import type { Cents } from "../money";

export interface HoldingValue {
  symbol: string;
  type: string;
  sector: string | null;
  marketValueCents: Cents;
  costBasisCents: Cents;
}

export interface PortfolioSummary {
  marketValueCents: Cents;
  costBasisCents: Cents;
  unrealizedGainCents: Cents;
  unrealizedGainPercent: number | null;
  allocation: { key: string; valueCents: Cents; percent: number }[];
  largestPositionPercent: number;
  /** Herfindahl-Hirschman index of position weights (0–10,000). Higher = more concentrated. */
  concentrationHHI: number;
  concentrationLevel: "diversified" | "moderate" | "concentrated";
}

export function summarizePortfolio(holdings: HoldingValue[], by: "type" | "sector" | "symbol" = "type"): PortfolioSummary {
  const mv = holdings.reduce((s, h) => s + h.marketValueCents, 0);
  const cb = holdings.reduce((s, h) => s + h.costBasisCents, 0);
  const groups = new Map<string, number>();
  for (const h of holdings) {
    const k = by === "type" ? h.type : by === "sector" ? h.sector ?? "Unclassified" : h.symbol;
    groups.set(k, (groups.get(k) ?? 0) + h.marketValueCents);
  }
  const weights = holdings.map((h) => (mv === 0 ? 0 : h.marketValueCents / mv));
  const hhi = Math.round(weights.reduce((s, w) => s + (w * 100) ** 2, 0));
  return {
    marketValueCents: mv,
    costBasisCents: cb,
    unrealizedGainCents: mv - cb,
    unrealizedGainPercent: cb === 0 ? null : Math.round(((mv - cb) / cb) * 1000) / 10,
    allocation: [...groups.entries()]
      .map(([key, v]) => ({ key, valueCents: v, percent: mv === 0 ? 0 : Math.round((v / mv) * 1000) / 10 }))
      .sort((a, b) => b.valueCents - a.valueCents),
    largestPositionPercent: Math.round(Math.max(0, ...weights) * 1000) / 10,
    concentrationHHI: hhi,
    concentrationLevel: hhi < 1500 ? "diversified" : hhi < 2500 ? "moderate" : "concentrated",
  };
}

export interface Snapshot {
  date: string;
  marketValueCents: Cents;
  /** Cumulative net contributions (deposits − withdrawals) up to this date. */
  netContributionsCents: Cents;
}

export interface PerformanceResult {
  startValueCents: Cents;
  endValueCents: Cents;
  valueChangeCents: Cents;
  netContributionsCents: Cents;
  /** Change in value NOT explained by contributions: the market gain/loss. */
  marketGainCents: Cents;
  /** Simple Modified Dietz return (assumes flows mid-period), percent. */
  returnPercent: number | null;
}

/**
 * Separates account growth from investment performance: a portfolio that grew
 * by $5,000 because the user deposited $5,000 has a 0% return, not a profit.
 */
export function portfolioPerformance(snapshots: Snapshot[]): PerformanceResult | null {
  if (snapshots.length < 2) return null;
  const s = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const first = s[0];
  const last = s[s.length - 1];
  const flows = last.netContributionsCents - first.netContributionsCents;
  const change = last.marketValueCents - first.marketValueCents;
  const gain = change - flows;
  const denom = first.marketValueCents + flows / 2;
  return {
    startValueCents: first.marketValueCents,
    endValueCents: last.marketValueCents,
    valueChangeCents: change,
    netContributionsCents: flows,
    marketGainCents: gain,
    returnPercent: denom <= 0 ? null : Math.round((gain / denom) * 10000) / 100,
  };
}
