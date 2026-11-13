import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { api, ApiError, type ChatMessage, type Health, type Inputs, type Result, type Sensitivity } from "../api";
import { Disclosure, PlanChip, ResultsTable, SensitivityView } from "../components/common";
import { shortVerdict } from "../format";

interface UiMessage extends ChatMessage {
  tables?: Sensitivity[];
  error?: boolean;
}

const SUGGESTED = [
  "Should I convert now or later?",
  "Explain PPP with my numbers",
  "Is my saving growing in real terms?",
  "What if Malaysian inflation rises to 4%?",
];

// Minimal, safe Markdown: paragraphs, "-"/"*" bullets and **bold**. No raw HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>);
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(<ul key={blocks.length}>{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>);
      bullets = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const m = line.match(/^[-*]\s+(.*)$/);
    if (m) { bullets.push(m[1]); continue; }
    flush();
    if (line) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}

export default function CoachPage({ inputs, result }: { inputs: Inputs; result: Result }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);

  const online = !!health?.coach_available;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: UiMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const history = next.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
      const res = await api.chat(inputs, history);
      setMessages([...next, {
        role: "assistant",
        content: res.reply || "Sorry, I had nothing to add. Try rephrasing your question.",
        tables: res.tool_results,
      }]);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 503
        ? "The AI Coach is offline (no API key on the server). The other pages still work."
        : "Sorry, I could not reach the AI service just now. Please try again in a moment.";
      setMessages([...next, { role: "assistant", content: msg, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page coach">
      <section className="hero">
        <h1>Ask the coach</h1>
        <p className="lead">Confused by a number? Ask in your own words. The coach explains your plan using only the numbers our engine calculated.</p>
      </section>

      <PlanChip inputs={inputs} />

      {health && !online && (
        <div className="alert alert-warn">The coach is offline because the server has no Gemini API key.
          Everything else still works. Set <code>GEMINI_API_KEY</code> on the backend and restart it.</div>
      )}
      {!health && <div className="alert alert-warn">Cannot reach the backend. Start it with <code>uvicorn backend.main:app</code>.</div>}

      <section className="card chat">
        <div className="chat-head">
          <span className="coach-id"><span className="avatar-lg" aria-hidden>🤖</span>
            <span><strong>Ringgit Coach</strong><small>{online ? `Online · Gemini (${health?.model})` : "Offline"}</small></span>
          </span>
          <button className="btn btn-ghost" disabled={!messages.length || busy} onClick={() => setMessages([])}>Clear chat</button>
        </div>

        <div className="messages" aria-live="polite">
          {!messages.length && (
            <div className="empty">
              <p><strong>Hi! I'm your study-abroad money coach.</strong></p>
              <p className="muted">Pick a question below to start. I'll name the theory behind each answer (PPP, IRP, Fisher or IFE).</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}${m.error ? " msg-error" : ""}`}>
              {m.role === "assistant" && <div className="avatar" aria-hidden>🤖</div>}
              <div className="bubble">
                {m.tables?.map((s, j) => (
                  <Disclosure key={j} title="What-if the engine ran" hint={`${shortVerdict(s.before.verdict)} → ${shortVerdict(s.after.verdict)}`}>
                    <SensitivityView s={s} cur={inputs.currency} explain={false} />
                  </Disclosure>
                ))}
                {m.role === "assistant" && !m.error ? <Markdown text={m.content} /> : <p>{m.content}</p>}
              </div>
            </div>
          ))}
          {busy && <div className="msg msg-assistant"><div className="avatar" aria-hidden>🤖</div><div className="bubble typing"><span className="dots"><i /><i /><i /></span> Checking the numbers</div></div>}
          <div ref={bottom} />
        </div>

        <div className="chips">
          {SUGGESTED.map((q) => (
            <button key={q} className="chip" disabled={!online || busy} onClick={() => ask(q)}>{q}</button>
          ))}
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!online || busy}
            placeholder="Ask anything about your plan..." maxLength={1000} aria-label="Your question" />
          <button className="btn" type="submit" disabled={!online || busy || !draft.trim()}>Send</button>
        </form>
      </section>

      <Disclosure title="Numbers the coach can see" hint="Every answer must match these">
        <ResultsTable r={result} compact />
      </Disclosure>
      <p className="caption center">A learning tool, not a licensed financial advisor.</p>
    </div>
  );
}
