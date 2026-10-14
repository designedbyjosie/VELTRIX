/**
 * VELTRIX service worker: the only component that stores the API key and talks to
 * the backend. Popup and options pages ask it to act via runtime messages.
 */
import type { ExtensionAnalysis, PageExtraction } from "@veltrix/shared";
import { apiCall, ApiError, OfflineError } from "./lib/api";
import { API_URL } from "./lib/config";
import { isRequest, type Account, type AnalyzeResult, type Request, type Settings } from "./lib/messages";

const DEFAULT_SETTINGS: Settings = { autoAnalyze: true, shareArticleText: false, disabledSites: [] };

async function getToken(): Promise<string | null> {
  const { token } = await chrome.storage.local.get("token");
  return typeof token === "string" ? token : null;
}

async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
}

async function clearAuth() {
  await chrome.storage.local.remove(["token", "account"]);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function authed<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new ApiError(401, "Connect the extension to your VELTRIX account.", "not_connected");
  try {
    return await apiCall<T>(path, { ...opts, token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) await clearAuth();
    throw e;
  }
}

async function extract(tabId: number, includeArticleExcerpt: boolean): Promise<PageExtraction> {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (opts: { includeArticleExcerpt: boolean }) => {
      (globalThis as unknown as { __veltrixOptions: unknown }).__veltrixOptions = opts;
    },
    args: [{ includeArticleExcerpt }],
  });
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, files: ["extractor.js"] });
  return res.result as PageExtraction;
}

async function analyze(tabId?: number): Promise<AnalyzeResult> {
  const tab = tabId !== undefined ? await chrome.tabs.get(tabId) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  const url = tab?.url ?? null;
  if (!tab?.id || !url || !/^https?:/i.test(url)) return { state: "unsupported", reason: "browser-page", url };
  const settings = await getSettings();
  const host = hostOf(url);
  if (host && settings.disabledSites.some((d) => host === d || host.endsWith(`.${d}`))) return { state: "unsupported", reason: "disabled-site", url };

  const account = (await chrome.storage.local.get("account")).account as Account | undefined;
  const includeExcerpt = settings.shareArticleText && !!account?.consents.pageContent;
  let extraction: PageExtraction;
  try {
    extraction = await extract(tab.id, includeExcerpt);
  } catch {
    return { state: "unsupported", reason: "no-access", url };
  }
  if (!(await getToken())) return { state: "local-only", extraction, reason: "not-connected" };
  try {
    const analysis = await authed<ExtensionAnalysis>("/api/ext/analyze", { body: extraction });
    return { state: "ok", extraction, analysis };
  } catch (e) {
    if (e instanceof OfflineError) return { state: "offline", extraction };
    if (e instanceof ApiError && e.status === 401) return { state: "local-only", extraction, reason: "not-connected" };
    return { state: "error", message: e instanceof Error ? e.message : "Analysis failed.", extraction };
  }
}

async function refreshAccount(): Promise<Account | null> {
  if (!(await getToken())) return null;
  const account = await authed<Account>("/api/ext/me");
  await chrome.storage.local.set({ account });
  return account;
}

async function handle(req: Request): Promise<unknown> {
  switch (req.type) {
    case "status": {
      const token = await getToken();
      if (!token) return { connected: false, apiUrl: API_URL };
      try {
        return { connected: true, apiUrl: API_URL, account: await refreshAccount() };
      } catch (e) {
        if (e instanceof OfflineError) return { connected: true, offline: true, apiUrl: API_URL, account: (await chrome.storage.local.get("account")).account ?? null };
        if (e instanceof ApiError && e.status === 401) return { connected: false, apiUrl: API_URL };
        throw e;
      }
    }
    case "pair": {
      const r = await apiCall<{ token: string }>("/api/ext/pair", { body: { code: req.code, deviceName: `${navigator.userAgent.includes("Edg/") ? "Edge" : "Chrome"} extension` } });
      await chrome.storage.local.set({ token: r.token });
      return { connected: true, account: await refreshAccount() };
    }
    case "disconnect": {
      await authed("/api/ext/disconnect", { body: {} }).catch(() => undefined);
      await clearAuth();
      return { connected: false };
    }
    case "analyze":
      return analyze(req.tabId);
    case "save":
      return authed("/api/ext/save", { body: req.payload });
    case "trips":
      return authed<{ trips: unknown[] }>("/api/trips");
    case "settings:get":
      return getSettings();
    case "settings:set": {
      const current = await getSettings();
      const s = req.settings;
      const next: Settings = {
        autoAnalyze: typeof s.autoAnalyze === "boolean" ? s.autoAnalyze : current.autoAnalyze,
        shareArticleText: typeof s.shareArticleText === "boolean" ? s.shareArticleText : current.shareArticleText,
        disabledSites: Array.isArray(s.disabledSites) ? s.disabledSites.filter((d): d is string => typeof d === "string" && /^[a-z0-9.-]{1,253}$/i.test(d)).map((d) => d.toLowerCase()).slice(0, 200) : current.disabledSites,
      };
      await chrome.storage.local.set({ settings: next });
      return next;
    }
    case "open":
      await chrome.tabs.create({ url: `${API_URL}${req.path}` });
      return { opened: true };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  // Only accept messages from this extension's own pages (popup/options), identified by their
  // chrome-extension:// origin. Web pages can't message us at all (no externally_connectable),
  // and the injected extractor never sends messages.
  const ownOrigin = `chrome-extension://${chrome.runtime.id}/`;
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(ownOrigin) || !isRequest(message)) {
    sendResponse({ ok: false, error: "Rejected." });
    return false;
  }
  handle(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e: unknown) =>
      sendResponse({ ok: false, error: e instanceof OfflineError ? "VELTRIX can't be reached. Check your connection." : e instanceof Error ? e.message : "Something went wrong.", code: e instanceof ApiError ? e.code : e instanceof OfflineError ? "offline" : undefined }),
    );
  return true;
});

// External messages are never accepted.
chrome.runtime.onMessageExternal?.addListener((_m, _s, sendResponse) => sendResponse({ ok: false, error: "Rejected." }));

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") await chrome.runtime.openOptionsPage();
});
