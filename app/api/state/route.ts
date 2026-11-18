import { getSim } from "@/lib/sim";
import { getUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await getUser())) return Response.json({ message: "Sign in required" }, { status: 401 });
  return Response.json(getSim().snapshot(), { headers: { "Cache-Control": "no-store" } });
}
