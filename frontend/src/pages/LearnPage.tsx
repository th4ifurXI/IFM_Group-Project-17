import { useState } from "react";

import type { Inputs } from "../api";
import { Tex } from "../components/common";
import { useI18n } from "../i18n";
import GuidedPage from "./GuidedPage";

// Formulas are the same in both languages; names and meanings come from i18n.
const TEX = [
  String.raw`Cost_t = Cost_0 \times (1 + \pi_f)^t`,
  String.raw`S_t = S_0 \times \left(\frac{1 + \pi_{MY}}{1 + \pi_f}\right)^t`,
  String.raw`F = S_0 \times \left(\frac{1 + i_{MY}}{1 + i_f}\right)^t`,
  String.raw`E[S_t] = S_0 \times \left(\frac{1 + i_{MY}}{1 + i_f}\right)^t`,
  String.raw`r = \frac{1 + i}{1 + \pi} - 1`,
  String.raw`PV = \frac{FV}{(1 + i_{MY})^t}`,
];

const SECTIONS = ["steps", "theories", "words", "limits", "sources"] as const;
type SectionId = (typeof SECTIONS)[number];

export default function LearnPage({ scenario1, mine }: { scenario1: Inputs; mine: Inputs }) {
  const { t } = useI18n();
  const l = t.learn;
  const [section, setSection] = useState<SectionId>("steps");

  return (
    <div className="page learn">
      <section className="hero">
        <h1>{l.heroTitle}</h1>
        <p className="lead">{l.heroLead}</p>
      </section>

      <div className="pills" role="tablist">
        {SECTIONS.map((id) => (
          <button key={id} role="tab" aria-selected={section === id}
            className={section === id ? "pill-btn active" : "pill-btn"} onClick={() => setSection(id)}>{l.sections[id]}</button>
        ))}
      </div>

      {section === "steps" && <GuidedPage scenario1={scenario1} mine={mine} />}

      {section === "theories" && (
        <>
          <div className="grid-2">
            {l.formulas.map(([name, meaning], i) => (
              <div className="card theory" key={i}>
                <strong>{name}</strong>
                <Tex expr={TEX[i]} />
                <p className="muted">{meaning}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>{l.decideTitle}</h3>
            <ul>{l.decide.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </div>
        </>
      )}

      {section === "words" && (
        <div className="glossary">
          {l.glossary.map(([term, meaning]) => (
            <div className="card term" key={term}><strong>{term}</strong><p className="muted">{meaning}</p></div>
          ))}
        </div>
      )}

      {section === "limits" && (
        <div className="grid-2">
          <div className="card">
            <h3>{l.assumeTitle}</h3>
            <ul>{l.assume.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
          <div className="card">
            <h3>{l.limitsTitle}</h3>
            <ul>{l.limits.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        </div>
      )}

      {section === "sources" && (
        <div className="grid-2">
          <div className="card">
            <h3>{l.refsTitle}</h3>
            <ul>
              <li>Madura, J. <em>International Financial Management</em>. Cengage Learning {l.refTextbook}.</li>
              <li>Bank Negara Malaysia. {l.refBnm} <a href="https://www.bnm.gov.my" target="_blank" rel="noreferrer">bnm.gov.my</a></li>
              <li>Department of Statistics Malaysia. {l.refDosm} <a href="https://www.dosm.gov.my" target="_blank" rel="noreferrer">dosm.gov.my</a></li>
              <li>International Monetary Fund. {l.refImf} <a href="https://www.imf.org" target="_blank" rel="noreferrer">imf.org</a></li>
            </ul>
          </div>
          <div className="card">
            <h3>{l.aiTitle}</h3>
            <p className="muted">{l.aiText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
