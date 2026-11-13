import { useMemo } from "react";

import type { ComputeResponse, Inputs, Presets } from "../api";
import { CurrencyBadge, DEST, Disclosure, Plot, ResultsTable, Tip } from "../components/common";
import { fc, fx, pct, rm, shortVerdict } from "../format";

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

const HEADLINE: Record<string, { title: string; icon: string; tone: string }> = {
  "Convert now": { title: "Convert now", icon: "✅", tone: "now" },
  "Convert later": { title: "Wait and convert later", icon: "⏳", tone: "later" },
  Either: { title: "Either works. Timing barely matters.", icon: "⚖️", tone: "either" },
};

export default function PlanPage({ inputs, presets, data, onChange }: Props) {
  const r = data.result;
  const cur = inputs.currency;
  const set = (patch: Partial<Inputs>) => onChange({ ...inputs, ...patch });
  const verdict = shortVerdict(r.verdict);
  const head = HEADLINE[verdict] ?? HEADLINE.Either;
  const gap = r.saving_from_converting_now;
  const cheaper = verdict === "Convert now" ? "now" : verdict === "Convert later" ? "later" : null;

  const sub = verdict === "Convert now"
    ? <>Buying {cur} today saves you about <strong>{rm(gap)}</strong> in today's money.</>
    : verdict === "Convert later"
      ? <>Keeping ringgit and converting when you leave saves about <strong>{rm(-gap)}</strong> in today's money.</>
      : <>The two options differ by only <strong>{rm(Math.abs(gap))}</strong>. Focus on saving enough, not on timing.</>;

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
          { x: path.map((p) => p.month), y: path.map((p) => p.cost_foreign), name: `Cost abroad (${cur})`,
            mode: "lines+markers", line: { color: "#0F766E", width: 3 },
            hovertemplate: `Month %{x}<br>${cur} %{y:,.2f}<extra></extra>` },
          { x: path.map((p) => p.month), y: path.map((p) => p.myr_needed), yaxis: "y2", name: "Ringgit needed",
            mode: "lines", line: { color: "#F59E0B", width: 3, dash: "dot" },
            hovertemplate: "Month %{x}<br>RM%{y:,.2f}<extra></extra>" },
        ],
        layout: {
          title: { text: "How your cost grows until you leave", font: { size: 14 } },
          xaxis: { title: { text: "Months from today" } },
          yaxis: { title: { text: cur }, tickformat: ",.0f" },
          yaxis2: { title: { text: "MYR" }, tickformat: ",.0f", overlaying: "y", side: "right" },
          legend: { orientation: "h", y: -0.25 }, hovermode: "x unified",
        },
      },
      pv: {
        data: [{ type: "bar", x: ["Convert now", "Convert later", "Forward contract"], y: values,
          text: values.map(rm), textposition: "outside",
          marker: { color: ["#0F766E", "#F59E0B", "#94A3B8"] },
          hovertemplate: "%{x}<br>RM%{y:,.2f}<extra></extra>" }],
        layout: {
          title: { text: "Cost of each option in today's money", font: { size: 14 } },
          yaxis: { range: [lo - pad, hi + pad], tickformat: ",.0f", title: { text: "MYR" } },
        },
      },
    };
  }, [data, r, cur]);

  return (
    <div className="page">
      <section className="hero">
        <h1>Studying abroad? Let's plan your money.</h1>
        <p className="lead">Tell us where you're going. We'll show what it will cost in ringgit and whether to convert now or later.</p>
      </section>

      <section className="card setup">
        <div className="setup-block">
          <span className="label">Where are you going?</span>
          <div className="dest-row">
            {Object.entries(presets.destinations).map(([code]) => (
              <button key={code} className={`dest ${cur === code ? "active" : ""}`}
                onClick={() => onChange({ ...presets.destinations[code].inputs })} aria-pressed={cur === code}>
                <CurrencyBadge code={code} />
                <span>{DEST[code]?.country}<small>{code}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div className="setup-grid">
          <label className="setup-block">
            <span className="label">Total cost there, at today's prices</span>
            <span className="money-input">
              <span>{cur}</span>
              <input type="number" min={1000} step={500} value={inputs.cost_foreign}
                onChange={(e) => { const v = Number(e.target.value); if (v > 0) set({ cost_foreign: v }); }} />
            </span>
            <small className="muted">Tuition, rent and living costs for the whole stay.</small>
          </label>
          <label className="setup-block">
            <span className="label">When do you leave?</span>
            <span className="big-value">In {inputs.months} {inputs.months === 1 ? "month" : "months"}</span>
            <input type="range" min={1} max={36} step={1} value={inputs.months}
              onChange={(e) => set({ months: Number(e.target.value) })} />
          </label>
        </div>

        <Disclosure title="Economic assumptions" hint="Exchange rate, interest and inflation (illustrative)">
          <div className="assume-grid">
            <label className="slider">
              <span className="slider-top">
                <span>Exchange rate today <Tip text={`How many ringgit you pay for 1 ${cur} right now.`} /></span>
                <span className="money-input sm"><span>RM</span>
                  <input type="number" min={0.0001} step={0.01} value={inputs.spot}
                    onChange={(e) => { const v = Number(e.target.value); if (v > 0) set({ spot: v }); }} />
                </span>
              </span>
            </label>
            <RateSlider label="Malaysian savings rate" hint="Interest your ringgit earns per year in a Malaysian account."
              value={inputs.i_my} onChange={(v) => set({ i_my: v })} />
            <RateSlider label={`Savings rate abroad (${cur})`} hint={`Interest ${cur} earns per year if you convert now and save it there.`}
              value={inputs.i_f} onChange={(v) => set({ i_f: v })} />
            <RateSlider label="Inflation in Malaysia" hint="How fast prices rise in Malaysia each year."
              value={inputs.pi_my} onChange={(v) => set({ pi_my: v })} />
            <RateSlider label={`Inflation abroad (${cur})`} hint="How fast prices rise at your destination each year."
              value={inputs.pi_f} onChange={(v) => set({ pi_f: v })} />
          </div>
          <button className="btn btn-ghost" onClick={() => onChange({ ...presets.destinations[cur].inputs })}>Reset to defaults</button>
        </Disclosure>
      </section>

      <section className={`card answer answer-${head.tone}`} aria-live="polite">
        <span className="eyebrow">Our answer</span>
        <h2><span aria-hidden>{head.icon}</span> {head.title}</h2>
        <p>{sub}</p>
        <div className="compare">
          <div className={`option ${cheaper === "now" ? "best" : ""}`}>
            <span className="option-label">Convert now</span>
            <span className="option-value">{rm(r.pv_convert_now)}</span>
            {cheaper === "now" && <span className="badge">Cheaper</span>}
          </div>
          <div className={`option ${cheaper === "later" ? "best" : ""}`}>
            <span className="option-label">Convert later</span>
            <span className="option-value">{rm(r.pv_convert_later)}</span>
            {cheaper === "later" && <span className="badge">Cheaper</span>}
          </div>
        </div>
        <p className="small muted">Both shown in today's money <Tip text="Present value: a future amount turned into what it is worth today, so the two options can be compared fairly." /></p>
      </section>

      <section className="insights">
        <div className="card insight">
          <span className="insight-icon" aria-hidden>👛</span>
          <span className="label">Ringgit to have ready</span>
          <strong className="insight-value">{rm(r.myr_needed_if_convert_later)}</strong>
          <p>What you'll need on departure day if you convert when you leave.</p>
        </div>
        <div className="card insight">
          <span className="insight-icon" aria-hidden>🧾</span>
          <span className="label">Your trip gets pricier</span>
          <strong className="insight-value">{fc(r.cost_at_departure_foreign, cur)}</strong>
          <p>Up from {fc(inputs.cost_foreign, cur)}, as prices abroad rise {pct(inputs.pi_f)} a year before you arrive.</p>
        </div>
        <div className="card insight">
          <span className="insight-icon" aria-hidden>💱</span>
          <span className="label">Expected exchange rate <Tip text="Purchasing Power Parity (PPP): the currency with higher inflation tends to weaken." /></span>
          <strong className="insight-value">RM{fx(inputs.spot)} → RM{fx(r.ppp_expected_rate)}</strong>
          <p>The ringgit is expected to {ringgitStronger ? "strengthen slightly" : "weaken"} against the {cur} (PPP).</p>
        </div>
        <div className={`card insight ${savingsGrow ? "good" : "bad"}`}>
          <span className="insight-icon" aria-hidden>{savingsGrow ? "🌱" : "🥀"}</span>
          <span className="label">Your savings in real terms <Tip text="Fisher Effect: real rate = what your interest earns after inflation." /></span>
          <strong className="insight-value">{pct(r.real_rate_my)} a year</strong>
          <p>{savingsGrow ? "Your ringgit savings grow faster than prices." : "Prices rise faster than your interest. Your savings lose buying power."}</p>
        </div>
      </section>

      <section className="next-steps">
        <a className="next" href="#whatif"><span aria-hidden>🔀</span><span><strong>Try a what-if</strong><small>What if inflation or rates change?</small></span></a>
        <a className="next" href="#coach"><span aria-hidden>🤖</span><span><strong>Ask the coach</strong><small>Get it explained in plain words</small></span></a>
        <a className="next" href="#learn"><span aria-hidden>🧮</span><span><strong>See the maths</strong><small>Step by step, with formulas</small></span></a>
      </section>

      <Disclosure title="Charts and all the numbers" hint="For the curious, and for checking our work">
        <div className="grid-2">
          <div className="card flat"><Plot data={charts.cost.data} layout={charts.cost.layout} /></div>
          <div className="card flat">
            <Plot data={charts.pv.data} layout={charts.pv.layout} />
            <p className="caption">The axis is zoomed in so small differences are visible.</p>
          </div>
        </div>
        <ResultsTable r={r} />
      </Disclosure>
    </div>
  );
}
