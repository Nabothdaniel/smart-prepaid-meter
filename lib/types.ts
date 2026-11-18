export type Level = "info" | "success" | "warn" | "critical";
export type Fault = "none" | "over_voltage" | "under_voltage" | "over_current";

export interface ApplianceState {
  id: string;
  name: string;
  watts: number;
  on: boolean;
}

export interface MeterState {
  now: number;
  credit: number;
  creditPct: number;
  energyKwh: number;
  power: number;
  voltage: number;
  current: number;
  relayClosed: boolean;
  locked: boolean;
  errorLabel: string | null;
  tariff: number;
  lowThreshold: number;
  speed: number;
  fault: Fault;
  runwayHours: number | null;
  lcd: [string, string];
  appliances: ApplianceState[];
  rechargeCount: number;
  rejectedTokens: number;
  readingsCount: number;
  recordEverySec: number;
  adminHold: boolean;
  notice: string | null;
  permissions: { userCanRecharge: boolean; userCanControlLoad: boolean };
}

export interface AuditEntry {
  id: number;
  ts: number;
  actor_name: string;
  actor_email: string;
  role: "user" | "admin";
  action: string;
  detail: string;
}

export interface MeterEvent {
  id: number;
  ts: number;
  level: Level;
  kind: string;
  message: string;
}

export interface ReadingPoint {
  t: number;
  power: number;
  voltage: number;
  credit: number;
}

export interface ReadingsResponse {
  points: ReadingPoint[];
  summary: { energyKwh: number; spend: number; avgPower: number; peakPower: number; samples: number };
}

export const RANGES = {
  "1h": { ms: 3_600_000, bucket: 30_000 },
  "6h": { ms: 21_600_000, bucket: 180_000 },
  "24h": { ms: 86_400_000, bucket: 600_000 },
} as const;
export type RangeKey = keyof typeof RANGES;
