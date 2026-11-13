import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { api, ApiError, type ChatMessage, type Health, type Inputs, type Result, type Sensitivity } from "../api";
import { Disclosure, PlanChip, ResultsTable, SensitivityView } from "../components/common";
import { useI18n, verdictKey } from "../i18n";

interface UiMessage extends ChatMessage {
  tables?: Sensitivity[];
  error?: boolean;
}

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
  const { t, lang } = useI18n();
  const c = t.coach;
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
      const res = await api.chat(inputs, history, lang);
      setMessages([...next, { role: "assistant", content: res.reply || c.noReply, tables: res.tool_results }]);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 503 ? c.errOffline : c.errReach;
      setMessages([...next, { role: "assistant", content: msg, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page coach">
      <section className="hero">
        <h1>{c.heroTitle}</h1>
        <p className="lead">{c.heroLead}</p>
      </section>

      <PlanChip inputs={inputs} />

      {health && !online && <div className="alert alert-warn">{c.offline()}</div>}
      {!health && <div className="alert alert-warn">{c.noBackend()}</div>}

      <section className="card chat">
        <div className="chat-head">
          <span className="coach-id"><span className="avatar-lg" aria-hidden>🤖</span>
            <span><strong>{t.appName}</strong><small>{online ? c.online(health?.model ?? "") : c.offlineShort}</small></span>
          </span>
          <button className="btn btn-ghost" disabled={!messages.length || busy} onClick={() => setMessages([])}>{c.clear}</button>
        </div>

        <div className="messages" aria-live="polite">
          {!messages.length && (
            <div className="empty">
              <p><strong>{c.greeting}</strong></p>
              <p className="muted">{c.greetingSub}</p>
              {c.languageNote && <p className="small muted">{c.languageNote}</p>}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}${m.error ? " msg-error" : ""}`}>
              {m.role === "assistant" && <div className="avatar" aria-hidden>🤖</div>}
              <div className="bubble">
                {m.tables?.map((s, j) => (
                  <Disclosure key={j} title={c.whatIfRan}
                    hint={`${t.verdict[verdictKey(s.before.verdict)]} → ${t.verdict[verdictKey(s.after.verdict)]}`}>
                    <SensitivityView s={s} cur={inputs.currency} explain={false} />
                  </Disclosure>
                ))}
                {m.role === "assistant" && !m.error ? <Markdown text={m.content} /> : <p>{m.content}</p>}
              </div>
            </div>
          ))}
          {busy && (
            <div className="msg msg-assistant">
              <div className="avatar" aria-hidden>🤖</div>
              <div className="bubble typing"><span className="dots"><i /><i /><i /></span> {c.typing}</div>
            </div>
          )}
          <div ref={bottom} />
        </div>

        <div className="chips">
          {c.suggested.map((q) => (
            <button key={q} className="chip" disabled={!online || busy} onClick={() => ask(q)}>{q}</button>
          ))}
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} disabled={!online || busy}
            placeholder={c.placeholder} maxLength={1000} aria-label={c.yourQuestion} />
          <button className="btn" type="submit" disabled={!online || busy || !draft.trim()}>{c.send}</button>
        </form>
      </section>

      <Disclosure title={c.numbersTitle} hint={c.numbersHint}>
        <ResultsTable r={result} compact />
      </Disclosure>
      <p className="caption center">{c.notAdvisor}</p>
    </div>
  );
}
