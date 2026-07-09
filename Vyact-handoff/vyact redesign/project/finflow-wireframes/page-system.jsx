/* global React */
const { useState: useStateDS } = React;

// ════════════════════════════════════════════════════════════════
//   TAB 2 — DESIGN SYSTEM
// ════════════════════════════════════════════════════════════════

const PageDesignSystem = () => (
  <div className="page-canvas" data-screen-label="02 Design System">
    <div className="page-head">
      <div>
        <div className="eyebrow"><span className="dot"/>Tab 02 / 07 — Design System</div>
        <h1>The <i>system</i>, end-to-end.</h1>
        <p className="lede">Color, type, components, motion — calibrated for family households (warm, readable, low-anxiety) and the personal-finance industry (trust, precision, clarity). Nothing precious. Every token earns its place.</p>
      </div>
      <div className="meta-stack">
        <span>Tokens · 7 hues</span>
        <span><b>3</b> typefaces</span>
        <span>Mid-fi v1</span>
      </div>
    </div>

    <div className="page-body">
      {/* Color */}
      <div className="section">
        <div className="section-head"><span className="section-num">02.1</span><h2>Color system</h2><span className="note">Coral lead · semantic supporting cast</span></div>

        <div className="kicker">Primary &amp; surface</div>
        <div className="grid-4" style={{ marginBottom: 18 }}>
          {[
            { name: "Coral",  hex: "#E26D5C", role: "Primary action, focus, brand", text: "white", dark: true },
            { name: "Cream",  hex: "#F5EFE6", role: "Canvas, app background",       text: "ink" },
            { name: "Ink",    hex: "#2A2522", role: "Primary text, headings",       text: "white", dark: true },
            { name: "Bone",   hex: "#FBF7EE", role: "Card, panel surface",          text: "ink" },
          ].map(s => (
            <div key={s.name} className="swatch">
              <div className={`swatch-color ${s.dark ? "dark" : ""}`} style={{ background: s.hex }}>
                <span className="name">{s.hex}</span>
              </div>
              <div className="swatch-meta">
                <span className="label">{s.name}</span>
                <span className="role">{s.role}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="kicker">Semantic — tuned warm, not neon</div>
        <div className="grid-4" style={{ marginBottom: 18 }}>
          {[
            { name: "Sage",       hex: "#85A88A", role: "Income, positive trend, success" },
            { name: "Olive",      hex: "#6B7C53", role: "Savings, deeper positive value" },
            { name: "Honey",      hex: "#E8A87C", role: "Warning, near-budget, attention" },
            { name: "Butter",     hex: "#F4D27A", role: "Highlight, soft caution" },
            { name: "Terracotta", hex: "#C44536", role: "Error, over-budget, destructive" },
            { name: "Plum",       hex: "#6E4555", role: "Multi-gen / elder accent" },
            { name: "Denim",      hex: "#4A6FA5", role: "Trust, banking, legal" },
            { name: "Mid Ink",    hex: "#6B635C", role: "Secondary text, meta" },
          ].map(s => (
            <div key={s.name} className="swatch">
              <div className="swatch-color dark" style={{ background: s.hex }}>
                <span className="name">{s.hex}</span>
              </div>
              <div className="swatch-meta">
                <span className="label">{s.name}</span>
                <span className="role">{s.role}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="note-box">
          Why warm coral over electric blue? Family-finance research shows households associate cool fintech palettes with banks and bills — i.e. the things they're stressed about. Warm cream + coral reads as <i>kitchen-table conversation</i>, not <i>quarterly statement</i>. The dark FinFlow shell still ships as a power-user theme; this paper-warm palette is the new default.
        </div>
      </div>

      {/* Type */}
      <div className="section">
        <div className="section-head"><span className="section-num">02.2</span><h2>Typography</h2><span className="note">Newsreader · Inter Tight · JetBrains Mono</span></div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="type-spec">
            <div className="meta">Display · Newsreader 400 italic · -0.02em</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 56, lineHeight: 1, letterSpacing: "-0.02em" }}>
              good with <i style={{ color: "var(--coral)" }}>money</i>
            </div>
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--ink-mid)" }}>Display sets the tone — warm, literate, slightly editorial. Italic for accent words only. Used for hero titles, large numbers, milestones.</p>
          </div>
          <div className="type-spec">
            <div className="meta">UI · Inter Tight 400/500/600 · -0.005em</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 32, fontWeight: 600 }}>$8,420.36</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 16, marginTop: 6 }}>Total balance · 3 accounts</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-mid)", marginTop: 4 }}>↑ $240 vs last month</div>
            <p style={{ marginTop: 14, fontSize: 13, color: "var(--ink-mid)" }}>Workhorse for body, buttons, list rows. Inter Tight runs slightly condensed — more breathing room on dense screens.</p>
          </div>
        </div>

        <div className="type-spec">
          <div className="meta">Mono · JetBrains Mono 400/500 · 0.05–0.18em tracking</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-mid)", marginBottom: 12 }}>Family Pulse Score · Apr 2026</div>
          <div className="row" style={{ gap: 22 }}>
            {["BUDGETS 82","SAVINGS 71","GOALS 64","TREND 88"].map((s,i)=>(
              <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500 }}>{s}</div>
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 13, color: "var(--ink-mid)" }}>Mono = data, metadata, status pins. Always tracked, almost always uppercase below 14px. Never used for body prose.</p>
        </div>

        <div className="kicker" style={{ marginTop: 22 }}>Type scale</div>
        <div className="tile">
          {[
            ["display-xl", 56, "Newsreader", "Hero titles"],
            ["display-l",  40, "Newsreader", "Section opens"],
            ["display-m",  28, "Newsreader", "Card hero numbers"],
            ["title",      20, "Inter Tight", "Panel headings"],
            ["body-l",     16, "Inter Tight", "Lead paragraph"],
            ["body",       14, "Inter Tight", "Default body"],
            ["caption",    12, "Inter Tight", "Secondary meta"],
            ["mono",       11, "JetBrains Mono", "Labels, status, data"],
            ["mono-xs",     9, "JetBrains Mono", "Pin tags only"],
          ].map((r) => (
            <div key={r[0]} style={{ display: "grid", gridTemplateColumns: "120px 70px 1fr 1fr", padding: "8px 0", borderBottom: "1px dashed var(--line-faint)", alignItems: "baseline", gap: 16 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mid)" }}>{r[0]}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{r[1]}px</span>
              <span style={{ fontFamily: r[2] === "Newsreader" ? "var(--font-display)" : r[2] === "Inter Tight" ? "var(--font-ui)" : "var(--font-mono)", fontSize: Math.min(r[1], 22) }}>The quick brown fox</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-mid)", letterSpacing: "0.06em" }}>{r[3]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spacing & radius */}
      <div className="section">
        <div className="section-head"><span className="section-num">02.3</span><h2>Spacing, radius, elevation</h2></div>
        <div className="grid-3">
          <div className="tile">
            <div className="kicker">4-pt scale</div>
            <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
              {[4, 8, 12, 16, 24, 32, 48].map(n => (
                <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: n, height: n, background: "var(--coral)" }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>{n}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: 12 }}>All gaps and padding align to 4px. Card padding default 16, page gutter 20–24 mobile.</p>
          </div>
          <div className="tile">
            <div className="kicker">Radius</div>
            <div className="row wrap" style={{ gap: 12, marginTop: 10 }}>
              {[
                ["sm", 4], ["md", 8], ["lg", 14], ["pill", 999],
              ].map(([n, r]) => (
                <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 44, height: 44, background: "var(--coral)", borderRadius: r }} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}>{n}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: 12 }}>Cards 8. Sheet 14. Pills (chips, segment toggles) 999. Buttons 9.</p>
          </div>
          <div className="tile">
            <div className="kicker">Elevation</div>
            <div className="row" style={{ gap: 14, marginTop: 10 }}>
              <div style={{ width: 44, height: 44, background: "#fff", border: "1px solid var(--line-soft)", borderRadius: 8 }} />
              <div style={{ width: 44, height: 44, background: "#fff", borderRadius: 8, boxShadow: "0 2px 6px rgba(42,37,34,0.08)" }} />
              <div style={{ width: 44, height: 44, background: "#fff", borderRadius: 8, boxShadow: "0 8px 20px rgba(42,37,34,0.12)" }} />
              <div style={{ width: 44, height: 44, background: "#fff", borderRadius: 8, boxShadow: "0 16px 40px rgba(42,37,34,0.18)" }} />
            </div>
            <p style={{ marginTop: 12, fontSize: 12 }}>0 / 1 / 2 / 3. Sheets at 2, modals at 3, toasts at 2. Never go higher.</p>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="section">
        <div className="section-head"><span className="section-num">02.4</span><h2>Components</h2><span className="note">Patterns the prototype is built from</span></div>
        <div className="grid-4">
          <div className="comp">
            <div className="comp-preview"><Btn>+ Add Transaction</Btn></div>
            <div className="comp-meta"><b>Button · Primary</b><span>Coral</span></div>
          </div>
          <div className="comp">
            <div className="comp-preview"><Btn variant="ghost">Cancel</Btn></div>
            <div className="comp-meta"><b>Button · Ghost</b><span>Border</span></div>
          </div>
          <div className="comp">
            <div className="comp-preview">
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--coral-tint)", color: "var(--terracotta)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }}>OVER</span>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "#E5EDD9", color: "var(--olive)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }}>ON TRACK</span>
              </div>
            </div>
            <div className="comp-meta"><b>Status pill</b><span>4 variants</span></div>
          </div>
          <div className="comp">
            <div className="comp-preview" style={{ width: "100%" }}>
              <div style={{ width: "100%" }}>
                <div className="row between" style={{ marginBottom: 6, fontFamily: "var(--font-mono)", fontSize: 10 }}><span>FOOD</span><span>$420 / $500</span></div>
                <div style={{ height: 6, background: "var(--paper-3)", borderRadius: 3 }}>
                  <div style={{ width: "84%", height: "100%", background: "var(--honey)", borderRadius: 3 }}/>
                </div>
              </div>
            </div>
            <div className="comp-meta"><b>Budget bar</b><span>3 thresholds</span></div>
          </div>
          <div className="comp">
            <div className="comp-preview">
              <div className="pulse-mini" style={{ "--p": 78 }}>
                <span className="pulse-num">78</span>
                <span className="pulse-lbl">Good</span>
              </div>
            </div>
            <div className="comp-meta"><b>Pulse ring</b><span>Hero</span></div>
          </div>
          <div className="comp">
            <div className="comp-preview"><div className="toast-demo"><span className="dot"/>Saved · Goal updated</div></div>
            <div className="comp-meta"><b>Toast</b><span>3.2s</span></div>
          </div>
          <div className="comp">
            <div className="comp-preview" style={{ width: "100%" }}>
              <input className="input" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--line-soft)", borderRadius: 8, background: "#FBF7EE", fontFamily: "var(--font-ui)", fontSize: 13 }} placeholder="Description…" defaultValue="Whole Foods" />
            </div>
            <div className="comp-meta"><b>Text input</b><span>Field</span></div>
          </div>
          <div className="comp">
            <div className="comp-preview">
              <div className="row" style={{ gap: 6 }}>
                {["W", "M", "Q", "Y"].map((l, i) => (
                  <span key={l} style={{ padding: "5px 10px", borderRadius: 6, background: i === 1 ? "var(--ink)" : "transparent", color: i === 1 ? "var(--paper)" : "var(--ink-mid)", border: "1px solid var(--line-soft)", fontFamily: "var(--font-mono)", fontSize: 10 }}>{l}</span>
                ))}
              </div>
            </div>
            <div className="comp-meta"><b>Segment toggle</b><span>Period</span></div>
          </div>
        </div>
      </div>

      {/* Iconography */}
      <div className="section">
        <div className="section-head"><span className="section-num">02.5</span><h2>Iconography</h2><span className="note">Outline · 1.5px · 18 / 22 / 28</span></div>
        <div className="tile">
          <div className="row wrap" style={{ gap: 22 }}>
            {[
              { lbl: "home", path: "M3 12 L12 3 L21 12 M5 10 V21 H19 V10" },
              { lbl: "txn", path: "M4 7 H20 M4 12 H20 M4 17 H14" },
              { lbl: "budget", path: "M3 12 A9 9 0 1 0 12 3 V12 Z M12 3 A9 9 0 0 1 21 12 H12 Z" },
              { lbl: "goal", path: "M12 3 V21 M3 12 H21 M5 5 L19 19 M19 5 L5 19" },
              { lbl: "report", path: "M4 20 V8 M9 20 V4 M14 20 V12 M19 20 V6" },
              { lbl: "search", path: "M11 4 A7 7 0 1 0 11 18 A7 7 0 1 0 11 4 M16 16 L21 21" },
              { lbl: "bell", path: "M6 18 H18 V10 A6 6 0 0 0 6 10 Z M10 21 H14" },
              { lbl: "user", path: "M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 M4 21 A8 8 0 0 1 20 21" },
              { lbl: "lock", path: "M6 11 V8 A6 6 0 0 1 18 8 V11 M5 11 H19 V21 H5 Z" },
              { lbl: "plus", path: "M12 4 V20 M4 12 H20" },
            ].map(ico => (
              <div key={ico.lbl} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ico.path}/>
                </svg>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-mid)", letterSpacing: "0.08em" }}>{ico.lbl}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--ink-mid)" }}>Single-stroke outlines, square caps, 24×24 grid. Categories keep their emoji (existing FinFlow convention) — system icons stay neutral.</p>
        </div>
      </div>
    </div>
    <div className="canvas-foot"><span>FinFlow · Wireframe Exploration</span><span>02 / 07 — Design System</span></div>
  </div>
);

window.PageDesignSystem = PageDesignSystem;
