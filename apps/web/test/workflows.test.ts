import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createAccount } from "@/app/api/accounts/route";
import { POST as createTxn } from "@/app/api/transactions/route";
import { GET as recurringList } from "@/app/api/recurring/route";
import { GET as ledger, POST as start } from "@/app/api/workflows/route";
import { GET as getWf, PATCH as patchWf } from "@/app/api/workflows/[id]/route";
import { POST as approve } from "@/app/api/workflows/[id]/approve/route";
import { POST as act } from "@/app/api/workflows/[id]/action/route";
import { POST as verify } from "@/app/api/workflows/[id]/verify/route";
import { POST as abandon } from "@/app/api/workflows/[id]/abandon/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { db } from "@/server/db";
import { addDays, todayIn } from "@/server/dates";
import { call, newUser } from "./helpers";

const today = todayIn("UTC");

/** Netflix charged monthly, last on day −50 (next expected ≈ day −20), with a price rise. */
async function userWithNetflix() {
  const u = await newUser(register);
  await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Checking", type: "CHECKING", balance: "3000.00" } });
  for (const [d, amt] of [[-140, "-15.49"], [-110, "-15.49"], [-80, "-15.49"], [-50, "-17.99"]] as const) {
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: addDays(today, d), amount: amt, merchant: "Netflix" } });
  }
  const rec = (await call(recurringList, "/api/recurring", { cookie: u.cookie, query: { refresh: "1" } })).json.items.find((r: { merchant: string }) => r.merchant === "Netflix");
  return { ...u, rec };
}
const post = (fn: typeof approve, cookie: string, id: string, body?: unknown) => call(fn, "/x", { cookie, method: "POST", params: { id }, body: body ?? {} });

