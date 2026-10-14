/// <reference types="chrome" />
/**
 * Loads the built extension into Chromium and runs the core cross-product journey:
 * pair → analyze a shopping page → save to wishlist → product appears in the web app.
 * Requires `npm run build -w @veltrix/extension` (built for http://localhost:3000).
 */
import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXT = join(__dirname, "..", "..", "extension", "dist");

test.describe("browser extension", () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    test.skip(!existsSync(join(EXT, "manifest.json")), "Build the extension first: npm run build:extension");
    context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "vx-e2e-")), {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
      headless: true,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    });
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent("serviceworker");
    extensionId = new URL(worker.url()).host;
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test("pairs, analyzes a product page and saves it to the shared wishlist", async () => {
    const page = await context.newPage();
    const email = `ext${Date.now()}@example.com`;
    const reg = await page.request.post("http://localhost:3000/api/auth/register", {
      data: { name: "Ext Tester", email, password: "correct horse battery", acceptTerms: true },
      headers: { origin: "http://localhost:3000" },
    });
    expect(reg.status()).toBe(201);
    const codeRes = await page.request.post("http://localhost:3000/api/extension/pairing-code", { data: {}, headers: { origin: "http://localhost:3000" } });
    const { code } = await codeRes.json();

    // A product page the extension may read.
    const store = await context.newPage();
    await store.goto("http://localhost:3000/demo/store");
    await expect(store.getByRole("heading", { name: /Aurora ANC/ })).toBeVisible();

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const tabId = await popup.evaluate(async () => (await chrome.tabs.query({ url: "http://localhost:3000/demo/store" }))[0]?.id);
    expect(tabId).toBeTruthy();
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);

    // Not connected yet: local-only detection, nothing sent.
    await expect(popup.getByText("Analyzed locally. Nothing was sent to VELTRIX.")).toBeVisible();
    await expect(popup.getByText("$249.00")).toBeVisible();

    await popup.fill("#pair-code", code);
    await popup.getByRole("button", { name: "Connect" }).click();

    // Connected analysis from the backend.
    await expect(popup.getByText("Product page")).toBeVisible();
    await expect(popup.getByText("Save this product to start recording its price history.")).toBeVisible();
    await expect(popup.getByText("Signed in as Ext Tester")).toBeVisible();
    await popup.getByRole("button", { name: "Save to wishlist" }).click();
    await expect(popup.getByRole("status")).toHaveText("Saved to your wishlist ✓");
    if (process.env.SCREENSHOT_DIR) {
      await popup.setViewportSize({ width: 380, height: 640 });
      await popup.screenshot({ path: join(process.env.SCREENSHOT_DIR, "extension-popup.png") });
    }

    // The saved product appears in the web app for the same account.
    await page.goto("http://localhost:3000/app/shopping");
    await expect(page.getByText("Aurora ANC Wireless Headphones (Demo Product)")).toBeVisible();
    await expect(page.getByText("From extension")).toBeVisible();
    await expect(page.getByText("VELTRIX Demo Store")).toBeVisible();

    // Re-analyzing shows the saved state.
    await popup.reload();
    await expect(popup.getByRole("button", { name: "View price history" })).toBeVisible();
  });

  test("does not analyze browser-internal pages", async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    const tabId = await popup.evaluate(async () => (await chrome.tabs.query({}))[0]?.id);
    const blank = await context.newPage();
    await blank.goto("about:blank");
    const blankId = await popup.evaluate(async () => (await chrome.tabs.query({ url: "about:blank" }))[0]?.id ?? null);
    await popup.goto(`chrome-extension://${extensionId}/popup.html?tabId=${blankId ?? tabId}`);
    await expect(popup.getByText(/Nothing to analyze here|can't be analyzed/)).toBeVisible();
  });
});
