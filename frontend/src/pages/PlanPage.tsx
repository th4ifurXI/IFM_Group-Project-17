import { useMemo } from "react";

import type { ComputeResponse, Inputs, Presets } from "../api";
import { CurrencyBadge, Disclosure, Plot, ResultsTable, Tip } from "../components/common";
import { fc, fx, pct, rm } from "../format";
import { useI18n, verdictKey } from "../i18n";

interface Props {
  inputs: Inputs;
  presets: Presets;
  data: ComputeResponse;
  onChange: (next: Inputs) => void;
}

function RateSlider({ label, hint, value, onChange }: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
}) {
  const shown = Math.round(value * 10000) / 100;
  return (
    <label className="slider">
      <span className="slider-top">
        <span>{label} <Tip text={hint} /></span>
        <strong>{shown.toFixed(2)}%</strong>
      </span>
      <input type="range" min={0} max={15} step={0.01} value={shown}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100) / 10000)} />
    </label>
  );
}

const ICON = { now: "✅", later: "⏳", either: "⚖️" } as const;

export default function PlanPage({ inputs, presets, data, onChange }: Props) {
  const { t } = useI18n();
  const p = t.plan;
  const r = data.result;
  const cur = inputs.currency;
  const set = (patch: Partial<Inputs>) => onChange({ ...inputs, ...patch });
  const v = verdictKey(r.verdict);
  const gap = r.saving_from_converting_now;
  const cheaper = v === "either" ? null : v;

  const sub = v === "now" ? p.subNow(rm(gap), cur) : v === "later" ? p.subLater(rm(-gap)) : p.subEither(rm(Math.abs(gap)));
  const ringgitStronger = r.ppp_expected_rate < inputs.spot;
  const savingsGrow = r.real_rate_my >= 0;

  const charts = useMemo(() => {
    const path = data.cost_path;
    const values = [r.pv_convert_now, r.pv_convert_later, r.pv_forward];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.6, hi * 0.01);
    return {
      cost: {
        data: [
          { x: path.map((q) => q.month), y: path.map((q) => q.cost_foreign), name: p.costSeries(cur),
            mode: "lines+markers", line: { color: "#0F766E", width: 3 },
            hovertemplate: `${p.month} %{x}<br>${cur} %{y:,.2f}<extra></extra>` },
          { x: path.map((q) => q.month), y: path.map((q) => q.myr_needed), yaxis: "y2", name: p.myrSeries,
            mode: "lines", line: { color: "#F59E0B", width: 3, dash: "dot" },
            hovertemplate: `${p.month} %{x}<br>RM%{y:,.2f}<extra></extra>` },
        ],
        layout: {
          title: { text: p.costChart, font: { size: 14 } },
          xaxis: { title: { text: p.monthsAxis } },
          yaxis: { title: { text: cur }, tickformat: ",.0f" },
          yaxis2: { title: { text: "MYR" }, tickformat: ",.0f", overlaying: "y", side: "right" },
          legend: { orientation: "h", y: -0.25 }, hovermode: "x unified",
        },
      },
      pv: {
        data: [{ type: "bar", x: [t.verdict.now, t.verdict.later, p.forward], y: values,
          text: values.map(rm), textposition: "outside",
          marker: { color: ["#0F766E", "#F59E0B", "#94A3B8"] },
          hovertemplate: "%{x}<br>RM%{y:,.2f}<extra></extra>" }],
        layout: {
          title: { text: p.pvChart, font: { size: 14 } },
          yaxis: { range: [lo - pad, hi + pad], tickformat: ",.0f", title: { text: "MYR" } },
        },
      },
    };
  }, [data, r, cur, p, t]);

  return (
    <div className="page">
      <section className="hero">
        <h1>{p.heroTitle}</h1>
        <p className="lead">{p.heroLead}</p>
      </section>

      <section className="card setup">
        <div className="setup-block">
          <span className="label">{p.whereGoing}</span>
          <div className="dest-row">
            {Object.keys(presets.destinations).map((code) => (
              <button key={code} className={`dest ${cur === code ? "active" : ""}`}
                onClick={() => onChange({ ...presets.destinations[code].inputs })} aria-pressed={cur === code}>
                <CurrencyBadge code={code} />
                <span>{t.country[code] ?? code}<small>{code}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div className="setup-grid">
          <label className="setup-block">
            <span className="label">{p.totalCost}</span>
            <span className="money-input">
              <span>{cur}</span>
              <input type="number" min={1000} step={500} value={inputs.cost_foreign}
                onChange={(e) => { const x = Number(e.target.value); if (x > 0) set({ cost_foreign: x }); }} />
            </span>
            <small className="muted">{p.costHint}</small>
          </label>
          <label className="setup-block">
            <span className="label">{p.whenLeave}</span>
            <span className="big-value">{p.inMonths(inputs.months)}</span>
            <input type="range" min={1} max={36} step={1} value={inputs.months}
              onChange={(e) => set({ months: Number(e.target.value) })} />
          </label>
        </div>

        <Disclosure title={p.assumptions} hint={p.assumptionsHint}>
          <div className="assume-grid">
            <label className="slider">
              <span className="slider-top">
                <span>{p.exchangeToday} <Tip text={p.exchangeTip(cur)} /></span>
                <span className="money-input sm"><span>RM</span>
                  <input type="number" min={0.0001} step={0.01} value={inputs.spot}
                    onChange={(e) => { const x = Number(e.target.value); if (x > 0) set({ spot: x }); }} />
                </span>
              </span>
            </label>
            <RateSlider label={p.myRate} hint={p.myRateTip} value={inputs.i_my} onChange={(x) => set({ i_my: x })} />
            <RateSlider label={p.fRate(cur)} hint={p.fRateTip(cur)} value={inputs.i_f} onChange={(x) => set({ i_f: x })} />
            <RateSlider label={p.myInfl} hint={p.myInflTip} value={inputs.pi_my} onChange={(x) => set({ pi_my: x })} />
            <RateSlider label={p.fInfl(cur)} hint={p.fInflTip} value={inputs.pi_f} onChange={(x) => set({ pi_f: x })} />
          </div>
          <button className="btn btn-ghost" onClick={() => onChange({ ...presets.destinations[cur].inputs })}>{p.reset}</button>
        </Disclosure>
      </section>

      <section className={`card answer answer-${v}`} aria-live="polite">
        <span className="eyebrow">{p.ourAnswer}</span>
        <h2><span aria-hidden>{ICON[v]}</span> {p.head[v]}</h2>
        <p>{sub}</p>
        <div className="compare">
          <div className={`option ${cheaper === "now" ? "best" : ""}`}>
            <span className="option-label">{t.verdict.now}</span>
            <span className="option-value">{rm(r.pv_convert_now)}</span>
            {cheaper === "now" && <span className="badge">{t.cheaper}</span>}
          </div>
          <div className={`option ${cheaper === "later" ? "best" : ""}`}>
            <span className="option-label">{t.verdict.later}</span>
            <span className="option-value">{rm(r.pv_convert_later)}</span>
            {cheaper === "later" && <span className="badge">{t.cheaper}</span>}
          </div>
        </div>
        <p className="small muted">{p.bothToday} <Tip text={p.pvTip} /></p>
      </section>

      <section className="insights">
        <div className="card insight">
          <span className="insight-icon" aria-hidden>👛</span>
          <span className="label">{p.readyTitle}</span>
          <strong className="insight-value">{rm(r.myr_needed_if_convert_later)}</strong>
          <p>{p.readyText}</p>
        </div>
        <div className="card insight">
          <span className="insight-icon" aria-hidden>🧾</span>
          <span className="label">{p.pricierTitle}</span>
          <strong className="insight-value">{fc(r.cost_at_departure_foreign, cur)}</strong>
          <p>{p.pricierText(fc(inputs.cost_foreign, cur), pct(inputs.pi_f))}</p>
        </div>
        <div className="card insight">
          <span className="insight-icon" aria-hidden>💱</span>
          <span className="label">{p.rateTitle} <Tip text={p.rateTip} /></span>
          <strong className="insight-value">RM{fx(inputs.spot)} → RM{fx(r.ppp_expected_rate)}</strong>
          <p>{p.rateText(ringgitStronger, cur)}</p>
        </div>
        <div className={`card insight ${savingsGrow ? "good" : "bad"}`}>
          <span className="insight-icon" aria-hidden>{savingsGrow ? "🌱" : "🥀"}</span>
          <span className="label">{p.realTitle} <Tip text={p.realTip} /></span>
          <strong className="insight-value">{p.perYear(pct(r.real_rate_my))}</strong>
          <p>{savingsGrow ? p.realGood : p.realBad}</p>
        </div>
      </section>

      <section className="next-steps">
        <a className="next" href="#whatif"><span aria-hidden>🔀</span><span><strong>{p.nextWhatif}</strong><small>{p.nextWhatifText}</small></span></a>
        <a className="next" href="#coach"><span aria-hidden>🤖</span><span><strong>{p.nextCoach}</strong><small>{p.nextCoachText}</small></span></a>
        <a className="next" href="#learn"><span aria-hidden>🧮</span><span><strong>{p.nextMaths}</strong><small>{p.nextMathsText}</small></span></a>
      </section>

      <Disclosure title={p.chartsTitle} hint={p.chartsHint}>
        <div className="grid-2">
          <div className="card flat"><Plot data={charts.cost.data} layout={charts.cost.layout} /></div>
          <div className="card flat">
            <Plot data={charts.pv.data} layout={charts.pv.layout} />
            <p className="caption">{p.zoomNote}</p>
          </div>
        </div>
        <ResultsTable r={r} />
      </Disclosure>
    </div>
  );
}
