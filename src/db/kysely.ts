import { Kysely, PostgresDialect } from "kysely";
import { getPool } from "./pool";
import type { Database } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __lmsourceDb: Kysely<Database> | undefined;
}

export function getDb(): Kysely<Database> {
  if (!globalThis.__lmsourceDb) {
    globalThis.__lmsourceDb = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: getPool() }),
    });
  }
  return globalThis.__lmsourceDb;
}
