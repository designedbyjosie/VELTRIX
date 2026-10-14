/** Calendar-date helpers. @db.Date values are UTC midnight; we pass YYYY-MM-DD strings around. */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** Today's date in the user's time zone as YYYY-MM-DD. */
export function todayIn(timeZone = "UTC", now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return ymd(now);
  }
}

export function monthStart(ym: string): string {
  return `${ym.slice(0, 7)}-01`;
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Inclusive start / exclusive end for a month (YYYY-MM). */
export function monthRange(ym: string): { gte: Date; lt: Date } {
  return { gte: fromYmd(monthStart(ym)), lt: fromYmd(monthStart(addMonths(ym, 1))) };
}

export function addDays(date: string, n: number): string {
  return ymd(new Date(fromYmd(date).getTime() + n * 86_400_000));
}
