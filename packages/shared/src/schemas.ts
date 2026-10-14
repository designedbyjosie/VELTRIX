/**
 * Request/response contracts shared by the web app, its API routes and the
 * browser extension. The server validates every request against these.
 */
import { z } from "zod";
import { DASHBOARD_WIDGET_IDS } from "./dashboard";

const money = z
  .string()
  .trim()
  .regex(/^-?\d{1,13}(\.\d{1,2})?$/, "Enter an amount like 12.34");
const positiveMoney = money.refine((v) => Number(v) > 0, "Must be greater than zero");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const id = z.string().min(1).max(64);
const shortText = (max: number) => z.string().trim().max(max);
/** http(s) only — zod's .url() alone also accepts javascript:, data: and other schemes. */
const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed");
const httpsUrl = httpUrl.refine((u) => /^https:\/\//i.test(u), "Only https links are allowed");

export const accountTypes = [
  "CHECKING",
  "SAVINGS",
  "CREDIT_CARD",
  "INVESTMENT",
  "RETIREMENT",
  "LOAN",
  "MORTGAGE",
  "CASH",
  "PROPERTY",
  "OTHER_ASSET",
  "OTHER_LIABILITY",
] as const;

// ---------- Auth ----------
export const registerSchema = z.object({
  name: shortText(80).min(1, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z.lazy(() => passwordSchema),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Accept the terms to continue" }) }),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z.string().min(1, "Enter your password").max(200),
});

// ---------- Accounts ----------
export const accountCreateSchema = z.object({
  name: shortText(80).min(1, "Name the account"),
  institution: shortText(80).optional().default(""),
  type: z.enum(accountTypes),
  currency: currency.default("USD"),
  balance: money,
  mask: z.string().regex(/^\d{0,4}$/, "Last 4 digits only").optional().default(""),
});
export const accountUpdateSchema = accountCreateSchema.partial().extend({ archived: z.boolean().optional() });

// ---------- Transactions ----------
export const transactionCreateSchema = z.object({
  date: isoDate,
  amount: money.refine((v) => Number(v) !== 0, "Amount can't be zero"),
  merchant: shortText(140).min(1, "Enter a merchant or description"),
  description: shortText(280).optional().default(""),
  categoryId: id.nullable().optional(),
  accountId: id.nullable().optional(),
  currency: currency.default("USD"),
  notes: shortText(500).optional().default(""),
});
export const transactionUpdateSchema = transactionCreateSchema.partial();
export const transactionQuerySchema = z.object({
  q: shortText(100).optional(),
  categoryId: id.optional(),
  accountId: id.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  min: money.optional(),
  max: money.optional(),
  type: z.enum(["all", "income", "expense"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});
export const csvImportSchema = z.object({
  filename: shortText(200).default("import.csv"),
  content: z.string().min(1).max(2_000_000, "File is larger than 2 MB"),
  accountId: id.nullable().optional(),
  invertSign: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
});

// ---------- Budgets ----------
export const budgetCreateSchema = z.object({
  name: shortText(80).min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
  recurring: z.boolean().default(true),
  lines: z
    .array(z.object({ categoryId: id, limit: positiveMoney, alertThreshold: z.number().int().min(10).max(100).default(80) }))
    .min(1, "Add at least one category")
    .max(30),
});
export const budgetUpdateSchema = budgetCreateSchema.partial().extend({ archived: z.boolean().optional() });

// ---------- Goals ----------
export const goalKinds = ["EMERGENCY_FUND", "VACATION", "CAR", "HOME", "DEBT", "RETIREMENT", "EDUCATION", "OTHER"] as const;
export const goalCreateSchema = z.object({
  name: shortText(80).min(1),
  kind: z.enum(goalKinds).default("OTHER"),
  target: positiveMoney,
  startingAmount: money.default("0"),
  targetDate: isoDate.nullable().optional(),
  plannedMonthly: money.nullable().optional(),
  currency: currency.default("USD"),
});
export const goalUpdateSchema = goalCreateSchema.partial().extend({ archived: z.boolean().optional() });
export const contributionSchema = z.object({ amount: money.refine((v) => Number(v) !== 0, "Amount can't be zero"), date: isoDate, note: shortText(200).optional().default("") });

// ---------- Recurring ----------
export const recurringUpdateSchema = z.object({ status: z.enum(["CONFIRMED", "DISMISSED", "SUSPECTED"]) });

// ---------- Investments ----------
export const holdingCreateSchema = z.object({
  accountId: id,
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-^]{0,9}$/, "Enter a ticker symbol"),
  quantity: z.string().regex(/^\d{1,12}(\.\d{1,8})?$/, "Enter a quantity"),
  costBasis: money,
});
export const watchlistAddSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-^]{0,9}$/, "Enter a ticker symbol"),
  note: shortText(200).optional().default(""),
  source: z.enum(["WEB", "EXTENSION"]).default("WEB"),
});
export const alertCreateSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-^]{0,9}$/),
  condition: z.enum(["ABOVE", "BELOW"]),
  targetPrice: positiveMoney,
});

