import { afterEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as linkToken } from "@/app/api/banks/link-token/route";
import { POST as exchange } from "@/app/api/banks/exchange/route";
import { GET as listBanks } from "@/app/api/banks/route";
import { POST as syncBank } from "@/app/api/banks/[id]/sync/route";
import { DELETE as removeBank } from "@/app/api/banks/[id]/route";
import { GET as listTxns } from "@/app/api/transactions/route";
import { GET as listAccounts } from "@/app/api/accounts/route";
import { setPlaidFetch } from "@/server/providers/plaid";
import { mapAccountType, mapCategory } from "@/server/services/banking";
import { db } from "@/server/db";
import { call, newUser } from "./helpers";

afterEach(() => setPlaidFetch(null));

const txn = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  transaction_id: id,
  account_id: "acc-checking",
  amount,
  iso_currency_code: "USD",
  unofficial_currency_code: null,
  date: "2026-10-10",
  name: "WHOLEFDS MKT #123",
  merchant_name: "Whole Foods",
  pending: false,
  personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_GROCERIES" },
  ...extra,
});

/** Fake Plaid: one item, two accounts, paginated sync, then a modification and a removal. */
let itemSeq = 0;
function fakePlaid() {
  const itemId = `item-${Date.now()}-${itemSeq++}`;
  const state = { syncCalls: 0, requests: [] as { path: string; body: Record<string, unknown>; headers: Record<string, string> }[], loginRequired: false };
  const fn = (async (input: string | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = JSON.parse(String(init?.body ?? "{}"));
    state.requests.push({ path, body, headers: init?.headers as Record<string, string> });
    const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (state.loginRequired && path !== "/link/token/create") return new Response(JSON.stringify({ error_code: "ITEM_LOGIN_REQUIRED", error_message: "login required", display_message: null }), { status: 400 });
    switch (path) {
      case "/link/token/create":
        return ok({ link_token: "link-sandbox-123", expiration: "2026-10-14T20:00:00Z" });
      case "/item/public_token/exchange":
        return body.public_token === "public-sandbox-good" ? ok({ access_token: "access-sandbox-secret", item_id: itemId }) : new Response(JSON.stringify({ error_code: "INVALID_PUBLIC_TOKEN", error_message: "bad", display_message: null }), { status: 400 });
      case "/accounts/get":
        return ok({
          item: { institution_id: "ins_1" },
          accounts: [
            { account_id: "acc-checking", name: "Plaid Checking", official_name: "Plaid Gold Checking", mask: "0000", type: "depository", subtype: "checking", balances: { current: 1250.55, available: 1200, iso_currency_code: "USD", unofficial_currency_code: null } },
            { account_id: "acc-card", name: "Plaid Credit Card", official_name: null, mask: "3333", type: "credit", subtype: "credit card", balances: { current: 410.2, available: null, iso_currency_code: "USD", unofficial_currency_code: null } },
          ],
        });
      case "/transactions/sync": {
        state.syncCalls++;
        if (!body.cursor) return ok({ added: [txn("t1", 84.5), txn("t2", -3200, { name: "ACME PAYROLL", merchant_name: null, personal_finance_category: { primary: "INCOME", detailed: "INCOME_WAGES" } })], modified: [], removed: [], next_cursor: "c1", has_more: true });
        if (body.cursor === "c1") return ok({ added: [txn("t3", 15.49, { name: "NETFLIX.COM", merchant_name: "Netflix", personal_finance_category: { primary: "ENTERTAINMENT", detailed: "ENTERTAINMENT_TV_AND_MOVIES" } }), txn("t4", 9.99, { pending: true })], modified: [], removed: [], next_cursor: "c2", has_more: false });
        return ok({ added: [], modified: [txn("t1", 90)], removed: [{ transaction_id: "t3" }], next_cursor: "c3", has_more: false });
      }
      case "/item/remove":
        return ok({ request_id: "r" });
      default:
        return new Response("{}", { status: 404 });
    }
  }) as typeof fetch;
  return { fn, state, itemId };
}

