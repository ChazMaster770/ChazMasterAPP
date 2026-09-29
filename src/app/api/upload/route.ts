import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { ensureSchema } from "@/lib/ensure-schema";

type Row = {
  cardName: string;
  setName: string;
  cardNumber: string;
  rarity: string;
  price: number;
  quantity: number;
  buyPct: number;
  buyPrice: number;
  variant: string;
  condition: string;
  tcg: string;
  tcgplayerId: string;
  productId: string;
};

function clean(s: unknown, max = 200): string {
  if (s === null || s === undefined) return "";
  return String(s).slice(0, max).trim();
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET() {
  try {
    await ensureSchema();
    const res = await pool.query(`SELECT id, filename, row_count AS "rowCount", new_cards AS "newCards", merged_cards AS "mergedCards", total_value AS "totalValue", created_at AS "createdAt" FROM upload_batches ORDER BY id DESC LIMIT 20`);
    return NextResponse.json({ batches: res.rows });
  } catch (e) {
    console.error("GET batches failed", e);
    return NextResponse.json({ batches: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const filename: string = clean(body.filename || "upload.csv", 300) || "upload.csv";
    const rawRows: Row[] = Array.isArray(body.rows) ? body.rows : [];
    if (!rawRows.length) return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    if (rawRows.length > 120000) return NextResponse.json({ error: "Too many rows (max 120,000 per upload)" }, { status: 400 });

    const rows: Row[] = rawRows
      .map((r) => ({
        cardName: clean(r.cardName, 200),
        setName: clean(r.setName || "Unknown Set", 200),
        cardNumber: clean(r.cardNumber, 50),
        rarity: clean(r.rarity || "Common", 100),
        price: Math.max(0, num(r.price, 0)),
        quantity: Math.max(1, Math.min(100000, Math.round(num(r.quantity, 1)) || 1)),
        buyPct: num(r.buyPct, 0),
        buyPrice: Math.max(0, num(r.buyPrice, 0)),
        variant: clean(r.variant || "Normal", 100),
        condition: clean(r.condition || "NM", 50),
        tcg: clean(r.tcg || "pokemon", 50),
        tcgplayerId: clean(r.tcgplayerId, 100),
        productId: clean(r.productId, 100),
      }))
      .filter((r) => r.cardName.length > 0);

    if (!rows.length) return NextResponse.json({ error: "No valid rows (missing Card Name)" }, { status: 400 });

    let newCards = 0;
    let mergedCards = 0;
    let totalValue = 0;
    for (const r of rows) totalValue += r.price * r.quantity;

    // Small/medium uploads: merge duplicates by (cardName, set, number, variant, condition)
    if (rows.length <= 3000) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const r of rows) {
          const found = await client.query(
            `SELECT id, quantity FROM cards WHERE LOWER(card_name)=LOWER($1) AND LOWER(COALESCE(set_name,''))=LOWER($2) AND LOWER(COALESCE(card_number,''))=LOWER($3) AND LOWER(COALESCE(variant,''))=LOWER($4) AND LOWER(COALESCE(condition,''))=LOWER($5) LIMIT 1`,
            [r.cardName, r.setName, r.cardNumber, r.variant, r.condition]
          );
          if (found.rows.length) {
            await client.query(
              `UPDATE cards SET quantity = COALESCE(quantity,0) + $1, price = $2, buy_pct=$3, buy_price=$4, rarity=$5, tcgplayer_id=$6, product_id=$7, updated_at=NOW(), source_file=$8 WHERE id=$9`,
              [r.quantity, r.price, r.buyPct, r.buyPrice, r.rarity, r.tcgplayerId, r.productId, filename, found.rows[0].id]
            );
            mergedCards++;
          } else {
            await client.query(
              `INSERT INTO cards (card_name, set_name, card_number, rarity, price, quantity, buy_pct, buy_price, variant, condition, tcg, tcgplayer_id, product_id, source_file) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
              [r.cardName, r.setName, r.cardNumber, r.rarity, r.price, r.quantity, r.buyPct, r.buyPrice, r.variant, r.condition, r.tcg, r.tcgplayerId, r.productId, filename]
            );
            newCards++;
          }
        }
        await client.query(`INSERT INTO upload_batches (filename, row_count, new_cards, merged_cards, total_value) VALUES ($1,$2,$3,$4,$5)`, [filename, rows.length, newCards, mergedCards, totalValue]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } else {
      // Large uploads: fast bulk insert in chunks (no per-row merge for speed)
      const CHUNK = 800;
      for (let s = 0; s < rows.length; s += CHUNK) {
        const chunk = rows.slice(s, s + CHUNK);
        const values: (string | number)[] = [];
        const placeholders: string[] = [];
        let p = 1;
        chunk.forEach((r) => {
          placeholders.push(`($${p},$${p + 1},$${p + 2},$${p + 3},$${p + 4},$${p + 5},$${p + 6},$${p + 7},$${p + 8},$${p + 9},$${p + 10},$${p + 11},$${p + 12},$${p + 13})`);
          values.push(r.cardName, r.setName, r.cardNumber, r.rarity, r.price, r.quantity, r.buyPct, r.buyPrice, r.variant, r.condition, r.tcg, r.tcgplayerId, r.productId, filename);
          p += 14;
        });
        await pool.query(
          `INSERT INTO cards (card_name, set_name, card_number, rarity, price, quantity, buy_pct, buy_price, variant, condition, tcg, tcgplayer_id, product_id, source_file) VALUES ${placeholders.join(",")}`,
          values
        );
      }
      newCards = rows.length;
      await pool.query(`INSERT INTO upload_batches (filename, row_count, new_cards, merged_cards, total_value) VALUES ($1,$2,$3,$4,$5)`, [filename, rows.length, newCards, 0, totalValue]);
    }

    // fresh totals
    const totals = await pool.query(`SELECT COUNT(*)::int AS cards, COALESCE(SUM(quantity),0)::int AS units, COALESCE(SUM(COALESCE(price,0)*COALESCE(quantity,0)),0)::float AS value FROM cards`);

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      newCards,
      mergedCards,
      totalValue,
      totals: totals.rows[0],
      fastMode: rows.length > 3000,
    });
  } catch (e) {
    console.error("POST /api/upload failed", e);
    const err = e as { message?: string; code?: string };
    let hint = err.message || "Import failed. Please check your CSV and try again.";
    if (err.code === "42P01") {
      hint = "Database tables are missing. Run `npx drizzle-kit push` against your live DATABASE_URL (see PUBLISH.md step 4).";
    } else if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      hint = "Cannot reach the database. Check DATABASE_URL in your hosting provider's environment variables.";
    } else if (err.code === "28P01" || err.code === "28000") {
      hint = "Database authentication failed. Double-check the password in DATABASE_URL.";
    } else if (err.code === "3D000") {
      hint = "Database does not exist. Verify the DB name at the end of DATABASE_URL.";
    }
    return NextResponse.json({ error: hint, code: err.code }, { status: 500 });
  }
}
