import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(url: string) {
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      "DATABASE_URL must be a Postgres connection string. Use the Supabase Connection string / Pooler URI, not NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  const client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}