// ---------- Shopping ----------
export const productSaveSchema = z.object({
  title: shortText(200).min(1),
  merchant: shortText(80).min(1),
  url: httpUrl,
  imageUrl: httpsUrl.nullable().optional(),
  price: positiveMoney.nullable().optional(),
  currency: currency.default("USD"),
  shippingCost: money.nullable().optional(),
  targetPrice: positiveMoney.nullable().optional(),
  status: z.enum(["WISHLIST", "WATCHING", "PURCHASED", "ARCHIVED"]).default("WISHLIST"),
  brand: shortText(80).nullable().optional(),
  sku: shortText(64).nullable().optional(),
  gtin: shortText(20).nullable().optional(),
  availability: shortText(40).nullable().optional(),
  notes: shortText(500).optional().default(""),
  source: z.enum(["EXTENSION", "MANUAL"]).default("MANUAL"),
});
export const productUpdateSchema = z.object({
  status: z.enum(["WISHLIST", "WATCHING", "PURCHASED", "ARCHIVED"]).optional(),
  targetPrice: positiveMoney.nullable().optional(),
  notes: shortText(500).optional(),
});
export const priceObservationSchema = z.object({ price: positiveMoney, currency, shippingCost: money.nullable().optional(), observedAt: z.string().datetime().optional() });
export const dealCreateSchema = z.object({
  title: shortText(200).min(1),
  merchant: shortText(80).min(1),
  url: httpUrl,
  price: positiveMoney.nullable().optional(),
  currency: currency.default("USD"),
  couponCode: shortText(40).nullable().optional(),
  couponConditions: shortText(400).nullable().optional(),
  cashbackRate: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/).nullable().optional(),
  shippingCost: money.nullable().optional(),
  expiresAt: isoDate.nullable().optional(),
});
export const rewardProgramSchema = z.object({
  name: shortText(80).min(1),
  programType: z.enum(["AIRLINE", "HOTEL", "CARD", "RETAIL", "OTHER"]),
  balance: z.coerce.number().int().min(0).max(1_000_000_000),
  pointValueCents: z.string().regex(/^\d{1,3}(\.\d{1,4})?$/, "Cents per point, e.g. 1.2").nullable().optional(),
  expiresAt: isoDate.nullable().optional(),
});

// ---------- Travel ----------
export const tripCreateSchema = z.object({
  name: shortText(80).min(1),
  destination: shortText(120).min(1),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
  budget: positiveMoney.nullable().optional(),
  currency: currency.default("USD"),
  notes: shortText(1000).optional().default(""),
});
export const tripUpdateSchema = tripCreateSchema.partial().extend({ status: z.enum(["PLANNING", "BOOKED", "COMPLETED", "CANCELLED"]).optional() });
export const travelExpenseSchema = z.object({
  category: z.enum(["FLIGHT", "LODGING", "CAR", "FOOD", "ACTIVITY", "TRANSPORT", "OTHER"]),
  description: shortText(200).min(1),
  amount: positiveMoney,
  currency: currency.default("USD"),
  date: isoDate.nullable().optional(),
  provider: shortText(80).optional().default(""),
  isQuote: z.boolean().default(false),
  sourceUrl: httpUrl.nullable().optional(),
});

// ---------- AI ----------
export const chatRequestSchema = z.object({
  conversationId: id.nullable().optional(),
  message: z.string().trim().min(1, "Ask a question").max(4000),
});

// ---------- Settings ----------
export const profileUpdateSchema = z.object({
  displayName: shortText(80).min(1).optional(),
  baseCurrency: currency.optional(),
  timezone: shortText(64).optional(),
});
export const consentPurposes = ["AI_PROCESSING", "EXTENSION_PAGE_CONTENT", "PRICE_TRACKING", "PRODUCT_EMAILS"] as const;
export const consentUpdateSchema = z.object({ purpose: z.enum(consentPurposes), granted: z.boolean() });
export const preferenceUpdateSchema = z.object({
  notifyBudget: z.boolean().optional(),
  notifyPriceDrops: z.boolean().optional(),
  notifyGoals: z.boolean().optional(),
  extensionAutoAnalyze: z.boolean().optional(),
});
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(200), confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type DELETE to confirm' }) }) });

