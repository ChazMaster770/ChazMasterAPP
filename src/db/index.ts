import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Don't crash the build when env is missing (e.g. during `next build` on a
    // hosting provider before env vars are attached). API routes will throw a
    // clear error at request time instead.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "postgresql://build:build@127.0.0.1:5432/build_db";
    }
    throw new Error("DATABASE_URL is required — set it in your hosting provider's environment variables.");
  }
  return url;
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createPool(): Pool {
  const connectionString = getDatabaseUrl();
  // Hosted Postgres (Neon, Supabase, Railway, Render) requires SSL.
  const needsSsl =
    /sslmode=require/i.test(connectionString) ||
    /neon\.tech|supabase\.|railway\.|render\.com/i.test(connectionString);
  return new Pool({
    connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

export const pool: Pool =
  globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
