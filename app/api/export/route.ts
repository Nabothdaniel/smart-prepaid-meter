import { getSim } from "@/lib/sim";
import { getUser } from "@/lib/session";
import { writeAudit } from "@/lib/authdb";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ message: "Sign in required" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ message: "Only an admin can export data" }, { status: 403 });
  writeAudit(getSim().db, user, "export", "Exported readings CSV");
  const rows = getSim().db.prepare("SELECT ts,power,voltage,current,energy,credit,relay FROM readings ORDER BY ts").all() as Record<string, number>[];
  const csv = ["timestamp,power_w,voltage_v,current_a,energy_kwh,credit_naira,relay"]
    .concat(rows.map((r) => [new Date(r.ts).toISOString(), r.power.toFixed(1), r.voltage.toFixed(1), r.current.toFixed(2), r.energy.toFixed(5), r.credit.toFixed(3), r.relay].join(",")))
    .join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="meter_readings.csv"' } });
}
