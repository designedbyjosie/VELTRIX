/**
 * Recognizes "what if" questions in plain language and turns them into plan-engine
 * inputs: a purchase review, a scenario, or a stress test. Pure; used by the built-in
 * advisor (an AI model calls the planning tools directly instead).
 */
import type { ScenarioChange } from "@veltrix/shared";
import { findAmounts } from "./intents";

export type WhatIfIntent =
  | { type: "purchase"; label: string; priceCents: number; waitMonths?: number; financing?: { months: number; aprPercent: number } | null }
  | { type: "scenario"; changes: ScenarioChange[] }
  | { type: "stress"; incomeLossMonths: number; incomeReplacementPct: number; emergencyCostCents: number; essentialIncreaseCents: number; discretionaryCutPct: number }
  | { type: "profile" };

const SEASON_MONTH: Record<string, number> = { spring: 4, summer: 7, fall: 10, autumn: 10, winter: 12, christmas: 12, holidays: 12 };
const NUM_WORDS: Record<string, number> = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, nine: 9, twelve: 12 };
const num = (s: string) => NUM_WORDS[s] ?? Number(s);

/** Months from now until the named season (or "in N months"); 0 if not stated. */
function whenMonth(q: string, currentMonth: number): number {
  const rel = q.match(/\bin\s+(\d{1,2}|a|one|two|three|four|five|six|nine|twelve)\s+(months?|years?)\b/);
  if (rel) return Math.min(119, num(rel[1]) * (rel[2].startsWith("year") ? 12 : 1));
  if (/\bnext year\b/.test(q)) return 12;
  const season = q.match(/\b(this|next)?\s*(spring|summer|fall|autumn|winter|christmas|holidays)\b/);
  if (season) {
    let m = SEASON_MONTH[season[2]] - currentMonth;
    if (m < 0 || season[1] === "next") m += 12;
    return m;
  }
  return 0;
}

function durationMonths(q: string): number | null {
  const d = q.match(/\bfor\s+(\d{1,2}|a|one|two|three|four|five|six|nine|twelve)\s+(months?|years?)\b/);
  return d ? num(d[1]) * (d[2].startsWith("year") ? 12 : 1) : null;
}

