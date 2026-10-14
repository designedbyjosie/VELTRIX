import { describe, expect, it } from "vitest";
import { findAmounts, parseChangeRequests, parseTargetDate, splitClauses } from "@/server/ai/intents";

const ctx = {
  today: "2026-10-14",
  accounts: [
    { id: "chk", name: "Everyday Checking", type: "CHECKING", linkedToBank: false },
    { id: "sav", name: "Ally Savings", type: "SAVINGS", linkedToBank: false },
    { id: "cc", name: "Chase Sapphire", type: "CREDIT_CARD", linkedToBank: true },
  ],
  goals: [
    { id: "g1", name: "Emergency fund", kind: "EMERGENCY_FUND" },
    { id: "g2", name: "Japan trip", kind: "VACATION" },
  ],
};
const parse = (m: string) => parseChangeRequests(m, ctx);

describe("plain-language change requests", () => {
  it("reads amounts", () => {
    expect(findAmounts("$1,200.5 and 5k and 300 dollars").map((a) => a.value)).toEqual(["1200.50", "5000.00", "300.00"]);
  });

  it("splits several requests in one message", () => {
    expect(splitClauses("Set my food budget to $400 and hide investments from my dashboard. My checking balance is $2,500")).toHaveLength(3);
  });

  it("budget limits and removals", () => {
    expect(parse("Set my groceries budget to $400").changes).toEqual([{ action: "set_budget_limit", category: "food", limit: "400.00" }]);
    expect(parse("limit eating out to $150 a month").changes).toEqual([{ action: "set_budget_limit", category: "food", limit: "150.00" }]);
    expect(parse("my rent went up to $1,500").changes).toEqual([{ action: "set_budget_limit", category: "housing", limit: "1500.00" }]);
    expect(parse("remove travel from my budget").changes).toEqual([{ action: "remove_budget_category", category: "travel" }]);
  });

  it("income with frequency", () => {
    expect(parse("I make $4,000 a month").changes).toEqual([{ action: "set_monthly_income", amount: "4000.00" }]);
    expect(parse("my salary is $60,000 a year").changes).toEqual([{ action: "set_monthly_income", amount: "5000.00" }]);
    expect(parse("I get paid $1,500 every two weeks").changes).toEqual([{ action: "set_monthly_income", amount: "3250.00" }]);
  });

  it("account balances, refusing bank-linked ones", () => {
    expect(parse("my checking balance is $2,500").changes).toEqual([{ action: "update_account_balance", accountId: "chk", balance: "2500.00" }]);
    expect(parse("Ally is now at $10,250.75").changes).toEqual([{ action: "update_account_balance", accountId: "sav", balance: "10250.75" }]);
    const linked = parse("my credit card balance is $900");
    expect(linked.changes).toEqual([]);
    expect(linked.notes[0]).toMatch(/linked to your bank/);
    expect(parse("I have $300 in cash").changes).toEqual([{ action: "create_account", name: "Cash", type: "CASH", balance: "300.00" }]);
  });

  it("goals: create, update and contribute", () => {
    expect(parse("I want to save $5,000 for a car by June 2027").changes).toEqual([
      { action: "create_goal", name: "Car", goalType: "CAR", target: "5000.00", targetDate: "2027-06-30", plannedMonthly: null },
    ]);
    expect(parse("change my Japan trip goal to $8,000").changes).toEqual([{ action: "update_goal", goalId: "g2", target: "8000.00" }]);
    expect(parse("push my emergency fund goal to December 2027").changes).toEqual([{ action: "update_goal", goalId: "g1", targetDate: "2027-12-31" }]);
    expect(parse("put $200 into my emergency fund").changes).toEqual([{ action: "add_goal_contribution", goalId: "g1", amount: "200.00" }]);
  });

  it("spending and income transactions", () => {
    expect(parse("I spent $45.20 on groceries at Trader Joe's yesterday").changes).toEqual([
      { action: "add_transaction", date: "2026-10-13", amount: "-45.20", merchant: "Trader Joe's", category: "food", accountId: null },
    ]);
    expect(parse("I got paid $2,000 today").changes[0]).toMatchObject({ action: "add_transaction", amount: "2000.00", category: "income" });
  });

  it("dashboard layout", () => {
    expect(parse("hide investments from my dashboard").changes).toEqual([{ action: "set_dashboard_widget", widget: "performance", visible: false }]);
    expect(parse("move my goals to the top of my dashboard").changes).toEqual([{ action: "set_dashboard_widget", widget: "goals", visible: true, position: "top" }]);
    expect(parse("show the monthly plan on my home page").changes).toEqual([{ action: "set_dashboard_widget", widget: "plan", visible: true }]);
  });

  it("leaves questions alone", () => {
    expect(parse("Which categories are over budget?").changes).toEqual([]);
    expect(parse("Can I afford a $350 purchase?").changes).toEqual([]);
    expect(parse("Where did my money go this month?").changes).toEqual([]);
  });

  it("target dates", () => {
    expect(parseTargetDate("in 18 months", "2026-10-14")).toBe("2028-04-30");
    expect(parseTargetDate("by 2028", "2026-10-14")).toBe("2028-12-31");
  });
});
