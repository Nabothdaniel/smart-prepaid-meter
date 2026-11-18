"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Segmented } from "./ui";
import type { RangeKey, ReadingsResponse } from "@/lib/types";

type Metric = "power" | "voltage" | "credit";
const META: Record<Metric, { label: string; unit: string; color: string; digits: number }> = {
  power: { label: "Power", unit: "W", color: "var(--power)", digits: 0 },
  voltage: { label: "Voltage", unit: "V", color: "var(--voltage)", digits: 1 },
  credit: { label: "Credit", unit: "₦", color: "var(--credit)", digits: 2 },
};

export function PowerChart() {
  const [range, setRange] = useState<RangeKey>("6h");
  const [metric, setMetric] = useState<Metric>("power");
  const [data, setData] = useState<ReadingsResponse | null>(null);
  const [error, setError] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/readings?range=${range}`, { cache: "no-store" });
        if (!r.ok) throw new Error();
        const j = (await r.json()) as ReadingsResponse;
        if (alive) { setData(j); setError(false); }
      } catch { if (alive) setError(true); }
    };
    load();
    const id = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(id); };
  }, [range]);

  const m = META[metric];
  const { path, area, lo, hi, pts } = useMemo(() => {
    const p = data?.points ?? [];
    if (p.length < 2) return { path: "", area: "", lo: 0, hi: 1, pts: [] as { x: number; y: number; v: number; t: number }[] };
    const vals = p.map((q) => q[metric]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (metric === "power") lo = 0;
    const pad = (hi - lo || 1) * 0.12; hi += pad; if (metric !== "power") lo -= pad;
    const t0 = p[0].t, t1 = p[p.length - 1].t;
    const pts = p.map((q) => ({ x: ((q.t - t0) / (t1 - t0 || 1)) * 100, y: 100 - ((q[metric] - lo) / (hi - lo)) * 100, v: q[metric], t: q.t }));
    const path = pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ");
    return { path, area: `${path} L100,100 L0,100 Z`, lo, hi, pts };
  }, [data, metric]);

  const active = hover !== null ? pts[hover] : null;
  const onMove = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect(); if (!r || !pts.length) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    let best = 0, d = Infinity; pts.forEach((p, i) => { const dd = Math.abs(p.x - x); if (dd < d) { d = dd; best = i; } });
    setHover(best);
  };
  const s = data?.summary;
  const fmt = (v: number) => v.toLocaleString("en-NG", { minimumFractionDigits: m.digits, maximumFractionDigits: m.digits });
  const time = (t: number) => new Date(t).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Metric" value={metric} onChange={setMetric} options={[{ value: "power", label: "Power" }, { value: "voltage", label: "Voltage" }, { value: "credit", label: "Credit" }]} />
        <Segmented label="Time range" value={range} onChange={setRange} options={[{ value: "1h", label: "1 h" }, { value: "6h", label: "6 h" }, { value: "24h", label: "24 h" }]} />
      </div>

      <div className="relative" ref={box} onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: "pan-y" }}>
        {!data && !error && <div className="skeleton h-56 rounded-xl bg-surface-2" />}
        {error && (
          <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-surface-2 text-sm text-muted">
            <AlertCircle className="size-5 text-danger" aria-hidden /> Couldn’t load history
            <button type="button" onClick={() => setRange(range)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 hover:bg-surface"><RefreshCw className="size-4" aria-hidden /> Retry</button>
          </div>
        )}
        {data && pts.length < 2 && <div className="flex h-56 items-center justify-center rounded-xl bg-surface-2 text-sm text-muted">No readings in this window yet</div>}
        {data && pts.length >= 2 && (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-56 w-full overflow-visible" role="img" aria-label={`${m.label} over the last ${range}`}>
              <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={m.color} stopOpacity=".32" /><stop offset="1" stopColor={m.color} stopOpacity="0" /></linearGradient></defs>
              {[0, 25, 50, 75, 100].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={y === 100 ? undefined : "2 4"} />)}
              <path d={area} fill="url(#fill)" />
              <path d={path} fill="none" stroke={m.color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="num pointer-events-none absolute left-1 top-0 text-[11px] text-muted">{fmt(hi)}</span>
            <span className="num pointer-events-none absolute bottom-0 left-1 text-[11px] text-muted">{fmt(lo)}</span>
            {active && (
              <>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-fg/30" style={{ left: `${active.x}%` }} />
                <div className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${active.x}%`, top: `${active.y}%`, background: m.color }} />
                <div className="num pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg" style={{ left: `clamp(0px, calc(${active.x}% - 50px), calc(100% - 110px))` }}>
                  <div className="text-muted">{time(active.t)}</div>
                  <div className="font-medium" style={{ color: m.color }}>{fmt(active.v)} {m.unit}</div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {s && (
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          {[
            ["Energy used", `${s.energyKwh.toFixed(3)} kWh`],
            ["Cost", `₦${s.spend.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`],
            ["Average load", `${Math.round(s.avgPower)} W`],
            ["Peak load", `${Math.round(s.peakPower)} W`],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="num mt-0.5 text-base font-medium">{v}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}
