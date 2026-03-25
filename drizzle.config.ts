import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["finance_manager_app"],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
