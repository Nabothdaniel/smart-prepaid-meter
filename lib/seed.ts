import type Database from "better-sqlite3";

export const APPLIANCE_DEFS = [
  { id: "lights", name: "Lighting", watts: 60 },
  { id: "fridge", name: "Refrigerator", watts: 150 },
  { id: "fan", name: "Ceiling fan", watts: 75 },
  { id: "tv", name: "Television", watts: 120 },
  { id: "laptop", name: "Laptop", watts: 65 },
  { id: "ac", name: "Air conditioner", watts: 1400 },
  { id: "kettle", name: "Electric kettle", watts: 1800 },
  { id: "iron", name: "Pressing iron", watts: 1000 },
] as const;
export const DEFAULT_ON = ["lights", "fridge", "fan", "tv"];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pre-seed 24 h of realistic history (one reading a minute) so the dashboard is alive on first run. */
export function seed(db: Database.Database) {
  const r = rng(20260918);
  const TARIFF = 50, PF = 0.95, STEP = 60_000, N = 1440;
  const end = Math.floor(Date.now() / STEP) * STEP - STEP;
  const t0 = end - (N - 1) * STEP;
  let credit = 300, energy = 0, lowSent = false;

  const acHour = new Map<number, boolean>();
  const insR = db.prepare("INSERT INTO readings (ts,power,voltage,current,energy,credit,relay) VALUES (?,?,?,?,?,?,?)");
  const insE = db.prepare("INSERT INTO events (ts,level,kind,message) VALUES (?,?,?,?)");
  const insC = db.prepare("INSERT INTO recharges (ts,token,amount,ok) VALUES (?,?,?,1)");
  const sagAt = Math.floor(N * 0.37);

  db.transaction(() => {
    insE.run(t0, "info", "boot", "Meter online. Monitoring started");
    for (let i = 0; i < N; i++) {
      const ts = t0 + i * STEP;
      const d = new Date(ts), h = d.getHours(), m = d.getMinutes();
      if (!acHour.has(ts - (ts % 3_600_000))) acHour.set(ts - (ts % 3_600_000), (h >= 22 || h <= 4) ? r() < 0.55 : (h >= 13 && h <= 15) ? r() < 0.35 : false);
      let load = 0;
      if (m % 30 < 18) load += 150;                                  // fridge duty cycle
      if (h >= 18 || h <= 5) load += 60;                              // lights
      if (h >= 11 || h <= 5) load += 75;                              // fan
      if (h >= 18 && h <= 22) load += 120;                            // tv
      if (h >= 9 && h <= 17) load += 65;                              // laptop
      if (acHour.get(ts - (ts % 3_600_000))) load += 1400;            // ac
      if ((h === 6 || h === 20) && m < 6) load += 1800;               // kettle
      if (h === 7 && m < 20) load += 1000;                            // iron
      let v = 230 + 4 * Math.sin(i / 90) + (r() - 0.5) * 3;
      if (Math.abs(i - sagAt) < 4) v = 172 + r() * 5;                 // one brown-out
      const relay = credit > 0;
      const p = relay ? load * (0.97 + 0.06 * r()) : 0;
      const cur = p / (v * PF);
      if (relay) {
        const kwh = (p * 60) / 3.6e6;
        energy += kwh; credit = Math.max(0, credit - kwh * TARIFF);
      }
      insR.run(ts, p, v, cur, energy, credit, relay ? 1 : 0);
      if (i === 2) {
        credit += 1000;
        insC.run(ts + 5000, "TOKEN1000", 1000);
        insE.run(ts + 5000, "success", "recharge", "Recharge successful: ₦1,000");
      }
      if (i === sagAt) insE.run(ts, "warn", "fault", "Low voltage warning");
      if (credit <= 100 && credit > 0 && !lowSent) { insE.run(ts, "warn", "credit", "Low credit"); lowSent = true; }
      if (credit <= 30) {
        credit += 500; lowSent = false;
        insC.run(ts + 5000, "TOKEN500", 500);
        insE.run(ts + 5000, "success", "recharge", "Recharge successful: ₦500");
      }
    }
    const set = db.prepare("INSERT OR REPLACE INTO state (key,value) VALUES (?,?)");
    set.run("credit", String(credit));
    set.run("energy", String(energy));
    set.run("tariff", String(TARIFF));
    set.run("lowThreshold", "100");
    set.run("speed", "10");
    set.run("locked", "0");
    set.run("lowAlertSent", credit <= 100 ? "1" : "0");
    set.run("appliances", JSON.stringify(DEFAULT_ON));
    set.run("seeded", String(Date.now()));
  })();
}
