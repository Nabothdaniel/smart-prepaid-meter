import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seed } from "./seed";
import { ensureAuth } from "./authdb";

/** Pick a writable data folder. Serverless hosts (Vercel/Lambda) have a read-only project dir,
 *  so fall back to the temp dir and copy the committed database there. */
function dataDir(): { dir: string; fallback: boolean } {
  // DATA_DIR lets a host point at a persistent disk (e.g. /data on Render/Railway/Fly).
  const wanted = process.env.DATA_DIR || path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(wanted, { recursive: true });
    fs.accessSync(wanted, fs.constants.W_OK);
    const probe = path.join(wanted, ".write-test");
    fs.writeFileSync(probe, "ok"); fs.unlinkSync(probe);
    return { dir: wanted, fallback: false };
  } catch {
    const tmp = path.join(os.tmpdir(), "meter-data");
    fs.mkdirSync(tmp, { recursive: true });
    const bundled = path.join(wanted, "meter.db");
    const target = path.join(tmp, "meter.db");
    if (!fs.existsSync(target) && fs.existsSync(bundled)) { fs.copyFileSync(bundled, target); fs.chmodSync(target, 0o644); } // bundled file may be read-only
    console.warn(`[meter] ${wanted} is read-only; using ${tmp}. Data will NOT persist on this host.`);
    return { dir: tmp, fallback: true };
  }
}

export function openDb(): Database.Database {
  const { dir } = dataDir();
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
