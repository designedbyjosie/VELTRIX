import { describe, expect, it } from "vitest";
import { parseMemory } from "@/server/ai/intents";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as setup } from "@/app/api/setup/route";
import { DELETE as deleteAll, GET as listMem, POST as saveMem } from "@/app/api/memory/route";
import { DELETE as deleteOne, PATCH as patchOne } from "@/app/api/memory/[id]/route";
import { PATCH as memorySettings } from "@/app/api/memory/settings/route";
import { GET as getProfile } from "@/app/api/plan/profile/route";
import { PATCH as patchAssumptions } from "@/app/api/plan/assumptions/route";
import { POST as decide } from "@/app/api/plan/decision/route";
import { POST as stress } from "@/app/api/plan/stress/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { POST as apply } from "@/app/api/advisor/actions/[id]/apply/route";
import { GET as exportData } from "@/app/api/settings/export/route";
import { call, newUser } from "./helpers";

async function plannedUser() {
  const u = await newUser(register);
  await call(setup, "/api/setup", {
    cookie: u.cookie,
    body: {
      path: "manual",
      accounts: [{ name: "Checking", type: "CHECKING", balance: "6000" }],
      monthlyIncome: "4000",
      budget: [{ category: "housing", limit: "1500" }, { category: "food", limit: "500" }, { category: "shopping", limit: "300" }, { category: "travel", limit: "200" }],
    },
  });
  return u;
}

describe("memory phrases", () => {
  it("recognizes deliberate preferences and refuses sensitive details", () => {
    expect(parseMemory("Remember that my emergency fund target is 6 months")).toEqual({ kind: "emergency_target", months: 6 });
    expect(parseMemory("I want to keep 4 months of expenses in reserve")).toEqual({ kind: "emergency_target", months: 4 });
    expect(parseMemory("I use the 50/30/20 rule")).toEqual({ kind: "budgeting_method", method: "50/30/20" });
    expect(parseMemory("Plan conservatively")).toEqual({ kind: "uncertainty_tolerance", level: "cautious" });
    expect(parseMemory("Travel matters to me")).toEqual({ kind: "category_priority", category: "travel", level: "protect" });
    expect(parseMemory("Shopping is flexible")).toEqual({ kind: "category_priority", category: "shopping", level: "flexible" });
    expect(parseMemory("I'm interested in VOO, NVDA and clean energy")).toEqual({ kind: "research_interest", symbols: ["VOO", "NVDA"], topics: ["clean energy"] });
    expect(parseMemory("Remember that I get paid every other Friday")).toEqual({ kind: "note", text: "I get paid every other Friday" });
    expect(parseMemory("Remember my card number 4111 1111 1111 1111")).toBeNull();
    expect(parseMemory("Where did my money go?")).toBeNull();
  });
});

