import { describe, expect, it } from "vitest";
import { isRequest } from "../src/lib/messages";

describe("extension message validation", () => {
  it("accepts well-formed requests", () => {
    expect(isRequest({ type: "status" })).toBe(true);
    expect(isRequest({ type: "analyze" })).toBe(true);
    expect(isRequest({ type: "analyze", tabId: 3 })).toBe(true);
    expect(isRequest({ type: "pair", code: "ABCD-EFGH" })).toBe(true);
    expect(isRequest({ type: "save", payload: { kind: "watchlist", symbol: "VOO" } })).toBe(true);
    expect(isRequest({ type: "open", path: "/app/shopping?product=1" })).toBe(true);
  });
  it("rejects unknown types and malformed payloads", () => {
    expect(isRequest(null)).toBe(false);
    expect(isRequest("status")).toBe(false);
    expect(isRequest({ type: "eval", code: "x" })).toBe(false);
    expect(isRequest({ type: "analyze", tabId: "1" })).toBe(false);
    expect(isRequest({ type: "pair", code: "x".repeat(100) })).toBe(false);
    expect(isRequest({ type: "save", payload: { kind: "transfer" } })).toBe(false);
  });
  it("only opens VELTRIX app paths (no open redirects)", () => {
    expect(isRequest({ type: "open", path: "https://evil.example" })).toBe(false);
    expect(isRequest({ type: "open", path: "//evil.example/app" })).toBe(false);
    expect(isRequest({ type: "open", path: "/api/settings/delete-account" })).toBe(false);
  });
});
