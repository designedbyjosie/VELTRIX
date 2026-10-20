import { describe, expect, it } from "vitest";
import { defaultInput, diffPlans, generate, rankDestinations, regenerateDay, type TripInput } from "./engine";
import { destinationById } from "./data";

const base: TripInput = { ...defaultInput, destination: "lisbon", origin: "uk", days: 4, travelers: 2, budget: 2400, interests: ["food", "culture", "history"] };
const acts = (p: ReturnType<typeof generate>) => p.days.flatMap((d) => d.items).filter((i) => i.kind === "activity");

describe("Margin planning engine", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(generate(base))).toBe(JSON.stringify(generate(base)));
  });

  it("produces a day per trip day and stays within budget when it can", () => {
    const p = generate(base);
    expect(p.days).toHaveLength(4);
    expect(p.total).toBeLessThanOrEqual(base.budget);
    expect(p.status).not.toBe("over");
  });

  it("reshapes the trip when the budget drops, and explains it", () => {
    const rich = { ...base, budget: 4000, style: "comfort" as const };
    const poor = { ...rich, budget: 1500 };
    const a = generate(rich);
    const b = generate(poor);
    expect(b.lines.find((l) => l.key === "stay")!.amount).toBeLessThan(a.lines.find((l) => l.key === "stay")!.amount);
    expect(b.total).toBeLessThan(a.total);
    const changes = diffPlans(a, b, rich, poor);
    expect(changes.some((c) => c.tone === "saving")).toBe(true);
  });

  it("says honestly when the budget can't work and offers alternatives", () => {
    const p = generate({ ...base, origin: "us-west", destination: "kyoto", budget: 600 });
    expect(p.status).toBe("over");
    expect(p.suggestions.length).toBeGreaterThan(0);
    expect(p.suggestions.some((s) => s.kind === "budget")).toBe(true);
  });

  it("schedules fewer activities on a relaxed pace", () => {
    const relaxed = acts(generate({ ...base, budget: 5000, pace: "relaxed" })).length;
    const packed = acts(generate({ ...base, budget: 5000, pace: "packed" })).length;
    expect(packed).toBeGreaterThan(relaxed);
  });

  it("replaces activities when the travel style changes", () => {
    const food = acts(generate({ ...base, interests: ["food", "nightlife"] })).map((i) => i.activityId);
    const hist = acts(generate({ ...base, interests: ["history", "photo"] })).map((i) => i.activityId);
    expect(food).not.toEqual(hist);
  });

  it("shortens the trip to fit vacation days", () => {
    const p = generate({ ...base, days: 7, vacationDays: 2 });
    expect(p.effectiveDays).toBe(4);
    expect(p.notes.join(" ")).toMatch(/vacation days/);
  });

  it("respects step-free access and exclusions", () => {
    const p = generate({ ...base, stepFree: true, excluded: ["l-market"] });
    const dest = destinationById("lisbon")!;
    for (const i of acts(p)) {
      expect(dest.activities.find((a) => a.id === i.activityId)!.stepFree).toBe(true);
      expect(i.activityId).not.toBe("l-market");
    }
    expect(p.stay?.stepFree).toBe(true);
  });

  it("keeps favourites when the trip is rebuilt", () => {
    const p = generate({ ...base, budget: 5000, favorites: ["l-cook"] });
    expect(acts(p).some((i) => i.activityId === "l-cook")).toBe(true);
  });

  it("regenerates one day without touching the others", () => {
    const p = generate({ ...base, budget: 5000 });
    const q = regenerateDay(p, { ...base, budget: 5000 }, 1);
    expect(q.days[0]).toEqual(p.days[0]);
    expect(q.days[1].items.map((i) => i.activityId)).not.toEqual(p.days[1].items.map((i) => i.activityId));
  });

  it("ranks destinations with reasons", () => {
    const r = rankDestinations({ ...base, destination: "suggest", interests: ["nature", "adventure"], origin: "us-west", month: 6 });
    expect(r[0].dest.kind).not.toBe("city");
    expect(r[0].reasons.length).toBeGreaterThan(0);
  });
});
