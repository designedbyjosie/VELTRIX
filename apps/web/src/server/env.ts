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
    provider: (optional("MARKET_DATA_PROVIDER") ?? "demo") as "demo" | "alphavantage",
    alphaVantageKey: optional("ALPHA_VANTAGE_API_KEY"),
  },
  fx: { provider: (optional("FX_PROVIDER") ?? "none") as "none" | "frankfurter" },
  aggregator: { provider: optional("AGGREGATOR_PROVIDER"), plaidClientId: optional("PLAID_CLIENT_ID") },
  /** Extra origins (e.g. chrome-extension://<id>) allowed to call token-authenticated APIs. */
  extensionOrigins: (optional("EXTENSION_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};
