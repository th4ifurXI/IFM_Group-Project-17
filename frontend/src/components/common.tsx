import katex from "katex";
import "katex/dist/katex.min.css";
import Plotly from "plotly.js-basic-dist-min";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { Inputs, Result, Sensitivity, SensKey } from "../api";
import { fc, fmtField, fx, pct, rm, rmSigned } from "../format";
import { verdictKey, useI18n, type Dict } from "../i18n";

// ---------- destinations ----------

export const DEST: Record<string, { symbol: string }> = {
  GBP: { symbol: "£" },
  AUD: { symbol: "A$" },
  USD: { symbol: "$" },
};

export function CurrencyBadge({ code, size = "md" }: { code: string; size?: "sm" | "md" }) {
  return <span className={`cur-badge cur-${code.toLowerCase()} cur-${size}`} aria-hidden>{DEST[code]?.symbol ?? code}</span>;
}

// ---------- language switch ----------

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label="Language / Bahasa">
      <button className={lang === "en" ? "active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")} title="English">EN</button>
      <button className={lang === "ms" ? "active" : ""} aria-pressed={lang === "ms"} onClick={() => setLang("ms")} title="Bahasa Melayu">BM</button>
    </div>
  );
}

// ---------- small building blocks ----------

export function IllustrativeNote() {
  const { t } = useI18n();
  return <span className="pill pill-warn" title={t.illustrativeTip}>⚠️ {t.illustrative}</span>;
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
  const { t } = useI18n();
  return (
    <div className="plan-chip">
      <CurrencyBadge code={inputs.currency} size="sm" />
      <span>
        <strong>{t.country[inputs.currency] ?? inputs.currency}</strong>
        <span className="muted"> · {fc(inputs.cost_foreign, inputs.currency)} · {t.leavingIn(inputs.months)}</span>
      </span>
      <a href="#plan" className="link">{t.editPlan}</a>
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
      font: { family: "Plus Jakarta Sans, Inter, system-ui, sans-serif", size: 12, color: "#0F172A" },
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

// ---------- verdict (guided mode) ----------

export function VerdictCard({ r }: { r: Result }) {
  const { t } = useI18n();
  const v = verdictKey(r.verdict);
  const gap = r.saving_from_converting_now;
  const icon = v === "now" ? "✅" : v === "later" ? "⏳" : "⚖️";
  const text = v === "now" ? t.guided.vNow(rm(gap)) : v === "later" ? t.guided.vLater(rm(-gap)) : t.guided.vEither(rm(Math.abs(gap)));
  return (
    <div className={`verdict verdict-${v}`}>
      <h3>{icon} {t.verdict[v]}</h3>
      <p>{text}</p>
    </div>
  );
}

// ---------- tables ----------

function resultValues(r: Result, cur: string, t: Dict): string[] {
  return [
    fc(r.cost_at_departure_foreign, cur), fx(r.ppp_expected_rate), fx(r.irp_forward_rate),
    rm(r.myr_needed_if_convert_later), rm(r.pv_convert_later), fc(r.foreign_needed_today, cur),
    rm(r.pv_convert_now), rm(r.myr_needed_with_forward), rm(r.pv_forward),
    rmSigned(r.saving_from_converting_now), pct(r.real_rate_my), pct(r.real_rate_foreign),
    pct(r.fisher_i_my_to_match_foreign_real), t.verdict[verdictKey(r.verdict)],
  ];
}

export function ResultsTable({ r, compact = false }: { r: Result; compact?: boolean }) {
  const { t } = useI18n();
  const cur = r.inputs.currency;
  const labels = t.table.rows(cur);
  const values = resultValues(r, cur, t);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>{t.table.item}</th><th className="num">{t.table.value}</th>{!compact && <th>{t.table.theory}</th>}</tr>
        </thead>
        <tbody>
          {labels.map(([item, short, theory], i) => (
            <tr key={i} className={i === labels.length - 1 ? "row-strong" : undefined}>
              <td>{compact ? short : item}</td>
              <td className="num">{values[i]}</td>
              {!compact && <td className="muted">{theory}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SENS_ROWS: [SensKey, (v: number) => string][] = [
  ["ppp_expected_rate", fx],
  ["myr_needed_if_convert_later", rm],
  ["pv_convert_later", rm],
  ["pv_convert_now", rm],
  ["saving_from_converting_now", rm],
  ["real_rate_my", pct],
];

function changeText(fmt: (v: number) => string, ch: number): string {
  if (fmt === rm) return rmSigned(ch);
  if (fmt === pct) return `${ch >= 0 ? "+" : ""}${(ch * 100).toFixed(2)} pp`;
  return `${ch >= 0 ? "+" : ""}${ch.toFixed(4)}`;
}

export function sensitivitySentence(s: Sensitivity, cur: string, t: Dict): string {
  const vb = t.verdict[verdictKey(s.before.verdict)];
  const va = t.verdict[verdictKey(s.after.verdict)];
  const ch = s.change.saving_from_converting_now;
  const moved = ch > 0 ? t.sens.moved.up : ch < 0 ? t.sens.moved.down : t.sens.moved.same;
  const vp = vb !== va ? t.sens.changed(vb, va) : t.sens.stayed(vb);
  return t.sens.sentence(
    t.field[s.field],
    fmtField(s.field, s.from, cur, t.monthsUnit), fmtField(s.field, s.to, cur, t.monthsUnit),
    moved, rm(s.before.saving_from_converting_now), rm(s.after.saving_from_converting_now), vp, t.sens.why[s.field],
  );
}

export function SensitivityView({ s, cur = "", explain = true }: { s: Sensitivity; cur?: string; explain?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="sens">
      <div className="table-wrap">
        <table className="table">
          <thead><tr>
            <th>{t.table.measure}</th><th className="num">{t.table.before}</th>
            <th className="num">{t.table.after}</th><th className="num">{t.table.change}</th>
          </tr></thead>
          <tbody>
            {SENS_ROWS.map(([key, f]) => (
              <tr key={key}>
                <td>{t.table.sensRows[key]}</td>
                <td className="num">{f(s.before[key])}</td>
                <td className="num">{f(s.after[key])}</td>
                <td className="num">{changeText(f, s.change[key])}</td>
              </tr>
            ))}
            <tr className="row-strong">
              <td>{t.table.verdict}</td>
              <td className="num">{t.verdict[verdictKey(s.before.verdict)]}</td>
              <td className="num">{t.verdict[verdictKey(s.after.verdict)]}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {explain && <p className="explain">{sensitivitySentence(s, cur, t)}</p>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="alert alert-error">{message}</div>;
}
