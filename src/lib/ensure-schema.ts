import { pool } from "@/db";

// Create tables on first request (safe: uses IF NOT EXISTS). Handy on Vercel
// so first-time visitors don't hit `relation does not exist` before drizzle-kit
// push has been run.
let ensured = false;

export async function ensureSchema(): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      id SERIAL PRIMARY KEY,
      card_name TEXT NOT NULL,
      set_name TEXT DEFAULT '',
      card_number TEXT DEFAULT '',
      rarity TEXT DEFAULT '',
      price REAL DEFAULT 0,
      quantity INTEGER DEFAULT 1,
      buy_pct REAL DEFAULT 0,
      buy_price REAL DEFAULT 0,
      variant TEXT DEFAULT 'Normal',
      condition TEXT DEFAULT 'NM',
      tcg TEXT DEFAULT 'pokemon',
      tcgplayer_id TEXT DEFAULT '',
      product_id TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      source_file TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sale_requests (
      id SERIAL PRIMARY KEY,
      requester_name TEXT NOT NULL,
      requester_contact TEXT NOT NULL DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      total_value REAL DEFAULT 0,
      item_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS request_items (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      card_name TEXT NOT NULL DEFAULT '',
      set_name TEXT DEFAULT '',
      card_number TEXT DEFAULT '',
      rarity TEXT DEFAULT '',
      condition TEXT DEFAULT '',
      variant TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      price_each REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS upload_batches (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL DEFAULT '',
      row_count INTEGER DEFAULT 0,
      new_cards INTEGER DEFAULT 0,
      merged_cards INTEGER DEFAULT 0,
      total_value REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS cards_name_lower_idx ON cards (LOWER(card_name));
    CREATE INDEX IF NOT EXISTS cards_set_idx ON cards (set_name);
    CREATE INDEX IF NOT EXISTS request_items_req_idx ON request_items (request_id);
  `);
  ensured = true;
}
