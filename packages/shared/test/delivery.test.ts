import { describe, expect, it } from "vitest";
import { inQuietHours, scheduleDelivery, type DeliveryPrefs } from "../src/delivery";

const base: DeliveryPrefs = { frequency: "immediate", quietStart: null, quietEnd: null, pausedUntil: null };

describe("notification delivery", () => {
  it("delivers immediately by default", () => {
    const now = new Date("2026-10-15T15:00:00Z");
    expect(scheduleDelivery(now, "UTC", base)).toEqual({ deliver: true, at: now, held: false, reason: "now" });
  });

  it("drops notifications when off or paused, and resumes after the pause", () => {
    const now = new Date("2026-10-15T15:00:00Z");
    expect(scheduleDelivery(now, "UTC", { ...base, frequency: "off" })).toEqual({ deliver: false, reason: "off" });
    expect(scheduleDelivery(now, "UTC", { ...base, pausedUntil: new Date("2026-10-20T00:00:00Z") })).toEqual({ deliver: false, reason: "paused" });
    expect(scheduleDelivery(now, "UTC", { ...base, pausedUntil: new Date("2026-10-14T00:00:00Z") }).deliver).toBe(true);
  });

  it("holds notifications during quiet hours that wrap past midnight, in the user's time zone", () => {
    expect(inQuietHours(23, 22, 7)).toBe(true);
    expect(inQuietHours(3, 22, 7)).toBe(true);
    expect(inQuietHours(7, 22, 7)).toBe(false);
    expect(inQuietHours(12, 9, 9)).toBe(false);
    const p = { ...base, quietStart: 22, quietEnd: 7 };
    // 23:30 in New York (EDT, UTC-4) → held until 07:00 New York the next day.
    const late = scheduleDelivery(new Date("2026-10-16T03:30:00Z"), "America/New_York", p);
    expect(late).toMatchObject({ deliver: true, held: true, reason: "quiet_hours" });
    if (late.deliver) expect(late.at.toISOString()).toBe("2026-10-16T11:00:00.000Z");
    // 02:00 New York → same morning.
    const early = scheduleDelivery(new Date("2026-10-16T06:00:00Z"), "America/New_York", p);
    if (early.deliver) expect(early.at.toISOString()).toBe("2026-10-16T11:00:00.000Z");
    // Afternoon → now.
    expect(scheduleDelivery(new Date("2026-10-16T18:00:00Z"), "America/New_York", p)).toMatchObject({ held: false });
  });

  it("collects daily and weekly digests at 9:00 local", () => {
    const daily = scheduleDelivery(new Date("2026-10-15T15:00:00Z"), "UTC", { ...base, frequency: "daily" });
    if (daily.deliver) expect(daily.at.toISOString()).toBe("2026-10-16T09:00:00.000Z");
    const morning = scheduleDelivery(new Date("2026-10-15T06:00:00Z"), "UTC", { ...base, frequency: "daily" });
    if (morning.deliver) expect(morning.at.toISOString()).toBe("2026-10-15T09:00:00.000Z");
    // Thursday 2026-10-15 → Monday 2026-10-19.
    const weekly = scheduleDelivery(new Date("2026-10-15T15:00:00Z"), "Europe/Berlin", { ...base, frequency: "weekly" });
    if (weekly.deliver) expect(weekly.at.toISOString()).toBe("2026-10-19T07:00:00.000Z");
    // Monday after 9:00 → next Monday.
    const mon = scheduleDelivery(new Date("2026-10-19T12:00:00Z"), "UTC", { ...base, frequency: "weekly" });
    if (mon.deliver) expect(mon.at.toISOString()).toBe("2026-10-26T09:00:00.000Z");
  });

  it("moves a digest that lands in quiet hours to when they end", () => {
    const r = scheduleDelivery(new Date("2026-10-15T15:00:00Z"), "UTC", { ...base, frequency: "daily", quietStart: 8, quietEnd: 10 });
    if (r.deliver) expect(r.at.toISOString()).toBe("2026-10-16T10:00:00.000Z");
  });

  it("falls back to UTC for an unknown time zone", () => {
    const r = scheduleDelivery(new Date("2026-10-15T23:00:00Z"), "Not/AZone", { ...base, quietStart: 22, quietEnd: 6 });
    if (r.deliver) expect(r.at.toISOString()).toBe("2026-10-16T06:00:00.000Z");
  });
});
