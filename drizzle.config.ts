import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/server/db/schema.ts",
  out: "./db/generated",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://tuberbot:tuberbot@127.0.0.1:5432/tuberbot",
  },
  strict: true,
  verbose: true,
});
