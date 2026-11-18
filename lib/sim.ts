import type Database from "better-sqlite3";
import { openDb } from "./db";
import { APPLIANCE_DEFS, DEFAULT_ON } from "./seed";
import type { Fault, Level, MeterState } from "./types";

// Token table from firmware Algorithm 6.
export const TOKENS: Record<string, number> = {
  TOKEN100: 100, TOKEN200: 200, TOKEN500: 500, TOKEN1000: 1000, TOKEN2000: 2000, TOKEN5000: 5000,
};

const CFG = { pf: 0.95, vMax: 260, vMin: 180, iMax: 20, filter: 0.5, recordEverySec: 5, eepromStep: 1 };
const noise = () => Math.random() + Math.random() + Math.random() - 1.5; // ~N(0, 0.5)

class Sim {
  db: Database.Database;
  credit = 0; energy = 0; vrms = 230; irms = 0; power = 0;
  tariff = 50; lowThreshold = 100; speed = 10;
  relayClosed = false; locked = false; lowAlertSent = false;
  adminHold = false; userCanRecharge = true; userCanControlLoad = true; notice: string | null = null;
  err: "none" | "under" | "over_v" | "over_i" = "none";
  fault: Fault = "none";
  on = new Set<string>(DEFAULT_ON);
  rechargeCount = 0; rejectedTokens = 0; readingsCount = 0;
  lcd: [string, string] = ["System Ready", ""];
  private displayMode = 0; private tickN = 0; private lastSaved = 0;

  constructor() {
    this.db = openDb();
    this.restore();
    this.relayClosed = this.credit > 0 && !this.locked && !this.adminHold;
    this.lastSaved = this.credit;
    this.show("System Ready", this.relayClosed ? "Connected" : "Disconnected");
    this.log("info", "boot", "Meter powered on. Recording resumed");
    setInterval(() => { try { this.tick(); } catch (e) { console.error("tick failed", e); } }, 1000);
    // Keep data/meter.db self-contained (flush the WAL) so committing/copying the one file carries everything.
    setInterval(() => this.flush(), 30_000);
    const bye = () => { this.flush(true); process.exit(0); };
    process.once("SIGINT", bye); process.once("SIGTERM", bye);
  }

  flush(close = false) {
    try { this.save(); this.db.pragma("wal_checkpoint(TRUNCATE)"); if (close) this.db.close(); } catch { /* db already closed */ }
  }

  // ---- persistence (the firmware's EEPROM) --------------------------------
  private getState(k: string) { return (this.db.prepare("SELECT value FROM state WHERE key=?").get(k) as { value: string } | undefined)?.value; }
  private setState = (() => { let st: Database.Statement | null = null; return (k: string, v: string) => { st ??= this.db.prepare("INSERT OR REPLACE INTO state (key,value) VALUES (?,?)"); st.run(k, v); }; })();
  private restore() {
    this.credit = Number(this.getState("credit") ?? 0);
    this.energy = Number(this.getState("energy") ?? 0);
    this.tariff = Number(this.getState("tariff") ?? 50);
    this.lowThreshold = Number(this.getState("lowThreshold") ?? 100);
    this.speed = Number(this.getState("speed") ?? 10);
    this.locked = this.getState("locked") === "1";
    this.lowAlertSent = this.getState("lowAlertSent") === "1";
    this.adminHold = this.getState("adminHold") === "1";
    this.userCanRecharge = this.getState("userCanRecharge") !== "0";
    this.userCanControlLoad = this.getState("userCanControlLoad") !== "0";
    this.notice = this.getState("notice") || null;
    try { this.on = new Set(JSON.parse(this.getState("appliances") ?? "[]")); } catch { /* keep defaults */ }
    this.rechargeCount = (this.db.prepare("SELECT COUNT(*) c FROM recharges WHERE ok=1").get() as { c: number }).c;
    this.rejectedTokens = (this.db.prepare("SELECT COUNT(*) c FROM recharges WHERE ok=0").get() as { c: number }).c;
    this.readingsCount = (this.db.prepare("SELECT COUNT(*) c FROM readings").get() as { c: number }).c;
  }
  private save() {
    this.db.transaction(() => {
      this.setState("credit", String(this.credit)); this.setState("energy", String(this.energy));
      this.setState("locked", this.locked ? "1" : "0"); this.setState("lowAlertSent", this.lowAlertSent ? "1" : "0");
      this.setState("speed", String(this.speed));
      this.setState("tariff", String(this.tariff)); this.setState("lowThreshold", String(this.lowThreshold));
      this.setState("adminHold", this.adminHold ? "1" : "0"); this.setState("notice", this.notice ?? "");
      this.setState("userCanRecharge", this.userCanRecharge ? "1" : "0"); this.setState("userCanControlLoad", this.userCanControlLoad ? "1" : "0"); this.setState("appliances", JSON.stringify([...this.on]));
    })();
    this.lastSaved = this.credit;
  }

