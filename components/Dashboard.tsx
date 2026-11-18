"use client";
import { useRef, useState } from "react";
import {
  Activity, AirVent, ArrowUpFromLine, CircleAlert, CircleCheck, CookingPot, Download, Fan, Gauge, History, Info, KeyRound,
  Laptop, Lightbulb, Lock, Megaphone, PlugZap, Power, Radio, Refrigerator, RotateCcw, SendHorizontal, Shirt, ShieldAlert,
  TrendingDown, Tv, Wallet, WifiOff, Zap, ZapOff, Cpu, Timer, UserRound, ShieldCheck,
} from "lucide-react";
import { Card, Sparkline, fmtRunway, naira } from "./ui";
import { PowerChart } from "./PowerChart";
import { Header } from "./Header";
import { AuditList } from "./AuditList";
import { control, useAudit, useEvents, useMeter } from "./useMeter";
import type { Level } from "@/lib/types";
import type { SessionUser } from "@/lib/authdb";

const APP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lights: Lightbulb, fridge: Refrigerator, fan: Fan, tv: Tv, laptop: Laptop, ac: AirVent, kettle: CookingPot, iron: Shirt,
};
const LEVEL: Record<Level, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  info: { icon: Info, cls: "text-voltage" }, success: { icon: CircleCheck, cls: "text-credit" },
  warn: { icon: CircleAlert, cls: "text-warn" }, critical: { icon: ShieldAlert, cls: "text-danger" },
};
const TOKENS = [100, 200, 500, 1000, 2000, 5000];

function Stat({ label, value, unit, color, icon, spark }: { label: string; value: string; unit: string; color: string; icon: React.ReactNode; spark: number[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{label}</span>
        <span aria-hidden style={{ color }} className="grid size-8 place-items-center rounded-lg bg-surface-2">{icon}</span>
      </div>
      <p className="num mt-2 text-3xl font-semibold leading-none sm:text-[2rem]" style={{ color }}>{value}<span className="ml-1.5 text-sm font-normal text-muted">{unit}</span></p>
      <div className="mt-3" style={{ color }}><Sparkline values={spark} color="currentColor" /></div>
    </div>
  );
}

export function Lcd({ lines }: { lines: [string, string] }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div role="img" aria-label={`Meter display: ${lines[0]} ${lines[1]}`} className="num rounded-md px-3 py-2.5 text-[15px] leading-snug shadow-inner" style={{ background: "var(--lcd-bg)", color: "var(--lcd-fg)" }}>
        <div className="whitespace-pre">{lines[0].padEnd(16, " ")}</div>
        <div className="whitespace-pre">{lines[1].padEnd(16, " ")}</div>
      </div>
    </div>
  );
}

