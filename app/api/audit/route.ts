import { getSim } from "@/lib/sim";
import { getUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ message: "Sign in required" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const limit = Math.min(200, Number(q.get("limit") ?? 30));
  const role = q.get("role");
  const db = getSim().db;
  // Customers only ever see their own activity; admins see everyone's.
  const rows = user.role === "admin"
    ? (role === "user" || role === "admin"
        ? db.prepare("SELECT * FROM audit WHERE role=? ORDER BY ts DESC, id DESC LIMIT ?").all(role, limit)
        : db.prepare("SELECT * FROM audit ORDER BY ts DESC, id DESC LIMIT ?").all(limit))
    : db.prepare("SELECT * FROM audit WHERE actor_email=? ORDER BY ts DESC, id DESC LIMIT ?").all(user.email, limit);
  return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
}
