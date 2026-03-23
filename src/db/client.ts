import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  db: Db | undefined;
  dbPool: Pool | undefined;
};

export function getDb(): Db {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const pool =
    globalForDb.dbPool ??
    new Pool({
      connectionString: databaseUrl,
      max: 10,
    });

  const db = drizzle({ client: pool, schema });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.dbPool = pool;
    globalForDb.db = db;
  }

  return db;
}
