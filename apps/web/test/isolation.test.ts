import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as listAccounts, POST as createAccount } from "@/app/api/accounts/route";
import { PATCH as patchAccount, DELETE as deleteAccount } from "@/app/api/accounts/[id]/route";
import { GET as listTxns, POST as createTxn } from "@/app/api/transactions/route";
import { GET as getTxn, PATCH as patchTxn, DELETE as deleteTxn } from "@/app/api/transactions/[id]/route";
import { GET as listGoals, POST as createGoal } from "@/app/api/goals/route";
import { POST as contribute } from "@/app/api/goals/[id]/contributions/route";
import { POST as createTrip } from "@/app/api/trips/route";
import { POST as addExpense } from "@/app/api/trips/[id]/expenses/route";
import { GET as listProducts, POST as saveProduct } from "@/app/api/products/route";
import { GET as getProduct, DELETE as deleteProduct } from "@/app/api/products/[id]/route";
import { GET as search } from "@/app/api/search/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { GET as getConversation } from "@/app/api/advisor/conversations/[id]/route";
import { GET as listCategories } from "@/app/api/categories/route";
import { db } from "@/server/db";
import { call, newUser } from "./helpers";

describe("cross-user data isolation", () => {
  it("never exposes or mutates another user's records", async () => {
    const a = await newUser(register, "Alice");
    const b = await newUser(register, "Bob");

    const acct = await call(createAccount, "/api/accounts", { cookie: a.cookie, body: { name: "Alice Checking", type: "CHECKING", balance: "1000.00" } });
    expect(acct.status).toBe(200);
    const accountId = acct.json.account.id;
    const txn = await call(createTxn, "/api/transactions", { cookie: a.cookie, body: { date: "2026-10-01", amount: "-42.00", merchant: "Alice Secret Store", accountId } });
    expect(txn.status).toBe(200);
    const txnId = txn.json.transaction.id;
    const goal = await call(createGoal, "/api/goals", { cookie: a.cookie, body: { name: "Alice goal", target: "500.00" } });
    const product = await call(saveProduct, "/api/products", { cookie: a.cookie, body: { title: "Alice headphones", merchant: "Shop", url: "https://shop.example.com/p/1", price: "100.00" } });
    const trip = await call(createTrip, "/api/trips", { cookie: a.cookie, body: { name: "Alice trip", destination: "Rome" } });
    const convo = await call(chat, "/api/advisor/chat", { cookie: a.cookie, body: { message: "What's my net worth?" } });
    expect(convo.status).toBe(200);

    // Reads
    expect((await call(getTxn, `/api/transactions/${txnId}`, { cookie: b.cookie, params: { id: txnId } })).status).toBe(404);
    expect((await call(getProduct, "/api/products/x", { cookie: b.cookie, params: { id: product.json.product.id } })).status).toBe(404);
    expect((await call(getConversation, "/api/advisor/conversations/x", { cookie: b.cookie, params: { id: convo.json.conversationId } })).status).toBe(404);
    expect((await call(listTxns, "/api/transactions", { cookie: b.cookie })).json.items).toHaveLength(0);
    expect((await call(listAccounts, "/api/accounts", { cookie: b.cookie })).json.accounts).toHaveLength(0);
    expect((await call(listGoals, "/api/goals", { cookie: b.cookie })).json.goals).toHaveLength(0);
    expect((await call(listProducts, "/api/products", { cookie: b.cookie })).json.products).toHaveLength(0);
    expect((await call(search, "/api/search", { cookie: b.cookie, query: { q: "Alice" } })).json.hits.filter((h: { type: string }) => h.type !== "instrument")).toHaveLength(0);

    // Writes
    expect((await call(patchTxn, "/api/transactions/x", { cookie: b.cookie, method: "PATCH", params: { id: txnId }, body: { merchant: "pwned" } })).status).toBe(404);
    expect((await call(deleteTxn, "/api/transactions/x", { cookie: b.cookie, method: "DELETE", params: { id: txnId } })).status).toBe(404);
    expect((await call(patchAccount, "/api/accounts/x", { cookie: b.cookie, method: "PATCH", params: { id: accountId }, body: { balance: "0.00" } })).status).toBe(404);
    expect((await call(deleteAccount, "/api/accounts/x", { cookie: b.cookie, method: "DELETE", params: { id: accountId } })).status).toBe(404);
    expect((await call(contribute, "/api/goals/x/contributions", { cookie: b.cookie, params: { id: goal.json.goal.id }, body: { amount: "10.00", date: "2026-10-01" } })).status).toBe(404);
    expect((await call(addExpense, "/api/trips/x/expenses", { cookie: b.cookie, params: { id: trip.json.trip.id }, body: { category: "FOOD", description: "x", amount: "1.00" } })).status).toBe(404);
    expect((await call(deleteProduct, "/api/products/x", { cookie: b.cookie, method: "DELETE", params: { id: product.json.product.id } })).status).toBe(404);

    // Bob can't attach his transaction to Alice's account either.
    expect((await call(createTxn, "/api/transactions", { cookie: b.cookie, body: { date: "2026-10-01", amount: "-1.00", merchant: "x", accountId } })).status).toBe(404);

    const t = await db.transaction.findUniqueOrThrow({ where: { id: txnId } });
    expect(t.merchant).toBe("Alice Secret Store");
    expect((await db.connectedAccount.findUniqueOrThrow({ where: { id: accountId } })).currentBalance.toString()).toBe("1000");
  });

  it("does not let a user use another user's custom category", async () => {
    const a = await newUser(register);
    const b = await newUser(register);
    const otherCat = await db.transactionCategory.create({ data: { userId: (await db.user.findUniqueOrThrow({ where: { email: a.email } })).id, slug: "secret", name: "Secret", kind: "EXPENSE", color: "#fff", icon: "x" } });
    const cats = await call(listCategories, "/api/categories", { cookie: b.cookie });
    expect(cats.json.categories.find((c: { id: string }) => c.id === otherCat.id)).toBeUndefined();
    const r = await call(createTxn, "/api/transactions", { cookie: b.cookie, body: { date: "2026-10-01", amount: "-1.00", merchant: "x", categoryId: otherCat.id } });
    expect(r.status).toBe(400);
  });
});