  log(level: Level, kind: string, message: string) {
    this.db.prepare("INSERT INTO events (ts,level,kind,message) VALUES (?,?,?,?)").run(Date.now(), level, kind, message);
  }
  private show(a: string, b: string) { this.lcd = [a.slice(0, 16), b.slice(0, 16)]; }
  private notify(level: Level, kind: string, msg: string) { this.log(level, kind, msg); }

  // ---- Algorithm 3: measure and deduct -----------------------------------
  private measure(dt: number) {
    const vTarget = this.fault === "over_voltage" ? 285 : this.fault === "under_voltage" ? 165 : 230 + 3 * Math.sin(Date.now() / 60000);
    const v = vTarget + noise() * 1.6;
    let load = 0;
    if (this.relayClosed) {
      for (const a of APPLIANCE_DEFS) if (this.on.has(a.id)) load += a.watts * (1 + noise() * 0.04);
      if (this.fault === "over_current") load += 4500;
    }
    let ri = load / (v * CFG.pf);
    if (ri < 0.05) ri = 0;
    const f = CFG.filter;
    this.vrms = f * this.vrms + (1 - f) * v;
    this.irms = f * this.irms + (1 - f) * ri;
    if (ri === 0 && this.irms < 0.05) this.irms = 0;
    this.power = this.vrms * this.irms * CFG.pf;
    if (this.relayClosed) {
      const kwh = (this.power * dt) / 3600 / 1000;
      this.energy += kwh;
      this.credit = Math.max(0, this.credit - kwh * this.tariff);
      if (this.lastSaved - this.credit >= CFG.eepromStep || this.credit === 0) this.save();
    }
  }

  // ---- Algorithms 4, 7 and the credit checks ----------------------------
  private updateLcd() {
    const m = this.displayMode;
    if (m === 0) this.show(`Credit: N${this.credit.toFixed(2)}`, `Power: ${this.power.toFixed(0)}W`);
    else if (m === 1) this.show(`Voltage: ${this.vrms.toFixed(0)}V`, `Current: ${this.irms.toFixed(2)}A`);
    else this.show(`Energy:${this.energy.toFixed(this.energy >= 100 ? 2 : 3)}kWh`, this.relayClosed ? "CONNECTED" : "DISCONNECTED");
    this.displayMode = (m + 1) % 3;
  }
  private applyRelay(closed: boolean) { this.relayClosed = closed; }
  private trip(e: "over_v" | "over_i", msg: string) {
    if (this.locked && this.err === e) return;
    this.err = e; this.locked = true; this.applyRelay(false);
    this.show(msg, "Manual reset"); this.notify("critical", "fault", `${msg}. Supply disconnected`); this.save();
  }
  private checks() {
    if (this.credit <= 0 && this.relayClosed) {
      this.applyRelay(false); this.show("Credit Exhausted", ""); this.notify("critical", "credit", "Disconnected: credit exhausted"); this.save();
    } else if (this.credit > 0 && !this.relayClosed && !this.locked && !this.adminHold) {
      this.applyRelay(true); this.show("Connected", ""); this.notify("success", "relay", "Supply reconnected");
    }
    if (this.credit > 0 && this.credit <= this.lowThreshold) {
      if (!this.lowAlertSent) { this.show("Low Credit", ""); this.notify("warn", "credit", "Low credit"); this.lowAlertSent = true; this.save(); }
    } else if (this.credit > this.lowThreshold) this.lowAlertSent = false;

    if (this.vrms > CFG.vMax) this.trip("over_v", "OVER VOLTAGE");
    else if (this.irms > CFG.iMax) this.trip("over_i", "OVER CURRENT");
    else if (!this.locked) {
      if (this.vrms > 0 && this.vrms < CFG.vMin) {
        if (this.err !== "under") { this.err = "under"; this.show("LOW VOLTAGE", ""); this.notify("warn", "fault", "Low voltage warning"); }
      } else if (this.err === "under") this.err = "none";
    }
  }

  tick() {
    const dt = this.speed; // simulated seconds per real second
    this.measure(dt);
    this.tickN++;
    if (this.tickN % 5 === 0) this.updateLcd();
    this.checks();
    if (this.tickN % CFG.recordEverySec === 0) {
      this.db.prepare("INSERT INTO readings (ts,power,voltage,current,energy,credit,relay) VALUES (?,?,?,?,?,?,?)")
        .run(Date.now(), this.power, this.vrms, this.irms, this.energy, this.credit, this.relayClosed ? 1 : 0);
      this.readingsCount++; this.save();
    }
  }

