/**
 * System transaction categories and deterministic rule-based categorization.
 * Rules are transparent keyword matches so users can understand (and override)
 * every automatic categorization.
 */
export type CategoryKind = "EXPENSE" | "INCOME" | "TRANSFER";

export interface SystemCategory {
  slug: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
}

export const SYSTEM_CATEGORIES: SystemCategory[] = [
  { slug: "housing", name: "Housing", kind: "EXPENSE", color: "#3B82F6", icon: "home" },
  { slug: "food", name: "Food & Dining", kind: "EXPENSE", color: "#D96A26", icon: "utensils" },
  { slug: "shopping", name: "Shopping", kind: "EXPENSE", color: "#1798BD", icon: "shopping-bag" },
  { slug: "transport", name: "Transportation", kind: "EXPENSE", color: "#D55181", icon: "car" },
  { slug: "travel", name: "Travel", kind: "EXPENSE", color: "#C98500", icon: "plane" },
  { slug: "entertainment", name: "Entertainment", kind: "EXPENSE", color: "#8F72F0", icon: "clapperboard" },
  { slug: "utilities", name: "Utilities", kind: "EXPENSE", color: "#16A06C", icon: "zap" },
  { slug: "health", name: "Health", kind: "EXPENSE", color: "#5D7290", icon: "heart-pulse" },
  { slug: "subscriptions", name: "Subscriptions", kind: "EXPENSE", color: "#5D7290", icon: "repeat" },
  { slug: "other", name: "Other", kind: "EXPENSE", color: "#5D7290", icon: "circle-dot" },
  { slug: "income", name: "Income", kind: "INCOME", color: "#26D9A0", icon: "wallet" },
  { slug: "transfer", name: "Transfers", kind: "TRANSFER", color: "#647896", icon: "arrow-left-right" },
];

/** Chart groups used by the dashboard spending breakdown (max 8 slices). */
export const CHART_GROUPS = [
  "housing",
  "food",
  "shopping",
  "transport",
  "travel",
  "entertainment",
  "utilities",
  "other",
] as const;
export type ChartGroup = (typeof CHART_GROUPS)[number];

export function chartGroupFor(slug: string | null | undefined): ChartGroup {
  return (CHART_GROUPS as readonly string[]).includes(slug ?? "") ? (slug as ChartGroup) : "other";
}

interface Rule {
  slug: string;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  { slug: "transfer", patterns: [/\btransfer\b/, /\bzelle\b/, /\bvenmo\b/, /credit card payment/, /\bautopay\b/] },
  { slug: "income", patterns: [/\bpayroll\b/, /\bsalary\b/, /direct dep/, /\bdividend\b/, /\binterest paid\b/, /\brefund\b/] },
  { slug: "housing", patterns: [/\brent\b/, /\bmortgage\b/, /property mgmt/, /\bhoa\b/, /apartments?\b/] },
  { slug: "utilities", patterns: [/electric/, /\bwater\b/, /\bgas co/, /comcast|xfinity|verizon|at&t|t-mobile|spectrum/, /\binternet\b/, /utility/] },
  {
    slug: "subscriptions",
    patterns: [/netflix|spotify|hulu|disney\+|youtube premium|apple\.com\/bill|icloud|adobe|dropbox|patreon|audible|hbo|max\.com|paramount/],
  },
  { slug: "travel", patterns: [/airlines?|delta|united|american air|southwest|jetblue|lufthansa|ryanair/, /\bhotel|marriott|hilton|hyatt|airbnb|booking\.com|expedia/] },
  { slug: "transport", patterns: [/\buber\b|\blyft\b/, /shell|chevron|exxon|\bbp\b|gas station|fuel/, /parking|transit|metro|toll/] },
  { slug: "food", patterns: [/restaurant|cafe|coffee|starbucks|chipotle|mcdonald|doordash|grubhub|uber eats|pizza|sushi|bakery|grocery|whole foods|trader joe|safeway|kroger/] },
  { slug: "health", patterns: [/pharmacy|cvs|walgreens|clinic|dental|medical|hospital|gym|fitness/] },
  { slug: "entertainment", patterns: [/cinema|theater|theatre|steam|playstation|xbox|nintendo|ticketmaster|concert|museum/] },
  { slug: "shopping", patterns: [/amazon|target|walmart|best buy|costco|ikea|etsy|ebay|apple store|nike|zara|h&m/] },
];

export interface CategorizationResult {
  slug: string;
  matched: string | null;
}

/**
 * Categorize a transaction from its merchant/description and sign.
 * Positive amounts without a matching rule default to income; negative to other.
 */
export function categorize(merchant: string, description = "", amountCents = -1): CategorizationResult {
  const text = `${merchant} ${description}`.toLowerCase();
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      const m = text.match(p);
      if (m) {
        // Income rules only apply to inflows; expense rules only to outflows (transfers either way)
        if (rule.slug === "income" && amountCents < 0) continue;
        if (rule.slug !== "income" && rule.slug !== "transfer" && amountCents > 0) continue;
        return { slug: rule.slug, matched: m[0] };
      }
    }
  }
  return { slug: amountCents > 0 ? "income" : "other", matched: null };
}

/** Normalize a merchant name into a stable key (used for recurring detection and dedupe). */
export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/\*.*$/, "")
    .replace(/#\s?\d+/g, "")
    .replace(/\b(inc|llc|ltd|co|corp)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b\d{3,}\b/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

const MERCHANT_NOISE = /\b(www|com|net|org|co|us|uk|online|digital|payment|payments|pmt|bill|billing|subscription|subscr|recurring|purchase|pos|debit|ach|autopay)\b/g;

/**
 * Whether two bank descriptors refer to the same merchant ("Netflix" / "NETFLIX.COM" /
 * "Netflix Subscription"). Conservative: after removing web and billing words, the names
 * must match, or share a distinctive first word of at least 6 letters.
 */
export function sameMerchant(a: string, b: string): boolean {
  const clean = (m: string) => merchantKey(m).replace(MERCHANT_NOISE, " ").replace(/\s+/g, " ").trim();
  const x = clean(a);
  const y = clean(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const fx = x.split(" ")[0];
  const fy = y.split(" ")[0];
  return fx === fy && fx.length >= 6;
}
