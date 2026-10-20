import { describe, expect, it } from "vitest";
import { recommend } from "./finder";

describe("flavour finder", () => {
  it("sends plain-water drinkers to the spring", () => {
    expect(recommend({ when: "dinner", sweet: 0, taste: "plain" }).best.flavour.id).toBe("spring-source");
  });
  it("finds the deep flavour for fruity late nights", () => {
    expect(recommend({ when: "night", sweet: 2, taste: "fruit" }).best.flavour.id).toBe("night-swim");
  });
  it("finds a herbal, dry can after a run", () => {
    expect(recommend({ when: "active", sweet: 0, taste: "herbal" }).best.flavour.id).toBe("fog-line");
  });
  it("always explains the match", () => {
    expect(recommend({ when: "morning", sweet: 2, taste: "citrus" }).best.reasons.length).toBeGreaterThan(0);
  });
});
