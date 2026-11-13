import katex from "katex";
import "katex/dist/katex.min.css";
import Plotly from "plotly.js-basic-dist-min";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ILLUSTRATIVE_LABEL, type Inputs, type Result, type Sensitivity, type SensKey } from "../api";
import {
  FIELD_LABELS, fc, fmtField, fx, pct, resultRows, rm, rmSigned, shortVerdict,
} from "../format";

// ---------- destinations ----------

export const DEST: Record<string, { country: string; symbol: string }> = {
  GBP: { country: "United Kingdom", symbol: "£" },
  AUD: { country: "Australia", symbol: "A$" },
  USD: { country: "United States", symbol: "$" },
};

export function CurrencyBadge({ code, size = "md" }: { code: string; size?: "sm" | "md" }) {
  return <span className={`cur-badge cur-${code.toLowerCase()} cur-${size}`} aria-hidden>{DEST[code]?.symbol ?? code}</span>;
}

// ---------- small building blocks ----------

export function IllustrativeNote() {
  return (
    <span className="pill pill-warn" title="All rates are made up for learning. They are not live market data.">
      ⚠️ {ILLUSTRATIVE_LABEL}
    </span>
  );
}

/** Small "?" that explains a term in plain words on hover, focus or tap. */
export function Tip({ text }: { text: string }) {
  return (
    <span className="tip" tabIndex={0} role="note" aria-label={text}>
      ?<span className="tip-text" role="tooltip">{text}</span>
    </span>
  );
}

/** Collapsible section. Children render only once opened (keeps charts sized correctly). */
export function Disclosure({ title, hint, children, defaultOpen = false }: {
  title: string; hint?: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="disclosure" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <span>{title}</span>
        {hint && <span className="disclosure-hint">{hint}</span>}
      </summary>
      {open && <div className="disclosure-body">{children}</div>}
    </details>
  );
}

/** "Your plan: UK, GBP 20,000, 12 months. Edit" summary shown on other pages. */
export function PlanChip({ inputs }: { inputs: Inputs }) {
  return (
    <div className="plan-chip">
      <CurrencyBadge code={inputs.currency} size="sm" />
      <span>
        <strong>{DEST[inputs.currency]?.country ?? inputs.currency}</strong>
        <span className="muted"> · {fc(inputs.cost_foreign, inputs.currency)} · leaving in {inputs.months} months</span>
      </span>
      <a href="#plan" className="link">Edit plan</a>
    </div>
  );
}

