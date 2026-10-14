/**
 * Status of every third-party integration. Integrations without credentials are
 * reported honestly as "not configured" — the UI never pretends a connection exists.
 */
import { env } from "../env";
import { marketData } from "./market";

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
      purpose: "Quotes, price history and company profiles.",
      configured: !md.isDemo,
      mode: md.label,
      envVars: ["MARKET_DATA_PROVIDER", "ALPHA_VANTAGE_API_KEY"],
    },
    {
      id: "aggregator",
      name: "Bank account aggregation",
      purpose: "Securely connect bank accounts through a provider's official consent flow.",
      configured: false,
      mode: "Not configured — add accounts manually or import CSV files",
      envVars: ["AGGREGATOR_PROVIDER", "PLAID_CLIENT_ID", "PLAID_SECRET"],
    },
    {
      id: "fx",
      name: "Currency exchange rates",
      purpose: "Convert foreign-currency balances and trip costs.",
      configured: env.fx.provider !== "none",
      mode: env.fx.provider === "frankfurter" ? "Frankfurter (ECB reference rates)" : "Not configured — foreign-currency accounts are shown separately",
      envVars: ["FX_PROVIDER"],
    },
    { id: "news", name: "Financial news", purpose: "Headlines related to your watchlist.", configured: false, mode: "Not configured — save articles with the browser extension", envVars: ["NEWS_PROVIDER", "NEWS_API_KEY"] },
    { id: "prices", name: "Product price feeds", purpose: "Verified price comparisons across merchants.", configured: false, mode: "Not configured — uses prices you've observed with the extension", envVars: ["PRICE_FEED_PROVIDER"] },
    { id: "travel", name: "Travel pricing", purpose: "Live flight and hotel prices.", configured: false, mode: "Not configured — track trips and quotes manually or via the extension", envVars: ["TRAVEL_PROVIDER"] },
  ];
}
