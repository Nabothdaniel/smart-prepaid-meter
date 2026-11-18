import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { Role, SessionUser } from "./authdb";

// Stateless signed sessions: no database lookup, so they work across serverless instances
// (each Vercel function has its own /tmp copy of the database). Set SESSION_SECRET in production.
export const COOKIE = "sm_session";
export const SESSION_MS = 7 * 24 * 3600 * 1000;
const secret = () => process.env.SESSION_SECRET || "smart-meter-demo-secret-change-me";
const sign = (body: string) => crypto.createHmac("sha256", secret()).update(body).digest("base64url");

export function createSession(u: SessionUser): string {
  const body = Buffer.from(JSON.stringify({ id: u.id, email: u.email, name: u.name, role: u.role, exp: Date.now() + SESSION_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionUser & { exp: number };
    if (!p.exp || p.exp < Date.now() || (p.role !== "user" && p.role !== "admin")) return null;
    return { id: p.id, email: p.email, name: p.name, role: p.role };
  } catch { return null; }
}

export async function getUser(): Promise<SessionUser | null> {
  return readSession((await cookies()).get(COOKIE)?.value);
}
export const isAdmin = (u: { role: Role }) => u.role === "admin";
