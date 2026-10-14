import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = ["APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

async function appUrl(vars: Record<string, string>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  vi.resetModules();
  return (await import("@/server/env")).env.appUrl;
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

describe("public app address (email links)", () => {
  it("uses APP_URL, tidied", async () => {
    expect(await appUrl({ APP_URL: "https://veltrix.app/" })).toBe("https://veltrix.app");
    expect(await appUrl({ APP_URL: "veltrix-xyz.vercel.app" })).toBe("https://veltrix-xyz.vercel.app");
    expect(await appUrl({ APP_URL: '"https://veltrix.app"' })).toBe("https://veltrix.app");
  });

  it("uses Vercel's production domain when APP_URL is missing or still localhost", async () => {
    expect(await appUrl({ VERCEL_PROJECT_PRODUCTION_URL: "veltrix-xyz.vercel.app" })).toBe("https://veltrix-xyz.vercel.app");
    expect(await appUrl({ APP_URL: "http://localhost:3000", VERCEL_PROJECT_PRODUCTION_URL: "veltrix-xyz.vercel.app", VERCEL_URL: "veltrix-abc123.vercel.app" })).toBe("https://veltrix-xyz.vercel.app");
  });

  it("stays on localhost for local development", async () => {
    expect(await appUrl({})).toBe("http://localhost:3000");
    expect(await appUrl({ APP_URL: "http://localhost:3000" })).toBe("http://localhost:3000");
  });
});
