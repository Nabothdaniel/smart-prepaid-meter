"use client";
import { useEffect, useRef, useState } from "react";
import {
  Coins, Flame, Gauge, History, Lock, Megaphone, PlugZap, Power, Radio, Receipt, RotateCcw, ShieldCheck, SlidersHorizontal,
  Unlock, UserRound, WifiOff, Zap, ZapOff, CircleCheck, TriangleAlert, Plus, Minus, Download,
} from "lucide-react";
import { Card, Segmented, naira } from "./ui";
import { Header } from "./Header";
import { AuditList } from "./AuditList";
import { control, useAudit, useMeter } from "./useMeter";
import type { Fault } from "@/lib/types";
import type { SessionUser } from "@/lib/authdb";

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0"><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted">{hint}</p></div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${checked ? "border-accent bg-accent" : "border-line bg-surface-2"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full transition-all ${checked ? "left-[1.35rem] bg-accent-fg" : "left-0.5 bg-muted"}`} />
      </button>
    </div>
  );
}

const field = "num min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60";

export function AdminConsole({ user }: { user: Pick<SessionUser, "name" | "role"> }) {
  const { state: s, offline, refresh } = useMeter();
  const [filter, setFilter] = useState<"all" | "admin" | "user">("all");
  const audit = useAudit(60, filter === "all" ? undefined : filter);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [tariff, setTariff] = useState(""); const [threshold, setThreshold] = useState("");
  const [amount, setAmount] = useState(""); const [notice, setNotice] = useState("");
  const init = useRef(false);

  useEffect(() => {
    if (s && !init.current) { init.current = true; setTariff(String(s.tariff)); setThreshold(String(s.lowThreshold)); setNotice(s.notice ?? ""); }
  }, [s]);

  const run = async (body: object, ok: string) => {
    const r = await control(body);
    setFlash({ ok: !!r.ok, text: r.ok ? ok : (r.message ?? "Something went wrong") });
    refresh(); audit.reload(); return r.ok;
  };

  if (!s) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6" aria-busy="true">
        <div className="skeleton mb-4 h-14 rounded-2xl bg-surface" />
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-48 rounded-2xl bg-surface" />)}</div>
      </main>
    );
  }

  const status = (
    <span className={`inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm ${offline ? "text-danger" : ""}`}>
      {offline ? <><WifiOff className="size-4" aria-hidden /> Reconnecting</> : <><span className="live-dot size-2.5 rounded-full bg-credit" aria-hidden /> <Radio className="size-4 text-muted" aria-hidden /> Live</>}
    </span>
  );
  const supplyColor = s.relayClosed ? "var(--credit)" : "var(--danger)";
  const faults: { f: Fault; label: string; Icon: typeof Zap }[] = [
    { f: "over_voltage", label: "Surge", Icon: Zap }, { f: "under_voltage", label: "Brownout", Icon: Gauge }, { f: "over_current", label: "Overload", Icon: Flame },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4 pb-16 sm:p-6">
      <Header user={user} page="admin" status={status} />

      <div role="status" aria-live="polite" className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${flash ? (flash.ok ? "border-credit/40 bg-credit/10 text-credit" : "border-danger/40 bg-danger/10 text-danger") : "border-line bg-surface text-muted"}`}>
        {flash ? (flash.ok ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <TriangleAlert className="size-4 shrink-0" aria-hidden />) : <ShieldCheck className="size-4 shrink-0" aria-hidden />}
        {flash ? flash.text : "You control supply, billing and customer access from here. Every action is logged."}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Credit", naira(s.credit), "var(--credit)"], ["Power", `${Math.round(s.power)} W`, "var(--power)"],
          ["Voltage", `${s.voltage.toFixed(1)} V`, "var(--voltage)"], ["Energy", `${s.energyKwh.toFixed(3)} kWh`, "var(--energy)"],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{k}</p><p className="num mt-1 text-2xl font-semibold" style={{ color: c }}>{v}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        {/* Supply */}
        <Card title="Supply control" icon={<PlugZap className="size-4" />}>
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${supplyColor} 16%, transparent)`, color: supplyColor }}>
              {s.relayClosed ? <Power className="size-7" aria-hidden /> : <ZapOff className="size-7" aria-hidden />}
            </div>
            <div><p className="text-2xl font-semibold leading-none" style={{ color: supplyColor }}>{s.relayClosed ? "Connected" : "Disconnected"}</p>
              <p className="mt-1 text-sm text-muted">{s.errorLabel ?? (s.relayClosed ? "Customer has power" : "Relay open")}</p></div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {s.adminHold
              ? <button type="button" onClick={() => run({ action: "hold", on: false }, "Supply hold released")} className={`${btn} bg-accent text-accent-fg hover:opacity-90`}><Unlock className="size-4" aria-hidden /> Restore supply</button>
              : <button type="button" onClick={() => run({ action: "hold", on: true }, "Customer disconnected")} className={`${btn} border border-danger/50 bg-danger/10 text-danger hover:bg-danger/20`}><Lock className="size-4" aria-hidden /> Disconnect customer</button>}
            <button type="button" disabled={!s.locked && s.fault === "none"} onClick={() => run({ action: "reset" }, "Trip reset and faults cleared")} className={`${btn} border border-line bg-surface-2 hover:border-muted`}><RotateCcw className="size-4" aria-hidden /> Reset trip</button>
          </div>
          <p className="mt-3 text-xs text-muted">A disconnect holds even if the customer recharges. Reset clears a protection trip and any injected fault.</p>
        </Card>

        {/* Billing */}
        <Card title="Billing" icon={<Receipt className="size-4" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <form onSubmit={(e) => { e.preventDefault(); run({ action: "tariff", value: Number(tariff) }, `Tariff set to ${naira(Number(tariff))}/kWh`); }}>
              <label htmlFor="tariff" className="mb-1.5 block text-sm font-medium">Tariff (₦ per kWh)</label>
              <div className="flex gap-2"><input id="tariff" type="number" inputMode="decimal" min={1} max={500} step="0.5" value={tariff} onChange={(e) => setTariff(e.target.value)} className={field} />
                <button type="submit" className={`${btn} bg-accent text-accent-fg hover:opacity-90`}>Save</button></div>
            </form>
            <form onSubmit={(e) => { e.preventDefault(); run({ action: "threshold", value: Number(threshold) }, `Low-credit alert set to ${naira(Number(threshold))}`); }}>
              <label htmlFor="threshold" className="mb-1.5 block text-sm font-medium">Low-credit alert (₦)</label>
              <div className="flex gap-2"><input id="threshold" type="number" inputMode="numeric" min={0} max={5000} step="10" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={field} />
                <button type="submit" className={`${btn} bg-accent text-accent-fg hover:opacity-90`}>Save</button></div>
            </form>
          </div>
          <form className="mt-4 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); const n = Number(amount); run({ action: "credit", amount: n }, `${n > 0 ? "Added" : "Removed"} ${naira(Math.abs(n))}`).then((ok) => ok && setAmount("")); }}>
            <label htmlFor="amount" className="mb-1.5 block text-sm font-medium">Adjust customer credit (₦)</label>
            <div className="flex gap-2">
              <input id="amount" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 or -200" className={field} />
              <button type="submit" disabled={!amount || Number(amount) === 0} className={`${btn} bg-accent text-accent-fg hover:opacity-90`}>Apply</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[200, 500, 1000, -200].map((n) => (
                <button key={n} type="button" onClick={() => setAmount(String(n))} className="num inline-flex min-h-10 items-center gap-1 rounded-lg border border-line bg-surface-2 px-3 text-sm hover:border-muted">
                  {n > 0 ? <Plus className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}₦{Math.abs(n).toLocaleString("en-NG")}
                </button>
              ))}
            </div>
          </form>
        </Card>

        {/* Access */}
        <Card title="Customer access" icon={<UserRound className="size-4" />}>
          <div className="divide-y divide-line">
            <Switch checked={s.permissions.userCanRecharge} label="Customer can recharge" hint="Lets the customer enter recharge tokens"
              onChange={(v) => run({ action: "permissions", userCanRecharge: v }, `Recharging ${v ? "enabled" : "disabled"} for the customer`)} />
            <Switch checked={s.permissions.userCanControlLoad} label="Customer can control appliances" hint="Lets the customer switch loads on and off"
              onChange={(v) => run({ action: "permissions", userCanControlLoad: v }, `Appliance control ${v ? "enabled" : "disabled"} for the customer`)} />
          </div>
          <p className="mt-3 text-xs text-muted">Only an admin can reset trips, change billing, disconnect the supply or inject faults.</p>
        </Card>

        {/* Notice */}
        <Card title="Notice to customer" icon={<Megaphone className="size-4" />}>
          <form onSubmit={(e) => { e.preventDefault(); run({ action: "notice", text: notice }, notice.trim() ? "Notice sent" : "Notice cleared"); }}>
            <label htmlFor="notice" className="mb-1.5 block text-sm font-medium">Message (shown on their dashboard)</label>
            <textarea id="notice" rows={3} maxLength={200} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="e.g. Scheduled maintenance tonight 2:00-3:00 am"
              className="min-h-24 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-base" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="num text-xs text-muted">{notice.length}/200</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setNotice(""); run({ action: "notice", text: "" }, "Notice cleared"); }} className={`${btn} border border-line bg-surface-2 hover:border-muted`}>Clear</button>
                <button type="submit" disabled={!notice.trim()} className={`${btn} bg-accent text-accent-fg hover:opacity-90`}>Send</button>
              </div>
            </div>
          </form>
        </Card>

        {/* Simulation */}
        <Card title="Simulation" icon={<SlidersHorizontal className="size-4" />} className="lg:col-span-2"
          action={<Segmented label="Simulation speed" value={s.speed} onChange={(v) => run({ action: "speed", speed: v }, `Speed set to ${v}×`)} options={[{ value: 1, label: "1×" }, { value: 10, label: "10×" }, { value: 60, label: "60×" }, { value: 300, label: "300×" }]} />}>
          <p className="mb-3 text-sm text-muted">Inject a grid fault to demonstrate the protection logic. Over-voltage above 260 V and over-current above 20 A trip the relay. Below 180 V only warns.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {faults.map(({ f, label, Icon }) => (
              <button key={f} type="button" aria-pressed={s.fault === f} onClick={() => run({ action: "fault", fault: s.fault === f ? "none" : f }, s.fault === f ? "Fault cleared" : `${label} injected`)}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${s.fault === f ? "border-danger bg-danger/15 text-danger" : "border-line bg-surface-2 hover:border-muted"}`}>
                <Icon className="size-4 shrink-0" /> {label}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Activity log" icon={<History className="size-4" />}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Filter by role" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "admin", label: "Admin" }, { value: "user", label: "Customer" }]} />
            <a href="/api/export" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-surface-2"><Download className="size-4" aria-hidden /> Readings CSV</a>
          </div>}>
        <AuditList entries={audit.data} error={audit.error} empty="Nothing logged for this filter yet." />
      </Card>

      <footer className="pt-2 text-center text-xs text-muted">{s.readingsCount.toLocaleString("en-NG")} readings stored in SQLite · data/meter.db</footer>
    </main>
  );
}
