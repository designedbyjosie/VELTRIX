/**
 * When a proactive notification may be shown, given the user's choices:
 * - frequency: "immediate", a "daily" digest, a "weekly" digest (Mondays), or "off"
 * - quiet hours in the user's time zone (may wrap past midnight)
 * - a pause until a given moment
 * Pure and time-zone aware, so it can be tested without a clock or database.
 */
export type NotifyFrequency = "immediate" | "daily" | "weekly" | "off";
export const NOTIFY_FREQUENCIES: NotifyFrequency[] = ["immediate", "daily", "weekly", "off"];
export const DIGEST_HOUR = 9;

export interface DeliveryPrefs {
  frequency: NotifyFrequency;
  /** Local hour (0–23) quiet hours start, or null for none. */
  quietStart: number | null;
  /** Local hour (0–23) quiet hours end. */
  quietEnd: number | null;
  pausedUntil: Date | null;
}

export type DeliveryDecision = { deliver: false; reason: "off" | "paused" } | { deliver: true; at: Date; held: boolean; reason: "now" | "quiet_hours" | "digest" };

interface Local {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  dow: number; // 0 = Sunday
}

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

function localParts(at: Date, tz: string): Local {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: +get("year"), m: +get("month"), d: +get("day"), h: +get("hour") % 24, min: +get("minute"), dow };
}

/** The UTC instant for a local wall-clock time (date may overflow; Date.UTC normalizes it). */
function fromLocal(y: number, m: number, d: number, h: number, tz: string): Date {
  const wall = Date.UTC(y, m - 1, d, h, 0, 0);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess), tz);
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
    const diff = wall - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

export function inQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start === null || end === null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** First moment at or after `at` that is outside quiet hours. */
function afterQuiet(at: Date, tz: string, p: DeliveryPrefs): Date {
  const l = localParts(at, tz);
  if (!inQuietHours(l.h, p.quietStart, p.quietEnd)) return at;
  const end = p.quietEnd!;
  // Quiet hours end later today, or (when they wrap past midnight and it's evening) tomorrow.
  const day = l.h < end ? l.d : l.d + 1;
  return fromLocal(l.y, l.m, day, end, tz);
}

export function scheduleDelivery(now: Date, timeZone: string, p: DeliveryPrefs): DeliveryDecision {
  const tz = safeZone(timeZone);
  if (p.frequency === "off") return { deliver: false, reason: "off" };
  if (p.pausedUntil && p.pausedUntil.getTime() > now.getTime()) return { deliver: false, reason: "paused" };
  if (p.frequency === "immediate") {
    const at = afterQuiet(now, tz, p);
    const held = at.getTime() !== now.getTime();
    return { deliver: true, at, held, reason: held ? "quiet_hours" : "now" };
  }
  const l = localParts(now, tz);
  let addDays: number;
  if (p.frequency === "daily") addDays = l.h < DIGEST_HOUR ? 0 : 1;
  else {
    // Next Monday at the digest hour (today if it's Monday morning).
    const toMonday = (8 - l.dow) % 7;
    addDays = toMonday === 0 && l.h >= DIGEST_HOUR ? 7 : toMonday;
  }
  const at = afterQuiet(fromLocal(l.y, l.m, l.d + addDays, DIGEST_HOUR, tz), tz, p);
  return { deliver: true, at, held: true, reason: "digest" };
}
