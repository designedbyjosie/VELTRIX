import { describe, expect, it } from "vitest";
import { detectMapping, parseCsv, parseDate, parseTransactionsCsv } from "../src/csv";

describe("csv", () => {
  it("parses quoted fields and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
    ]);
  });
  it("parses dates strictly", () => {
    expect(parseDate("2026-10-01")).toBe("2026-10-01");
    expect(parseDate("10/01/2026")).toBe("2026-10-01");
    expect(parseDate("1/5/26")).toBe("2026-01-05");
    expect(parseDate("31.12.2025")).toBe("2025-12-31");
    expect(parseDate("02/30/2026")).toBeNull();
    expect(parseDate("yesterday")).toBeNull();
  });
  it("detects header mappings", () => {
    expect(detectMapping(["Date", "Description", "Amount"])).toEqual({ date: 0, merchant: 1, amount: 2 });
    expect(detectMapping(["Posted Date", "Payee", "Debit", "Credit"])).toEqual({ date: 0, merchant: 1, debit: 2, credit: 3 });
    expect(detectMapping(["foo", "bar"])).toBeNull();
  });
  it("validates rows and reports line-level errors", () => {
    const csv = ["Date,Description,Amount", "2026-10-01,Coffee,-4.50", "bad-date,Thing,-1", "2026-10-02,,-3", "2026-10-03,Payroll,\"2,500.00\"", "2026-10-03,Nothing,abc"].join("\n");
    const r = parseTransactionsCsv(csv);
    expect(r.rows.map((x) => x.amountCents)).toEqual([-450, 250000]);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 6]);
  });
  it("numbers identical rows so re-imports dedupe but genuine repeats are kept", () => {
    const csv = ["Date,Description,Amount", "2026-10-01,Coffee,-4.50", "2026-10-01,Coffee,-4.50"].join("\n");
    const r = parseTransactionsCsv(csv);
    expect(r.rows.map((x) => x.occurrence)).toEqual([0, 1]);
  });
  it("supports debit/credit columns", () => {
    const r = parseTransactionsCsv("Date,Payee,Debit,Credit\n2026-10-01,Store,12.00,\n2026-10-02,Employer,,100.00");
    expect(r.rows.map((x) => x.amountCents)).toEqual([-1200, 10000]);
  });
});