export function parseWhatIf(message: string, currentMonth: number): WhatIfIntent | null {
  const q = message.toLowerCase().replace(/[’']/g, "'");
  const amounts = findAmounts(message);
  const amountCents = amounts.length ? Math.round(Math.abs(Number(amounts[0].value)) * 100) : null;
  const hypothetical = /\b(what if|what happens if|what would happen|if i|if my|should i|could i|can i afford|afford|stress[- ]?test|how long (could|would|can) i)\b/.test(q);
  if (!hypothetical) {
    if (/\b(financial (picture|profile|snapshot|situation)|my (whole )?picture|where do i stand|how am i doing overall)\b/.test(q)) return { type: "profile" };
    return null;
  }
  if (/\b(stock|share|etf|invest in)\b/.test(q)) return null;

  // Stress test
  const jobLoss = q.match(/\b(lose|lost|losing) (my )?(job|income|work)\b|\bjob loss\b|\bunemploy|\bno income\b|\bstress[- ]?test\b|\bhow long (could|would|can) i\b|\b(income|paycheck)\b[^.]*\b(stops?|ends?)\b/);
  if (jobLoss) {
    const months = durationMonths(q) ?? (/(\d{1,2}|three|six) months?/.test(q) ? num(q.match(/(\d{1,2}|three|six) months?/)![1]) : 3);
    const replacement = q.match(/(\d{1,3})% (of my )?(income|pay|unemployment)/);
    return {
      type: "stress",
      incomeLossMonths: /\b(lose|lost|losing|job loss|unemploy|no income|how long|without (a )?(job|paycheck|income|work))\b|\b(income|paycheck|pay)\b[^.]*\b(stops?|ends?|goes away)\b/.test(q) ? Math.min(24, months) : 0,
      incomeReplacementPct: replacement ? Math.min(100, Number(replacement[1])) : 0,
      emergencyCostCents: /\b(repair|medical|emergency|unexpected|bill)\b/.test(q) && amountCents ? amountCents : 0,
      essentialIncreaseCents: 0,
      discretionaryCutPct: 0,
    };
  }

  const changes: ScenarioChange[] = [];
  // Income change: "income drops 15%", "salary goes up by 10%", "I get a $500 raise"
  const incomePct = q.match(/\b(income|salary|pay|paycheck)\b[^.]*?\b(drops?|falls?|goes down|decreases?|is cut|gets cut|shrinks?|rises?|goes up|increases?|grows?)\b[^.\d]*?(\d{1,3})\s?%/);
  if (incomePct) {
    const down = /drop|fall|down|decrease|cut|shrink/.test(incomePct[2]);
    changes.push({ kind: "income", label: `Income ${down ? "−" : "+"}${incomePct[3]}%`, percent: (down ? -1 : 1) * Number(incomePct[3]), startMonth: whenMonth(q, currentMonth), months: durationMonths(q) });
  } else if (/\braise\b/.test(q) && amountCents) {
    changes.push({ kind: "income", label: "Raise", amountCents, startMonth: whenMonth(q, currentMonth), months: null });
  }
  // Essential cost change: "rent goes up $200", "move to an apartment that costs $400 more"
  const essentialUp = /\b(rent|mortgage|bills?|utilities|insurance|apartment|childcare)\b/.test(q) && /\b(goes up|went up|increases?|rises?|more|higher|costs?)\b/.test(q);
  if (essentialUp && amountCents && !incomePct) {
    const pct = q.match(/(\d{1,3})\s?%/);
    changes.push(pct ? { kind: "expense", label: `Essential costs +${pct[1]}%`, bucket: "essential", percent: Number(pct[1]), startMonth: whenMonth(q, currentMonth), months: null } : { kind: "expense", label: `Essential costs +$${amountCents / 100}/mo`, bucket: "essential", amountCents, startMonth: whenMonth(q, currentMonth), months: null });
  }
  // Spending cuts: "cut my spending by 20%", "reduce dining and shopping by $300"
  const cut = q.match(/\b(cut|reduce|lower|trim)\b[^.]*?\b(spending|dining|eating out|shopping|entertainment|discretionary)\b[^.]*?(?:(\d{1,3})\s?%|\$)/);
  if (cut) {
    if (cut[3]) changes.push({ kind: "expense", label: `Cut discretionary ${cut[3]}%`, bucket: "discretionary", percent: -Number(cut[3]), startMonth: 0, months: durationMonths(q) });
    else if (amountCents) changes.push({ kind: "expense", label: `Spend $${amountCents / 100} less a month`, bucket: "discretionary", amountCents: -amountCents, startMonth: 0, months: durationMonths(q) });
  }
  // Saving more / paying debt faster
  if (/\b(save|saving)\b[^.]*\b(more|extra|additional)\b/.test(q) && amountCents && !changes.length) changes.push({ kind: "extra_saving", label: `Save $${amountCents / 100} more a month`, amountCents, startMonth: whenMonth(q, currentMonth) });
  if (/\b(extra|additional|more)\b[^.]*\b(debt|loan|credit card|card)\b|\bpay (off|down)\b/.test(q) && amountCents && !changes.length) changes.push({ kind: "extra_debt_payment", label: `Extra $${amountCents / 100}/mo to debt`, amountCents, startMonth: whenMonth(q, currentMonth) });
  // Vacation / trip as a one-time cost inside a scenario
  if (/\b(vacation|trip|holiday|wedding)\b/.test(q) && amountCents && !changes.length) {
    const what = q.match(/\b(vacation|trip|holiday|wedding)\b/)![1];
    changes.push({ kind: "one_time", label: what[0].toUpperCase() + what.slice(1), amountCents, month: whenMonth(q, currentMonth) });
  }
  if (changes.length) return { type: "scenario", changes };

  // Purchase review
  if (amountCents && /\b(buy|purchase|get|afford|spend|order|upgrade)\b/.test(q)) {
    const after = message.slice(amounts[0].end).match(/^\s*(?:for\s+(?:a|an|the|my)\s+|on\s+(?:a|an|the|my)\s+)?([A-Za-z][\w\s'-]{1,40}?)(?=\s+(?:now|today|this|next|in|for|over|on|at|and|or|right|soon|later)\b|[?.!,]|$)/);
    const before = q.match(/\b(?:buy|purchase|get|afford|order)\s+(?:a|an|the|my|new\s)?\s*(?:new\s)?([a-z][a-z\s-]{1,30}?)\s+(?:for|that costs|at)\s+\$/);
    const afterLabel = after?.[1] && !/^(over|at|in|for|per)\b/i.test(after[1]) ? after[1] : null;
    const label = (before?.[1] ?? afterLabel ?? "this purchase").trim();
    const fin = q.match(/\bover\s+(\d{1,3})\s+months?(?:\s+at\s+(\d{1,2}(?:\.\d+)?)\s?%)?/);
    const wait = q.match(/\b(?:wait|in|after)\s+(\d{1,2}|a|one|two|three|six)\s+months?\b/);
    return {
      type: "purchase",
      label: label.length > 1 ? label[0].toUpperCase() + label.slice(1) : "This purchase",
      priceCents: amountCents,
      waitMonths: wait ? Math.max(1, num(wait[1])) : undefined,
      financing: fin ? { months: Number(fin[1]), aprPercent: fin[2] ? Number(fin[2]) : 0 } : null,
    };
  }
  return null;
}
