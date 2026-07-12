import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(__dirname, '../../data/studio.db')

let db: Database.Database | null = null

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS history_items (
      task_id TEXT PRIMARY KEY NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      state TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      result_urls TEXT,
      prompt TEXT,
      credits_consumed REAL,
      fail_msg TEXT,
      model_id TEXT,
      input TEXT,
      pinned INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_history_created
      ON history_items(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_pinned
      ON history_items(pinned);
  `)
}

/** Open (or reuse) the studio SQLite database under data/studio.db. */
export function getDb(): Database.Database {
  if (db) return db
  mkdirSync(dirname(DB_PATH), { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

export function getDbPath(): string {
  return DB_PATH
}
