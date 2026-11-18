import crypto from "node:crypto";
import type Database from "better-sqlite3";

export type Role = "user" | "admin";
export interface SessionUser { id: number; email: string; name: string; role: Role }

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16);
  return `${salt.toString("hex")}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string) {
  const [s, h] = stored.split(":");
  const got = crypto.scryptSync(pw, Buffer.from(s, "hex"), 64);
  const want = Buffer.from(h, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

// Demo accounts, shown on the login page. Change or remove before real use (set DEMO_LOGINS=off).
export const DEMO_ACCOUNTS = [
  { email: "user@demo.com", password: "user123", name: "Amina Bello", role: "user" as Role },
  { email: "admin@demo.com", password: "admin123", name: "Grid Admin", role: "admin" as Role },
];

export function writeAudit(db: Database.Database, who: { name: string; email: string; role: Role }, action: string, detail: string, ts = Date.now()) {
  db.prepare("INSERT INTO audit (ts,actor_name,actor_email,role,action,detail) VALUES (?,?,?,?,?,?)")
    .run(ts, who.name, who.email, who.role, action, detail);
}

/** Idempotent: safe to run on an already-recorded database. Never touches meter data. */
export function ensureAuth(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user','admin')), password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, actor_name TEXT NOT NULL,
      actor_email TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts);
  `);
  db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());

  const ins = db.prepare("INSERT OR IGNORE INTO users (email,name,role,password) VALUES (?,?,?,?)");
  for (const a of DEMO_ACCOUNTS) ins.run(a.email, a.name, a.role, hashPassword(a.password));

  if ((db.prepare("SELECT COUNT(*) c FROM audit").get() as { c: number }).c === 0) {
    const U = { name: "Amina Bello", email: "user@demo.com", role: "user" as Role };
    const A = { name: "Grid Admin", email: "admin@demo.com", role: "admin" as Role };
    const M = 60_000, now = Date.now();
    // [minutes ago, actor, action, detail]
    const demo: [number, typeof U, string, string][] = [
      [1380, A, "login", "Signed in"],
      [1375, A, "tariff", "Confirmed tariff at ₦50/kWh"],
      [1372, A, "permissions", "Customer may recharge and control appliances"],
      [1368, A, "threshold", "Low-credit alert set to ₦100"],
      [1360, A, "logout", "Signed out"],
      [1290, U, "login", "Signed in"],
      [1288, U, "recharge", "Recharged ₦1,000 (TOKEN1000)"],
      [1280, U, "appliance", "Turned Refrigerator on"],
      [1279, U, "appliance", "Turned Lighting on"],
      [1240, U, "logout", "Signed out"],
      [960, A, "login", "Signed in"],
      [955, A, "notice", "Sent notice: Scheduled maintenance tonight 2:00-3:00 am"],
      [950, A, "export", "Exported readings CSV"],
      [945, A, "logout", "Signed out"],
      [720, U, "login", "Signed in"],
      [718, U, "appliance", "Turned Air conditioner on"],
      [600, U, "appliance", "Turned Air conditioner off"],
      [598, U, "logout", "Signed out"],
      [420, U, "login", "Signed in"],
      [418, U, "recharge", "Rejected token \"TOKEN999\""],
      [416, U, "recharge", "Recharged ₦500 (TOKEN500)"],
      [300, A, "login", "Signed in"],
      [296, A, "fault", "Ran brownout simulation, then cleared"],
      [290, A, "speed", "Simulation speed set to 10×"],
      [284, A, "logout", "Signed out"],
      [90, U, "login", "Signed in"],
      [85, U, "appliance", "Turned Television on"],
    ];
    db.transaction(() => { for (const [m, who, a, d] of demo) writeAudit(db, who, a, d, now - m * M); })();
  }
}
