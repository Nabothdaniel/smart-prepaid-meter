import { getSim } from "@/lib/sim";
import { getUser } from "@/lib/session";
import { writeAudit } from "@/lib/authdb";
import type { Fault } from "@/lib/types";
export const dynamic = "force-dynamic";

const ADMIN_ONLY = new Set(["speed", "fault", "reset", "hold", "tariff", "threshold", "credit", "permissions", "notice"]);
const naira = (n: number) => "₦" + n.toLocaleString("en-NG");
const deny = (message: string, status = 403) => Response.json({ ok: false, message }, { status });

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return deny("Sign in required", 401);
  const sim = getSim();
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");
  const admin = user.role === "admin";
  const log = (a: string, d: string) => writeAudit(sim.db, user, a, d);

  if (ADMIN_ONLY.has(action) && !admin) return deny("Only an admin can do that");

  switch (action) {
    case "recharge": {
      if (!admin && !sim.userCanRecharge) return deny("Recharging is turned off by your admin");
      const r = sim.recharge(String(b.token ?? ""));
      log("recharge", r.ok ? `Recharged ${r.message.replace(" added", "")} (${String(b.token).trim().toUpperCase()})` : `Rejected token "${String(b.token ?? "").trim().toUpperCase().slice(0, 24)}"`);
      return Response.json(r);
    }
    case "appliance": {
      if (!admin && !sim.userCanControlLoad) return deny("Appliance control is turned off by your admin");
      const a = sim.snapshot().appliances.find((x) => x.id === b.id);
      if (!a) return deny("Unknown appliance", 400);
      sim.setAppliance(a.id, !!b.on);
      log("appliance", `Turned ${a.name} ${b.on ? "on" : "off"}`);
      break;
    }
    case "speed": sim.setSpeed(Number(b.speed)); log("speed", `Simulation speed set to ${Number(b.speed)}×`); break;
    case "fault": {
      const f = (b.fault ?? "none") as Fault;
      sim.setFault(f); log("fault", f === "none" ? "Cleared injected faults" : `Injected ${f.replace("_", " ")} fault`); break;
    }
    case "reset": sim.manualReset(); log("reset", "Manual reset. Supply restored"); break;
    case "hold": {
      const on = !!b.on; sim.setHold(on);
      log(on ? "hold" : "release", on ? "Disconnected the customer's supply" : "Released the supply hold"); break;
    }
    case "tariff": {
      const n = Number(b.value);
      if (!sim.setTariff(n)) return deny("Tariff must be between ₦1 and ₦500 per kWh", 400);
      log("tariff", `Tariff set to ${naira(n)}/kWh`); break;
    }
    case "threshold": {
      const n = Number(b.value);
      if (!sim.setThreshold(n)) return deny("Alert must be between ₦0 and ₦5,000", 400);
      log("threshold", `Low-credit alert set to ${naira(n)}`); break;
    }
    case "credit": {
      const n = Number(b.amount);
      if (!sim.adjustCredit(n)) return deny("Enter an amount other than zero (max ₦100,000)", 400);
      log("credit", `${n > 0 ? "Added" : "Removed"} ${naira(Math.abs(n))} ${n > 0 ? "to" : "from"} the customer's credit`); break;
    }
    case "permissions": {
      sim.setPermissions({ userCanRecharge: b.userCanRecharge, userCanControlLoad: b.userCanControlLoad });
      log("permissions", `Customer ${sim.userCanRecharge ? "may" : "may not"} recharge; ${sim.userCanControlLoad ? "may" : "may not"} control appliances`); break;
    }
    case "notice": {
      const t = String(b.text ?? "").trim();
      sim.setNotice(t || null);
      log("notice", t ? `Sent notice: ${t.slice(0, 120)}` : "Cleared the customer notice"); break;
    }
    default: return deny("Unknown action", 400);
  }
  return Response.json({ ok: true });
}