export function LockedNote({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted"><Lock className="size-4 shrink-0" aria-hidden /> {children}</p>;
}

export function Dashboard({ user }: { user: Pick<SessionUser, "name" | "role"> }) {
  const admin = user.role === "admin";
  const { state: s, offline, hist, refresh } = useMeter();
  const events = useEvents(30);
  const audit = useAudit(12);
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const act = async (body: object) => { const r = await control(body); if (!r.ok && r.message) setMsg({ ok: false, text: r.message }); refresh(); audit.reload(); };
  const recharge = async (t: string) => {
    if (!t.trim()) { setMsg({ ok: false, text: "Enter a token first" }); input.current?.focus(); return; }
    setBusy(true);
    const r = await control({ action: "recharge", token: t });
    setBusy(false); setMsg({ ok: !!r.ok, text: r.ok ? `Recharge successful: ${r.message}` : (r.message ?? "Couldn’t recharge") });
    if (r.ok) setToken(""); refresh(); audit.reload();
  };

  const status = !s ? null : (
    <span className={`inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm ${offline ? "text-danger" : ""}`}>
      {offline ? <><WifiOff className="size-4" aria-hidden /> Reconnecting</> : <><span className="live-dot size-2.5 rounded-full bg-credit" aria-hidden /> <Radio className="size-4 text-muted" aria-hidden /> Recording every {s.recordEverySec}s</>}
    </span>
  );

  if (!s) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6" aria-busy="true">
        <div className="skeleton mb-4 h-14 rounded-2xl bg-surface" />
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-2xl bg-surface" />)}</div>
        {offline && <p className="mt-6 text-center text-sm text-muted">Waiting for the meter service…</p>}
      </main>
    );
  }

  const low = s.credit > 0 && s.credit <= s.lowThreshold;
  const statusColor = !s.relayClosed ? "var(--danger)" : low ? "var(--warn)" : "var(--credit)";
  const canRecharge = admin || s.permissions.userCanRecharge;
  const canLoad = admin || s.permissions.userCanControlLoad;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 pb-16 sm:p-6">
      <Header user={user} page="dashboard" status={status} />

      {s.notice && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-voltage/40 bg-voltage/10 px-4 py-3 text-sm">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-voltage" aria-hidden />
          <p><span className="font-medium">Notice from your admin:</span> {s.notice}</p>
        </div>
      )}
      {s.adminHold && !admin && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <ZapOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Your supply was disconnected by an admin. Recharging won’t reconnect it. Contact your utility to restore it.</p>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-muted"><Wallet className="size-4" aria-hidden /> Remaining credit</p>
              <p className="num mt-2 text-5xl font-semibold leading-none sm:text-6xl" style={{ color: low ? "var(--warn)" : "var(--credit)" }}>{naira(s.credit)}</p>
            </div>
            <div className="text-right text-sm">
              <p className="flex items-center justify-end gap-1.5 text-muted"><Timer className="size-4" aria-hidden /> Runway</p>
              <p className="num mt-1 text-xl font-medium">{s.relayClosed ? fmtRunway(s.runwayHours) : "—"}</p>
            </div>
          </div>
          <div className="mt-5" role="progressbar" aria-label="Credit remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.creditPct)}>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div className="bar-fill h-full rounded-full" style={{ width: `${s.creditPct}%`, background: low ? "var(--warn)" : "var(--credit)" }} />
            </div>
            <div className="num mt-2 flex justify-between text-xs text-muted"><span>₦0</span><span>Low alert ₦{s.lowThreshold}</span><span>₦1,000</span></div>
          </div>
          {low && <p className="mt-4 flex items-center gap-2 rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn"><TrendingDown className="size-4 shrink-0" aria-hidden /> Credit is low. Recharge before the supply disconnects.</p>}
        </Card>

        <Card title="Supply" icon={<PlugZap className="size-4" />} className="lg:col-span-2">
          <div className="flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${statusColor} 16%, transparent)`, color: statusColor }}>
              {s.relayClosed ? <Power className="size-8" aria-hidden /> : <ZapOff className="size-8" aria-hidden />}
            </div>
            <div>
              <p className="text-3xl font-semibold leading-none" style={{ color: statusColor }}>{s.relayClosed ? "Connected" : "Disconnected"}</p>
              <p className="mt-1.5 text-sm text-muted">{s.errorLabel ?? (s.relayClosed ? "Relay closed · supply live" : s.credit <= 0 ? "Credit exhausted" : "Relay open")}</p>
            </div>
          </div>
          {s.locked && (admin
            ? <button type="button" onClick={() => act({ action: "reset" })} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:opacity-90"><RotateCcw className="size-4" aria-hidden /> Manual reset</button>
            : <p className="mt-4 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"><Lock className="size-4 shrink-0" aria-hidden /> Protection tripped. Only an admin can reset it.</p>)}
          <div className="mt-4"><Lcd lines={s.lcd} /></div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Power" value={Math.round(s.power).toLocaleString("en-NG")} unit="W" color="var(--power)" icon={<Zap className="size-4" />} spark={hist.power} />
        <Stat label="Voltage" value={s.voltage.toFixed(1)} unit="V" color="var(--voltage)" icon={<Gauge className="size-4" />} spark={hist.voltage} />
        <Stat label="Current" value={s.current.toFixed(2)} unit="A" color="var(--current)" icon={<Activity className="size-4" />} spark={hist.current} />
        <Stat label="Energy" value={s.energyKwh.toFixed(3)} unit="kWh" color="var(--energy)" icon={<ArrowUpFromLine className="size-4" />} spark={hist.energy} />
      </div>

      <Card title="Usage history" icon={<History className="size-4" />}
        action={admin ? <a href="/api/export" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-surface-2"><Download className="size-4" aria-hidden /> Export CSV</a> : undefined}>
        <PowerChart />
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card title="Recharge" icon={<KeyRound className="size-4" />}>
          {!canRecharge && <LockedNote>Recharging is turned off by your admin.</LockedNote>}
          <form onSubmit={(e) => { e.preventDefault(); recharge(token); }} noValidate>
            <label htmlFor="token" className="mb-1.5 block text-sm font-medium">Recharge token</label>
            <div className="flex gap-2">
              <input id="token" ref={input} value={token} disabled={!canRecharge} onChange={(e) => { setToken(e.target.value.toUpperCase()); setMsg(null); }}
                name="token" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="TOKEN500"
                aria-invalid={msg ? !msg.ok : undefined} aria-describedby="token-msg"
                className="num min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-base placeholder:text-muted/70 disabled:opacity-60" />
              <button type="submit" disabled={busy || !canRecharge} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-60">
                <SendHorizontal className="size-4" aria-hidden /> Send
              </button>
            </div>
            <p id="token-msg" role="status" className={`mt-2 min-h-5 text-sm ${msg ? (msg.ok ? "text-credit" : "text-danger") : "text-muted"}`}>
              {msg ? msg.text : "Tokens look like TOKEN500. Tap one below to fill it in."}
            </p>
          </form>
          <div className="mt-2 flex flex-wrap gap-2">
            {TOKENS.map((n) => (
              <button key={n} type="button" disabled={!canRecharge} onClick={() => { setToken(`TOKEN${n}`); setMsg(null); input.current?.focus(); }}
                className="num min-h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm hover:border-muted disabled:opacity-60">₦{n.toLocaleString("en-NG")}</button>
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
            <div><dt className="text-xs text-muted">Tariff</dt><dd className="num mt-0.5 font-medium">₦{s.tariff}/kWh</dd></div>
            <div><dt className="text-xs text-muted">Recharges</dt><dd className="num mt-0.5 font-medium">{s.rechargeCount}</dd></div>
            <div><dt className="text-xs text-muted">Rejected</dt><dd className="num mt-0.5 font-medium">{s.rejectedTokens}</dd></div>
          </dl>
        </Card>

        <Card title="Connected load" icon={<Cpu className="size-4" />}>
          {!canLoad && <LockedNote>Appliance control is turned off by your admin.</LockedNote>}
          <ul className="grid grid-cols-2 gap-2">
            {s.appliances.map((a) => {
              const Icon = APP_ICON[a.id] ?? Zap;
              return (
                <li key={a.id}>
                  <button type="button" aria-pressed={a.on} disabled={!canLoad} onClick={() => act({ action: "appliance", id: a.id, on: !a.on })}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors disabled:opacity-60 ${a.on ? "border-accent/60 bg-accent/10" : "border-line bg-surface-2 hover:border-muted"}`}>
                    <Icon className={`size-5 shrink-0 ${a.on ? "text-accent" : "text-muted"}`} />
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{a.name}</span><span className="num block text-xs text-muted">{a.watts} W · {a.on ? "On" : "Off"}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card title={admin ? "Recent activity (all users)" : "My activity"} icon={admin ? <ShieldCheck className="size-4" /> : <UserRound className="size-4" />}
          action={admin ? <a href="/admin" className="text-sm text-accent hover:underline">Open console</a> : undefined}>
          <AuditList entries={audit.data} error={audit.error} showActor={admin} empty="No activity yet. Recharge or switch an appliance to see it here." />
        </Card>

        <Card title="Meter events" icon={<History className="size-4" />}>
          {!events.data ? <div className="skeleton h-40 rounded-xl bg-surface-2" /> :
            events.data.length === 0 ? <p className="py-8 text-center text-sm text-muted">No events yet.</p> : (
              <ul className="-mx-1 max-h-80 divide-y divide-line overflow-y-auto pr-1">
                {events.data.map((e) => {
                  const L = LEVEL[e.level] ?? LEVEL.info;
                  return (
                    <li key={e.id} className="flex items-start gap-3 px-1 py-2.5">
                      <L.icon className={`mt-0.5 size-4 shrink-0 ${L.cls}`} />
                      <span className="min-w-0 flex-1 text-sm">{e.message}</span>
                      <time className="num shrink-0 text-xs text-muted" dateTime={new Date(e.ts).toISOString()}>
                        {new Date(e.ts).toLocaleString("en-NG", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
        </Card>
      </div>

      <footer className="pt-2 text-center text-xs text-muted">{s.readingsCount.toLocaleString("en-NG")} readings stored in SQLite · data/meter.db</footer>
    </main>
  );
}
