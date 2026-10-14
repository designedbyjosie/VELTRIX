import type { Cents } from "../money";

export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "INVESTMENT"
  | "RETIREMENT"
  | "LOAN"
  | "MORTGAGE"
  | "CASH"
  | "PROPERTY"
  | "OTHER_ASSET"
  | "OTHER_LIABILITY";

export const LIABILITY_TYPES: AccountType[] = ["CREDIT_CARD", "LOAN", "MORTGAGE", "OTHER_LIABILITY"];
export const LIQUID_TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CASH"];
export const INVESTMENT_TYPES: AccountType[] = ["INVESTMENT", "RETIREMENT"];

export function isLiability(type: AccountType): boolean {
  return LIABILITY_TYPES.includes(type);
}

export interface NetWorthAccount {
  type: AccountType;
  /**
   * Balance convention: assets are stored as positive values. Liabilities are
   * stored as the positive amount OWED (a $1,200 credit card balance is 1200.00).
   */
  balanceCents: Cents;
  currency: string;
}

export interface NetWorthResult {
  assetsCents: Cents;
  liabilitiesCents: Cents;
  netWorthCents: Cents;
  liquidCents: Cents;
  investmentsCents: Cents;
  /** Accounts skipped because they are not in the base currency (no FX conversion applied). */
  excludedForeignCurrency: number;
}

/**
 * Net worth = total assets − total liabilities. Only accounts in the base
 * currency are included; foreign-currency accounts are reported separately
 * rather than silently converted with an unverified rate.
 */
export function calculateNetWorth(accounts: NetWorthAccount[], baseCurrency = "USD"): NetWorthResult {
  let assets = 0;
  let liabilities = 0;
  let liquid = 0;
  let investments = 0;
  let excluded = 0;
  for (const a of accounts) {
    if (a.currency !== baseCurrency) {
      excluded++;
      continue;
    }
    if (isLiability(a.type)) {
      liabilities += Math.abs(a.balanceCents);
    } else {
      assets += a.balanceCents;
      if (LIQUID_TYPES.includes(a.type)) liquid += a.balanceCents;
      if (INVESTMENT_TYPES.includes(a.type)) investments += a.balanceCents;
    }
  }
  return {
    assetsCents: assets,
    liabilitiesCents: liabilities,
    netWorthCents: assets - liabilities,
    liquidCents: liquid,
    investmentsCents: investments,
    excludedForeignCurrency: excluded,
  };
}