// ---------- Extension ----------
export const pairSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/, "Enter the 8-character code"), deviceName: shortText(60).default("Browser extension") });

const extractedProduct = z.object({
  title: shortText(200).min(1),
  priceCents: z.number().int().positive().max(1_000_000_000).nullable(),
  currency: currency.nullable(),
  merchant: shortText(80).min(1),
  imageUrl: httpUrl.nullable(),
  availability: shortText(40).nullable(),
  brand: shortText(120).nullable(),
  sku: shortText(64).nullable(),
  gtin: shortText(20).nullable(),
});
const extractedArticle = z.object({
  headline: shortText(240).min(1),
  publisher: shortText(120).nullable(),
  publishedAt: z.string().datetime().nullable(),
  description: shortText(400).nullable(),
  excerpt: shortText(2000).nullable(),
});
const extractedTravel = z.object({
  kind: z.enum(["flight", "hotel", "car", "package", "unknown"]),
  provider: shortText(80),
  title: shortText(200),
  priceCents: z.number().int().positive().max(1_000_000_000).nullable(),
  currency: currency.nullable(),
  startDate: isoDate.nullable(),
  endDate: isoDate.nullable(),
  destination: shortText(80).nullable(),
});
export const pageExtractionSchema = z.object({
  url: httpUrl,
  canonicalUrl: httpUrl,
  domain: shortText(253),
  title: shortText(240),
  pageType: z.enum(["product", "article", "instrument", "travel", "unsupported"]),
  unsupportedReason: z.enum(["sensitive", "no-financial-content", "not-http"]).optional(),
  product: extractedProduct.optional(),
  article: extractedArticle.optional(),
  travel: extractedTravel.optional(),
  symbols: z.array(z.string().regex(/^[A-Z][A-Z0-9.\-^]{0,9}$/)).max(12),
  signals: z.array(shortText(60)).max(20),
  extractedAt: z.string().datetime(),
});
export type PageExtractionInput = z.infer<typeof pageExtractionSchema>;

export const extensionSaveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("product"), extraction: pageExtractionSchema, status: z.enum(["WISHLIST", "WATCHING"]).default("WISHLIST") }),
  z.object({ kind: z.literal("article"), extraction: pageExtractionSchema }),
  z.object({ kind: z.literal("watchlist"), symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-^]{0,9}$/) }),
  z.object({ kind: z.literal("travel"), extraction: pageExtractionSchema, tripId: id }),
]);

// ---------- Extension analysis response ----------
export type DataProvenance = "user" | "verified-account" | "observed" | "provider" | "demo" | "estimate" | "education";

export interface InsightLine {
  text: string;
  provenance: DataProvenance;
  tone?: "positive" | "negative" | "neutral" | "warning";
}

export interface ExtensionAnalysis {
  pageType: PageExtractionInput["pageType"];
  headline: string;
  product?: {
    title: string;
    merchant: string;
    priceCents: number | null;
    currency: string | null;
    imageUrl: string | null;
    saved: { id: string; status: string } | null;
    history: { observedAt: string; priceCents: number; merchant: string; source: string }[];
    historyStats: { count: number; lowCents: number; highCents: number; avgCents: number } | null;
    verdict: { label: string; tone: "positive" | "neutral" | "warning"; basis: string } | null;
    budget: { categoryName: string; remainingCents: number; limitCents: number; currency: string } | null;
    alternatives: { title: string; merchant: string; priceCents: number; currency: string; url: string; observedAt: string }[];
    /** Think-before-you-spend review against the user's plan; null when it can't be computed. */
    decision?: { verdict: "fits" | "consider" | "risk" | "unknown"; title: string; reasons: string[]; limited: boolean; reviewPath: string } | null;
  };
  instruments?: {
    symbol: string;
    name: string | null;
    known: boolean;
    priceCents: number | null;
    currency: string | null;
    changePercent: number | null;
    asOf: string | null;
    dataSource: string | null;
    isDemo: boolean;
    onWatchlist: boolean;
  }[];
  article?: { headline: string; publisher: string | null; publishedAt: string | null; summary: string | null; summarySource: "ai" | "page-metadata" | "none"; saved: boolean };
  travel?: { kind: string; provider: string; priceCents: number | null; currency: string | null; trips: { id: string; name: string; budgetCents: number | null; spentCents: number; currency: string }[] };
  insights: InsightLine[];
  disclaimers: string[];
  generatedAt: string;
}

