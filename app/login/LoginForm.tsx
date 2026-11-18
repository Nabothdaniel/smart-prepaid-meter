"use client";
import { useState } from "react";
import { LogIn, ShieldCheck, UserRound, Zap, TriangleAlert } from "lucide-react";

const DEMOS = [
  { label: "Customer", sub: "Views usage, recharges, runs appliances", email: "user@demo.com", password: "user123", Icon: UserRound },
  { label: "Admin", sub: "Controls supply, billing and customer access", email: "admin@demo.com", password: "admin123", Icon: ShieldCheck },
];

export function LoginForm({ demo }: { demo: boolean }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const submit = async (e: string, p: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, password: p }) });
      const j = await r.json();
      if (!j.ok) { setErr(j.message ?? "Couldn’t sign in"); setBusy(false); return; }
      window.location.href = j.role === "admin" ? "/admin" : "/";
    } catch { setErr("Network error. Check your connection and try again."); setBusy(false); }
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div aria-hidden className="grid size-12 place-items-center rounded-xl bg-accent text-accent-fg"><Zap className="size-7" strokeWidth={2.4} /></div>
        <div><h1 className="text-xl font-semibold leading-tight">Smart Prepaid Meter</h1><p className="text-sm text-muted">Sign in to continue</p></div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(email, password); }} className="space-y-4 rounded-2xl border border-line bg-surface p-5" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base" placeholder="you@example.com" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base" />
        </div>
        <p role="alert" className={`flex min-h-5 items-center gap-2 text-sm text-danger ${err ? "" : "hidden"}`}><TriangleAlert className="size-4 shrink-0" aria-hidden />{err}</p>
        <button type="submit" disabled={busy || !email || !password} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-60">
          <LogIn className="size-4" aria-hidden /> {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {demo && (
        <section aria-labelledby="demo-h" className="rounded-2xl border border-dashed border-line p-4">
          <h2 id="demo-h" className="mb-3 text-sm font-medium text-muted">Demo accounts</h2>
          <ul className="space-y-2">
            {DEMOS.map(({ label, sub, email: e, password: p, Icon }) => (
              <li key={label}>
                <button type="button" disabled={busy} onClick={() => { setEmail(e); setPassword(p); submit(e, p); }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 text-left hover:border-muted disabled:opacity-60">
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2"><Icon className="size-5" /></span>
                  <span className="min-w-0"><span className="block text-sm font-medium">Sign in as {label}</span><span className="num block truncate text-xs text-muted">{e} · {p}</span><span className="block text-xs text-muted">{sub}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