describe("financial memory", () => {
  it("saves, edits, disables and deletes items; single-value kinds replace", async () => {
    const u = await plannedUser();
    const a = await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "emergency_target", months: 6 } });
    expect(a.json.item).toMatchObject({ kind: "emergency_target", text: "Keep 6 months of essential spending as an emergency reserve.", enabled: true, source: "user" });
    await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "emergency_target", months: 4 } });
    await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "note", text: "I get paid every other Friday" } });
    let list = (await call(listMem, "/x", { cookie: u.cookie })).json;
    expect(list.items).toHaveLength(2);
    expect(list.items.find((i: { kind: string }) => i.kind === "emergency_target").value.months).toBe(4);

    const note = list.items.find((i: { kind: string }) => i.kind === "note");
    expect((await call(patchOne, "/x", { cookie: u.cookie, method: "PATCH", params: { id: note.id }, body: { enabled: false } })).json.item.enabled).toBe(false);
    expect((await call(patchOne, "/x", { cookie: u.cookie, method: "PATCH", params: { id: note.id }, body: { value: { kind: "emergency_target", months: 2 } } })).status).toBe(400);
    expect((await call(deleteOne, "/x", { cookie: u.cookie, method: "DELETE", params: { id: note.id } })).status).toBe(200);
    list = (await call(listMem, "/x", { cookie: u.cookie })).json;
    expect(list.items).toHaveLength(1);

    const bad = await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "note", text: "my SSN is 123-45-6789" } });
    expect(bad.status).toBe(422);

    expect((await call(deleteAll, "/x", { cookie: u.cookie, method: "DELETE" })).json.deleted).toBe(1);
  });

  it("is private to its owner", async () => {
    const u = await plannedUser();
    const other = await newUser(register);
    const item = (await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "note", text: "Private preference" } })).json.item;
    expect((await call(patchOne, "/x", { cookie: other.cookie, method: "PATCH", params: { id: item.id }, body: { enabled: false } })).status).toBe(404);
    expect((await call(deleteOne, "/x", { cookie: other.cookie, method: "DELETE", params: { id: item.id } })).status).toBe(404);
    expect((await call(listMem, "/x", { cookie: other.cookie })).json.items).toEqual([]);
  });

  it("shapes plans: reserve target, caution, and spending priorities — and stops when switched off", async () => {
    const u = await plannedUser();
    await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "emergency_target", months: 6 } });
    await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "uncertainty_tolerance", level: "cautious" } });
    await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "category_priority", category: "shopping", level: "flexible" } });
    await call(saveMem, "/x", { cookie: u.cookie, body: { kind: "category_priority", category: "travel", level: "protect" } });

    let p = (await call(getProfile, "/x", { cookie: u.cookie })).json.profile;
    expect(p.assumptions.emergencyMonths).toBe(6);
    expect(p.assumptions.spendingVariancePct).toBe(15); // default 10% × cautious 1.5
    expect(p.memory.applied.map((a: { text: string }) => a.text)).toEqual(expect.arrayContaining(["Reserve target: 6 months of essentials"]));

    const d = (await call(decide, "/x", { cookie: u.cookie, body: { label: "Flights", priceCents: 50000, categorySlug: "travel" } })).json.decision;
    expect(d.preferenceNotes[0]).toMatch(/Travel matters to you/);
    const s = (await call(stress, "/x", { cookie: u.cookie, body: { incomeLossMonths: 3 } })).json;
    expect(s.steps[0]).toMatchObject({ title: "Pause your flexible spending first: Shopping", impactCents: 30000 });

    // Editing the reserve target in Assumptions keeps memory in sync
    await call(patchAssumptions, "/x", { cookie: u.cookie, method: "PATCH", body: { emergencyMonths: 5 } });
    expect((await call(listMem, "/x", { cookie: u.cookie })).json.items.find((i: { kind: string }) => i.kind === "emergency_target").value.months).toBe(5);

    await call(memorySettings, "/x", { cookie: u.cookie, method: "PATCH", body: { enabled: false } });
    p = (await call(getProfile, "/x", { cookie: u.cookie })).json.profile;
    expect(p.assumptions.spendingVariancePct).toBe(10);
    expect(p.memory.applied).toEqual([]);
  });

  it("the advisor saves a memory only after Apply, recalls it, and it's in the data export", async () => {
    const u = await plannedUser();
    const ask = async (message: string) => (await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message } })).json.message;
    const r = await ask("Remember that travel matters to me");
    expect(r.content).toMatch(/I'll remember this once you confirm/);
    expect(r.actions[0]).toMatchObject({ kind: "save_memory", summary: "Remember: Travel matters to me; cut elsewhere first." });
    expect((await call(listMem, "/x", { cookie: u.cookie })).json.items).toEqual([]);
    await call(apply, "/x", { cookie: u.cookie, method: "POST", params: { id: r.actions[0].id } });
    const saved = (await call(listMem, "/x", { cookie: u.cookie })).json.items;
    expect(saved[0]).toMatchObject({ kind: "category_priority", source: "advisor" });

    const recall = await ask("What do you remember about me?");
    expect(recall.content).toMatch(/Travel matters to me/);

    const refused = await ask("Remember my card number 4111 1111 1111 1111");
    expect(refused.actions).toEqual([]);
    expect(refused.content).toMatch(/won't save account numbers/);

    const exp = await call(exportData, "/x", { cookie: u.cookie, query: { format: "json" } });
    expect(JSON.stringify(exp.json)).toContain("category_priority");
  });
});