// ---------- Account security ----------
/** A small list of passwords that appear at the top of every breach corpus. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "123456789", "1234567890", "12345678910", "qwertyuiop", "qwerty1234", "1q2w3e4r5t",
  "iloveyou12", "letmein123", "welcome123", "admin12345", "abc1234567", "passw0rd12", "football12", "baseball12", "superman12", "trustno1234",
  "veltrix123", "veltrix1234", "0123456789", "1111111111", "aaaaaaaaaa", "changeme12", "monkey1234", "dragon1234", "sunshine12", "princess12",
]);
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "That password is too common. Choose something less predictable.")
  .refine((p) => new Set(p).size >= 4, "Use a more varied password.");
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
export const tokenSchema = z.string().trim().min(20).max(200);
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: tokenSchema, password: passwordSchema });
export const verifyEmailSchema = z.object({ token: tokenSchema });
export const mfaCodeSchema = z.object({ code: z.string().trim().min(6, "Enter the 6-digit code").max(12) });
export const mfaDisableSchema = z.object({ password: z.string().min(1).max(200), code: z.string().trim().min(6).max(12) });
export const passwordConfirmSchema = z.object({ password: z.string().min(1).max(200) });

// ---------- Guided setup & advisor changes ----------
/** System spending categories a budget line can use, by slug. */
export const budgetCategorySlugs = ["housing", "utilities", "food", "transport", "health", "subscriptions", "entertainment", "shopping", "travel", "other"] as const;
const nonNegativeMoney = money.refine((v) => Number(v) >= 0, "Can't be negative");
const name80 = shortText(80).min(1, "Enter a name");

export const setupSchema = z.object({
  path: z.enum(["bank", "manual"]),
  accounts: z.array(z.object({ name: name80, type: z.enum(accountTypes), balance: money })).max(20).default([]),
  monthlyIncome: nonNegativeMoney.nullable().optional(),
  budget: z
    .array(z.object({ category: z.enum(budgetCategorySlugs), limit: positiveMoney }))
    .max(budgetCategorySlugs.length)
    .default([])
    .refine((lines) => new Set(lines.map((l) => l.category)).size === lines.length, "Each category can appear only once."),
  goal: z
    .object({ name: name80, kind: z.enum(goalKinds).default("OTHER"), target: positiveMoney, startingAmount: nonNegativeMoney.default("0"), targetDate: isoDate.nullable().optional(), plannedMonthly: nonNegativeMoney.nullable().optional() })
    .nullable()
    .optional(),
});

export const dashboardLayoutSchema = z.object({ layout: z.array(z.enum(DASHBOARD_WIDGET_IDS)).max(DASHBOARD_WIDGET_IDS.length) });

/**
 * One change the advisor can propose. Proposals are stored and only take effect when
 * the user applies them; they are re-validated against the user's data at that point.
 */
export const advisorChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_monthly_income"), amount: nonNegativeMoney }),
  z.object({ action: z.literal("update_account_balance"), accountId: id, balance: money }),
  z.object({ action: z.literal("create_account"), name: name80, type: z.enum(accountTypes), balance: money }),
  z.object({ action: z.literal("set_budget_limit"), category: z.enum(budgetCategorySlugs), limit: positiveMoney }),
  z.object({ action: z.literal("remove_budget_category"), category: z.enum(budgetCategorySlugs) }),
  z.object({ action: z.literal("create_goal"), name: name80, goalType: z.enum(goalKinds).default("OTHER"), target: positiveMoney, targetDate: isoDate.nullable().optional(), plannedMonthly: nonNegativeMoney.nullable().optional() }),
  z.object({ action: z.literal("update_goal"), goalId: id, target: positiveMoney.optional(), targetDate: isoDate.nullable().optional(), plannedMonthly: nonNegativeMoney.nullable().optional() }),
  z.object({ action: z.literal("add_goal_contribution"), goalId: id, amount: money.refine((v) => Number(v) !== 0, "Amount can't be zero") }),
  z.object({ action: z.literal("add_transaction"), date: isoDate, amount: money.refine((v) => Number(v) !== 0, "Amount can't be zero"), merchant: shortText(140).min(1), category: z.enum([...budgetCategorySlugs, "income"]).nullable().optional(), accountId: id.nullable().optional() }),
  z.object({ action: z.literal("set_dashboard_widget"), widget: z.enum(DASHBOARD_WIDGET_IDS), visible: z.boolean(), position: z.enum(["top", "bottom"]).optional() }),
]);
export type AdvisorChange = z.infer<typeof advisorChangeSchema>;
export const MAX_CHANGES_PER_PROPOSAL = 10;

