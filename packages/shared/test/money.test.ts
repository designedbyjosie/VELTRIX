import { describe, expect, it } from "vitest";
import { formatMoney, fromCents, parseAmount, percentChange, toCents } from "../src/money";

describe("money", () => {
  it("converts decimals to integer cents without float drift", () => {
    expect(toCents("0.1")).toBe(10);
    expect(toCents("19.99")).toBe(1999);
    expect(toCents("-1234.56")).toBe(-123456);
    expect(toCents("2.005")).toBe(201); // half rounds away from zero
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
  it("round-trips cents to decimal strings", () => {
    expect(fromCents(123456)).toBe("1234.56");
    expect(fromCents(-5)).toBe("-0.05");
    expect(fromCents(0)).toBe("0.00");
    expect(() => fromCents(1.5)).toThrow();
  });
  it("parses human-entered amounts", () => {
    expect(parseAmount("$1,234.56")).toBe(123456);
    expect(parseAmount("(12.00)")).toBe(-1200);
    expect(parseAmount("-12")).toBe(-1200);
    expect(parseAmount("12.5 USD")).toBe(1250);
    expect(parseAmount("1,23")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
  it("summing many cents is exact", () => {
    const total = Array.from({ length: 1000 }, () => toCents("0.10")).reduce((a, b) => a + b, 0);
    expect(total).toBe(10000);
  });
  it("percent change is null when previous is zero", () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(90, -100)).toBeCloseTo(190);
  });
  it("formats money", () => {
    expect(formatMoney(12456300)).toBe("$124,563.00");
    expect(formatMoney(-500, "USD", { showSign: true })).toBe("-$5.00");
  });
});
