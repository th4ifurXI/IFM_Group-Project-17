import { useState } from "react";

import { api, type Field, type Inputs, type Sensitivity } from "../api";
import { Disclosure, ErrorBox, PlanChip, SensitivityView, sensitivitySentence } from "../components/common";
import { FIELD_LABELS, PCT_FIELDS, pct, rm, shortVerdict } from "../format";

interface Shown {
  title: string;
  s: Sensitivity;
  cur: string;
  lesson?: string;
}

// One story per verdict. Numbers come from the backend (finance.sensitivity).
const STORIES = [
  {
    id: "2", icon: "📈", title: "Prices in Malaysia rise faster",
    body: "Malaysian inflation jumps from 2% to 4%, but your bank still pays 3%.",
    tag: "Convert now", tone: "now",
    lesson: "Your savings now lose buying power (negative real rate) and PPP expects the ringgit to weaken. Converting early protects you.",
  },
  {
    id: "3", icon: "🏦", title: "Banks raise rates to keep up",
    body: "Inflation is 4%, but Malaysian savings rates rise to 5.01% to match it.",
    tag: "Either", tone: "either",
    lesson: "When interest rates adjust for inflation, both currencies earn the same real return (Fisher Effect), so timing stops mattering.",
  },
  {
    id: "4", icon: "💰", title: "Malaysian savings pay more",
    body: "Malaysian savings rates rise from 3% to 5% while inflation stays at 2%.",
    tag: "Convert later", tone: "later",
    lesson: "Ringgit savings now grow faster in real terms than money abroad (Fisher), which beats the move PPP expects. Waiting is cheaper.",
  },
];

const FRIENDLY: Record<Field, string> = {
  pi_my: "Inflation in Malaysia",
  pi_f: "Inflation abroad",
  i_my: "Malaysian savings rate",
  i_f: "Savings rate abroad",
  spot: "Exchange rate today",
  months: "Months until you leave",
  cost_foreign: "Total cost abroad",
};

export default function WhatIfPage({ inputs }: { inputs: Inputs }) {
  const [field, setField] = useState<Field>("pi_my");
  const [value, setValue] = useState("");
  const [shown, setShown] = useState<Shown | null>(null);
  const [active, setActive] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPct = PCT_FIELDS.includes(field);
  const current = inputs[field];
  const placeholder = String(isPct ? (current * 100).toFixed(2) : current);
  const unit = field === "spot" ? `RM per ${inputs.currency}` : field === "months" ? "months"
    : field === "cost_foreign" ? inputs.currency : "%";

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
    setActive("custom");
    run(() => api.sensitivity(inputs, field, v),
      (s) => setShown({ title: `${FRIENDLY[field]} on your plan`, s, cur: inputs.currency }));
  }

  const s = shown?.s;
  const vb = s ? shortVerdict(s.before.verdict) : "";
  const va = s ? shortVerdict(s.after.verdict) : "";

  return (
    <div className="page">
      <section className="hero">
        <h1>What if things change?</h1>
        <p className="lead">The economy moves. Pick a situation and see how it changes your answer.</p>
      </section>

      <div className="stories">
        {STORIES.map((st) => (
          <button key={st.id} className={`card story ${active === st.id ? "active" : ""}`} disabled={busy}
            onClick={() => {
              setActive(st.id);
              run(() => api.scenario(st.id),
                (d) => setShown({ title: st.title, s: d.sensitivity, cur: "GBP", lesson: st.lesson }));
            }}>
            <span className="story-icon" aria-hidden>{st.icon}</span>
            <strong>{st.title}</strong>
            <span className="muted">{st.body}</span>
            <span className={`tag tag-${st.tone}`}>Answer becomes: {st.tag}</span>
          </button>
        ))}
      </div>
      <p className="caption center">These three start from the worked example (UK, GBP 20,000, 12 months).</p>

      {error && <ErrorBox message={error} />}

      {s && shown && (
        <section className="card result" aria-live="polite">
          <span className="eyebrow">{shown.title}</span>
          <h2 className="verdict-change">
            <span className={`tag tag-${vb === "Convert now" ? "now" : vb === "Convert later" ? "later" : "either"}`}>{vb}</span>
            <span aria-hidden className="arrow">→</span>
            <span className={`tag tag-lg tag-${va === "Convert now" ? "now" : va === "Convert later" ? "later" : "either"}`}>{va}</span>
          </h2>
          {shown.lesson
            ? <p>{shown.lesson}</p>
            : <p>{sensitivitySentence(s, shown.cur)}</p>}

          <div className="mini-stats">
            <div>
              <span className="label">Saving from converting now</span>
              <strong>{rm(s.before.saving_from_converting_now)} → {rm(s.after.saving_from_converting_now)}</strong>
            </div>
            <div>
              <span className="label">Real savings rate in Malaysia</span>
              <strong>{pct(s.before.real_rate_my)} → {pct(s.after.real_rate_my)}</strong>
            </div>
          </div>

          <Disclosure title="See all the numbers" hint="Before, after and change">
            <SensitivityView s={s} cur={shown.cur} explain={!!shown.lesson} />
          </Disclosure>
        </section>
      )}

      <section className="card custom">
        <h3>Try your own what-if</h3>
        <PlanChip inputs={inputs} />
        <form className="custom-row" onSubmit={runCustom}>
          <label className="setup-block">
            <span className="label">Change</span>
            <select value={field} onChange={(e) => { setField(e.target.value as Field); setValue(""); }}>
              {(Object.keys(FIELD_LABELS) as Field[]).map((f) => <option key={f} value={f}>{FRIENDLY[f]}</option>)}
            </select>
          </label>
          <label className="setup-block">
            <span className="label">To ({unit})</span>
            <input type="number" step="any" value={value} placeholder={`Now: ${placeholder}`}
              onChange={(e) => setValue(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Working..." : "Show me"}</button>
        </form>
      </section>
    </div>
  );
}
