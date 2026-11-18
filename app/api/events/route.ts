import { getSim } from "@/lib/sim";
import { getUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await getUser())) return Response.json({ message: "Sign in required" }, { status: 401 });
  const limit = Math.min(100, Number(new URL(req.url).searchParams.get("limit") ?? 30));
  const rows = getSim().db.prepare("SELECT id,ts,level,kind,message FROM events ORDER BY id DESC LIMIT ?").all(limit);
  return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
}
