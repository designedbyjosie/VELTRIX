/**
 * Status of every third-party integration. Integrations without credentials are
 * reported honestly as "not configured" — the UI never pretends a connection exists.
 */
import { env } from "../env";
import { marketData } from "./market";
import { mailConfigured, missingMailSettings } from "../mail";

export interface IntegrationStatus {
  id: string;
  name: string;
  purpose: string;
  configured: boolean;
  mode: string;
  envVars: string[];
}

export function integrationStatuses(): IntegrationStatus[] {
  const md = marketData();
  return [
    {
      id: "ai",
      name: "AI language model",
      purpose: "Conversational answers in the AI Advisor and article summaries.",
      configured: env.ai.provider !== "none" && !!env.ai.apiKey,
      mode: env.ai.provider !== "none" && env.ai.apiKey ? `${env.ai.provider}` : "Built-in deterministic analysis only",
      envVars: ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL"],
    },
    {
      id: "market",
      name: "Market data",
      purpose: "Live quotes, symbol search, company profiles and company news.",
      configured: md.id !== "none" && !md.isDemo,
      mode: md.id === "none" ? "Not configured — no prices are shown" : md.label,
      envVars: ["FINNHUB_API_KEY", "ALPHA_VANTAGE_API_KEY (optional, price history)"],
    },
    {
      id: "aggregator",
      name: "Bank connections (Plaid)",
      purpose: "Securely link bank, card, loan and investment accounts through Plaid's official consent flow.",
      configured: !!(env.plaid.clientId && env.plaid.secret),
      mode: env.plaid.clientId && env.plaid.secret ? `Plaid ${env.plaid.env}` : "Not configured — add accounts manually or import CSV files",
      envVars: ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"],
    },
    {
      id: "fx",
      name: "Currency exchange rates",
      purpose: "Convert foreign-currency balances into your base currency.",
      configured: env.fx.provider !== "none",
      mode: env.fx.provider === "frankfurter" ? "European Central Bank reference rates (via Frankfurter)" : "Turned off — foreign-currency accounts are shown separately",
      envVars: ["FX_PROVIDER"],
    },
    {
      id: "email",
      name: "Email",
      purpose: "Account confirmation, password resets and security alerts.",
      configured: mailConfigured(),
      mode: mailConfigured() ? `SMTP via ${env.mail.host} as ${env.mail.user}` : `Not configured (missing ${missingMailSettings().join(", ")}). ${env.isProduction ? "Sign-up emails can't be sent." : "Emails are printed to the server log."}`,
      envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"],
    },
    { id: "news", name: "Financial news", purpose: "Company headlines on instrument pages.", configured: md.id === "finnhub", mode: md.id === "finnhub" ? "Finnhub company news" : "Comes with Finnhub market data; save articles with the extension meanwhile", envVars: ["FINNHUB_API_KEY"] },
    { id: "prices", name: "Product price feeds", purpose: "Verified price comparisons across merchants.", configured: false, mode: "Not configured — uses prices you've observed with the extension", envVars: ["PRICE_FEED_PROVIDER"] },
    { id: "travel", name: "Travel pricing", purpose: "Live flight and hotel prices.", configured: false, mode: "Not configured — track trips and quotes manually or via the extension", envVars: ["TRAVEL_PROVIDER"] },
  ];
}
