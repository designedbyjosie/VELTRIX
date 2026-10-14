import { memoryValueSchema } from "@veltrix/shared";
import { handler } from "@/server/http";
import { deleteAllMemory, listMemory, saveMemory } from "@/server/services/memory";

export const GET = handler({}, async ({ auth }) => listMemory(auth.userId));
export const POST = handler({ body: memoryValueSchema, rateLimit: { key: "memory-save", limit: 60, windowMs: 60 * 60_000, by: "user" } }, async ({ auth, body }) => ({ item: await saveMemory(auth.userId, body, "user") }));
export const DELETE = handler({}, async ({ auth }) => ({ deleted: await deleteAllMemory(auth.userId) }));
