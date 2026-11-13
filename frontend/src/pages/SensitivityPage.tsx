import { useState } from "react";

import { api, type Field, type Inputs, type Sensitivity } from "../api";
import { ErrorBox, SensitivityView } from "../components/common";
import { FIELD_LABELS, PCT_FIELDS } from "../format";

interface Shown {
  title: string;
  s: Sensitivity;
  cur: string;
  note?: string;
}

const NOTES: Record<string, string> = {
  "3": "When the Malaysian interest rate rises enough to cover the extra inflation, both currencies earn the same real return (Fisher Effect). The expected ringgit weakness is exactly offset, so timing stops mattering.",
  "4": "Your ringgit savings now earn a higher real return in Malaysia than the foreign currency does abroad (Fisher). That extra growth beats the ringgit weakness PPP expects, so keeping MYR and converting at departure is cheaper.",
};

const PRESET_BUTTONS = [
  { id: "2", label: "Scenario 2: Malaysian inflation 2% -> 4%" },
  { id: "3", label: "Scenario 3: Fisher holds" },
  { id: "4", label: "Scenario 4: Malaysian rate 3% -> 5%" },
];

export default function SensitivityPage({ inputs }: { inputs: Inputs }) {
  const [field, setField] = useState<Field>("pi_my");
  const current = inputs[field];
  const [value, setValue] = useState<string>("");
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPct = PCT_FIELDS.includes(field);
  const unit = field === "spot" ? `MYR per ${inputs.currency}` : field === "months" ? "months"
    : field === "cost_foreign" ? inputs.currency : "%";
  const placeholder = String(isPct ? (current * 100).toFixed(2) : current);

  async function run<T>(fn: () => Promise<T>, then: (x: T) => void) {
    setBusy(true);
    setError("");
    try { then(await fn()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  function runCustom(e: React.FormEvent) {
    e.preventDefault();
    const raw = Number(value === "" ? placeholder : value);
    if (!Number.isFinite(raw)) { setError("Please enter a number."); return; }
    let v = isPct ? raw / 100 : raw;
    if (field === "months") v = Math.min(36, Math.max(1, Math.round(v)));
    run(() => api.sensitivity(inputs, field, v),
      (s) => setShown({ title: `Your plan: ${FIELD_LABELS[field]}`, s, cur: inputs.currency }));
  }

  return (
    <section>
      <h2>What happens if one thing changes?</h2>
      <p className="caption">Uses your plan as the starting point, unless you click a preset. Presets show each
        verdict: Scenario 2 gives Convert now, Scenario 3 gives Either, Scenario 4 gives Convert later.</p>

      <div className="btn-row">
        {PRESET_BUTTONS.map((b) => (
          <button key={b.id} className="btn btn-secondary" disabled={busy}
            onClick={() => run(() => api.scenario(b.id),
              (d) => setShown({ title: d.title, s: d.sensitivity, cur: "GBP", note: NOTES[b.id] }))}>
            {b.label}
          </button>
        ))}
      </div>

      <form className="card form-row" onSubmit={runCustom}>
        <label className="field">
          <span>Input to change</span>
          <select value={field} onChange={(e) => { setField(e.target.value as Field); setValue(""); }}>
            {(Object.keys(FIELD_LABELS) as Field[]).map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>New value ({unit})</span>
          <input type="number" step="any" value={value} placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={busy}>Run sensitivity</button>
      </form>

      {error && <ErrorBox message={error} />}
      {shown && (
        <div className="result-block">
          <h3>{shown.title}</h3>
          <SensitivityView s={shown.s} cur={shown.cur} />
          {shown.note && <div className="alert alert-success">{shown.note}</div>}
        </div>
      )}
    </section>
  );
}
