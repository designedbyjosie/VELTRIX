import { db } from "@/server/db";
import { json } from "@/server/http";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return json({ ok: true, database: "up" });
  } catch {
    return json({ ok: false, database: "down" }, { status: 503 });
  }
}
