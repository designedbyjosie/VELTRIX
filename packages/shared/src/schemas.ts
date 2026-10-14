/**
 * Request/response contracts shared by the web app, its API routes and the
 * browser extension. The server validates every request against these.
 */
import { z } from "zod";

const money = z
  .string()
  .trim()
  .regex(/^-?\d{1,13}(\.\d{1,2})?$/, "Enter an amount like 12.34");
const positiveMoney = money.refine((v) => Number(v) > 0, "Must be greater than zero");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const id = z.string().min(1).max(64);
const shortText = (max: number) => z.string().trim().max(max);

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
  password: z.string().min(10, "Use at least 10 characters").max(200),
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
  url: z.string().url().max(2048).refine((u) => /^https?:/i.test(u), "Only http(s) links"),
  imageUrl: z.string().url().max(2048).refine((u) => /^https:/i.test(u), "Only https images").nullable().optional(),
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
  url: z.string().url().max(2048).refine((u) => /^https?:/i.test(u), "Only http(s) links"),
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
  sourceUrl: z.string().url().max(2048).nullable().optional(),
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
  imageUrl: z.string().url().max(2048).nullable(),
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
  url: z.string().url().max(2048),
  canonicalUrl: z.string().url().max(2048),
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