export function Tex({ expr, block = true }: { expr: string; block?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(expr, { displayMode: block, throwOnError: false }),
    [expr, block],
  );
  return <span className={block ? "tex-block" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Plot({ data, layout, height = 360 }: { data: unknown[]; layout: Record<string, unknown>; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    Plotly.react(el, data, {
      height,
      margin: { l: 56, r: 56, t: 48, b: 48 },
      font: { family: "Inter, system-ui, sans-serif", size: 12, color: "#0F172A" },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      ...layout,
    }, { displayModeBar: false, responsive: true });
  }, [data, layout, height]);
  useEffect(() => {
    const el = ref.current;
    return () => { if (el) Plotly.purge(el); };
  }, []);
  return <div ref={ref} className="plot" />;
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

// ---------- verdict ----------

export function VerdictCard({ r }: { r: Result }) {
  const v = shortVerdict(r.verdict);
  const gap = r.saving_from_converting_now;
  if (v === "Convert now") {
    return (
      <div className="verdict verdict-now">
        <h3>✅ Convert now</h3>
        <p>Converting today is cheaper by <strong>{rm(gap)}</strong> in today's money. Expected ringgit
          weakness (PPP) costs more than the extra interest you would earn in MYR.</p>
      </div>
    );
  }
  if (v === "Convert later") {
    return (
      <div className="verdict verdict-later">
        <h3>⏳ Convert later</h3>
        <p>Waiting is cheaper by <strong>{rm(-gap)}</strong> in today's money. Your MYR savings earn
          enough interest to beat the expected exchange-rate move (PPP).</p>
      </div>
    );
  }
  return (
    <div className="verdict verdict-either">
      <h3>⚖️ Either</h3>
      <p>The two options differ by only <strong>{rm(Math.abs(gap))}</strong> (under 0.5%). When interest
        rates and inflation line up (Fisher, IRP), timing barely matters.</p>
    </div>
  );
}

// ---------- tables ----------

export function ResultsTable({ r, compact = false }: { r: Result; compact?: boolean }) {
  const cur = r.inputs.currency;
  const rows = resultRows(r, cur);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Item</th><th className="num">Value</th>{!compact && <th>Theory</th>}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item} className={row.item === "Verdict" ? "row-strong" : undefined}>
              <td>{compact ? row.short : row.item}</td>
              <td className="num">{row.value}</td>
              {!compact && <td className="muted">{row.theory}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SENS_ROWS: [SensKey, string, (v: number) => string][] = [
  ["ppp_expected_rate", "PPP expected rate", fx],
  ["myr_needed_if_convert_later", "MYR needed if convert later", rm],
  ["pv_convert_later", "PV of converting later", rm],
  ["pv_convert_now", "PV of converting now", rm],
  ["saving_from_converting_now", "Saving from converting now", rm],
  ["real_rate_my", "Real interest rate, Malaysia", pct],
];

const SENS_WHY: Record<string, string> = {
  pi_my: "Under PPP, higher Malaysian inflation means the ringgit is expected to weaken, so each foreign unit costs more MYR if you wait.",
  pi_f: "Higher foreign inflation raises the foreign cost itself, while PPP expects the ringgit to strengthen a little against that currency.",
  i_my: "A higher Malaysian interest rate grows your MYR savings faster, so you need less today to fund converting later (Fisher Effect).",
  i_f: "A higher foreign interest rate means you can buy less foreign currency today and let it grow abroad, making converting now cheaper.",
  spot: "The spot rate scales both options, so the MYR amounts move but the verdict depends on interest rates and inflation, not the spot level.",
  months: "A longer wait compounds every gap between interest rates and inflation, so the difference between the options grows.",
  cost_foreign: "A bigger budget scales every MYR amount; the verdict depends on rates, not on the size of the budget.",
};

function changeText(fmt: (v: number) => string, ch: number): string {
  if (fmt === rm) return rmSigned(ch);
  if (fmt === pct) return `${ch >= 0 ? "+" : ""}${(ch * 100).toFixed(2)} pp`;
  return `${ch >= 0 ? "+" : ""}${ch.toFixed(4)}`;
}

export function sensitivitySentence(s: Sensitivity, cur = ""): string {
  const vb = shortVerdict(s.before.verdict);
  const va = shortVerdict(s.after.verdict);
  const ch = s.change.saving_from_converting_now;
  const moved = ch > 0 ? "rose" : ch < 0 ? "fell" : "did not change";
  const verdictPart = vb !== va ? `the verdict changed from ${vb} to ${va}` : `the verdict stayed ${vb}`;
  return `Changing ${FIELD_LABELS[s.field]} from ${fmtField(s.field, s.from, cur)} to ${fmtField(s.field, s.to, cur)}: ` +
    `the saving from converting now ${moved} (${rm(s.before.saving_from_converting_now)} to ` +
    `${rm(s.after.saving_from_converting_now)}), and ${verdictPart}. ${SENS_WHY[s.field]}`;
}

export function SensitivityView({ s, cur = "", explain = true }: { s: Sensitivity; cur?: string; explain?: boolean }) {
  return (
    <div className="sens">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Measure</th><th className="num">Before</th><th className="num">After</th><th className="num">Change</th></tr></thead>
          <tbody>
            {SENS_ROWS.map(([key, label, f]) => (
              <tr key={key}>
                <td>{label}</td>
                <td className="num">{f(s.before[key])}</td>
                <td className="num">{f(s.after[key])}</td>
                <td className="num">{changeText(f, s.change[key])}</td>
              </tr>
            ))}
            <tr className="row-strong">
              <td>Verdict</td>
              <td className="num">{shortVerdict(s.before.verdict)}</td>
              <td className="num">{shortVerdict(s.after.verdict)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {explain && <p className="explain">{sensitivitySentence(s, cur)}</p>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="alert alert-error">{message}</div>;
}
