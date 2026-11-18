import { cookies } from "next/headers";
import { getSim } from "@/lib/sim";
import { COOKIE, SESSION_MS, createSession } from "@/lib/session";
import { verifyPassword, writeAudit, type Role } from "@/lib/authdb";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { n: number; reset: number }>();
const DUMMY = "00".repeat(16) + ":" + "00".repeat(64);

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const key = (req.headers.get("x-forwarded-for") ?? "local") + "|" + email;
  const a = attempts.get(key);
  if (a && a.reset > Date.now() && a.n >= 6) return Response.json({ ok: false, message: "Too many attempts. Try again in a minute." }, { status: 429 });

  const db = getSim().db;
  const u = db.prepare("SELECT id,email,name,role,password FROM users WHERE email=?").get(email) as
    { id: number; email: string; name: string; role: Role; password: string } | undefined;
  const good = verifyPassword(password, u?.password ?? DUMMY) && !!u;
  if (!good || !u) {
    attempts.set(key, { n: (a && a.reset > Date.now() ? a.n : 0) + 1, reset: a && a.reset > Date.now() ? a.reset : Date.now() + 60_000 });
    return Response.json({ ok: false, message: "Wrong email or password" }, { status: 401 });
  }
  attempts.delete(key);
  const token = createSession(u.id);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MS / 1000,
    secure: req.headers.get("x-forwarded-proto") === "https",
  });
  writeAudit(db, u, "login", "Signed in");
  return Response.json({ ok: true, role: u.role });
}
