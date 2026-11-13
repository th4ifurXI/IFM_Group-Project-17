// Display formatting only. RM with 2 decimals, exchange rates with 4 decimals,
// percents with 2 decimals.

import type { Field, Result } from "./api";

const num = (v: number, d: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const rm = (v: number) => (v < 0 ? `-RM${num(Math.abs(v), 2)}` : `RM${num(v, 2)}`);
export const rmSigned = (v: number) => (v > 0 ? `+${rm(v)}` : rm(v));
export const fx = (v: number) => num(v, 4);
export const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
export const fc = (v: number, cur: string) => `${cur} ${num(v, 2)}`;
export const shortVerdict = (v: string) => v.split(" - ")[0].trim();

export const PCT_FIELDS: Field[] = ["i_my", "i_f", "pi_my", "pi_f"];

export const FIELD_LABELS: Record<Field, string> = {
  pi_my: "Malaysia inflation",
  pi_f: "Foreign inflation",
  i_my: "Malaysia interest rate",
  i_f: "Foreign interest rate",
  spot: "Spot rate",
  months: "Months to departure",
  cost_foreign: "Total foreign cost",
};

export function fmtField(field: Field, v: number, cur = ""): string {
  if (PCT_FIELDS.includes(field)) return pct(v);
  if (field === "spot") return fx(v);
  if (field === "months") return `${Math.round(v)} months`;
  return cur ? fc(v, cur) : num(v, 2);
}

export interface Row {
  item: string;
  short: string;
  value: string;
  theory: string;
}

export function resultRows(r: Result, cur: string): Row[] {
  return [
    { item: `Cost at departure (${cur})`, short: "Cost at departure", value: fc(r.cost_at_departure_foreign, cur), theory: "Foreign inflation" },
    { item: `PPP expected rate (MYR per ${cur})`, short: `PPP rate (MYR/${cur})`, value: fx(r.ppp_expected_rate), theory: "PPP" },
    { item: `IRP forward rate (MYR per ${cur})`, short: `IRP forward (MYR/${cur})`, value: fx(r.irp_forward_rate), theory: "IRP" },
    { item: "MYR needed if you convert later", short: "MYR if convert later", value: rm(r.myr_needed_if_convert_later), theory: "PPP" },
    { item: "PV of converting later", short: "PV convert later", value: rm(r.pv_convert_later), theory: "PPP + discounting" },
    { item: `${cur} to buy today and save abroad`, short: `${cur} to buy today`, value: fc(r.foreign_needed_today, cur), theory: "Foreign interest" },
    { item: "PV of converting now", short: "PV convert now", value: rm(r.pv_convert_now), theory: "Spot today" },
    { item: "MYR needed with a forward contract", short: "MYR with forward", value: rm(r.myr_needed_with_forward), theory: "IRP" },
    { item: "PV of forward contract", short: "PV forward", value: rm(r.pv_forward), theory: "IRP" },
    { item: "Saving from converting now", short: "Saving if convert now", value: rmSigned(r.saving_from_converting_now), theory: "PV later minus PV now" },
    { item: "Real interest rate, Malaysia", short: "Real rate, Malaysia", value: pct(r.real_rate_my), theory: "Fisher" },
    { item: `Real interest rate, ${cur}`, short: `Real rate, ${cur}`, value: pct(r.real_rate_foreign), theory: "Fisher" },
    { item: "Malaysian rate where Fisher holds", short: "i_MY where Fisher holds", value: pct(r.fisher_i_my_to_match_foreign_real), theory: "Fisher / IFE" },
    { item: "Verdict", short: "Verdict", value: shortVerdict(r.verdict), theory: "Compare PVs" },
  ];
}
