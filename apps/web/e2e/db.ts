/** Test-only helper: confirm an account's email without reading the inbox. */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? "postgresql://veltrix:veltrix@localhost:5432/veltrix?schema=public" } } });

export async function markEmailVerified(email: string) {
  await db.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
}
