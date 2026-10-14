/**
 * Server-only configuration. Secrets are read here and never sent to the client.
 * Optional integrations report "not configured" instead of failing.
 */

function optional(name: string): string | null {
  let v = process.env[name]?.trim();
  // Hosting dashboards store values literally, so a pasted "value" keeps its quotes.
  if (v && v.length >= 2 && /^(["']).*\1$/.test(v)) v = v.slice(1, -1).trim();
  return v ? v : null;
}

const first = (...names: string[]) => names.map(optional).find((v) => v !== null) ?? null;

const KNOWN_SMTP_HOSTS: Record<string, string> = {
  "gmail.com": "smtp.gmail.com",
  "googlemail.com": "smtp.gmail.com",
  "icloud.com": "smtp.mail.me.com",
  "me.com": "smtp.mail.me.com",
  "mac.com": "smtp.mail.me.com",
  "outlook.com": "smtp-mail.outlook.com",
  "hotmail.com": "smtp-mail.outlook.com",
  "live.com": "smtp-mail.outlook.com",
  "yahoo.com": "smtp.mail.yahoo.com",
};

/**
 * SMTP settings. Only SMTP_USER and SMTP_PASS are required for Gmail, iCloud, Outlook
 * and Yahoo addresses: the server is inferred from the address and the sender defaults
 * to "VELTRIX <SMTP_USER>". Common alternative variable names are accepted too.
 */
function mailSettings() {
  const user = first("SMTP_USER", "SMTP_USERNAME", "EMAIL_USER", "GMAIL_USER");
  const domain = user?.split("@")[1]?.toLowerCase() ?? "";
  const host = first("SMTP_HOST", "EMAIL_HOST") ?? KNOWN_SMTP_HOSTS[domain] ?? null;
  const rawPass = first("SMTP_PASS", "SMTP_PASSWORD", "EMAIL_PASS", "EMAIL_PASSWORD", "GMAIL_APP_PASSWORD");
  // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces aren't part of it.
  const pass = rawPass && host === "smtp.gmail.com" ? rawPass.replace(/\s+/g, "") : rawPass;
  const from = first("EMAIL_FROM", "SMTP_FROM", "MAIL_FROM") ?? (user ? `VELTRIX <${user}>` : null);
  return { host, port: Number(first("SMTP_PORT", "EMAIL_PORT") ?? 587), user, pass, from };
}

export const env = {
  appUrl: optional("APP_URL") ?? "http://localhost:3000",
  /** 32-byte key (base64) for encrypting secrets at rest: two-factor secrets and bank-connection tokens. */
  encryptionKey: optional("ENCRYPTION_KEY"),
  requireEmailVerification: (optional("REQUIRE_EMAIL_VERIFICATION") ?? "true") !== "false",
  mail: mailSettings(),
  isProduction: process.env.NODE_ENV === "production",
  bcryptCost: Number(optional("BCRYPT_COST") ?? 12),
  ai: {
    provider: (optional("AI_PROVIDER") ?? "none") as "anthropic" | "openai" | "none",
    apiKey: optional("AI_API_KEY"),
    model: optional("AI_MODEL"),
    baseUrl: optional("AI_BASE_URL"),
    dailyMessageLimit: Number(optional("AI_DAILY_MESSAGE_LIMIT") ?? 100),
  },
  market: {
    provider: (optional("MARKET_DATA_PROVIDER") ?? (optional("FINNHUB_API_KEY") ? "finnhub" : "none")) as "none" | "demo" | "finnhub" | "alphavantage",
    finnhubKey: optional("FINNHUB_API_KEY"),
    alphaVantageKey: optional("ALPHA_VANTAGE_API_KEY"),
  },
  fx: { provider: (optional("FX_PROVIDER") ?? "frankfurter") as "none" | "frankfurter" },
  plaid: {
    clientId: optional("PLAID_CLIENT_ID"),
    secret: optional("PLAID_SECRET"),
    env: (optional("PLAID_ENV") ?? "sandbox") as "sandbox" | "production",
    countryCodes: (optional("PLAID_COUNTRY_CODES") ?? "US").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
  },
  /** Extra origins (e.g. chrome-extension://<id>) allowed to call token-authenticated APIs. */
  extensionOrigins: (optional("EXTENSION_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};
