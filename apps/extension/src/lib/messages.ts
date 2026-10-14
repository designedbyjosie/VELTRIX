/**
 * Messages between extension pages (popup/options) and the service worker.
 * The service worker is the only component that holds the API key or talks to the backend.
 */
import type { ExtensionAnalysis, PageExtraction } from "@veltrix/shared";

export interface Account {
  displayName: string;
  email: string;
  baseCurrency: string;
  consents: { pageContent: boolean; aiProcessing: boolean; priceTracking: boolean };
  autoAnalyze: boolean;
}

export interface Settings {
  autoAnalyze: boolean;
  shareArticleText: boolean;
  disabledSites: string[];
}

export type Request =
  | { type: "status" }
  | { type: "pair"; code: string }
  | { type: "disconnect" }
  | { type: "analyze"; tabId?: number }
  | { type: "save"; payload: SavePayload }
  | { type: "trips" }
  | { type: "settings:get" }
  | { type: "settings:set"; settings: Partial<Settings> }
  | { type: "open"; path: string };

export type SavePayload =
  | { kind: "product"; extraction: PageExtraction; status: "WISHLIST" | "WATCHING" }
  | { kind: "article"; extraction: PageExtraction }
  | { kind: "watchlist"; symbol: string }
  | { kind: "travel"; extraction: PageExtraction; tripId: string };

export type AnalyzeResult =
  | { state: "ok"; extraction: PageExtraction; analysis: ExtensionAnalysis }
  | { state: "local-only"; extraction: PageExtraction; reason: "not-connected" }
  | { state: "unsupported"; reason: "browser-page" | "disabled-site" | "no-access"; url: string | null }
  | { state: "offline"; extraction: PageExtraction | null }
  | { state: "error"; message: string; extraction: PageExtraction | null };

export type Response<T = unknown> = { ok: true; data: T } | { ok: false; error: string; code?: string };

export function send<T>(req: Request): Promise<Response<T>> {
  return chrome.runtime.sendMessage(req);
}

const TYPES = new Set(["status", "pair", "disconnect", "analyze", "save", "trips", "settings:get", "settings:set", "open"]);

/** Structural validation of incoming messages (defense in depth; only our own pages can send). */
export function isRequest(m: unknown): m is Request {
  if (!m || typeof m !== "object") return false;
  const r = m as Record<string, unknown>;
  if (typeof r.type !== "string" || !TYPES.has(r.type)) return false;
  switch (r.type) {
    case "pair":
      return typeof r.code === "string" && r.code.length <= 20;
    case "analyze":
      return r.tabId === undefined || (typeof r.tabId === "number" && Number.isInteger(r.tabId));
    case "save":
      return !!r.payload && typeof r.payload === "object" && ["product", "article", "watchlist", "travel"].includes(String((r.payload as Record<string, unknown>).kind));
    case "settings:set":
      return !!r.settings && typeof r.settings === "object";
    case "open":
      return typeof r.path === "string" && r.path.startsWith("/app") && !r.path.startsWith("//") && r.path.length < 200;
    default:
      return true;
  }
}
