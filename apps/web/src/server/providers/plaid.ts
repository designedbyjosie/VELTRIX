/**
 * Minimal Plaid API client (https://plaid.com/docs/api/). Credentials are sent in
 * headers from the server only. Errors surface Plaid's error_code so the UI can
 * react (e.g. ITEM_LOGIN_REQUIRED → reconnect).
 */
import { env } from "../env";
import { HttpError } from "../errors";

export class PlaidError extends Error {
  constructor(
    public code: string,
    message: string,
    public displayMessage: string | null,
  ) {
    super(message);
  }
}

export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: { current: number | null; available: number | null; iso_currency_code: string | null; unofficial_currency_code: string | null };
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  date: string;
  name: string;
  merchant_name: string | null;
  pending: boolean;
  personal_finance_category: { primary: string; detailed: string } | null;
}

export interface SyncPage {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
}

let fetchOverride: typeof fetch | null = null;
/** Tests inject a fake transport here. */
export function setPlaidFetch(f: typeof fetch | null) {
  fetchOverride = f;
}

export function plaidConfigured() {
  return !!(env.plaid.clientId && env.plaid.secret);
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!plaidConfigured()) throw new HttpError(503, "not_configured", "Bank connections aren't set up on this server yet.");
  const base = env.plaid.env === "production" ? "https://production.plaid.com" : "https://sandbox.plaid.com";
  let res: Response;
  try {
    res = await (fetchOverride ?? fetch)(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "PLAID-CLIENT-ID": env.plaid.clientId!, "PLAID-SECRET": env.plaid.secret!, "Plaid-Version": "2020-09-14" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new PlaidError("NETWORK_ERROR", "Couldn't reach Plaid.", null);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new PlaidError(String(data.error_code ?? "UNKNOWN"), String(data.error_message ?? `Plaid returned ${res.status}`), (data.display_message as string | null) ?? null);
  return data as T;
}

export const plaid = {
  linkTokenCreate: (userId: string, accessToken?: string) =>
    call<{ link_token: string; expiration: string }>("/link/token/create", {
      client_name: "VELTRIX",
      user: { client_user_id: userId },
      country_codes: env.plaid.countryCodes,
      language: "en",
      ...(accessToken ? { access_token: accessToken } : { products: ["transactions"], transactions: { days_requested: 730 } }),
    }),
  exchange: (publicToken: string) => call<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token: publicToken }),
  accounts: (accessToken: string) => call<{ accounts: PlaidAccount[]; item: { institution_id: string | null } }>("/accounts/get", { access_token: accessToken }),
  sync: (accessToken: string, cursor: string | null) => call<SyncPage>("/transactions/sync", { access_token: accessToken, ...(cursor ? { cursor } : {}), count: 500 }),
  remove: (accessToken: string) => call<{ request_id: string }>("/item/remove", { access_token: accessToken }),
};
