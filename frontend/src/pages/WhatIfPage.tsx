import { useState } from "react";

import { api, type Field, type Inputs, type Sensitivity } from "../api";
import { Disclosure, ErrorBox, PlanChip, SensitivityView, sensitivitySentence } from "../components/common";
import { FIELDS, PCT_FIELDS, pct, rm } from "../format";
import { useI18n, verdictKey } from "../i18n";

interface Shown {
  storyId?: string;
  field?: Field;
  s: Sensitivity;
  cur: string;
}

// One story per verdict. Numbers come from the backend (finance.sensitivity).
const STORIES = [
  { id: "2", icon: "📈", tone: "now" as const },
  { id: "3", icon: "🏦", tone: "either" as const },
  { id: "4", icon: "💰", tone: "later" as const },
];

export default function WhatIfPage({ inputs }: { inputs: Inputs }) {
  const { t } = useI18n();
  const w = t.whatif;
  const [field, setField] = useState<Field>("pi_my");
  const [value, setValue] = useState("");
  const [shown, setShown] = useState<Shown | null>(null);
  const [active, setActive] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPct = PCT_FIELDS.includes(field);
  const current = inputs[field];
  const placeholder = String(isPct ? (current * 100).toFixed(2) : current);
  const unit = field === "spot" ? w.unitRmPer(inputs.currency) : field === "months" ? w.unitMonths
    : field === "cost_foreign" ? inputs.currency : "%";

  async function run<T>(fn: () => Promise<T>, then: (x: T) => void) {
    setBusy(true);
    setError("");
    try { then(await fn()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  function runCustom(e: React.FormEvent) {
    e.preventDefault();
    const raw = Number(value === "" ? placeholder : value);
    if (!Number.isFinite(raw)) { setError(w.enterNumber); return; }
    let v = isPct ? raw / 100 : raw;
    if (field === "months") v = Math.min(36, Math.max(1, Math.round(v)));
    setActive("custom");
    const f = field;
    run(() => api.sensitivity(inputs, f, v), (s) => setShown({ field: f, s, cur: inputs.currency }));
  }

  const s = shown?.s;
  const story = shown?.storyId ? w.stories[shown.storyId] : null;
  const title = story ? story.title : shown?.field ? w.onYourPlan(t.field[shown.field]) : "";
  const vb = s ? verdictKey(s.before.verdict) : "either";
  const va = s ? verdictKey(s.after.verdict) : "either";

  return (
    <div className="page">
      <section className="hero">
        <h1>{w.heroTitle}</h1>
        <p className="lead">{w.heroLead}</p>
      </section>

      <div className="stories">
        {STORIES.map((st) => {
          const txt = w.stories[st.id];
          return (
            <button key={st.id} className={`card story ${active === st.id ? "active" : ""}`} disabled={busy}
              onClick={() => {
                setActive(st.id);
                run(() => api.scenario(st.id), (d) => setShown({ storyId: st.id, s: d.sensitivity, cur: "GBP" }));
              }}>
              <span className="story-icon" aria-hidden>{st.icon}</span>
              <strong>{txt.title}</strong>
              <span className="muted">{txt.body}</span>
              <span className={`tag tag-${st.tone}`}>{w.answerBecomes(t.verdict[st.tone])}</span>
            </button>
          );
        })}
      </div>
      <p className="caption center">{w.storiesCaption}</p>

      {error && <ErrorBox message={error} />}

      {s && shown && (
        <section className="card result" aria-live="polite">
          <span className="eyebrow">{title}</span>
          <h2 className="verdict-change">
            <span className={`tag tag-${vb}`}>{t.verdict[vb]}</span>
            <span aria-hidden className="arrow">→</span>
            <span className={`tag tag-lg tag-${va}`}>{t.verdict[va]}</span>
          </h2>
          <p>{story ? story.lesson : sensitivitySentence(s, shown.cur, t)}</p>

          <div className="mini-stats">
            <div>
              <span className="label">{w.savingLabel}</span>
              <strong>{rm(s.before.saving_from_converting_now)} → {rm(s.after.saving_from_converting_now)}</strong>
            </div>
            <div>
              <span className="label">{w.realLabel}</span>
              <strong>{pct(s.before.real_rate_my)} → {pct(s.after.real_rate_my)}</strong>
            </div>
          </div>

          <Disclosure title={w.seeAll} hint={w.seeAllHint}>
            <SensitivityView s={s} cur={shown.cur} explain={!!story} />
          </Disclosure>
        </section>
      )}

      <section className="card custom">
        <h3>{w.customTitle}</h3>
        <PlanChip inputs={inputs} />
        <form className="custom-row" onSubmit={runCustom}>
          <label className="setup-block">
            <span className="label">{w.change}</span>
            <select value={field} onChange={(e) => { setField(e.target.value as Field); setValue(""); }}>
              {FIELDS.map((f) => <option key={f} value={f}>{t.field[f]}</option>)}
            </select>
          </label>
          <label className="setup-block">
            <span className="label">{w.to(unit)}</span>
            <input type="number" step="any" value={value} placeholder={w.nowPh(placeholder)}
              onChange={(e) => setValue(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={busy}>{busy ? w.working : w.show}</button>
        </form>
      </section>
    </div>
  );
}
