import { fromCents, toCents } from "@veltrix/shared";
import { Prisma } from "@prisma/client";

/** Prisma Decimal (or null) → integer cents. */
export function cents(d: Prisma.Decimal | string | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return toCents(d.toString());
}

export function centsOrNull(d: Prisma.Decimal | null | undefined): number | null {
  return d === null || d === undefined ? null : toCents(d.toString());
}

/** Integer cents → Prisma Decimal. */
export function dec(c: number): Prisma.Decimal {
  return new Prisma.Decimal(fromCents(c));
}

/** Decimal string from a validated request ("12.34") → Prisma Decimal. */
export function decStr(s: string): Prisma.Decimal {
  return new Prisma.Decimal(s);
}
