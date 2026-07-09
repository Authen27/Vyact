/* global React, ReactDOM */
const { useState, useEffect } = React;

// ════════════════════════════════════════════════════════════════
//   FinFlow Wireframe Exploration — Tabbed Shell
// ════════════════════════════════════════════════════════════════

const TABS = [
  { id: "moodboard", num: "01", label: "Moodboard", sub: "Direction · segments · voice", Comp: () => <PageMoodboard/> },
  { id: "system",    num: "02", label: "Design system", sub: "Palette · type · components", Comp: () => <PageDesignSystem/> },
  { id: "flows",     num: "03", label: "User flows", sub: "10 rails · happy + branches", Comp: () => <PageFlows/> },
  { id: "states",    num: "04", label: "States", sub: "Empty · loading · error · transitions", Comp: () => <PageStates/> },
  { id: "proto",     num: "05", label: "Prototype", sub: "Live, tappable mobile", Comp: (p) => <PagePrototype {...p}/> },
  { id: "micro",     num: "06", label: "Microinteractions", sub: "Motion · spec · loading", Comp: () => <PageMicro/> },
  { id: "hier",      num: "07", label: "Hierarchy & voice", sub: "Eye-path · microcopy · next steps", Comp: () => <PageHier/> },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "segment": "couple",
  "showAnnotations": true,
  "paperBg": "#F5EFE6",
  "coralAccent": "#E26D5C",
  "locale": "en-US",
  "currency": "USD"
}/*EDITMODE-END*/;

const App = () => {
  const initial = (typeof location !== "undefined" && location.hash.replace("#", "")) || "moodboard";
  const [tab, setTab] = useState(TABS.find(t => t.id === initial) ? initial : "moodboard");
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    const onHash = () => {
      const next = location.hash.replace("#", "");
      if (TABS.find(t => t.id === next)) setTab(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    location.hash = tab;
    document.documentElement.style.setProperty("--paper", tweaks.paperBg || "#F5EFE6");
    document.documentElement.style.setProperty("--coral", tweaks.coralAccent || "#E26D5C");
    document.body.dataset.annotations = tweaks.showAnnotations ? "on" : "off";
  }, [tab, tweaks.paperBg, tweaks.coralAccent, tweaks.showAnnotations]);

  const idx = TABS.findIndex(t => t.id === tab);
  const Active = TABS[idx].Comp;

  return (
    <>
      <header className="shell-head">
        <div className="shell-brand">
          <span className="shell-brand-mark">
            <svg viewBox="0 0 36 36" width="28" height="28">
              <circle cx="18" cy="18" r="16" fill="#E26D5C"/>
              <path d="M10 22 Q 18 14, 26 22" stroke="#FBE4DD" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
              <circle cx="13" cy="16" r="1.4" fill="#2A2522"/>
              <circle cx="23" cy="16" r="1.4" fill="#2A2522"/>
            </svg>
          </span>
          <div>
            <div className="shell-brand-title">FinFlow</div>
            <div className="shell-brand-sub">Wireframe exploration · v1.0 · Apr 2026</div>
          </div>
        </div>
        <div className="shell-meta">
          <span><b>7</b> deliverables</span>
          <span><b>{TABS[idx].num}</b> / {TABS.length}</span>
        </div>
      </header>

      <nav className="shell-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`shell-tab ${tab === t.id ? "active" : ""}`}>
            <span className="shell-tab-num">{t.num}</span>
            <div className="shell-tab-text">
              <span className="shell-tab-label">{t.label}</span>
              <span className="shell-tab-sub">{t.sub}</span>
            </div>
          </button>
        ))}
      </nav>

      <main className="shell-main">
        <Active segment={tweaks.segment || "couple"} locale={tweaks.locale || "en-US"} currency={tweaks.currency || "USD"}/>
      </main>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Segment lens">
            <window.TweakRadio
              label="Audience"
              value={tweaks.segment}
              options={[
                { value: "couple", label: "Couple" },
                { value: "growing", label: "Growing fam" },
                { value: "multigen", label: "Multi-gen" },
              ]}
              onChange={v => setTweak("segment", v)}
            />
            <p style={{ fontSize: 11, color: "var(--shell-dim)", margin: "6px 0 0", lineHeight: 1.45 }}>
              Shifts copy + insight on the live prototype (Tab 05). Couple → date-night fund. Growing → childcare. Multi-gen → medical.
            </p>
          </window.TweakSection>
          <window.TweakSection label="Localization">
            <window.TweakSelect
              label="Locale"
              value={tweaks.locale}
              options={Object.entries(window.LOCALES || {}).map(([v, l]) => ({ value: v, label: `${l.flag}  ${l.name}` }))}
              onChange={v => setTweak("locale", v)}
            />
            <window.TweakSelect
              label="Currency"
              value={tweaks.currency}
              options={Object.entries(window.CURRENCIES || {}).map(([v, c]) => ({ value: v, label: `${c.symbol}  ${c.code} — ${c.name}` }))}
              onChange={v => setTweak("currency", v)}
            />
            <p style={{ fontSize: 11, color: "var(--shell-dim)", margin: "6px 0 0", lineHeight: 1.45 }}>
              Live on the prototype (Tab 05) — every amount reformats. FX is illustrative.
            </p>
          </window.TweakSection>
          <window.TweakSection label="Annotations">
            <window.TweakToggle label="Show eye-path numbers" value={!!tweaks.showAnnotations} onChange={v => setTweak("showAnnotations", v)}/>
          </window.TweakSection>
          <window.TweakSection label="Paper">
            <window.TweakColor label="Background" value={tweaks.paperBg} onChange={v => setTweak("paperBg", v)}/>
            <window.TweakColor label="Coral accent" value={tweaks.coralAccent} onChange={v => setTweak("coralAccent", v)}/>
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
