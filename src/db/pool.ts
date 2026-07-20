import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __lmsourcePool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__lmsourcePool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalThis.__lmsourcePool = new Pool({ connectionString, max: 10 });
  }
  return globalThis.__lmsourcePool;
}
