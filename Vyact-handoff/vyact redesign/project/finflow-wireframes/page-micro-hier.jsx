/* global React, Phone, Tabnav, Mascot */

// ════════════════════════════════════════════════════════════════
//   TAB 6 — MICROINTERACTIONS + LOADING
// ════════════════════════════════════════════════════════════════

const Spec = ({ name, spec, note }) => (
  <div className="tile">
    <div className="kicker">{name}</div>
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink)", lineHeight: 1.55 }}>{spec}</div>
    <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink-mid)" }}>{note}</p>
  </div>
);

const PageMicro = () => {
  const [pulse, setPulse] = React.useState(false);
  const [confetti, setConfetti] = React.useState(false);
  const [chip, setChip] = React.useState(0);
  return (
    <div className="page-canvas" data-screen-label="06 Microinteractions">
      <div className="page-head">
        <div>
          <div className="eyebrow"><span className="dot"/>Tab 06 / 07 — Microinteractions</div>
          <h1>The little moments <i>that make it feel alive.</i></h1>
          <p className="lede">Every touch should answer back. Pulse score animates in. Goals celebrate. Pip reacts. Buttons squish. None of this is decoration — every motion has a job: confirm input, hint at relationship, reward progress.</p>
        </div>
        <div className="meta-stack"><span><b>9</b> interactions</span><span>Mid-fi spec</span></div>
      </div>

      <div className="page-body">
        {/* Live demos */}
        <div className="section">
          <div className="section-head"><span className="section-num">06.1</span><h2>Live demos</h2><span className="note">Click to trigger</span></div>
          <div className="grid-3" style={{ alignItems: "start" }}>
            <div className="tile" style={{ textAlign: "center" }}>
              <div className="kicker">Pulse score reveal</div>
              <div className="pulse-mini" style={{ "--p": pulse ? 78 : 0, transition: "all 1.4s cubic-bezier(.2,.7,.2,1)", margin: "20px auto 12px" }}>
                <span className="pulse-num">{pulse ? 78 : 0}</span>
                <span className="pulse-lbl">{pulse ? "Good" : "Idle"}</span>
              </div>
              <button onClick={() => { setPulse(false); setTimeout(() => setPulse(true), 50); }} style={{ background: "var(--ink)", color: "var(--paper-1)", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em" }}>REPLAY</button>
              <p style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 10 }}>0 → N tick · ring fills in sync · 1.4s ease-out · runs once per dashboard mount.</p>
            </div>

            <div className="tile" style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div className="kicker">Goal complete</div>
              <div style={{ marginTop: 16, marginBottom: 12 }}>
                <div style={{ height: 8, background: "var(--paper-3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: confetti ? "100%" : "62%", height: "100%", background: "var(--coral)", borderRadius: 4, transition: "width 0.9s cubic-bezier(.2,.7,.2,1)" }}/>
                </div>
                <div style={{ marginTop: 14, position: "relative", height: 60 }}>
                  <Mascot size={48} mood={confetti ? "happy" : "calm"}/>
                  {confetti && [...Array(20)].map((_, i) => (
                    <span key={i} style={{ position: "absolute", left: "50%", top: "50%", width: 6, height: 6, borderRadius: 1, background: ["var(--coral)", "var(--honey)", "var(--olive)", "var(--terracotta)", "var(--ink)"][i % 5], animation: `confetti-${i % 4} 1.6s ease-out forwards`, "--ang": `${i * 18}deg` }}/>
                  ))}
                </div>
              </div>
              <button onClick={() => { setConfetti(false); setTimeout(() => setConfetti(true), 50); }} style={{ background: "var(--coral)", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em" }}>CELEBRATE</button>
              <p style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 10 }}>Bar fills · confetti burst · Pip "wow". 1.8s total. One-shot.</p>
            </div>

            <div className="tile">
              <div className="kicker">Smart-cat chips</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mid)", marginBottom: 8 }}>"Whole Foods" →</div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {["🍔 Food", "🛒 Groceries", "🏠 Household"].map((c, i) => (
                  <button key={c} onClick={() => setChip(i)} style={{ padding: "6px 10px", borderRadius: 999, border: "1.5px solid " + (chip === i ? "var(--coral)" : "var(--ink-faint)"), background: chip === i ? "var(--coral-tint)" : "var(--paper-1)", color: chip === i ? "var(--terracotta)" : "var(--ink-mid)", fontSize: 12, cursor: "pointer", transition: "all 0.18s ease" }}>{c}</button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 12 }}>Top-3 ranked by Pip's confidence. First chip auto-selected. Tap to override.</p>
            </div>
          </div>
        </div>

        {/* Specs */}
        <div className="section">
          <div className="section-head"><span className="section-num">06.2</span><h2>Motion specs</h2><span className="note">All easings · all timings</span></div>
          <div className="grid-2">
            <Spec name="Button press" spec="scale(0.96) · 80ms in · 120ms out · ease-out" note="Universal. Coral primary also brightens 4% on press."/>
            <Spec name="Toast drop-in" spec="translateY(-12px → 0) + opacity 0→1 · 180ms · spring(0.7, 0.9) · auto-dismiss 3.2s" note="Always top-center. Never overlaps tab bar."/>
            <Spec name="Card hover (web)" spec="translateY(-2px) + shadow 0→12% · 160ms ease-out" note="Mobile uses press-down (0.98 scale) instead."/>
            <Spec name="Pip mood transition" spec="Cross-fade between SVG mood frames · 220ms · happy ↔ calm ↔ concerned" note="Triggered by score delta or insight chip context."/>
            <Spec name="Number ticker" spec="Increment frame-by-frame · monospace stable · 60fps · custom hook" note="Used on Pulse, Balance, Goal $. Skipped on rapid re-render."/>
            <Spec name="Pull-to-refresh" spec="Drag-down 80px → release → 'syncing' spinner · 600ms min · haptic on threshold" note="Mobile only. Hides FAB while pulling."/>
            <Spec name="Tab switch" spec="Cross-fade 180ms · ease-out · indicator slides + scales (0.85→1)" note="Indicator under-line is the same coral, with subtle shadow."/>
            <Spec name="Sheet dismiss" spec="Swipe-down velocity > 600px/s OR drag past 30% · 220ms snap" note="Backdrop fades in lock-step. ESC also dismisses on web."/>
          </div>
        </div>

        {/* Loading rhythm */}
        <div className="section">
          <div className="section-head"><span className="section-num">06.3</span><h2>Loading rhythm</h2><span className="note">When to skeleton, when to spinner, when to nothing</span></div>
          <div className="grid-3">
            <div className="tile">
              <div className="kicker">&lt; 200ms — nothing</div>
              <p style={{ fontSize: 13, color: "var(--ink-mid)" }}>Don't show a state. The action just happens. Most local computations land here.</p>
            </div>
            <div className="tile">
              <div className="kicker">200ms – 1.2s — skeleton</div>
              <p style={{ fontSize: 13, color: "var(--ink-mid)" }}>Shimmer placeholder for the actual layout. Never spinners — they imply uncertainty.</p>
            </div>
            <div className="tile">
              <div className="kicker">&gt; 1.2s — Pip narrates</div>
              <p style={{ fontSize: 13, color: "var(--ink-mid)" }}>Mascot + status copy: "Pulling your transactions… 2 of 4 accounts". Cancel button at 5s.</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        ${[...Array(20)].map((_, i) => `
          @keyframes confetti-${i % 4} {
            0% { transform: translate(-50%, -50%) rotate(${i * 18}deg) translateY(0); opacity: 1; }
            100% { transform: translate(-50%, -50%) rotate(${i * 18}deg) translateY(${-60 - (i % 3) * 10}px) translateX(${(i % 2 ? 1 : -1) * 20}px); opacity: 0; }
          }
        `).join("")}
      `}</style>

      <div className="canvas-foot"><span>FinFlow · Wireframe Exploration</span><span>06 / 07 — Microinteractions</span></div>
    </div>
  );
};

window.PageMicro = PageMicro;

// ════════════════════════════════════════════════════════════════
//   TAB 7 — VISUAL HIERARCHY + MICROCOPY
// ════════════════════════════════════════════════════════════════

const PageHier = () => (
  <div className="page-canvas" data-screen-label="07 Hierarchy & Voice">
    <div className="page-head">
      <div>
        <div className="eyebrow"><span className="dot"/>Tab 07 / 07 — Hierarchy &amp; copy</div>
        <h1>What you read first. <i>What Pip says.</i></h1>
        <p className="lede">Two things to lock before hi-fi: the visual order on every screen (what the eye lands on, in what sequence), and the actual words Pip uses. Both are about reducing anxiety while keeping it honest.</p>
      </div>
      <div className="meta-stack"><span><b>4</b> screens annotated</span><span><b>20+</b> copy snippets</span></div>
    </div>

    <div className="page-body">
      <div className="section">
        <div className="section-head"><span className="section-num">07.1</span><h2>Visual hierarchy — annotated</h2><span className="note">Numbered eye-path</span></div>
        <div className="grid-3" style={{ alignItems: "start" }}>
          {[
            { label: "Dashboard", items: [["1", "Pulse score (focal)", "Display 36px · ring ring · single-glance status"], ["2", "Balance & savings rate", "Two stat cards · paired with Pulse"], ["3", "Insight banner (coral)", "Pip's pick of the week — actionable"], ["4", "Budget mini-bars", "Glanceable, tappable"], ["5", "Recent txns (3)", "Most-recent only — full list one tap away"]] },
            { label: "Add transaction", items: [["1", "Amount field (huge)", "Display 32px · blinks cursor on mount"], ["2", "Type toggle", "Expense / Income — expense default"], ["3", "Description", "Triggers smart-cat in real-time"], ["4", "Pip's suggestion", "Coral-tint card — accept or override"], ["5", "Save CTA", "Sticky bottom · primary color"]] },
            { label: "Goal detail", items: [["1", "Goal name + emoji", "Display 28px · personable"], ["2", "Progress bar (full-width)", "1.5x larger than card bars"], ["3", "$ raised / $ target", "Mono · stable digits"], ["4", "+ Add to goal CTA", "Inline · same height as bar"], ["5", "Activity log", "Scrollable · most-recent first"]] },
          ].map(s => (
            <div key={s.label} className="tile">
              <div className="kicker">{s.label}</div>
              <ol style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
                {s.items.map(([n, t, d]) => (
                  <li key={n} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 10, alignItems: "start" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 999, background: "var(--coral)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{n}</span>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-mid)", marginTop: 2 }}>{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-num">07.2</span><h2>Microcopy — Pip's voice</h2><span className="note">Plainspoken · warm · honest · never preachy</span></div>
        <div className="grid-2">
          {[
            { c: "Empty dashboard", do: "\"Add your first transaction and I'll start spotting patterns. Promise I'm useful.\"", dont: "\"Welcome! Let's begin your financial journey.\"" },
            { c: "Saved a transaction", do: "\"Saved · pulse +2\"", dont: "\"Transaction successfully recorded.\"" },
            { c: "Over budget", do: "\"Food's munched 92% of its budget. 4 days left.\"", dont: "\"Warning: budget threshold exceeded.\"" },
            { c: "Goal hit 100%", do: "\"You did it. That's $4,000 banked.\"", dont: "\"Congratulations on achieving your goal!\"" },
            { c: "Network offline", do: "\"You're working offline. Anything you log queues up — I'll sync when bars are back.\"", dont: "\"Network error. Please check your connection.\"" },
            { c: "Permission denied (child role)", do: "\"Budgets can be edited by Alex or Sam. You can still log your own spend.\"", dont: "\"Access denied. Insufficient permissions.\"" },
            { c: "Soft paywall (multi-member)", do: "\"Add a partner with Family — $18/month. Or keep flying solo, that's good too.\"", dont: "\"Upgrade now to unlock this feature!\"" },
            { c: "Score dropped 10+", do: "\"Pulse is down 12 this month. Want to look at why?\"", dont: "\"Your financial health has decreased significantly.\"" },
            { c: "Debt added", do: "\"Logged. Here's the road out — 28 months at the current pace.\"", dont: "\"Liability successfully created.\"" },
            { c: "Negative net worth", do: "\"You're at −$2,140 today. Plenty of folks have been here. Let's pick a strategy.\"", dont: "\"Warning: net worth below zero.\"" },
            { c: "Debt-free milestone", do: "\"That's it. You're debt-free. Two years, four months — want to roll that payment into savings?\"", dont: "\"Congratulations on debt elimination!\"" },
            { c: "FX rates stale", do: "\"Last rate refresh was 26 hours ago. Foreign totals could be off by a percent or two.\"", dont: "\"Error: currency exchange rate data is outdated.\"" },
            { c: "Locale switch", do: "\"Switched to español. Date formats and decimals updated. Pip can keep going.\"", dont: "\"Language preference saved.\"" },
          ].map(r => (
            <div key={r.c} className="tile">
              <div className="kicker">{r.c}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--olive)", padding: "2px 6px", border: "1px solid var(--olive)", borderRadius: 4, letterSpacing: "0.08em" }}>DO</span>
                <span style={{ fontSize: 13.5, color: "var(--ink)", fontStyle: "italic" }}>{r.do}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "start" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--terracotta)", padding: "2px 6px", border: "1px solid var(--terracotta)", borderRadius: 4, letterSpacing: "0.08em" }}>DON'T</span>
                <span style={{ fontSize: 13.5, color: "var(--ink-mid)", textDecoration: "line-through", textDecorationColor: "var(--ink-faint)" }}>{r.dont}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span className="section-num">07.3</span><h2>Open questions for hi-fi</h2><span className="note">What we still need to decide</span></div>
        <div className="grid-2">
          {[
            ["Pip's animation budget", "Are we shipping a lottie/rive mascot or staying with SVG mood frames? Affects bundle size + iOS perf."],
            ["Score formula transparency", "Do users see the breakdown (savings rate × consistency × goal progress) or just the number? Lean toward expandable."],
            ["Bank link Phase-2 placement", "Hidden until Family tier, or visible-but-locked? Lock-state can be a great upsell hook."],
            ["Multi-currency — Phase 1 or 2?", "Affects DB schema. Recommend: single-currency MVP, schema-ready for v2."],
            ["Children's UI mode", "Read-only is settled. Open: simplified type scale, mascot-forward layout, gamified streak meter?"],
            ["Notifications — opt-in flow", "When do we ask? After first goal? After first over-budget? Recommend: only after a real signal."],
            ["Debt categorization", "We default to 5 types (CC, student, auto, mortgage, family). Are 'medical' and 'BNPL' first-class or grouped under 'other'?"],
            ["Net-worth privacy", "Show or hide on a roommate / shared-device case? Recommend: blur-on-tap with biometric unlock."],
            ["Currency conversion source", "Single FX provider or fallback chain? SLA matters — stale FX is the #1 trust issue."],
            ["Locale-specific debt norms", "India: gold loans + chit funds. Brazil: 12-parcela installments. UK: ISA. Each needs its own primitives."],
          ].map(([q, a]) => (
            <div key={q} className="tile" style={{ borderLeft: "3px solid var(--coral)" }}>
              <div className="kicker">{q}</div>
              <p style={{ fontSize: 13, color: "var(--ink-mid)" }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section" style={{ background: "var(--ink)", color: "var(--paper-1)", borderColor: "var(--ink)" }}>
        <div className="section-head"><span className="section-num" style={{ background: "var(--coral)", color: "#fff", borderColor: "var(--coral)" }}>END</span><h2 style={{ color: "var(--paper-1)" }}>Next steps</h2><span className="note" style={{ color: "var(--paper-3)", borderColor: "var(--paper-3)" }}>From wireframe → hi-fi</span></div>
        <ol style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--paper-2)" }}>
          <li><b style={{ color: "var(--paper-1)" }}>Lock segment + tier scope.</b> Confirm Phase-1 = Solo + Couple. Multi-gen as Phase-1.5 with copy-only changes.</li>
          <li><b style={{ color: "var(--paper-1)" }}>Hi-fi sweep on the 6 prototype screens.</b> Type lockup, real iconography, illustrated Pip frames, real photography for empty states.</li>
          <li><b style={{ color: "var(--paper-1)" }}>Motion prototype.</b> Build the Pulse reveal + goal-complete + smart-cat in Lottie/Rive. Validate on-device perf.</li>
          <li><b style={{ color: "var(--paper-1)" }}>Usability test the daily-log flow.</b> 5 users · think-aloud · target: 90% complete in &lt;15s without help.</li>
          <li><b style={{ color: "var(--paper-1)" }}>Eng spike on bank-link.</b> Plaid vs. Open Banking — confidence on Phase-2 timeline before we sell it as a Family-tier hook.</li>
        </ol>
      </div>

      <div className="canvas-foot" style={{ background: "var(--paper-1)" }}>
        <span>FinFlow · Wireframe Exploration · v1.0</span><span>07 / 07 — Hierarchy &amp; Voice · END</span>
      </div>
    </div>
  </div>
);

window.PageHier = PageHier;
