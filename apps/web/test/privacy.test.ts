import { describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createAccount } from "@/app/api/accounts/route";
import { POST as chat } from "@/app/api/advisor/chat/route";
import { PATCH as prefs } from "@/app/api/settings/preferences/route";
import { GET as overview } from "@/app/api/privacy/route";
import { GET as history } from "@/app/api/privacy/history/route";
import { POST as del } from "@/app/api/privacy/delete/route";
import { POST as release } from "@/app/api/privacy/release/route";
import { GET as inbox } from "@/app/api/notifications/route";
import { db } from "@/server/db";
import { notify } from "@/server/services/notifications";
import { TOOL_DATA } from "@/server/services/privacy";
import { TOOLS } from "@/server/ai/tools";
import { call, newUser } from "./helpers";

async function user() {
  const u = await newUser(register);
  return { ...u, userId: (await db.user.findUniqueOrThrow({ where: { email: u.email.toLowerCase() } })).id };
}
const n = (key: string) => ({ kind: "outcome", title: `Test ${key}`, body: "b", dedupeKey: key });

describe("privacy & permissions center", () => {
  it("reports sources, permissions and pending proposals from live data, only for the owner", async () => {
    const u = await user();
    const other = await user();
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Checking", type: "CHECKING", balance: "1200.00" } });
    const r = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "my checking balance is $1,500" } });
    expect(r.json.message.actions).toHaveLength(1);

    const o = (await call(overview, "/x", { cookie: u.cookie })).json;
    expect(o.sources.find((s: { id: string }) => s.id === "manual").records[0]).toEqual({ label: "Accounts", count: 1 });
    expect(o.sources.find((s: { id: string }) => s.id === "advisor").records[0]).toEqual({ label: "Conversations", count: 1 });
    expect(o.pending.proposals).toHaveLength(1);
    expect(o.pending.proposals[0].summary).toMatch(/1,500/);
    // No AI provider in tests: the advisor shares nothing outside
    expect(o.sources.find((s: { id: string }) => s.id === "advisor").sharedWith).toBe("Nobody.");
    expect(o.permissions.map((p: { id: string }) => p.id)).toContain("advisorProposals");
    expect(o.cannotDo.length).toBeGreaterThan(0);

    const theirs = (await call(overview, "/x", { cookie: other.cookie })).json;
    expect(theirs.pending.proposals).toHaveLength(0);
    expect(theirs.sources.find((s: { id: string }) => s.id === "manual").records[0].count).toBe(0);
  });

  it("lists what every advisor tool reads, so the disclosure can't fall out of date", () => {
    for (const t of TOOLS) expect(TOOL_DATA[t.name], `TOOL_DATA is missing ${t.name}`).toBeTruthy();
  });

  it("stops the advisor from proposing changes when that permission is off, and records the change", async () => {
    const u = await user();
    await call(createAccount, "/api/accounts", { cookie: u.cookie, body: { name: "Checking", type: "CHECKING", balance: "1200.00" } });
    expect((await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { advisorProposals: false } })).status).toBe(200);
    const r = await call(chat, "/api/advisor/chat", { cookie: u.cookie, body: { message: "my checking balance is $1,500" } });
    expect(r.json.message.actions ?? []).toHaveLength(0);
    expect(await db.advisorAction.count({ where: { userId: u.userId } })).toBe(0);
    const h = (await call(history, "/x", { cookie: u.cookie, query: { group: "privacy" } })).json;
    expect(h.items[0]).toMatchObject({ type: "privacy.permission_changed", detail: "advisorProposals: off" });
  });

  it("enforces pause, off, quiet hours and digests when creating notifications", async () => {
    const u = await user();
    // Off: nothing is created
    await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { notifyFrequency: "off" } });
    await notify(u.userId, n("a"));
    // Paused: nothing is created
    await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { notifyFrequency: "immediate", notificationsPausedUntil: new Date(Date.now() + 86_400_000).toISOString() } });
    await notify(u.userId, n("b"));
    expect(await db.notification.count({ where: { userId: u.userId } })).toBe(0);
    // Resume, then quiet hours covering the whole day except one hour → held
    await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { notificationsPausedUntil: null } });
    const hour = new Date().getUTCHours();
    await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { quietHoursStart: hour, quietHoursEnd: (hour + 23) % 24 } });
    await notify(u.userId, n("c"));
    expect((await call(inbox, "/x", { cookie: u.cookie })).json.items).toHaveLength(0);
    const o = (await call(overview, "/x", { cookie: u.cookie })).json;
    expect(o.notifications.held.map((h: { title: string }) => h.title)).toEqual(["Test c"]);
    // "Show them now" releases held notifications
    expect((await call(release, "/x", { cookie: u.cookie, method: "POST", body: {} })).json.released).toBe(1);
    expect((await call(inbox, "/x", { cookie: u.cookie })).json.items.map((i: { title: string }) => i.title)).toEqual(["Test c"]);
    // Daily digest holds until 9:00
    await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { quietHoursStart: null, quietHoursEnd: null, notifyFrequency: "daily" } });
    await notify(u.userId, n("d"));
    const d = await db.notification.findFirstOrThrow({ where: { userId: u.userId, dedupeKey: "d" } });
    expect(d.deliverAt.getTime()).toBeGreaterThan(Date.now());
    expect(d.deliverAt.getUTCHours()).toBe(9);
    // Quiet hours need both ends
    expect((await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { quietHoursStart: 22 } })).status).toBe(422);
  });

  it("deletes one source's data without touching another user's, and logs it", async () => {
    const u = await user();
    const other = await user();
    for (const x of [u, other]) {
      await call(chat, "/api/advisor/chat", { cookie: x.cookie, body: { message: "how much did I spend this month?" } });
      await notify(x.userId, n(`k-${x.userId}`));
    }
    expect((await call(del, "/x", { cookie: u.cookie, body: { source: "advisor_conversations" } })).json.deleted).toBe(1);
    expect((await call(del, "/x", { cookie: u.cookie, body: { source: "notifications" } })).json.deleted).toBe(1);
    expect((await call(del, "/x", { cookie: u.cookie, body: { source: "accounts" } })).status).toBe(422);
    expect(await db.aIConversation.count({ where: { userId: u.userId } })).toBe(0);
    expect(await db.aIConversation.count({ where: { userId: other.userId } })).toBe(1);
    expect(await db.notification.count({ where: { userId: other.userId } })).toBe(1);
    const h = (await call(history, "/x", { cookie: u.cookie, query: { group: "data" } })).json;
    expect(h.items.map((i: { detail: string }) => i.detail)).toEqual(["notifications: 1 removed", "advisor_conversations: 1 removed"]);
  });

  it("pages and filters activity history", async () => {
    const u = await user();
    for (const v of [true, false, true]) await call(prefs, "/x", { cookie: u.cookie, method: "PATCH", body: { advisorProposals: v } });
    const p1 = (await call(history, "/x", { cookie: u.cookie, query: { group: "privacy", limit: "2" } })).json;
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = (await call(history, "/x", { cookie: u.cookie, query: { group: "privacy", limit: "2", cursor: p1.nextCursor } })).json;
    expect(p2.items).toHaveLength(1);
    expect(p2.nextCursor).toBeNull();
    const security = (await call(history, "/x", { cookie: u.cookie, query: { group: "security" } })).json;
    expect(security.items.every((i: { type: string }) => /^(auth|session|security)\./.test(i.type))).toBe(true);
    // Another user's cursor reveals nothing of theirs
    const other = await user();
    const o = (await call(history, "/x", { cookie: other.cookie, query: { group: "privacy" } })).json;
    expect(o.items).toHaveLength(0);
  });
});
