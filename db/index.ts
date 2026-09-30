import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL or SUPABASE_DATABASE_URL environment variable is not set. " +
        "Set it to your Supabase PostgreSQL connection string."
      );
    }

    const client = postgres(databaseUrl);
    db = drizzle(client, { schema });
  }

  return db;
}
