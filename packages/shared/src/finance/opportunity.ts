/**
 * Opportunity ranking and helpers. Ranking is transparent: every score is the sum of
 * named parts multiplied by named factors, so the app can show why an item ranks where
 * it does. Feedback only counts how often the user dismissed a *kind* recently; no
 * behavioral profile is built.
 */
import type { Cents } from "../money";

export type OpportunityConfidence = "high" | "medium" | "low";
export type ImpactType = "CONFIRMED" | "POTENTIAL" | "NONE";

export interface RankInput {
  /** Base importance of the rule (0–100). */
  priority: number;
  impactCents: Cents | null;
  impactType: ImpactType;
  /** Days until the related event (renewal, trip, bill); null when there's no date. */
  daysUntil: number | null;
  confidence: OpportunityConfidence;
  /** How many opportunities of this kind the user dismissed in the last 90 days. */
  recentDismissalsOfKind: number;
}

export interface RankBasis {
  base: number;
  impact: number;
  urgency: number;
  confidenceFactor: number;
  feedbackFactor: number;
  score: number;
}

const CONFIDENCE_FACTOR: Record<OpportunityConfidence, number> = { high: 1, medium: 0.85, low: 0.65 };

export function rankOpportunity(i: RankInput): RankBasis {
  const impact = i.impactCents && i.impactCents > 0 && i.impactType !== "NONE" ? Math.min(30, Math.round(Math.log10(1 + i.impactCents / 100) * 10)) : 0;
  const d = i.daysUntil;
  const urgency = d === null ? 0 : d <= 3 ? 25 : d <= 7 ? 18 : d <= 14 ? 10 : d <= 30 ? 5 : 0;
  const confidenceFactor = CONFIDENCE_FACTOR[i.confidence];
  const feedbackFactor = Math.round(Math.pow(0.75, Math.min(3, Math.max(0, i.recentDismissalsOfKind))) * 100) / 100;
  const score = Math.round((i.priority + impact + urgency) * confidenceFactor * feedbackFactor * 10) / 10;
  return { base: i.priority, impact, urgency, confidenceFactor, feedbackFactor, score };
}

export interface PriceChange {
  previousCents: Cents;
  latestCents: Cents;
  increaseCents: Cents;
  percent: number;
  latestDate: string;
}

/**
 * Detects a recurring charge that went up: the latest charge vs. the median of earlier
 * ones. Needs at least two earlier charges; ignores changes under 5% or $1.
 */
export function detectPriceIncrease(charges: { date: string; amountCents: Cents }[]): PriceChange | null {
  if (charges.length < 3) return null;
  const sorted = [...charges].sort((a, b) => a.date.localeCompare(b.date)).map((c) => ({ ...c, amountCents: Math.abs(c.amountCents) }));
  const latest = sorted[sorted.length - 1];
  const earlier = sorted.slice(0, -1).map((c) => c.amountCents).sort((a, b) => a - b);
  const mid = Math.floor(earlier.length / 2);
  const previous = earlier.length % 2 ? earlier[mid] : Math.round((earlier[mid - 1] + earlier[mid]) / 2);
  const inc = latest.amountCents - previous;
  if (previous <= 0 || inc < 100 || inc / previous < 0.05) return null;
  return { previousCents: previous, latestCents: latest.amountCents, increaseCents: inc, percent: Math.round((inc / previous) * 1000) / 10, latestDate: latest.date };
}

/**
 * Total possible savings across opportunities without double counting: each opportunity
 * lists the parts it would save (keyed by the underlying record), and each key counts once.
 */
export function totalPotentialSavings(items: { savingsParts?: { key: string; cents: Cents }[] }[]): Cents {
  const best = new Map<string, Cents>();
  for (const i of items) for (const p of i.savingsParts ?? []) best.set(p.key, Math.max(best.get(p.key) ?? 0, p.cents));
  return [...best.values()].reduce((a, b) => a + b, 0);
}