describe("recurring-expense workflow: discover → verified outcome", () => {
  it("prepares a cancellation plan with evidence, calculation and a draft, then confirms from later transactions", async () => {
    const u = await userWithNetflix();
    const s = await call(start, "/x", { cookie: u.cookie, body: { recurringId: u.rec.id, kind: "cancel" } });
    expect(s.json.existing).toBe(false);
    // Starting again returns the same open workflow (no duplicates)
    expect((await call(start, "/x", { cookie: u.cookie, body: { recurringId: u.rec.id, kind: "cancel" } })).json).toMatchObject({ id: s.json.id, existing: true });

    let w = (await call(getWf, "/x", { cookie: u.cookie, params: { id: s.json.id } })).json.workflow;
    expect(w).toMatchObject({ stage: "prepared", kind: "cancel", merchant: "Netflix", baselineCents: 1799, estimatedAnnualCents: 1799 * 12 });
    expect(w.evidence.charges).toHaveLength(4);
    expect(w.calculation).toMatchObject({ yearlyCostCents: 1799 * 12, previousCents: 1549 });
    expect(w.draft).toMatch(/Please cancel my subscription/);
    expect(w.draft).toMatch(/\[YOUR NAME/); // placeholders, never invented details
    expect(w.checklist[0].label).toMatch(/cancellation fee/);

    // Checklist and a user-verified contact link
    await call(patchWf, "/x", { cookie: u.cookie, method: "PATCH", params: { id: w.id }, body: { checklist: [{ id: "terms", done: true }], contactUrl: "https://www.netflix.com/cancelplan" } });
    expect((await call(patchWf, "/x", { cookie: u.cookie, method: "PATCH", params: { id: w.id }, body: { contactUrl: "javascript:alert(1)" } })).status).toBe(422);

    expect((await post(approve, u.cookie, w.id)).json.workflow.stage).toBe("approved");
    expect((await post(approve, u.cookie, w.id)).status).toBe(409); // no double-approve
    expect((await post(act, u.cookie, w.id, { date: addDays(today, 1) })).status).toBe(400); // future date

    // Reported cancellation, but no data after the next billing date yet → pending, nothing realized
    w = (await post(act, u.cookie, w.id, { date: addDays(today, -45) })).json.workflow;
    expect(w.stage).toBe("action_taken");
    expect(w.verification.status).toBe("pending");
    expect(w.realizedCents).toBe(0);
    let l = (await call(ledger, "/x", { cookie: u.cookie })).json.totals;
    expect(l.initiated).toEqual({ count: 1, estimatedAnnualCents: 1799 * 12 });
    expect(l.realizedCents).toBe(0);

    // Newer transactions arrive (another merchant), with no Netflix charge → confirmed
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: addDays(today, -2), amount: "-42.10", merchant: "Safeway" } });
    w = (await post(verify, u.cookie, w.id)).json.workflow;
    expect(w.stage).toBe("confirmed");
    expect(w.realizedCents).toBe(1799);
    expect(w.confirmedAnnualCents).toBe(1799 * 12);
    expect(w.events.map((e: { stage: string }) => e.stage)).toEqual(["prepared", "approved", "action_taken", "confirmed"]);
    l = (await call(ledger, "/x", { cookie: u.cookie })).json.totals;
    expect(l.confirmed).toEqual({ count: 1, confirmedAnnualCents: 1799 * 12 });
    expect(l.initiated.count).toBe(0);
    expect(l.realizedCents).toBe(1799);
    // The charge is no longer expected
    expect((await db.recurringPayment.findUniqueOrThrow({ where: { id: u.rec.id } })).status).toBe("DISMISSED");
  });

  it("does not confirm when the merchant keeps charging", async () => {
    const u = await userWithNetflix();
    const id = (await call(start, "/x", { cookie: u.cookie, body: { recurringId: u.rec.id, kind: "cancel" } })).json.id;
    await post(act, u.cookie, id, { date: addDays(today, -45) });
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: addDays(today, -20), amount: "-17.99", merchant: "NETFLIX.COM" } });
    const w = (await post(verify, u.cookie, id)).json.workflow;
    expect(w.stage).toBe("not_confirmed");
    expect(w.verification.reason).toMatch(/Charged again/);
    expect((await call(ledger, "/x", { cookie: u.cookie })).json.totals).toMatchObject({ notConfirmed: { count: 1 }, realizedCents: 0 });
  });

  it("measures a negotiated price from the next charge", async () => {
    const u = await userWithNetflix();
    const id = (await call(start, "/x", { cookie: u.cookie, body: { recurringId: u.rec.id, kind: "negotiate" } })).json.id;
    let w = (await call(getWf, "/x", { cookie: u.cookie, params: { id } })).json.workflow;
    expect(w.estimatedAnnualCents).toBe(0); // unknown until a target is entered
    expect((await call(patchWf, "/x", { cookie: u.cookie, method: "PATCH", params: { id }, body: { targetCents: 2000 } })).status).toBe(400);
    w = (await call(patchWf, "/x", { cookie: u.cookie, method: "PATCH", params: { id }, body: { targetCents: 1299 } })).json.workflow;
    expect(w.estimatedAnnualCents).toBe(500 * 12);
    await post(act, u.cookie, id, { date: addDays(today, -45), newPriceCents: 1299 });
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: addDays(today, -20), amount: "-12.99", merchant: "Netflix" } });
    w = (await post(verify, u.cookie, id)).json.workflow;
    expect(w).toMatchObject({ stage: "confirmed", realizedCents: 500, confirmedAnnualCents: 6000 });
  });

  it("keeps workflows private and lets the user stop one", async () => {
    const u = await userWithNetflix();
    const other = await newUser(register);
    const id = (await call(start, "/x", { cookie: u.cookie, body: { recurringId: u.rec.id, kind: "cancel" } })).json.id;
    expect((await call(getWf, "/x", { cookie: other.cookie, params: { id } })).status).toBe(404);
    expect((await call(start, "/x", { cookie: other.cookie, body: { recurringId: u.rec.id, kind: "cancel" } })).status).toBe(404);
    expect((await post(abandon, other.cookie, id, { reason: "x" })).status).toBe(404);
    expect((await post(abandon, u.cookie, id, { reason: "Decided to keep it" })).json.workflow.stage).toBe("abandoned");
    // A new plan can be started after stopping
    expect((await call(start, "/x", { cookie: u.cookie, body: { recurringId: u.rec.id, kind: "negotiate" } })).json.existing).toBe(false);
  });

  it("the advisor builds a recurring savings plan with links to start", async () => {
    const u = await userWithNetflix();
    const m = (await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "Help me lower my recurring expenses" } })).json.message;
    expect(m.content).toMatch(/Netflix: \$17\.99 monthly \(\$215\.88\/yr\), up 16\.1%/);
    expect(m.content).toMatch(/you contact the provider/);
    expect(m.evidence.tools[0]).toMatchObject({ name: "get_recurring_savings_plan", link: { href: "/app/bills" } });
  });
});
