import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getSim } from "./sim";
import type { Role, SessionUser } from "./authdb";

export const COOKIE = "sm_session";
export const SESSION_MS = 7 * 24 * 3600 * 1000;
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getSim().db.prepare(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires > ?`).get(sha(token), Date.now()) as SessionUser | undefined;
  return row ?? null;
}
export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  getSim().db.prepare("INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)").run(sha(token), userId, Date.now() + SESSION_MS);
  return token;
}
export function destroySession(token: string) { getSim().db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(token)); }
export const isAdmin = (u: { role: Role }) => u.role === "admin";
