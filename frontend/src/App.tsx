import { useEffect, useState } from "react";

import { api, type ComputeResponse, type Inputs, type Presets } from "./api";
import { ErrorBox, IllustrativeNote, LanguageToggle } from "./components/common";
import { useI18n } from "./i18n";
import CoachPage from "./pages/CoachPage";
import LearnPage from "./pages/LearnPage";
import PlanPage from "./pages/PlanPage";
import QuizPage from "./pages/QuizPage";
import WhatIfPage from "./pages/WhatIfPage";

const TABS = [
  { id: "plan", icon: "🎓" },
  { id: "whatif", icon: "🔀" },
  { id: "coach", icon: "🤖" },
  { id: "learn", icon: "📚" },
  { id: "quiz", icon: "🧠" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Old links from the first version still work.
const ALIASES: Record<string, TabId> = { sensitivity: "whatif", guided: "learn" };

const tabFromHash = (): TabId => {
  const h = window.location.hash.slice(1);
  return (ALIASES[h] ?? TABS.find((t) => t.id === h)?.id ?? "plan") as TabId;
};

export default function App() {
  const { t } = useI18n();
  const [presets, setPresets] = useState<Presets | null>(null);
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [data, setData] = useState<ComputeResponse | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    api.presets()
      .then((p) => { setPresets(p); setInputs(p.destinations[p.default].inputs); })
      .catch((e) => setError(e.message));
    const onHash = () => { setTab(tabFromHash()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Recompute through the API whenever inputs change (debounced for sliders).
  useEffect(() => {
    if (!inputs) return;
    let live = true;
    const id = setTimeout(() => {
      api.compute(inputs)
        .then((d) => { if (live) { setData(d); setError(""); } })
        .catch((e) => live && setError(e.message));
    }, 150);
    return () => { live = false; clearTimeout(id); };
  }, [inputs]);

  const nav = (className: string) => (
    <nav className={className} aria-label="Sections">
      {TABS.map((tb) => (
        <a key={tb.id} href={`#${tb.id}`} className={tab === tb.id ? "active" : undefined}
          aria-current={tab === tb.id ? "page" : undefined}>
          <span aria-hidden>{tb.icon}</span> {t.nav[tb.id]}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="#plan" className="brand">
            <span className="logo" aria-hidden>RM</span>
            <span>{t.appName}<small>{t.tagline}</small></span>
          </a>
          {nav("nav-top")}
          <LanguageToggle />
        </div>
      </header>

      <main className="container">
        <div className="data-note"><IllustrativeNote /></div>
        {error && <ErrorBox message={t.backendError(error)} />}
        {!data && !error && <p className="loading">{t.loading}</p>}

        {presets && inputs && data && (
          <>
            {tab === "plan" && <PlanPage inputs={inputs} presets={presets} data={data} onChange={setInputs} />}
            {tab === "whatif" && <WhatIfPage inputs={inputs} />}
            {/* Kept mounted so the conversation survives switching sections. */}
            <div hidden={tab !== "coach"}><CoachPage inputs={inputs} result={data.result} /></div>
            {tab === "learn" && <LearnPage scenario1={presets.destinations.GBP.inputs} mine={inputs} />}
            {tab === "quiz" && <QuizPage inputs={inputs} result={data.result} />}
          </>
        )}

        <footer className="footer">{t.footer}</footer>
      </main>

      {nav("nav-bottom")}
    </div>
  );
}