// ---------- Planning: assumptions, scenarios, decisions, stress tests ----------
const cents = z.number().int().min(-100_000_000_00).max(100_000_000_00);
const posCents = cents.refine((v) => v > 0, "Must be greater than zero");
const monthIdx = z.number().int().min(0).max(119);
const label = shortText(80).min(1);

export const planningAssumptionsSchema = z.object({
  emergencyMonths: z.number().min(0).max(24).optional(),
  annualReturnPct: z.object({ best: z.number().min(-50).max(50), expected: z.number().min(-50).max(50), adverse: z.number().min(-90).max(50) }).optional(),
  spendingVariancePct: z.number().min(0).max(100).nullable().optional(),
  essentialCategories: z.array(z.string().max(64)).max(40).optional(),
  excludedAccountIds: z.array(id).max(100).optional(),
  debts: z.record(id, z.object({ aprPercent: z.number().min(0).max(100).nullable(), monthlyPaymentCents: z.number().int().min(0).max(100_000_000) })).optional(),
});
export type PlanningAssumptionsInput = z.infer<typeof planningAssumptionsSchema>;

export const scenarioChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("one_time"), label, amountCents: cents.refine((v) => v !== 0, "Can't be zero"), month: monthIdx }),
  z.object({ kind: z.literal("income"), label, percent: z.number().min(-100).max(500).optional(), amountCents: cents.optional(), startMonth: monthIdx, months: z.number().int().min(1).max(120).nullable() }),
  z.object({ kind: z.literal("expense"), label, bucket: z.enum(["essential", "discretionary"]), percent: z.number().min(-100).max(500).optional(), amountCents: cents.optional(), startMonth: monthIdx, months: z.number().int().min(1).max(120).nullable() }),
  z.object({ kind: z.literal("extra_saving"), label, amountCents: posCents, startMonth: monthIdx, goalId: id.nullable().optional() }),
  z.object({ kind: z.literal("extra_debt_payment"), label, amountCents: posCents, startMonth: monthIdx }),
  z.object({ kind: z.literal("financed_purchase"), label, amountCents: posCents, months: z.number().int().min(1).max(120), aprPercent: z.number().min(0).max(100), startMonth: monthIdx }),
]);

export const scenarioRequestSchema = z.object({
  changes: z.array(scenarioChangeSchema).max(12),
  horizonMonths: z.number().int().min(3).max(120).default(24),
});

export const decisionRequestSchema = z.object({
  label: label,
  priceCents: posCents,
  categorySlug: z.enum(budgetCategorySlugs).nullable().optional(),
  financing: z.object({ months: z.number().int().min(1).max(120), aprPercent: z.number().min(0).max(100) }).nullable().optional(),
  alternative: z.object({ label, priceCents: posCents }).nullable().optional(),
  waitMonths: z.number().int().min(1).max(24).optional(),
  usesPerMonth: z.number().min(0).max(1000).nullable().optional(),
  horizonMonths: z.number().int().min(6).max(60).default(24),
});

export const stressRequestSchema = z.object({
  incomeLossMonths: z.number().int().min(0).max(24).default(0),
  incomeReplacementPct: z.number().min(0).max(100).default(0),
  emergencyCostCents: z.number().int().min(0).max(100_000_000_00).default(0),
  essentialIncreaseCents: z.number().int().min(0).max(100_000_000).default(0),
  discretionaryCutPct: z.number().min(0).max(100).default(0),
  horizonMonths: z.number().int().min(3).max(36).default(12),
});

export const planSnapshotCreateSchema = z.object({
  name: label,
  kind: z.enum(["scenario", "purchase", "stress"]),
  changes: z.array(scenarioChangeSchema).max(12),
  horizonMonths: z.number().int().min(3).max(120).default(24),
  decision: z.object({ label, priceCents: posCents, verdict: z.enum(["fits", "consider", "risk", "unknown"]), choice: z.enum(["buy_now", "buy_later", "alternative", "financed", "skip", "undecided"]) }).nullable().optional(),
  note: shortText(500).optional().default(""),
});
