"use client";
import type { ReactNode } from "react";
import { LogOut, ShieldCheck, UserRound, Zap, LayoutDashboard } from "lucide-react";
import type { SessionUser } from "@/lib/authdb";

export function Header({ user, page, status }: { user: Pick<SessionUser, "name" | "role">; page: "dashboard" | "admin"; status?: ReactNode }) {
  const admin = user.role === "admin";
  const signOut = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };
  const link = "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm";
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div aria-hidden className="grid size-11 place-items-center rounded-xl bg-accent text-accent-fg"><Zap className="size-6" strokeWidth={2.4} /></div>
        <div>
          <h1 className="text-lg font-semibold leading-tight">{page === "admin" ? "Admin console" : "Smart Prepaid Meter"}</h1>
          <p className="text-sm text-muted">ESP8266 · simulated live feed</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status}
        {admin && (page === "admin"
          ? <a href="/" className={`${link} border-line bg-surface hover:bg-surface-2`}><LayoutDashboard className="size-4" aria-hidden /> Customer view</a>
          : <a href="/admin" className={`${link} border-accent/50 bg-accent/10 text-accent hover:bg-accent/20`}><ShieldCheck className="size-4" aria-hidden /> Admin console</a>)}
        <span className={`${link} border-line bg-surface`}>
          {admin ? <ShieldCheck className="size-4 text-accent" aria-hidden /> : <UserRound className="size-4 text-muted" aria-hidden />}
          <span className="max-w-[9rem] truncate">{user.name}</span>
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${admin ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"}`}>{admin ? "Admin" : "Customer"}</span>
        </span>
        <button type="button" onClick={signOut} className={`${link} border-line bg-surface hover:bg-surface-2`}><LogOut className="size-4" aria-hidden /> Sign out</button>
      </div>
    </header>
  );
}
