/**
 * Understands plain-language requests to change the user's data ("set my food budget
 * to $400", "my checking balance is $2,500", "hide investments from my dashboard").
 * Used by the built-in advisor when no language model is configured. Pure: it only
 * turns text into proposed changes, which the user must still apply.
 */
import type { AdvisorChange, DashboardWidget, budgetCategorySlugs } from "@veltrix/shared";

type BudgetSlug = (typeof budgetCategorySlugs)[number];
import { addMonths, addDays, daysInMonth } from "../dates";

export interface IntentContext {
  today: string; // YYYY-MM-DD in the user's timezone
  accounts: { id: string; name: string; type: string; linkedToBank: boolean }[];
  goals: { id: string; name: string; kind: string }[];
}

export interface IntentResult {
  changes: AdvisorChange[];
  notes: string[];
}

const CATEGORY_WORDS: [BudgetSlug, RegExp][] = [
  ["housing", /\b(rent|housing|mortgage payments?|home costs?)\b/],
  ["utilities", /\b(utilit(y|ies)|bills?|electric(ity)?|internet|phone|water bill|gas bill)\b/],
  ["food", /\b(food|groceries|grocery|dining|eating out|restaurants?|takeout|take-out|coffee|meals?)\b/],
  ["transport", /\b(transport(ation)?|gas|fuel|car costs?|uber|lyft|transit|commut\w*|parking)\b/],
  ["health", /\b(health|medical|doctors?|pharmacy|gym|fitness|dental)\b/],
  ["subscriptions", /\b(subscriptions?|streaming|netflix|spotify)\b/],
  ["entertainment", /\b(entertainment|fun|going out|movies|games|concerts?|hobbies)\b/],
  ["shopping", /\b(shopping|clothes|clothing|amazon)\b/],
  ["travel", /\b(travel|vacations?|trips?|flights?|hotels?)\b/],
  ["other", /\b(other|misc(ellaneous)?)\b/],
];

const WIDGET_WORDS: [DashboardWidget, RegExp][] = [
  ["plan", /\b(monthly plan|plan|cash ?flow|income card|left ?over)\b/],
  ["recommendations", /\b(recommendations?|insights?|tips|suggestions)\b/],
  ["performance", /\b(investments?|portfolio|performance|stocks?)\b/],
  ["spending", /\b(spending( breakdown| chart)?|where my money goes)\b/],
  ["budget", /\b(budgets?( progress)?)\b/],
  ["goals", /\b(goals?)\b/],
  ["metrics", /\b(summary( cards)?|metrics|totals|net worth|top cards)\b/],
];

const ACCOUNT_TYPE_WORDS: [string, RegExp][] = [
  ["CREDIT_CARD", /\b(credit ?card|card)\b/],
  ["CHECKING", /\b(checking|current account|debit)\b/],
  ["SAVINGS", /\b(savings|high[- ]yield)\b/],
  ["RETIREMENT", /\b(401k|401\(k\)|ira|roth|retirement|pension)\b/],
  ["INVESTMENT", /\b(brokerage|investment account|investments)\b/],
  ["MORTGAGE", /\b(mortgage)\b/],
  ["LOAN", /\b(loan|student loans?|car loan)\b/],
  ["CASH", /\b(cash|wallet)\b/],
];

const GOAL_KIND_WORDS: [string, RegExp][] = [
  ["EMERGENCY_FUND", /\b(emergency|rainy day|safety net)\b/],
  ["VACATION", /\b(vacation|trip|holiday|travel)\b/],
  ["CAR", /\b(car|vehicle|truck)\b/],
  ["HOME", /\b(house|home|down ?payment|apartment)\b/],
  ["DEBT", /\b(debt|pay off|loan|credit card)\b/],
  ["RETIREMENT", /\b(retire(ment)?)\b/],
  ["EDUCATION", /\b(school|college|tuition|education|degree)\b/],
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const AMOUNT = /(-)?\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(k\b)?|\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(k\b|dollars|bucks|usd)/gi;

interface Amount {
  value: string;
  index: number;
  end: number;
}

/** Dollar amounts in the text ("$1,200", "$45.50", "5k", "300 dollars"), as decimal strings. */
export function findAmounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const whole = (m[2] ?? m[5]).replace(/,/g, "");
    const frac = m[3] ?? m[6] ?? "";
    const k = (m[4] ?? m[7] ?? "").toLowerCase() === "k";
    let n = Number(`${whole}.${frac || "0"}`) * (k ? 1000 : 1);
    if (m[1]) n = -n;
    out.push({ value: n.toFixed(2), index: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

function firstMatch<T extends string>(text: string, table: [T, RegExp][]): T | null {
  let best: { key: T; at: number } | null = null;
  for (const [key, re] of table) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.at)) best = { key, at: m.index };
  }
  return best?.key ?? null;
}

