/**
 * Money helpers. All business calculations use integer minor units (cents) so
 * that sums never accumulate floating-point error. Conversion to/from decimal
 * strings happens only at the edges (database, CSV, display).
 */
export type Cents = number;

const DECIMAL_RE = /^-?\d+(\.\d{1,8})?$/;

/** Convert a decimal string or number (e.g. "12.34", 12.34) to integer cents. */
export function toCents(value: string | number | { toString(): string }): Cents {
  const s = typeof value === "number" ? value.toFixed(8) : value.toString().trim();
  if (!DECIMAL_RE.test(s)) throw new Error(`Invalid decimal amount: ${s}`);
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const fracPadded = (frac + "000").slice(0, 3); // round half away from zero on 3rd digit
  let cents = Number(whole) * 100 + Number(fracPadded.slice(0, 2));
  if (Number(fracPadded[2]) >= 5) cents += 1;
  return negative ? -cents : cents;
}

/** Convert integer cents to a fixed 2-decimal string suitable for Decimal columns. */
export function fromCents(cents: Cents): string {
  if (!Number.isInteger(cents)) throw new Error(`Cents must be an integer, got ${cents}`);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negative ? `-${s}` : s;
}

/**
 * Parse a human-entered amount: "$1,234.56", "(12.00)", "-12", "12.5 USD".
 * Returns null when the input is not a valid amount.
 */
export function parseAmount(input: string): Cents | null {
  if (typeof input !== "string") return null;
  let s = input.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[A-Z]{3}$/i, "").replace(/[$€£¥\s]/g, "").trim();
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  // Accept "1,234.56" but reject ambiguous "1,23"
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) return null;
  s = s.replace(/,/g, "");
  try {
    const c = toCents(s);
    return negative ? -c : c;
  } catch {
    return null;
  }
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}

/** Percentage change from previous to current, or null when not calculable. */
export function percentChange(current: Cents, previous: Cents): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatMoney(
  cents: Cents,
  currency = "USD",
  opts: { compact?: boolean; showSign?: boolean; noCents?: boolean } = {},
): string {
  const value = cents / 100;
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.compact ? 0 : opts.noCents ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : opts.noCents ? 0 : 2,
    signDisplay: opts.showSign ? "exceptZero" : "auto",
  });
  return fmt.format(value);
}

export function formatPercent(value: number | null, digits = 1, showSign = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "INR", "MXN"] as const;
