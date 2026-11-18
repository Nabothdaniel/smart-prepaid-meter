"use client";
import { useCallback, useEffect, useState } from "react";
import type { AuditEntry, MeterEvent, MeterState } from "@/lib/types";

export async function control(body: object): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await fetch("/api/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.status === 401) { window.location.href = "/login"; return { ok: false, message: "Session expired" }; }
    return await r.json();
  } catch { return { ok: false, message: "Network error. Try again." }; }
}

export function useMeter() {
  const [state, setState] = useState<MeterState | null>(null);
  const [offline, setOffline] = useState(false);
  const [hist, setHist] = useState<{ power: number[]; voltage: number[]; current: number[]; energy: number[] }>({ power: [], voltage: [], current: [], energy: [] });
  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      if (r.status === 401) { window.location.href = "/login"; return; }
      if (!r.ok) throw new Error();
      const s = (await r.json()) as MeterState;
      setState(s); setOffline(false);
      setHist((h) => {
        const push = (a: number[], v: number) => [...a.slice(-59), v];
        return { power: push(h.power, s.power), voltage: push(h.voltage, s.voltage), current: push(h.current, s.current), energy: push(h.energy, s.energyKwh) };
      });
    } catch { setOffline(true); }
  }, []);
  useEffect(() => { poll(); const id = setInterval(poll, 1000); return () => clearInterval(id); }, [poll]);
  return { state, offline, hist, refresh: poll };
}

function usePolled<T>(url: string, every: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(); setData(await r.json()); setError(false); } catch { setError(true); }
  }, [url]);
  useEffect(() => { setData(null); load(); const id = setInterval(load, every); return () => clearInterval(id); }, [load, every]);
  return { data, error, reload: load };
}
export const useEvents = (limit = 30) => usePolled<MeterEvent[]>(`/api/events?limit=${limit}`, 3000);
export const useAudit = (limit = 30, role?: "user" | "admin") => usePolled<AuditEntry[]>(`/api/audit?limit=${limit}${role ? `&role=${role}` : ""}`, 4000);
