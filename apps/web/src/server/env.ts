/**
 * Server-only configuration. Secrets are read here and never sent to the client.
 * Optional integrations report "not configured" instead of failing.
 */

function optional(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export const env = {
  appUrl: optional("APP_URL") ?? "http://localhost:3000",
  /** 32-byte key (base64) for encrypting secrets at rest: two-factor secrets and bank-connection tokens. */
  encryptionKey: optional("ENCRYPTION_KEY"),
  requireEmailVerification: (optional("REQUIRE_EMAIL_VERIFICATION") ?? "true") !== "false",
  mail: {
    host: optional("SMTP_HOST"),
    port: Number(optional("SMTP_PORT") ?? 587),
    user: optional("SMTP_USER"),
    pass: optional("SMTP_PASS"),
    from: optional("EMAIL_FROM"),
  },
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
