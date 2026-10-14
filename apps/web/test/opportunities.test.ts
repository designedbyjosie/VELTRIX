import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createAccount } from "@/app/api/accounts/route";
import { POST as createTxn } from "@/app/api/transactions/route";
import { GET as listCategories } from "@/app/api/categories/route";
import { POST as createBudget } from "@/app/api/budgets/route";
import { GET as overview } from "@/app/api/opportunities/route";
import { POST as mute } from "@/app/api/opportunities/mute/route";
import { PATCH as patchInsight } from "@/app/api/insights/[id]/route";
import { POST as setup } from "@/app/api/setup/route";
import { POST as createTrip } from "@/app/api/trips/route";
import { POST as addExpense } from "@/app/api/trips/[id]/expenses/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { db } from "@/server/db";
import { addMonths } from "@/server/dates";
import { addDays, todayIn } from "@/server/dates";
import { call, newUser } from "./helpers";

const today = todayIn("UTC");

/** A user with a Netflix subscription that just went up, renewing soon, while Subscriptions is over budget and cash is thin. */
async function connectedUser() {
  const u = await newUser(register);
  await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Checking", type: "CHECKING", balance: "10.00" } });
  for (const [d, amt] of [[-110, "-15.49"], [-80, "-15.49"], [-50, "-15.49"], [-20, "-17.99"]] as const) {
    await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: addDays(today, d), amount: amt, merchant: "Netflix" } });
  }
  await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: today, amount: "-25.00", merchant: "Spotify Family" } });
  const cats = (await call(listCategories, "/api/categories", { cookie: u.cookie })).json.categories;
  const subs = cats.find((c: { slug: string }) => c.slug === "subscriptions");
  await call(createBudget, "/api/budgets", { cookie: u.cookie, body: { name: "Monthly", month: today.slice(0, 7), lines: [{ categoryId: subs.id, limit: "20" }] } });
  return u;
}

