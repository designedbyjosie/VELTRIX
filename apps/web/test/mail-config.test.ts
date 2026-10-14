import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_PASSWORD", "EMAIL_FROM"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

async function load(vars: Record<string, string>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  vi.resetModules();
  const { env } = await import("@/server/env");
  const mail = await import("@/server/mail");
  return { mail: env.mail, configured: mail.mailConfigured(), missing: mail.missingMailSettings() };
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

describe("email settings", () => {
  it("only needs a Gmail address and app password", async () => {
    const r = await load({ SMTP_USER: "veltrix.app@gmail.com", SMTP_PASS: "abcd efgh ijkl mnop" });
    expect(r.configured).toBe(true);
    expect(r.mail).toMatchObject({ host: "smtp.gmail.com", port: 587, pass: "abcdefghijklmnop", from: "VELTRIX <veltrix.app@gmail.com>" });
  });

  it("strips quotes pasted into a hosting dashboard and accepts SMTP_PASSWORD", async () => {
    const r = await load({ SMTP_USER: '"me@icloud.com"', SMTP_PASSWORD: "'abcd-efgh-ijkl-mnop'", EMAIL_FROM: '"VELTRIX <me@icloud.com>"' });
    expect(r.mail).toMatchObject({ host: "smtp.mail.me.com", user: "me@icloud.com", pass: "abcd-efgh-ijkl-mnop", from: "VELTRIX <me@icloud.com>" });
  });

  it("names what's missing", async () => {
    expect((await load({})).missing).toEqual(["SMTP_USER", "SMTP_PASS", "SMTP_HOST"]);
    expect((await load({ SMTP_USER: "me@company.example", SMTP_PASS: "x" })).missing).toEqual(["SMTP_HOST"]);
  });
});
