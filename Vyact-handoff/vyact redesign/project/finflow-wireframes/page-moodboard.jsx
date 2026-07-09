/* global React, ReactDOM */
const { useState, useEffect, useRef } = React;

// ════════════════════════════════════════════════════════════════
//   Shared primitives
// ════════════════════════════════════════════════════════════════

const Mascot = ({ size = 36, mood = "happy" }) => (
  <span className="mascot" style={{ width: size, height: size }}>
    <svg viewBox="0 0 36 36" width={size} height={size}>
      <defs>
        <radialGradient id="pip-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#F4B6A8" />
          <stop offset="100%" stopColor="#E26D5C" />
        </radialGradient>
      </defs>
      <path d="M18 3 C 27 3, 33 9, 33 18 C 33 27, 27 33, 18 33 C 9 33, 3 27, 3 18 C 3 9, 9 3, 18 3 Z"
            fill="url(#pip-grad)" stroke="#2A2522" strokeWidth="1.2" />
      <ellipse cx="13" cy="16" rx="1.4" ry={mood === "sleep" ? 0.4 : 1.8} fill="#2A2522" />
      <ellipse cx="23" cy="16" rx="1.4" ry={mood === "sleep" ? 0.4 : 1.8} fill="#2A2522" />
      <circle cx="9.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      <circle cx="26.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      {mood === "happy" && <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round" />}
      {mood === "wow"   && <ellipse cx="18" cy="23" rx="2" ry="2.3" fill="#2A2522" />}
      {mood === "calm"  && <path d="M14 23 L 22 23" stroke="#2A2522" strokeWidth="1.2" strokeLinecap="round" />}
      {mood === "sleep" && <path d="M14 23 Q 16 22, 18 23 Q 20 24, 22 23" stroke="#2A2522" strokeWidth="1" fill="none" />}
      {/* leaf antenna */}
      <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.8" />
    </svg>
  </span>
);

const Phone = ({ label, sublabel, children, time = "9:41", coral = false }) => (
  <div className="phone-stack">
    <div className="phone">
      <div className="phone-screen" style={coral ? { background: "#FBE4DD" } : undefined}>
        <div className="phone-statusbar">
          <span>{time}</span>
          <span className="sb-right">
            <svg viewBox="0 0 16 10"><path d="M1 8 L 3 8 L 3 6 L 1 6 Z M 5 8 L 7 8 L 7 4 L 5 4 Z M 9 8 L 11 8 L 11 2 L 9 2 Z M 13 8 L 15 8 L 15 0 L 13 0 Z" fill="currentColor"/></svg>
            <svg viewBox="0 0 14 10"><rect x="0" y="2" width="11" height="6" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="1.5" y="3.5" width="7" height="3" fill="currentColor"/><rect x="12" y="4" width="1.5" height="2" fill="currentColor"/></svg>
          </span>
        </div>
        <div className="phone-content">{children}</div>
      </div>
    </div>
    {label && (
      <div className="phone-label">
        <b>{label}</b>{sublabel ? <> · {sublabel}</> : null}
      </div>
    )}
  </div>
);

const Btn = ({ children, variant = "primary", className = "" }) => (
  <button className={`btn-ph ${variant === "ghost" ? "ghost" : variant === "dark" ? "dark" : ""} ${className}`}>
    {children}
  </button>
);

const Tabnav = ({ active = "home" }) => (
  <div className="tabnav">
    {[
      ["home", "Home"],
      ["txn", "Txns"],
      ["budget", "Budget"],
      ["goals", "Goals"],
      ["more", "More"],
    ].map(([k, l]) => (
      <div key={k} className={`tabnav-item ${active === k ? "active" : ""}`}>
        <span className="icon" />
        <span>{l}</span>
      </div>
    ))}
  </div>
);

// ════════════════════════════════════════════════════════════════
//   TAB 1 — MOODBOARD
// ════════════════════════════════════════════════════════════════

const PageMoodboard = () => (
  <div className="page-canvas" data-screen-label="01 Moodboard">
    <div className="page-head">
      <div>
        <div className="eyebrow"><span className="dot"/>Tab 01 / 07 — Moodboard &amp; Voice</div>
        <h1>A finance app that feels <i>warm</i>, not cold.</h1>
        <p className="lede">FinFlow's competitors lean clinical — navy charts, sterile numerics, robotic affirmations. We're going the other way: warm cream paper, hand-set serif headlines, a coral accent that signals <i>care</i>, and a gentle mascot named Pip who knows when to cheer and when to stay quiet.</p>
      </div>
      <div className="meta-stack">
        <span>Doc · v1.0</span>
        <span><b>Mid-fi</b> grayscale</span>
        <span>Mobile-first</span>
      </div>
    </div>

    <div className="page-body">
      {/* Mood collage */}
      <div className="section">
        <div className="section-head"><span className="section-num">01.1</span><h2>Mood collage</h2><span className="note">Texture · color · feeling</span></div>
        <div className="grid-4" style={{ gridAutoRows: "140px" }}>
          <div className="mood-cell" style={{ background: "linear-gradient(135deg, #F4B6A8, #E26D5C)" }}><span className="label">Coral warmth</span></div>
          <div className="mood-cell" style={{ background: "#F5EFE6", display: "grid", placeItems: "center" }}>
            <Mascot size={84} mood="happy" />
            <span className="label">Pip — mascot</span>
          </div>
          <div className="mood-cell" style={{ background: "#EDE5D6", gridColumn: "span 2", display: "grid", placeItems: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontStyle: "italic", color: "#2A2522", letterSpacing: "-0.02em" }}>good with money</div>
            <span className="label">Type voice</span>
          </div>
          <div className="mood-cell" style={{ background: "#85A88A", display: "grid", placeItems: "center" }}>
            <span style={{ color: "#fff", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.18em" }}>+ $1,240</span>
            <span className="label">Sage = grow</span>
          </div>
          <div className="mood-cell" style={{ background: "#2A2522", display: "grid", placeItems: "center" }}>
            <div style={{ width: 70, height: 70, borderRadius: "50%", background: "conic-gradient(#E26D5C 78%, #4A4540 0)", display: "grid", placeItems: "center", position: "relative" }}>
              <div style={{ position: "absolute", inset: 8, background: "#2A2522", borderRadius: "50%" }} />
              <span style={{ position: "relative", color: "#F5EFE6", fontFamily: "var(--font-display)", fontSize: 22 }}>78</span>
            </div>
            <span className="label">Pulse Score</span>
          </div>
          <div className="mood-cell" style={{ background: "linear-gradient(180deg, #F4D27A, #E8A87C)", display: "grid", placeItems: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "#2A2522" }}>🪙</span>
            <span className="label">Honey · save</span>
          </div>
          <div className="mood-cell" style={{ background: "#FBF7EE", border: "1px solid #2A2522", display: "grid", placeItems: "center", padding: 12 }}>
            <div style={{ width: "100%", height: 6, background: "#EDE5D6", borderRadius: 3 }}>
              <div style={{ width: "62%", height: "100%", background: "#E26D5C", borderRadius: 3 }} />
            </div>
            <span className="label">Budget bar</span>
          </div>
          <div className="mood-cell" style={{ background: "#4A6FA5", display: "grid", placeItems: "center" }}>
            <span style={{ color: "#fff", fontFamily: "var(--font-display)", fontSize: 32 }}>$</span>
            <span className="label">Trust · denim</span>
          </div>
        </div>
      </div>

      {/* Three voice options */}
      <div className="section">
        <div className="section-head"><span className="section-num">01.2</span><h2>Voice &amp; tone</h2><span className="note">Playful — picked direction · 3 reference points</span></div>
        <div className="grid-3">
          <div className="voice-card">
            <div className="role">Notification · over-budget</div>
            <div className="quote">Heads up — Food's munched 92% of its budget. 4 days left in the month.</div>
            <p style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mid)" }}>Friendly, observational, never shame-y. Verbs do the heavy lifting.</p>
          </div>
          <div className="voice-card">
            <div className="role">Goal complete · celebration</div>
            <div className="quote">You did it. Emergency Fund — fully stocked. That's six months of breathing room.</div>
            <p style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mid)" }}>Present-tense, concrete. Name the win. Don't oversell.</p>
          </div>
          <div className="voice-card">
            <div className="role">Empty state · first run</div>
            <div className="quote">Hi, I'm Pip. Add your first transaction and I'll start spotting patterns. Promise I'm useful.</div>
            <p style={{ marginTop: 10, fontSize: 12, color: "var(--ink-mid)" }}>Mascot speaks in first person. One self-deprecating beat per onboarding screen, max.</p>
          </div>
        </div>
      </div>

      {/* Customer segments */}
      <div className="section">
        <div className="section-head"><span className="section-num">01.3</span><h2>Customer segments</h2><span className="note">All four supported · default surface tuned per household</span></div>
        <div className="grid-4">
          {[
            { name: "Young couple", age: "25–35", who: "Dual-income, urban, no kids yet. Optimizing for the down payment.", color: "#4A6FA5", touch: "Joint goals, split-tracking, date-night budget" },
            { name: "Growing family", age: "30–42", who: "Parents with young kids. Childcare is the #1 line item.", color: "#E26D5C", touch: "Childcare category, kid-allowance goals, school-year budget" },
            { name: "Multi-gen", age: "35–60", who: "Adults supporting both kids and aging parents.", color: "#6E4555", touch: "Elder role, medical sub-budgets, caregiver permissions" },
            { name: "Single parent", age: "28–48", who: "Solo navigator. Resilience &amp; emergency fund matter most.", color: "#85A88A", touch: "Bigger emergency target, simplified UI, school-fee reminders" },
          ].map((s) => (
            <div key={s.name} className="tile">
              <div style={{ width: 24, height: 24, borderRadius: 6, background: s.color, marginBottom: 10 }} />
              <h3>{s.name}</h3>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)", letterSpacing: "0.1em", marginBottom: 8 }}>AGE {s.age}</div>
              <p dangerouslySetInnerHTML={{ __html: s.who }} />
              <div className="note-box" style={{ marginTop: 10, fontSize: 11 }}>{s.touch}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mascot poses */}
      <div className="section">
        <div className="section-head"><span className="section-num">01.4</span><h2>Pip — the mascot</h2><span className="note">Used sparingly · never as decoration</span></div>
        <div className="grid-4">
          {[
            { mood: "happy", when: "Goal hit, savings up, new milestone", say: "Onwards!" },
            { mood: "calm",  when: "Steady state — daily logging, no alarms", say: "All steady." },
            { mood: "wow",   when: "Anomaly spotted — weird txn or big charge", say: "Hmm, this one's new." },
            { mood: "sleep", when: "Inactive 7+ days — gentle re-engagement", say: "Just resting. Tap me." },
          ].map((p, i) => (
            <div key={i} className="tile" style={{ textAlign: "center" }}>
              <Mascot size={84} mood={p.mood} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-mid)", marginTop: 12 }}>{p.mood}</div>
              <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", marginTop: 6, color: "var(--ink)" }}>"{p.say}"</div>
              <p style={{ marginTop: 8, fontSize: 12 }}>{p.when}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="canvas-foot"><span>FinFlow · Wireframe Exploration</span><span>01 / 07 — Moodboard</span></div>
  </div>
);

window.PageMoodboard = PageMoodboard;
window.Mascot = Mascot;
window.Phone = Phone;
window.Btn = Btn;
window.Tabnav = Tabnav;
