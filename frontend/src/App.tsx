import { useEffect, useState } from "react";

import { api, type ComputeResponse, type Inputs, type Presets } from "./api";
import { ErrorBox, IllustrativeNote } from "./components/common";
import CoachPage from "./pages/CoachPage";
import LearnPage from "./pages/LearnPage";
import PlanPage from "./pages/PlanPage";
import WhatIfPage from "./pages/WhatIfPage";

const TABS = [
  { id: "plan", label: "My plan", icon: "🎓" },
  { id: "whatif", label: "What if?", icon: "🔀" },
  { id: "coach", label: "Ask coach", icon: "🤖" },
  { id: "learn", label: "Learn", icon: "📚" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Old links from the first version still work.
const ALIASES: Record<string, TabId> = { sensitivity: "whatif", guided: "learn" };

const tabFromHash = (): TabId => {
  const h = window.location.hash.slice(1);
  return (ALIASES[h] ?? TABS.find((t) => t.id === h)?.id ?? "plan") as TabId;
};

export default function App() {
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
      {TABS.map((t) => (
        <a key={t.id} href={`#${t.id}`} className={tab === t.id ? "active" : undefined}
          aria-current={tab === t.id ? "page" : undefined}>
          <span aria-hidden>{t.icon}</span> {t.label}
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
            <span>Ringgit Coach<small>Know when to convert, what it will cost, and why.</small></span>
          </a>
          {nav("nav-top")}
        </div>
      </header>

      <main className="container">
        <div className="data-note"><IllustrativeNote /></div>
        {error && <ErrorBox message={`${error} Start the backend with: uvicorn backend.main:app --reload`} />}
        {!data && !error && <p className="loading">Loading your plan...</p>}

        {presets && inputs && data && (
          <>
            {tab === "plan" && <PlanPage inputs={inputs} presets={presets} data={data} onChange={setInputs} />}
            {tab === "whatif" && <WhatIfPage inputs={inputs} />}
            {/* Kept mounted so the conversation survives switching sections. */}
            <div hidden={tab !== "coach"}><CoachPage inputs={inputs} result={data.result} /></div>
            {tab === "learn" && <LearnPage scenario1={presets.destinations.GBP.inputs} mine={inputs} />}
          </>
        )}

        <footer className="footer">
          StudyAbroad Ringgit Coach · a learning tool for GFB3043 International Financial Management (UTP).
          Not financial advice.
        </footer>
      </main>

      {nav("nav-bottom")}
    </div>
  );
}
