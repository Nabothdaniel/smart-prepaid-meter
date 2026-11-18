import { Cpu, Download, KeyRound, LogIn, LogOut, Lock, Unlock, Megaphone, Receipt, RotateCcw, ShieldCheck, SlidersHorizontal, Flame, Gauge, Settings2, Info, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import type { AuditEntry } from "@/lib/types";

const ICON: Record<string, ComponentType<{ className?: string }>> = {
  login: LogIn, logout: LogOut, recharge: KeyRound, appliance: Cpu, tariff: Receipt, threshold: SlidersHorizontal,
  hold: Lock, release: Unlock, reset: RotateCcw, credit: Wallet, permissions: ShieldCheck, notice: Megaphone,
  fault: Flame, speed: Gauge, export: Download, settings: Settings2,
};

export function AuditList({ entries, error, empty, showActor = true }: { entries: AuditEntry[] | null; error: boolean; empty: string; showActor?: boolean }) {
  if (error && !entries) return <p className="py-8 text-center text-sm text-danger">Couldn’t load activity. It will retry.</p>;
  if (!entries) return <div className="skeleton h-40 rounded-xl bg-surface-2" />;
  if (entries.length === 0) return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="-mx-1 max-h-80 divide-y divide-line overflow-y-auto pr-1">
      {entries.map((e) => {
        const Icon = ICON[e.action] ?? Info;
        return (
          <li key={e.id} className="flex items-start gap-3 px-1 py-2.5">
            <span aria-hidden className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${e.role === "admin" ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"}`}><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{e.detail}</p>
              {showActor && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  {e.actor_name}
                  <span className={`rounded px-1 text-[10px] font-semibold uppercase ${e.role === "admin" ? "bg-accent/15 text-accent" : "bg-surface-2"}`}>{e.role === "admin" ? "Admin" : "Customer"}</span>
                </p>
              )}
            </div>
            <time className="num shrink-0 text-xs text-muted" dateTime={new Date(e.ts).toISOString()}>
              {new Date(e.ts).toLocaleString("en-NG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
