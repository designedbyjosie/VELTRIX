import { parseAmount, type Cents } from "./money";

/** RFC 4180-ish CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** Parse YYYY-MM-DD, MM/DD/YYYY, M/D/YY, or DD.MM.YYYY into YYYY-MM-DD. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  } else if ((match = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export interface CsvMapping {
  date: number;
  merchant: number;
  description?: number;
  /** Single signed amount column … */
  amount?: number;
  /** … or separate debit/credit columns. */
  debit?: number;
  credit?: number;
  category?: number;
  /** Set when the bank exports spending as positive numbers. */
  invertSign?: boolean;
}

const ALIASES: Record<keyof Omit<CsvMapping, "invertSign">, string[]> = {
  date: ["date", "transaction date", "posted date", "posting date", "trans date"],
  merchant: ["merchant", "payee", "name", "description", "merchant name"],
  description: ["memo", "details", "notes", "original description"],
  amount: ["amount", "transaction amount", "value"],
  debit: ["debit", "withdrawal", "withdrawals", "money out"],
  credit: ["credit", "deposit", "deposits", "money in"],
  category: ["category"],
};

/** Guess a column mapping from header names. Returns null when required columns are missing. */
export function detectMapping(header: string[]): CsvMapping | null {
  const h = header.map((x) => x.trim().toLowerCase());
  const find = (names: string[], exclude: number[] = []) => h.findIndex((col, i) => !exclude.includes(i) && names.includes(col));
  const date = find(ALIASES.date);
  const merchant = find(ALIASES.merchant);
  if (date < 0 || merchant < 0) return null;
  const mapping: CsvMapping = { date, merchant };
  const description = find(ALIASES.description, [merchant]);
  if (description >= 0) mapping.description = description;
  const amount = find(ALIASES.amount);
  const debit = find(ALIASES.debit);
  const credit = find(ALIASES.credit);
  if (amount >= 0) mapping.amount = amount;
  else if (debit >= 0 || credit >= 0) {
    if (debit >= 0) mapping.debit = debit;
    if (credit >= 0) mapping.credit = credit;
  } else return null;
  const category = find(ALIASES.category);
  if (category >= 0) mapping.category = category;
  return mapping;
}

export interface ParsedCsvRow {
  line: number;
  date: string;
  merchant: string;
  description: string;
  amountCents: Cents;
  category: string | null;
  /** Position among identical (date, amount, merchant) rows in this file; makes re-imports idempotent. */
  occurrence: number;
}

export interface CsvRowError {
  line: number;
  message: string;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  errors: CsvRowError[];
  mapping: CsvMapping | null;
}

export const MAX_IMPORT_ROWS = 5000;

export function parseTransactionsCsv(text: string, mappingOverride?: CsvMapping): CsvParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: [{ line: 1, message: "The file needs a header row and at least one transaction." }], mapping: null };
  const mapping = mappingOverride ?? detectMapping(table[0]);
  if (!mapping) {
    return {
      rows: [],
      errors: [{ line: 1, message: "Couldn't find Date, Merchant/Description and Amount (or Debit/Credit) columns in the header." }],
      mapping: null,
    };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Files are limited to ${MAX_IMPORT_ROWS} rows.` }], mapping };
  }
  const rows: ParsedCsvRow[] = [];
  const errors: CsvRowError[] = [];
  const seen = new Map<string, number>();
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const line = i + 1;
    const date = parseDate(r[mapping.date] ?? "");
    if (!date) {
      errors.push({ line, message: `Unrecognized date "${(r[mapping.date] ?? "").slice(0, 40)}".` });
      continue;
    }
    const merchant = (r[mapping.merchant] ?? "").trim().slice(0, 140);
    if (!merchant) {
      errors.push({ line, message: "Missing merchant or description." });
      continue;
    }
    let amount: Cents | null = null;
    if (mapping.amount !== undefined) {
      amount = parseAmount(r[mapping.amount] ?? "");
    } else {
      const debitRaw = mapping.debit !== undefined ? (r[mapping.debit] ?? "").trim() : "";
      const creditRaw = mapping.credit !== undefined ? (r[mapping.credit] ?? "").trim() : "";
      const debit = debitRaw ? parseAmount(debitRaw) : 0;
      const credit = creditRaw ? parseAmount(creditRaw) : 0;
      if (debit !== null && credit !== null) amount = Math.abs(credit) - Math.abs(debit);
    }
    if (amount === null) {
      errors.push({ line, message: "Unrecognized amount." });
      continue;
    }
    if (mapping.invertSign) amount = -amount;
    if (amount === 0) {
      errors.push({ line, message: "Amount is zero." });
      continue;
    }
    const key = `${date}|${amount}|${merchant.toLowerCase()}`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    rows.push({
      line,
      date,
      merchant,
      description: mapping.description !== undefined ? (r[mapping.description] ?? "").trim().slice(0, 280) : "",
      amountCents: amount,
      category: mapping.category !== undefined ? (r[mapping.category] ?? "").trim().toLowerCase() || null : null,
      occurrence,
    });
  }
  return { rows, errors, mapping };
}
