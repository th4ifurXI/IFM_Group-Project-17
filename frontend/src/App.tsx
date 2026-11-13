import { useEffect, useState } from "react";

import { api, type ComputeResponse, type Inputs, type Presets } from "./api";
import { ErrorBox, IllustrativeNote } from "./components/common";
import InputPanel from "./components/InputPanel";
import CoachPage from "./pages/CoachPage";
import GuidedPage from "./pages/GuidedPage";
import LearnPage from "./pages/LearnPage";
import PlanPage from "./pages/PlanPage";
import SensitivityPage from "./pages/SensitivityPage";

const TABS = [
  { id: "plan", label: "📊 Plan" },
  { id: "guided", label: "🧭 Guided mode" },
  { id: "sensitivity", label: "🔀 Sensitivity" },
  { id: "coach", label: "🤖 AI Coach" },
  { id: "learn", label: "📚 Learn" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const tabFromHash = (): TabId => {
  const h = window.location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? "plan") as TabId;
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
    const onHash = () => setTab(tabFromHash());
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

  const go = (id: TabId) => { window.location.hash = id; setTab(id); };

  return (
    <div className="layout">
      {presets && inputs
        ? <InputPanel inputs={inputs} presets={presets} onChange={setInputs} />
        : <aside className="panel"><p className="caption">Loading plan...</p></aside>}

      <main className="main">
        <header className="header">
          <h1><span className="logo" aria-hidden>RM</span> StudyAbroad Ringgit Coach</h1>
          <p className="tagline">Know when to convert, what it will cost, and why.</p>
          <IllustrativeNote />
        </header>

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              className={tab === t.id ? "tab active" : "tab"} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </nav>

        {error && <ErrorBox message={`${error} Start the backend with: uvicorn backend.main:app --reload`} />}

        {presets && inputs && data && (
          <>
            {tab === "plan" && <PlanPage data={data} />}
            {tab === "guided" && <GuidedPage scenario1={presets.destinations.GBP.inputs} mine={inputs} />}
            {tab === "sensitivity" && <SensitivityPage inputs={inputs} />}
            {/* Kept mounted so the conversation survives tab switches. */}
            <div hidden={tab !== "coach"}><CoachPage inputs={inputs} result={data.result} /></div>
            {tab === "learn" && <LearnPage />}
          </>
        )}

        <footer className="footer">
          Learning tool for GFB3043 International Financial Management (UTP). Not financial advice.
        </footer>
      </main>
    </div>
  );
}
