// Typed client for the FastAPI backend. The frontend never calculates finance
// numbers: every figure on screen comes from these responses (finance.py).

export const ILLUSTRATIVE_LABEL = "Illustrative data - not current market rates";

export type Field = "cost_foreign" | "months" | "spot" | "i_my" | "i_f" | "pi_my" | "pi_f";

export interface Inputs {
  cost_foreign: number;
  months: number;
  spot: number;
  i_my: number;
  i_f: number;
  pi_my: number;
  pi_f: number;
  currency: string;
}

export interface Result {
  inputs: Inputs;
  t_years: number;
  cost_at_departure_foreign: number;
  ppp_expected_rate: number;
  irp_forward_rate: number;
  myr_needed_if_convert_later: number;
  pv_convert_later: number;
  foreign_needed_today: number;
  pv_convert_now: number;
  myr_needed_with_forward: number;
  pv_forward: number;
  saving_from_converting_now: number;
  real_rate_my: number;
  real_rate_foreign: number;
  fisher_i_my_to_match_foreign_real: number;
  verdict: string;
}

export interface PathPoint {
  month: number;
  cost_foreign: number;
  ppp_rate: number;
  myr_needed: number;
}

export interface ComputeResponse {
  result: Result;
  cost_path: PathPoint[];
}

export type SensKey =
  | "ppp_expected_rate"
  | "myr_needed_if_convert_later"
  | "pv_convert_later"
  | "pv_convert_now"
  | "saving_from_converting_now"
  | "real_rate_my";

export type SensSnapshot = Record<SensKey, number> & { verdict: string };

export interface Sensitivity {
  field: Field;
  from: number;
  to: number;
  before: SensSnapshot;
  after: SensSnapshot;
  change: Record<SensKey, number>;
}

export interface Presets {
  note: string;
  default: string;
  destinations: Record<string, { name: string; inputs: Inputs }>;
  scenarios: Record<string, { title: string; expected_verdict: string }>;
}

export interface Health {
  status: string;
  coach_available: boolean;
  model: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  tool_results: Sensitivity[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<Health>("/api/health"),
  presets: () => request<Presets>("/api/presets"),
  compute: (inputs: Inputs) => request<ComputeResponse>("/api/compute", inputs),
  sensitivity: (inputs: Inputs, field: Field, new_value: number) =>
    request<Sensitivity>("/api/sensitivity", { inputs, field, new_value }),
  scenario: (id: string) =>
    request<{ title: string; sensitivity: Sensitivity }>(`/api/scenarios/${id}`),
  chat: (inputs: Inputs, messages: ChatMessage[]) =>
    request<ChatResponse>("/api/chat", { inputs, messages: messages.slice(-10) }),
};