describe("opportunity graph", () => {
  it("connects related records and explains each opportunity", async () => {
    const u = await connectedUser();
    const r = await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } });
    expect(r.status).toBe(200);
    const byKind = Object.fromEntries(r.json.open.map((o: { kind: string }) => [o.kind, o]));

    // Netflix is one event, not three cards: the increase is folded into the renewal, and the
    // subscription review (Netflix only) is dropped.
    expect(Object.keys(byKind).sort()).toEqual(["budget", "commitments_vs_cash", "renewal_over_budget"]);
    const renewal = byKind.renewal_over_budget;
    expect(renewal.title).toMatch(/^Netflix renews .* while Subscriptions is over budget \(and just went up\)$/);
    expect(renewal.summary).toMatch(/went up recently: from \$15\.49 to \$17\.99/);
    expect(renewal.links.map((l: { type: string }) => l.type)).toEqual(["recurring", "budget"]);
    expect(renewal.confidence).toBe("medium");
    expect(renewal.confidenceBasis).toMatch(/Detected from 4 past charges/);
    expect(renewal.eventDate).toBe(addDays(today, 10));
    expect(renewal.scoreBasis.urgency).toBe(10);
    expect(renewal.estimateCents).toBe(1799); // the latest (increased) charge, not the old typical one


    expect(byKind.commitments_vs_cash.title).toMatch(/Upcoming bills leave -\$/);
    expect(byKind.budget).toBeTruthy();

    // Potential savings: Netflix at its latest price, counted once
    expect(r.json.potentialSavingsCents).toBe(1799 * 12);

    // Ranked by score, every item has a basis
    const scores = r.json.open.map((o: { score: number }) => o.score);
    expect([...scores].sort((a: number, b: number) => b - a)).toEqual(scores);
  });

  it("follows, dismisses with an outcome, mutes a kind, and learns only from dismissals", async () => {
    const u = await connectedUser();
    const first = (await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } })).json.open;
    const inc = first.find((o: { kind: string }) => o.kind === "renewal_over_budget");
    const budget = first.find((o: { kind: string }) => o.kind === "budget");

    await call(patchInsight, "/x", { cookie: u.cookie, method: "PATCH", params: { id: budget.id }, body: { status: "FOLLOWING" } });
    await call(patchInsight, "/x", { cookie: u.cookie, method: "PATCH", params: { id: inc.id }, body: { status: "DISMISSED", outcome: "not_relevant" } });
    let o = (await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } })).json;
    expect(o.open[0].id).toBe(budget.id); // followed first
    expect(o.open.find((x: { id: string }) => x.id === inc.id)).toBeUndefined(); // stays dismissed after refresh
    expect(o.history.find((x: { id: string }) => x.id === inc.id)).toMatchObject({ status: "DISMISSED", outcome: "not_relevant" });

    await call(mute, "/x", { cookie: u.cookie, body: { kind: "commitments_vs_cash", muted: true } });
    o = (await call(overview, "/x", { cookie: u.cookie })).json;
    expect(o.open.some((x: { kind: string }) => x.kind === "commitments_vs_cash")).toBe(false);
    expect(o.muted).toEqual([{ kind: "commitments_vs_cash", label: "Upcoming bills vs. cash" }]);
    expect((await call(mute, "/x", { cookie: u.cookie, body: { kind: "made_up", muted: true } })).status).toBe(404);

    // A dismissal lowers future scores for that kind only
    const userId = (await db.user.findUniqueOrThrow({ where: { email: u.email } })).id;
    const dismissedKind = await db.financialInsight.findFirstOrThrow({ where: { userId, kind: "renewal_over_budget" } });
    expect((dismissedKind.scoreBasis as { feedbackFactor: number }).feedbackFactor).toBe(0.75);
    const otherKind = await db.financialInsight.findFirstOrThrow({ where: { userId, kind: "budget" } });
    expect((otherKind.scoreBasis as { feedbackFactor: number }).feedbackFactor).toBe(1);
  });

  it("resolves opportunities whose condition no longer holds, and keeps them private", async () => {
    const u = await connectedUser();
    const other = await newUser(register);
    const open = (await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } })).json.open;
    const commit = open.find((o: { kind: string }) => o.kind === "commitments_vs_cash");
    expect((await call(patchInsight, "/x", { cookie: other.cookie, method: "PATCH", params: { id: commit.id }, body: { status: "DONE" } })).status).toBe(404);

    const userId = (await db.user.findUniqueOrThrow({ where: { email: u.email } })).id;
    await db.connectedAccount.updateMany({ where: { userId }, data: { currentBalance: "5000" } });
    const after = (await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } })).json;
    expect(after.open.some((o: { kind: string }) => o.kind === "commitments_vs_cash")).toBe(false);
    expect(after.history.find((h: { id: string }) => h.id === commit.id)?.status).toBe("RESOLVED");
  });

  it("connects an upcoming trip to the goal it would delay, using the plan engine", async () => {
    const u = await newUser(register);
    await call(setup, "/api/setup", {
      cookie: u.cookie,
      body: {
        path: "manual",
        accounts: [{ name: "Checking", type: "CHECKING", balance: "8000" }],
        monthlyIncome: "4000",
        budget: [{ category: "housing", limit: "2000" }, { category: "food", limit: "800" }],
        goal: { name: "House deposit", kind: "HOME", target: "6000", targetDate: null, plannedMonthly: "1000" },
      },
    });
    const start = `${addMonths(today.slice(0, 7), 2)}-15`;
    const trip = (await call(createTrip, "/api/trips", { cookie: u.cookie, body: { name: "Lisbon", destination: "Lisbon, Portugal", startDate: start } })).json.trip;
    await call(addExpense, "/x", { cookie: u.cookie, params: { id: trip.id }, body: { category: "FLIGHT", description: "Flights", amount: "1800", isQuote: true } });
    const o = (await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } })).json.open;
    const t = o.find((x: { kind: string }) => x.kind === "trip_vs_goal");
    expect(t.title).toBe('Lisbon would push "House deposit" back 1 month'); // trip month's $1,200 surplus is used up once
    expect(t.links.map((l: { type: string; name: string }) => `${l.type}:${l.name}`)).toEqual(["trip:Lisbon", "goal:House deposit"]);
    expect(t.eventDate).toBe(start);
  });

  it("shows a price increase on its own when there's no renewal card to fold it into", async () => {
    const u = await newUser(register);
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Checking", type: "CHECKING", balance: "3000.00" } });
    for (const [d, amt] of [[-110, "-15.49"], [-80, "-15.49"], [-50, "-15.49"], [-20, "-17.99"]] as const) {
      await call(createTxn, "/api/transactions", { cookie: u.cookie, body: { date: addDays(today, d), amount: amt, merchant: "Netflix" } });
    }
    const open = (await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } })).json.open;
    const inc = open.find((o: { kind: string }) => o.kind === "bill_increase");
    expect(inc).toMatchObject({ title: "Netflix went up 16.1%", estimateCents: 250 * 12, estimateType: "CONFIRMED", confidence: "high" });
    expect(open.some((o: { kind: string }) => o.kind === "subscriptions")).toBe(true);
  });

  it("the advisor lists opportunities and links to them", async () => {
    const u = await connectedUser();
    await call(overview, "/x", { cookie: u.cookie, query: { refresh: "1" } });
    const m = (await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "What should I look at this week?" } })).json.message;
    expect(m.content).toMatch(/Netflix renews/);
    expect(m.evidence.tools[0]).toMatchObject({ name: "get_insights", link: { href: "/app/opportunities" } });
  });
});