  // ---- Algorithm 6: recharge --------------------------------------------
  recharge(raw: string) {
    const token = (raw ?? "").trim().toUpperCase();
    const reject = (m: string) => { this.rejectedTokens++; this.show(m, ""); this.notify("warn", "recharge", m);
      this.db.prepare("INSERT INTO recharges (ts,token,amount,ok) VALUES (?,?,?,0)").run(Date.now(), token.slice(0, 24), null); return { ok: false, message: m }; };
    if (token.length < 4) return reject("Invalid token format");
    const value = TOKENS[token];
    if (!value) return reject("Invalid token");
    this.credit += value; this.lowAlertSent = false; this.rechargeCount++;
    this.db.prepare("INSERT INTO recharges (ts,token,amount,ok) VALUES (?,?,?,1)").run(Date.now(), token, value);
    this.show("Recharge OK", `+N${value}`);
    this.notify("success", "recharge", `Recharge successful: ₦${value.toLocaleString("en-NG")}`);
    if (!this.locked && !this.relayClosed && !this.adminHold) { this.applyRelay(true); this.notify("success", "relay", "Supply reconnected"); }
    this.save();
    return { ok: true, message: `₦${value.toLocaleString("en-NG")} added`, amount: value };
  }

  setAppliance(id: string, on: boolean) {
    if (!APPLIANCE_DEFS.some((a) => a.id === id)) return;
    on ? this.on.add(id) : this.on.delete(id);
    this.save();
  }
  setSpeed(s: number) { if ([1, 10, 60, 300].includes(s)) { this.speed = s; this.save(); } }
  setFault(f: Fault) {
    this.fault = f;
    if (f !== "none") this.log("warn", "sim", `Fault injected: ${f.replace("_", " ")}`);
    else this.log("info", "sim", "Faults cleared");
  }
  manualReset() {
    this.fault = "none"; this.locked = false; this.err = "none";
    this.vrms = 230; this.irms = 0;
    if (this.credit > 0 && !this.adminHold) this.applyRelay(true);
    this.log("info", "relay", "Manual reset. Supply restored"); this.show("Reset OK", ""); this.save();
  }

  // ---- admin controls -----------------------------------------------------
  setHold(on: boolean) {
    this.adminHold = on;
    if (on && this.relayClosed) { this.applyRelay(false); this.show("Admin Hold", "Disconnected"); this.log("critical", "relay", "Supply disconnected by admin"); }
    else if (!on) { this.log("info", "relay", "Admin released the supply hold"); if (this.credit > 0 && !this.locked) { this.applyRelay(true); this.show("Connected", ""); this.log("success", "relay", "Supply reconnected"); } }
    this.save();
  }
  setTariff(n: number) { if (n >= 1 && n <= 500) { this.tariff = n; this.save(); this.log("info", "billing", `Tariff set to ₦${n}/kWh`); return true; } return false; }
  setThreshold(n: number) { if (n >= 0 && n <= 5000) { this.lowThreshold = n; this.lowAlertSent = false; this.save(); this.log("info", "billing", `Low-credit alert set to ₦${n}`); return true; } return false; }
  adjustCredit(amount: number) {
    if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) return false;
    this.credit = Math.max(0, this.credit + amount);
    if (amount > 0) this.lowAlertSent = false;
    this.log(amount > 0 ? "success" : "warn", "credit", `Admin ${amount > 0 ? "added" : "removed"} ₦${Math.abs(amount).toLocaleString("en-NG")} ${amount > 0 ? "credit" : "from credit"}`);
    this.save(); return true;
  }
  setPermissions(p: { userCanRecharge?: boolean; userCanControlLoad?: boolean }) {
    if (typeof p.userCanRecharge === "boolean") this.userCanRecharge = p.userCanRecharge;
    if (typeof p.userCanControlLoad === "boolean") this.userCanControlLoad = p.userCanControlLoad;
    this.save();
  }
  setNotice(text: string | null) { this.notice = text ? text.slice(0, 200) : null; this.save(); }

  snapshot(): MeterState {
    const errorLabel = this.adminHold ? "Disconnected by admin" : this.err === "over_v" ? "Over-voltage trip" : this.err === "over_i" ? "Over-current trip" : this.err === "under" ? "Low voltage" : null;
    return {
      now: Date.now(), credit: this.credit, creditPct: this.credit > 0 ? Math.min(100, this.credit / 10) : 0,
      energyKwh: this.energy, power: this.power, voltage: this.vrms, current: this.irms,
      relayClosed: this.relayClosed, locked: this.locked, errorLabel, tariff: this.tariff, lowThreshold: this.lowThreshold,
      speed: this.speed, fault: this.fault,
      runwayHours: this.power > 1 ? this.credit / ((this.power / 1000) * this.tariff) : null,
      lcd: this.lcd,
      appliances: APPLIANCE_DEFS.map((a) => ({ id: a.id, name: a.name, watts: a.watts, on: this.on.has(a.id) })),
      rechargeCount: this.rechargeCount, rejectedTokens: this.rejectedTokens, readingsCount: this.readingsCount,
      recordEverySec: CFG.recordEverySec,
      adminHold: this.adminHold, notice: this.notice,
      permissions: { userCanRecharge: this.userCanRecharge, userCanControlLoad: this.userCanControlLoad },
    };
  }
}

const g = globalThis as unknown as { __meterSim?: Sim };
export function getSim(): Sim { return (g.__meterSim ??= new Sim()); }
