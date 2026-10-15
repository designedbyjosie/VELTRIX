import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createTxn } from "@/app/api/transactions/route";
import { DELETE as removeDemo } from "@/app/api/settings/demo/route";
import { db } from "@/server/db";
import { loadDemoData } from "@/server/services/demo";
import { todayIn } from "@/server/dates";
import { call, newUser } from "./helpers";

describe("test-account sample data", () => {
  it("is tagged as demo, can be reloaded, and removal leaves real records alone", async () => {
    const u = await newUser(register);
    const userId = (await db.user.findUniqueOrThrow({ where: { email: u.email.toLowerCase() } })).id;
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: todayIn("UTC"), amount: "-12.00", merchant: "Real Coffee" } });

    const first = await loadDemoData(userId);
    expect(first.transactions).toBeGreaterThan(100);
    await loadDemoData(userId); // reloading replaces, never duplicates
    expect(await db.transaction.count({ where: { userId, source: "DEMO" } })).toBe(first.transactions);
    expect((await db.userProfile.findUniqueOrThrow({ where: { userId } })).hasDemoData).toBe(true);
    expect(await db.connectedAccount.count({ where: { userId, source: { not: "DEMO" } } })).toBe(0);
    // Price increase is present for the bills features
    expect(await db.transaction.count({ where: { userId, merchant: "NETFLIX.COM", amount: -17.99 } })).toBeGreaterThan(0);

    expect((await call(removeDemo, "/x", { cookie: u.cookie, method: "DELETE" })).status).toBe(200);
    expect(await db.transaction.count({ where: { userId, source: "DEMO" } })).toBe(0);
    expect(await db.transaction.count({ where: { userId } })).toBe(1);
    expect((await db.userProfile.findUniqueOrThrow({ where: { userId } })).hasDemoData).toBe(false);
  });
});
