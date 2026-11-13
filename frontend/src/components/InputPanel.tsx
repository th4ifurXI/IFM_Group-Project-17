import type { Inputs, Presets } from "../api";
import { ILLUSTRATIVE_LABEL } from "../api";

interface Props {
  inputs: Inputs;
  presets: Presets;
  onChange: (next: Inputs) => void;
}

function PctSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const shown = Math.round(value * 10000) / 100;
  return (
    <label className="field">
      <span className="field-row"><span>{label}</span><span className="field-value">{shown.toFixed(2)}%</span></span>
      <input type="range" min={0} max={15} step={0.01} value={shown}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100) / 10000)} />
    </label>
  );
}

export default function InputPanel({ inputs, presets, onChange }: Props) {
  const cur = inputs.currency;
  const set = (patch: Partial<Inputs>) => onChange({ ...inputs, ...patch });

  return (
    <aside className="panel">
      <h2>Your plan</h2>
      <p className="note small">⚠️ {ILLUSTRATIVE_LABEL}</p>

      <label className="field">
        <span>Destination currency</span>
        <select value={cur} onChange={(e) => onChange({ ...presets.destinations[e.target.value].inputs })}>
          {Object.entries(presets.destinations).map(([code, d]) => (
            <option key={code} value={code}>{d.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Total cost abroad, today's prices ({cur})</span>
        <input type="number" min={1000} step={500} value={inputs.cost_foreign}
          onChange={(e) => { const v = Number(e.target.value); if (v > 0) set({ cost_foreign: v }); }} />
      </label>

      <label className="field">
        <span className="field-row"><span>Months to departure</span><span className="field-value">{inputs.months}</span></span>
        <input type="range" min={1} max={36} step={1} value={inputs.months}
          onChange={(e) => set({ months: Number(e.target.value) })} />
      </label>

      <label className="field">
        <span>Spot rate today (MYR per 1 {cur})</span>
        <input type="number" min={0.0001} step={0.01} value={inputs.spot}
          onChange={(e) => { const v = Number(e.target.value); if (v > 0) set({ spot: v }); }} />
      </label>

      <h3>Interest rates (per year)</h3>
      <PctSlider label="Malaysia interest rate" value={inputs.i_my} onChange={(v) => set({ i_my: v })} />
      <PctSlider label={`Foreign interest rate, ${cur}`} value={inputs.i_f} onChange={(v) => set({ i_f: v })} />

      <h3>Inflation (per year)</h3>
      <PctSlider label="Malaysia inflation" value={inputs.pi_my} onChange={(v) => set({ pi_my: v })} />
      <PctSlider label={`Foreign inflation, ${cur}`} value={inputs.pi_f} onChange={(v) => set({ pi_f: v })} />

      <button className="btn btn-secondary full" onClick={() => onChange({ ...presets.destinations[cur].inputs })}>
        Reset to preset
      </button>
    </aside>
  );
}
