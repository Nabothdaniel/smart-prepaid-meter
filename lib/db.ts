import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./seed";
import { ensureAuth } from "./authdb";

export function openDb(): Database.Database {
  // DATA_DIR lets a host point at a persistent disk (e.g. /data on Render/Railway/Fly).
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "meter.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, power REAL, voltage REAL, current REAL,
      energy REAL, credit REAL, relay INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, level TEXT NOT NULL, kind TEXT NOT NULL, message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    CREATE TABLE IF NOT EXISTS recharges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, token TEXT NOT NULL, amount REAL, ok INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const seeded = db.prepare("SELECT value FROM state WHERE key = 'seeded'").get();
  if (!seeded) seed(db);
  ensureAuth(db);
  return db;
}
