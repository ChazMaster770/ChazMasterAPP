import { db, pool } from "@/db";
import { sql } from "drizzle-orm";
import { ensureSchema } from "@/lib/ensure-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const status: {
    ok: boolean;
    hasDatabaseUrl: boolean;
    dbConnect: boolean;
    schemaReady: boolean;
    cardCount: number | null;
    error?: string;
    hint?: string;
    hasPokemonTcgKey: boolean;
  } = {
    ok: false,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    dbConnect: false,
    schemaReady: false,
    cardCount: null,
    hasPokemonTcgKey: !!process.env.POKEMONTCG_API_KEY,
  };

  if (!status.hasDatabaseUrl) {
    status.hint = "Set DATABASE_URL in your hosting provider's Environment Variables and redeploy.";
    return Response.json(status, { status: 500 });
  }

  try {
    await db.execute(sql`select 1`);
    status.dbConnect = true;
  } catch (e) {
    const err = e as { message?: string; code?: string };
    status.error = err.message || String(e);
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      status.hint = "The DATABASE_URL host is unreachable. If using Neon/Supabase, make sure the URL ends with ?sslmode=require.";
    } else if (err.code === "28P01") {
      status.hint = "Password in DATABASE_URL is wrong.";
    }
    return Response.json(status, { status: 500 });
  }

  try {
    await ensureSchema();
    const res = await pool.query(`SELECT COUNT(*)::int AS c FROM cards`);
    status.schemaReady = true;
    status.cardCount = res.rows[0]?.c ?? 0;
    status.ok = true;
    return Response.json(status);
  } catch (e) {
    const err = e as { message?: string; code?: string };
    status.error = err.message || String(e);
    status.hint = "Auto-schema creation failed. Try running `npx drizzle-kit push` manually against your DATABASE_URL.";
    return Response.json(status, { status: 500 });
  }
}
