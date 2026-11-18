import { cookies } from "next/headers";
import { getSim } from "@/lib/sim";
import { COOKIE, destroySession, getUser } from "@/lib/session";
import { writeAudit } from "@/lib/authdb";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getUser();
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) destroySession(token);
  if (user) writeAudit(getSim().db, user, "logout", "Signed out");
  jar.delete(COOKIE);
  return Response.json({ ok: true });
}