const lastDay = (ym: string) => `${ym}-${String(daysInMonth(ym)).padStart(2, "0")}`;

/** A target date phrase: "by June 2027", "by 2028", "in 18 months", "in 2 years", "by 2027-06-30". */
export function parseTargetDate(text: string, today: string): string | null {
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const my = text.match(/\b(?:by|before|until|in|to)\s+(?:the end of\s+)?([a-z]{3,9})\.?\s+(\d{4})\b/);
  if (my) {
    const mi = MONTHS.indexOf(my[1].slice(0, 3));
    if (mi >= 0) return lastDay(`${my[2]}-${String(mi + 1).padStart(2, "0")}`);
  }
  const y = text.match(/\b(?:by|before|until)\s+(?:the end of\s+)?(20\d{2})\b/);
  if (y) return `${y[1]}-12-31`;
  const rel = text.match(/\bin\s+(\d{1,3}|a|one|two|three|six)\s+(months?|years?)\b/);
  if (rel) {
    const words: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, six: 6 };
    const n = words[rel[1]] ?? Number(rel[1]);
    const months = rel[2].startsWith("year") ? n * 12 : n;
    return lastDay(addMonths(today.slice(0, 7), months));
  }
  return null;
}

/** A transaction date: today (default), yesterday, "on Oct 3", "on 2026-10-03", "N days ago". */
function parseTxnDate(text: string, today: string): string {
  if (/\byesterday\b/.test(text)) return addDays(today, -1);
  const ago = text.match(/\b(\d{1,2}|two|three) days ago\b/);
  if (ago) return addDays(today, -({ two: 2, three: 3 }[ago[1]] ?? Number(ago[1])));
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso && iso[1] <= today) return iso[1];
  const md = text.match(/\bon\s+([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (md) {
    const mi = MONTHS.indexOf(md[1].slice(0, 3));
    if (mi >= 0) {
      let year = Number(today.slice(0, 4));
      const candidate = (y: number) => `${y}-${String(mi + 1).padStart(2, "0")}-${md[2].padStart(2, "0")}`;
      if (candidate(year) > today) year -= 1;
      return candidate(year);
    }
  }
  return today;
}

/** Convert an income amount to a monthly figure from the stated frequency. */
function toMonthly(amount: string, text: string): string {
  const n = Number(amount);
  if (/\b(a|per|each|every|\/)\s?(year|yr)\b|\b(annual(ly)?|yearly|salary of)\b/.test(text) && !/\b(a|per|each|every)\s?month\b/.test(text)) return (n / 12).toFixed(2);
  if (/\b(bi-?weekly|every (two|2|other) weeks?)\b/.test(text)) return ((n * 26) / 12).toFixed(2);
  if (/\b(a|per|each|every)\s?week\b|\bweekly\b/.test(text)) return ((n * 52) / 12).toFixed(2);
  if (/\b(twice a month|semi-?monthly)\b/.test(text)) return (n * 2).toFixed(2);
  return n.toFixed(2);
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["the", "and", "for", "account", "card", "goal", "fund", "my"].includes(w));

/** The user's account named or described in the text (unique match only). */
function findAccount(text: string, ctx: IntentContext) {
  const byName = ctx.accounts.filter((a) => words(a.name).some((w) => new RegExp(`\\b${w}\\b`).test(text)));
  if (byName.length === 1) return byName[0];
  const type = firstMatch(text, ACCOUNT_TYPE_WORDS);
  if (!type) return byName.length > 1 ? "ambiguous" : null;
  const byType = (byName.length ? byName : ctx.accounts).filter((a) => a.type === type);
  return byType.length === 1 ? byType[0] : byType.length > 1 ? "ambiguous" : null;
}

function findGoal(text: string, ctx: IntentContext) {
  const byName = ctx.goals.filter((g) => words(g.name).some((w) => new RegExp(`\\b${w}\\b`).test(text)));
  if (byName.length === 1) return byName[0];
  const kind = firstMatch(text, GOAL_KIND_WORDS);
  const byKind = kind ? ctx.goals.filter((g) => g.kind === kind) : [];
  if (byKind.length === 1) return byKind[0];
  return byName.length > 1 || byKind.length > 1 ? "ambiguous" : null;
}

const CHANGE_VERBS = "set|change|make|update|raise|lower|increase|decrease|cut|reduce|bump|my|i|i'm|im|hide|show|remove|delete|add|move|put|create|start|budget|record|log";

export function splitClauses(message: string): string[] {
  return message
    .split(/[\n;!?]+|\.(?=\s|$)/)
    .flatMap((s) => s.split(new RegExp(`,?\\s+(?:and|also|then|plus)\\s+(?=(?:${CHANGE_VERBS})\\b)`, "i")))
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseClause(original: string, ctx: IntentContext, notes: string[]): AdvisorChange | null {
  const c = original.toLowerCase();
  const amounts = findAmounts(original);
  const amount = amounts[0]?.value;
  const isQuestion = /^(what|how|which|where|why|when|can|could|should|would|is|are|do|does)\b/.test(c) && !/\b(set|change|update|add|hide|show|remove|make)\b/.test(c);
  if (isQuestion) return null;

  // Dashboard layout
  const dashVerb = c.match(/\b(hide|remove|get rid of|take off|turn off|show|bring back|display|turn on|move|put|pin|add)\b/);
  if (dashVerb && !amount && (/\b(dashboard|home ?page|home screen|home)\b/.test(c) || /^(hide|show)\b/.test(c))) {
    const widget = firstMatch(c, WIDGET_WORDS);
    if (widget) {
      const hide = /\b(hide|remove|get rid of|take off|turn off)\b/.test(dashVerb[1]);
      const position = /\b(top|first|up front)\b/.test(c) ? ("top" as const) : /\b(bottom|last|end)\b/.test(c) ? ("bottom" as const) : undefined;
      return { action: "set_dashboard_widget", widget, visible: !hide, ...(position && !hide ? { position } : {}) };
    }
  }

  // Budget: remove a category, or set its limit
  const category = firstMatch(c, CATEGORY_WORDS);
  if (/\bbudget/.test(c) && category && /\b(remove|delete|drop|stop budgeting|take .* out|get rid of)\b/.test(c) && !amount) {
    return { action: "remove_budget_category", category };
  }
  // A fixed bill changing ("my rent went up to $1,500") updates that budget line too.
  const billChanged = (category === "housing" || category === "utilities" || category === "subscriptions") && /\b(is|went|goes|go|increased|decreased|rose|dropped|costs?|now)\b/.test(c);
  if (category && amount && Number(amount) > 0 && (/\bbudget/.test(c) || /\b(limit|cap)\b/.test(c) || /\bspend (only |no more than |at most |up to )?\$/.test(c) || billChanged) && !/\b(spent|paid|bought)\b/.test(c)) {
    return { action: "set_budget_limit", category, limit: amount };
  }

  // Income
  if (amount && /\b(i (now )?(make|earn|take home|bring home|get paid)|(my )?(monthly |annual |yearly )?(income|salary|take[- ]?home( pay)?|paycheck|pay)\b.*\b(is|was|went|now|to|of|at)\b|set (my )?(income|salary)|got a raise)\b/.test(c) && !/\b(goal|budget|spent)\b/.test(c)) {
    return { action: "set_monthly_income", amount: toMonthly(amount, c) };
  }

  // Goal contribution: "put $200 into my vacation fund"
  const contrib = c.match(/\b(put|add(ed)?|mov(e|ed)|deposit(ed)?|sav(e|ed)|contribut(e|ed)|transfer(red)?|withdr(ew|aw)|took|take)\b.*\b(in|into|to|towards?|for|from|out of)\b/);
  if (amount && contrib && (/\b(goal|fund)\b/.test(c) || findGoal(c, ctx)) && !/\b(want|plan|need|goal of|new goal|create|start)\b.*\bsave\b|\bby\b/.test(c)) {
    const goal = findGoal(c, ctx);
    if (goal && goal !== "ambiguous") {
      const out = /\b(withdr(ew|aw)|took|take|out of)\b/.test(c);
      return { action: "add_goal_contribution", goalId: goal.id, amount: (Number(amount) * (out ? -1 : 1)).toFixed(2) };
    }
    if (goal === "ambiguous") notes.push(`More than one goal matches "${original}". Use the goal's exact name.`);
    else if (/\b(goal|fund)\b/.test(c)) notes.push(`I couldn't find the goal in "${original}". Your goals: ${ctx.goals.map((g) => g.name).join(", ") || "none yet"}.`);
    if (goal === "ambiguous" || /\b(goal|fund)\b/.test(c)) return null;
  }

  // Update an existing goal: "change my car goal to $8,000", "push my vacation goal to June 2027"
  const goalRef = /\bgoal\b/.test(c) ? findGoal(c, ctx) : null;
  if (goalRef && goalRef !== "ambiguous" && /\b(change|update|raise|lower|increase|decrease|set|move|push|extend|make)\b/.test(c)) {
    const date = parseTargetDate(c, ctx.today);
    const monthly = amounts.find((a) => /^\s*(a|per|each|every|\/)\s?month/.test(c.slice(a.end)));
    const target = amounts.find((a) => a !== monthly);
    if (target || date || monthly) {
      return { action: "update_goal", goalId: goalRef.id, ...(target ? { target: target.value } : {}), ...(date ? { targetDate: date } : {}), ...(monthly ? { plannedMonthly: monthly.value } : {}) };
    }
  }

  // New goal: "I want to save $5,000 for a car by June 2027"
  if (amount && /\b(save|saving|goal|set aside|put aside)\b/.test(c) && /\b(for|towards?|goal)\b/.test(c)) {
    const forWhat = c.match(/\b(?:for|towards?)\s+(?:a |an |my |the |our |new )*([a-z][a-z' -]{1,40}?)(?=\s+(?:by|before|until|in|within|and|saving|with|at|of)\b|[,.]|$)/);
    const name = forWhat ? titleCase(forWhat[1].trim()) : null;
    const goalType = (firstMatch(c, GOAL_KIND_WORDS) ?? "OTHER") as "OTHER";
    const monthly = amounts.find((a) => /^\s*(a|per|each|every|\/)\s?month/.test(c.slice(a.end)));
    const target = amounts.find((a) => a !== monthly);
    if (target && Number(target.value) > 0 && (name || goalType !== "OTHER")) {
      const goalName = name ?? titleCase(goalType.toLowerCase().replace("_", " "));
      const existing = findGoal(goalName.toLowerCase(), ctx);
      if (existing && existing !== "ambiguous" && existing.name.toLowerCase() === goalName.toLowerCase()) {
        return { action: "update_goal", goalId: existing.id, target: target.value };
      }
      return { action: "create_goal", name: goalName, goalType, target: target.value, targetDate: parseTargetDate(c, ctx.today), plannedMonthly: monthly?.value ?? null };
    }
  }

  // Spending or income transaction: "I spent $45 on groceries at Trader Joe's yesterday"
  if (amount && /\b(spent|paid|bought|purchased|got paid|received|earned)\b/.test(c) && !/\b(a|per|each|every)\s?(month|year|week)\b/.test(c)) {
    const isIncome = /\b(got paid|received|earned)\b/.test(c);
    const at = original.match(/\bat\s+([A-Za-z0-9][\w'&.-]*(?:\s+[A-Z0-9][\w'&.-]*)*)/);
    const cat = isIncome ? "income" : category;
    const merchant = at?.[1] ?? (isIncome ? "Income" : cat ? titleCase(CATEGORY_WORDS.find(([k]) => k === cat)![1].exec(c)![0]) : "Purchase");
    const account = findAccount(c.replace(/\bon (groceries|food|gas)\b/, ""), ctx);
    return {
      action: "add_transaction",
      date: parseTxnDate(c, ctx.today),
      amount: (Math.abs(Number(amount)) * (isIncome ? 1 : -1)).toFixed(2),
      merchant: merchant.slice(0, 140),
      category: cat,
      accountId: account && account !== "ambiguous" ? account.id : null,
    };
  }

  // Account balance: "my checking balance is $2,500", "I have $300 in cash"
  if (amount && /\b(balance|have|has|is at|is now|owe|is|are)\b/.test(c)) {
    const account = findAccount(c, ctx);
    if (account === "ambiguous") {
      notes.push(`More than one account matches "${original}". Use the account's exact name.`);
      return null;
    }
    if (account) {
      if (account.linkedToBank) {
        notes.push(`${account.name} is linked to your bank, so its balance updates automatically.`);
        return null;
      }
      return { action: "update_account_balance", accountId: account.id, balance: amount };
    }
    const type = firstMatch(c, ACCOUNT_TYPE_WORDS);
    if (type && /\b(i have|i've got|there's|add|new|open(ed)?)\b/.test(c)) {
      const named = original.match(/\b(?:called|named)\s+["“]?([^"”,.]{1,60})/i);
      const label: Record<string, string> = { CREDIT_CARD: "Credit card", CHECKING: "Checking", SAVINGS: "Savings", RETIREMENT: "Retirement", INVESTMENT: "Investments", MORTGAGE: "Mortgage", LOAN: "Loan", CASH: "Cash" };
      return { action: "create_account", name: named?.[1].trim() ?? label[type], type: type as "CASH", balance: Math.abs(Number(amount)).toFixed(2) };
    }
  }
  return null;
}

export function parseChangeRequests(message: string, ctx: IntentContext): IntentResult {
  const notes: string[] = [];
  const changes: AdvisorChange[] = [];
  for (const clause of splitClauses(message)) {
    const change = parseClause(clause, ctx, notes);
    if (change) changes.push(change);
  }
  return { changes, notes };
}
