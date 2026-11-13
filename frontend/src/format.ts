// Display formatting only. RM with 2 decimals, exchange rates with 4 decimals,
// percents with 2 decimals. Same number format in English and Bahasa Melayu.

import type { Field } from "./api";

const num = (v: number, d: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const rm = (v: number) => (v < 0 ? `-RM${num(Math.abs(v), 2)}` : `RM${num(v, 2)}`);
export const rmSigned = (v: number) => (v > 0 ? `+${rm(v)}` : rm(v));
export const fx = (v: number) => num(v, 4);
export const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
export const fc = (v: number, cur: string) => `${cur} ${num(v, 2)}`;
export const shortVerdict = (v: string) => v.split(" - ")[0].trim();

export const PCT_FIELDS: Field[] = ["i_my", "i_f", "pi_my", "pi_f"];
export const FIELDS: Field[] = ["pi_my", "pi_f", "i_my", "i_f", "spot", "months", "cost_foreign"];

export function fmtField(field: Field, v: number, cur: string, monthsUnit: (n: number) => string): string {
  if (PCT_FIELDS.includes(field)) return pct(v);
  if (field === "spot") return fx(v);
  if (field === "months") return monthsUnit(Math.round(v));
  return cur ? fc(v, cur) : num(v, 2);
}
