import { getSim } from "@/lib/sim";
import { getUser } from "@/lib/session";
import { RANGES, type RangeKey, type ReadingsResponse } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await getUser())) return Response.json({ message: "Sign in required" }, { status: 401 });
  const key = (new URL(req.url).searchParams.get("range") ?? "6h") as RangeKey;
  const r = RANGES[key] ?? RANGES["6h"];
  const since = Date.now() - r.ms;
  const db = getSim().db;
  const points = (db.prepare(
    `SELECT (ts / @b) * @b AS t, AVG(power) AS power, AVG(voltage) AS voltage, AVG(credit) AS credit
     FROM readings WHERE ts >= @since GROUP BY ts / @b ORDER BY t`).all({ b: r.bucket, since }) as ReadingsResponse["points"]);
  const agg = db.prepare(
    `SELECT MIN(energy) e0, MAX(energy) e1, AVG(power) avgp, MAX(power) peak, COUNT(*) n FROM readings WHERE ts >= ?`).get(since) as
    { e0: number | null; e1: number | null; avgp: number | null; peak: number | null; n: number };
  const energyKwh = Math.max(0, (agg.e1 ?? 0) - (agg.e0 ?? 0));
  const body: ReadingsResponse = {
    points,
    summary: { energyKwh, spend: energyKwh * getSim().tariff, avgPower: agg.avgp ?? 0, peakPower: agg.peak ?? 0, samples: agg.n },
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
