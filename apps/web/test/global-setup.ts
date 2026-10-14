import { execSync } from "node:child_process";

/**
 * Applies pending migrations to the test database (non-destructive). Tests never
 * depend on an empty database: every test creates its own uniquely-named users.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://veltrix:veltrix@localhost:5432/veltrix_test?schema=public";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
