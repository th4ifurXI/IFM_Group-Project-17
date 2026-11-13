import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { api, ApiError, type ChatMessage, type Health, type Inputs, type Result, type Sensitivity } from "../api";
import { ResultsTable, SensitivityView } from "../components/common";

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
    <section className="coach">
      <div className="coach-chat">
        <div className="coach-head">
          <h2>Ask the coach</h2>
          <button className="btn btn-ghost" disabled={!messages.length || busy} onClick={() => setMessages([])}>Clear chat</button>
        </div>
        {health && !online && (
          <div className="alert alert-warn">The AI Coach is offline because the server has no Gemini API key.
            Every other page still works. Set <code>GEMINI_API_KEY</code> on the backend and restart it.</div>
        )}
        {!health && <div className="alert alert-warn">Cannot reach the backend. Start it with <code>uvicorn backend.main:app</code>.</div>}
        {online && <p className="caption">Powered by Gemini ({health?.model}). It explains the engine's numbers; it never calculates its own.</p>}

        <div className="suggest">
          {SUGGESTED.map((q) => (
            <button key={q} className="btn btn-secondary" disabled={!online || busy} onClick={() => ask(q)}>{q}</button>
          ))}
        </div>

        <div className="messages" aria-live="polite">
          {!messages.length && <p className="caption">Pick a suggested question or type your own below.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}${m.error ? " msg-error" : ""}`}>
              <div className="avatar" aria-hidden>{m.role === "user" ? "🧑‍🎓" : "🤖"}</div>
              <div className="bubble">
                {m.tables?.map((s, j) => (
                  <div key={j} className="tool">
                    <p className="caption">What-if run by the finance engine:</p>
                    <SensitivityView s={s} cur={inputs.currency} />
                  </div>
                ))}
                {m.role === "assistant" && !m.error ? <Markdown text={m.content} /> : <p>{m.content}</p>}
              </div>
            </div>
          ))}
          {busy && <div className="msg msg-assistant"><div className="avatar">🤖</div><div className="bubble typing">Checking the numbers...</div></div>}
          <div ref={bottom} />
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!online || busy}
            placeholder="Ask about your plan, e.g. 'Why is converting now cheaper?'" maxLength={1000} />
          <button className="btn" type="submit" disabled={!online || busy || !draft.trim()}>Send</button>
        </form>
      </div>

      <aside className="coach-data">
        <h3>Engine results</h3>
        <p className="caption">The coach may only use these numbers, or a what-if it runs through the same engine.</p>
        <ResultsTable r={result} compact />
      </aside>
    </section>
  );
}
