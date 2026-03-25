import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function normalizeConnectionString(url) {
  if (!url) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("sslmode") === "require") {
      parsed.searchParams.set("sslmode", "verify-full");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

async function run() {
  const migrationPath = path.join(process.cwd(), "drizzle", "0000_init.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  const connectionString = normalizeConnectionString(process.env.DATABASE_URL);
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log("Applied non-destructive schema bootstrap to finance_manager_app.");
}

run().catch((error) => {
  console.error("db-bootstrap failed:", error);
  process.exit(1);
});