describe("Plaid mapping", () => {
  it("maps account types and categories", () => {
    expect(mapAccountType("depository", "savings")).toBe("SAVINGS");
    expect(mapAccountType("credit", "credit card")).toBe("CREDIT_CARD");
    expect(mapAccountType("loan", "mortgage")).toBe("MORTGAGE");
    expect(mapAccountType("investment", "401k")).toBe("RETIREMENT");
    expect(mapAccountType("investment", "brokerage")).toBe("INVESTMENT");
    expect(mapCategory({ amount: 1800, name: "RENT", merchant_name: null, personal_finance_category: { primary: "RENT_AND_UTILITIES", detailed: "RENT_AND_UTILITIES_RENT" } })).toBe("housing");
    expect(mapCategory({ amount: 15.49, name: "NETFLIX.COM", merchant_name: "Netflix", personal_finance_category: { primary: "ENTERTAINMENT", detailed: "x" } })).toBe("subscriptions");
    expect(mapCategory({ amount: 500, name: "PAYMENT THANK YOU", merchant_name: null, personal_finance_category: { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" } })).toBe("transfer");
  });
});

describe("bank connections", () => {
  it("links a bank, imports accounts and posted transactions, syncs changes idempotently, and removes cleanly", async () => {
    const { fn, state, itemId } = fakePlaid();
    setPlaidFetch(fn);
    const u = await newUser(register);

    const lt = await call(linkToken, "/api/banks/link-token", { cookie: u.cookie, body: {} });
    expect(lt.json.link_token).toBe("link-sandbox-123");
    expect(state.requests[0].headers["PLAID-SECRET"]).toBe("test-secret");
    expect(JSON.stringify(state.requests[0].body)).not.toContain("test-secret");

    expect((await call(exchange, "/api/banks/exchange", { cookie: u.cookie, body: { publicToken: "public-sandbox-bad", institution: { id: "ins_1", name: "Plaid Bank" } } })).status).toBe(400);
    const ex = await call(exchange, "/api/banks/exchange", { cookie: u.cookie, body: { publicToken: "public-sandbox-good", institution: { id: "ins_1", name: "Plaid Bank" } } });
    expect(ex.status).toBe(200);
    expect(ex.json.result).toMatchObject({ accounts: 2, added: 3 });

    const item = await db.plaidItem.findUniqueOrThrow({ where: { itemId } });
    expect(item.accessTokenEnc).not.toContain("access-sandbox-secret");
    expect(item.cursor).toBe("c2");

    const accounts = (await call(listAccounts, "/api/accounts", { cookie: u.cookie })).json.accounts;
    expect(accounts.map((a: { type: string; balanceCents: number; source: string }) => [a.type, a.balanceCents, a.source]).sort((a: string[], b: string[]) => a[0].localeCompare(b[0]))).toEqual([
      ["CHECKING", 125055, "AGGREGATOR"],
      ["CREDIT_CARD", 41020, "AGGREGATOR"],
    ]);

    let txns = (await call(listTxns, "/api/transactions", { cookie: u.cookie })).json.items;
    expect(txns.map((t: { amountCents: number; category: { slug: string } }) => [t.amountCents, t.category.slug]).sort((a: [number], b: [number]) => a[0] - b[0])).toEqual([
      [-8450, "food"],
      [-1549, "subscriptions"],
      [320000, "income"],
    ]); // pending t4 skipped; outflows negative

    const sync = await call(syncBank, "/api/banks/x/sync", { cookie: u.cookie, params: { id: item.id }, body: {} });
    expect(sync.json).toMatchObject({ added: 0, modified: 1, removed: 1 });
    txns = (await call(listTxns, "/api/transactions", { cookie: u.cookie })).json.items;
    expect(txns.map((t: { amountCents: number }) => t.amountCents).sort((a: number, b: number) => a - b)).toEqual([-9000, 320000]);

    // Another user can't touch this connection.
    const other = await newUser(register);
    expect((await call(syncBank, "/api/banks/x/sync", { cookie: other.cookie, params: { id: item.id }, body: {} })).status).toBe(404);
    expect((await call(removeBank, "/api/banks/x", { cookie: other.cookie, method: "DELETE", params: { id: item.id } })).status).toBe(404);
    expect((await call(listBanks, "/api/banks", { cookie: other.cookie })).json.items).toHaveLength(0);

    expect((await call(removeBank, "/api/banks/x", { cookie: u.cookie, method: "DELETE", params: { id: item.id } })).status).toBe(200);
    expect(state.requests.some((r) => r.path === "/item/remove")).toBe(true);
    expect((await call(listAccounts, "/api/accounts", { cookie: u.cookie })).json.accounts).toHaveLength(0);
    expect((await call(listTxns, "/api/transactions", { cookie: u.cookie })).json.total).toBe(0);
  });

  it("marks a connection as needing reconnection when the bank requires a new login", async () => {
    const { fn, state } = fakePlaid();
    setPlaidFetch(fn);
    const u = await newUser(register);
    await call(exchange, "/api/banks/exchange", { cookie: u.cookie, body: { publicToken: "public-sandbox-good", institution: { id: null, name: "Plaid Bank" } } });
    const item = await db.plaidItem.findFirstOrThrow({ where: { user: { email: u.email } } });
    state.loginRequired = true;
    const r = await call(syncBank, "/api/banks/x/sync", { cookie: u.cookie, params: { id: item.id }, body: {} });
    expect(r.status).toBe(502);
    expect(r.json.error.message).toMatch(/sign in again/);
    const banks = (await call(listBanks, "/api/banks", { cookie: u.cookie })).json;
    expect(banks.items[0].status).toBe("login_required");
    const relink = await call(linkToken, "/api/banks/link-token", { cookie: u.cookie, body: { itemId: item.id } });
    expect(relink.status).toBe(200);
    expect(state.requests.at(-1)!.body.access_token).toBe("access-sandbox-secret"); // update mode
  });
});
