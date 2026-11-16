import { useMemo, useState } from "react";

import type { Inputs, Result } from "../api";
import { PlanChip } from "../components/common";
import { useI18n } from "../i18n";
import { buildQuiz } from "../quiz";

const BEST_KEY = "quizBest";

function readBest(): number {
  try { return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0; } catch { return 0; }
}
function saveBest(score: number) {
  try { if (score > readBest()) localStorage.setItem(BEST_KEY, String(score)); } catch { /* storage blocked */ }
}

export default function QuizPage({ inputs, result }: { inputs: Inputs; result: Result }) {
  const { t, lang } = useI18n();
  const q = t.quiz;
  // Questions follow the current language and the student's current plan.
  const questions = useMemo(() => buildQuiz(lang, inputs, result), [lang, inputs, result]);
  const total = questions.length;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => Array(total).fill(null));
  const [done, setDone] = useState(false);
  const [best, setBest] = useState(readBest);

  const current = questions[index];
  const picked = answers[index];
  const score = answers.filter((a, i) => a === questions[i].answer).length;

  function choose(option: number) {
    if (picked !== null) return; // one try per question
    setAnswers((prev) => prev.map((a, i) => (i === index ? option : a)));
  }

  function next() {
    if (index + 1 < total) { setIndex(index + 1); return; }
    saveBest(score);
    setBest(readBest());
    setDone(true);
  }

  function restart() {
    setAnswers(Array(total).fill(null));
    setIndex(0);
    setDone(false);
  }

  const topicLabel = (topic: string) => (topic === "plan" ? q.planTopic : topic);

  if (done) {
    const ratio = score / total;
    const msg = ratio >= 0.8 ? q.msgHigh : ratio >= 0.5 ? q.msgMid : q.msgLow;
    return (
      <div className="page quiz">
        <section className="card answer answer-either quiz-score" aria-live="polite">
          <span className="eyebrow">{q.scoreTitle}</span>
          <h2>{q.score(score, total)}</h2>
          <div className="quiz-bar" aria-hidden><span style={{ width: `${Math.round(ratio * 100)}%` }} /></div>
          <p>{msg}</p>
          <p className="small muted">{q.best(Math.max(best, score), total)}</p>
          <div className="quiz-actions">
            <button className="btn" onClick={restart}>{q.again}</button>
            <a className="btn btn-ghost" href="#learn">{q.toLearn}</a>
          </div>
        </section>

        <h3>{q.review}</h3>
        <div className="quiz-review">
          {questions.map((qq, i) => {
            const ok = answers[i] === qq.answer;
            return (
              <div key={qq.id} className={`card quiz-review-item ${ok ? "good" : "bad"}`}>
                <span className={`tag ${ok ? "tag-now" : "tag-bad"}`}>{ok ? "✓" : "✗"} {topicLabel(qq.topic)}</span>
                <p><strong>{qq.prompt}</strong></p>
                <p>{q.answerWas(qq.options[qq.answer])}</p>
                <p className="small muted">{qq.explain}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="page quiz">
      <section className="hero">
        <h1>{q.heroTitle}</h1>
        <p className="lead">{q.heroLead}</p>
      </section>
      {current.topic === "plan" && <PlanChip inputs={inputs} />}

      <section className="card quiz-card">
        <div className="quiz-top">
          <span className="label">{q.progress(index + 1, total)}</span>
          <span className="tag tag-either">{topicLabel(current.topic)}</span>
        </div>
        <div className="quiz-bar" aria-hidden><span style={{ width: `${Math.round((index / total) * 100)}%` }} /></div>

        <h2 className="quiz-q">{current.prompt}</h2>

        <div className="quiz-options" role="group" aria-label={current.prompt}>
          {current.options.map((opt, i) => {
            const state = picked === null ? "" : i === current.answer ? "right" : i === picked ? "wrong" : "dim";
            return (
              <button key={i} className={`quiz-option ${state}`} onClick={() => choose(i)}
                disabled={picked !== null} aria-pressed={picked === i}>
                <span className="quiz-letter" aria-hidden>{String.fromCharCode(65 + i)}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {picked !== null && (
          <div className={`quiz-feedback ${picked === current.answer ? "good" : "bad"}`} aria-live="polite">
            <strong>{picked === current.answer ? q.correct : q.wrong}</strong>{" "}
            {picked !== current.answer && <span>{q.answerWas(current.options[current.answer])}. </span>}
            <span>{current.explain}</span>
          </div>
        )}

        <div className="quiz-actions">
          <button className="btn" onClick={next} disabled={picked === null}>
            {index + 1 < total ? q.next : q.finish}
          </button>
        </div>
      </section>
    </div>
  );
}
