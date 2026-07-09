/* global React, Phone, Btn, Tabnav, Mascot */

// ════════════════════════════════════════════════════════════════
//   TAB 4 — SCREEN TRANSITIONS + EDGE / EMPTY / ERROR / LOADING
// ════════════════════════════════════════════════════════════════

const ScrShell = ({ title, children, eyebrow, back = true }) => (
  <div className="scr">
    <div className="scr-head">
      {back ? <span className="scr-back">‹</span> : <span style={{ width: 22 }}/>}
      <div style={{ textAlign: "center", flex: 1 }}>
        {eyebrow && <div className="scr-eyebrow">{eyebrow}</div>}
        <div className="scr-title">{title}</div>
      </div>
      <span style={{ width: 22 }}/>
    </div>
    {children}
  </div>
);

const PageStates = () => (
  <div className="page-canvas" data-screen-label="04 States & Transitions">
    <div className="page-head">
      <div>
        <div className="eyebrow"><span className="dot"/>Tab 04 / 07 — Screen states</div>
        <h1>Empty, loading, error — <i>designed</i>.</h1>
        <p className="lede">A finance app lives or dies in its non-happy states. First-run is empty. Network drops. Forms get rejected. Categories get blown. Each state below is paired with the screen it's anchored on plus the recovery copy Pip uses.</p>
      </div>
      <div className="meta-stack"><span><b>16</b> states</span><span>Mid-fi mobile</span></div>
    </div>

    <div className="page-body">
      {/* Empty states */}
      <div className="section">
        <div className="section-head"><span className="section-num">04.1</span><h2>Empty states — first-run</h2><span className="note">Pip stays helpful, never twee</span></div>
        <div className="grid-3">
          <Phone label="Dashboard · empty" sublabel="Day 0">
            <ScrShell title="Welcome" eyebrow="MON · APR 28" back={false}>
              <div className="scr-card" style={{ textAlign: "center", padding: 18 }}>
                <Mascot size={64} mood="happy"/>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 10 }}>Hi — I'm Pip.</div>
                <p style={{ fontSize: 12.5, color: "var(--ink-mid)", marginTop: 6 }}>Add your first transaction and I'll start spotting patterns. Promise I'm useful.</p>
                <div style={{ marginTop: 12 }}><Btn>+ Add transaction</Btn></div>
              </div>
              <div className="scr-card outlined" style={{ marginTop: 8 }}>
                <div className="scr-eyebrow">PULSE SCORE — IDLE</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 36, color: "var(--ink-faint)" }}>--</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-mid)" }}>Awakens after 5 transactions.</div>
              </div>
            </ScrShell>
            <Tabnav active="home"/>
          </Phone>
          <Phone label="Budgets · empty">
            <ScrShell title="Budgets" eyebrow="0 ACTIVE">
              <div className="scr-card" style={{ textAlign: "center", padding: 22 }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, border: "1.5px dashed var(--ink-mid)", margin: "0 auto", display: "grid", placeItems: "center", color: "var(--ink-mid)" }}>◎</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, marginTop: 10 }}>No budgets yet</div>
                <p style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 6 }}>Pick a category. We'll suggest a limit from your history.</p>
                <div style={{ marginTop: 12 }}><Btn>+ Add budget</Btn></div>
              </div>
            </ScrShell>
            <Tabnav active="budget"/>
          </Phone>
          <Phone label="Goals · empty">
            <ScrShell title="Goals" eyebrow="0 ACTIVE">
              <div className="scr-card" style={{ textAlign: "center", padding: 22 }}>
                <Mascot size={56} mood="calm"/>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, marginTop: 10 }}>What are we aiming at?</div>
                <p style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 6 }}>Pick a goal type — emergency fund, savings, debt payoff, a big purchase. We'll track the rest.</p>
                <div style={{ marginTop: 12 }}><Btn>+ Set a goal</Btn></div>
              </div>
            </ScrShell>
            <Tabnav active="goals"/>
          </Phone>
        </div>
      </div>

      {/* Error / warning */}
      <div className="section">
        <div className="section-head"><span className="section-num">04.2</span><h2>Errors, warnings, alerts</h2><span className="note">Coral border = action needed · honey = nudge</span></div>
        <div className="grid-3">
          <Phone label="Over-budget" sublabel="Honey warn">
            <ScrShell title="Food &amp; Dining">
              <div className="scr-card" style={{ borderLeft: "3px solid var(--honey, #E8A87C)", background: "#FBF4E5" }}>
                <div className="scr-eyebrow" style={{ color: "#A06A2C" }}>HEADS UP</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Food's munched 92% of its budget. 4 days left in the month.</div>
              </div>
              <div className="scr-card">
                <div className="row between">
                  <span style={{ fontSize: 13, fontWeight: 600 }}>This month</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>$460 / $500</span>
                </div>
                <div style={{ height: 6, background: "var(--paper-3)", borderRadius: 3, marginTop: 8 }}><div style={{ width: "92%", height: "100%", background: "var(--honey)", borderRadius: 3 }}/></div>
              </div>
            </ScrShell>
            <Tabnav active="budget"/>
          </Phone>

          <Phone label="Form error">
            <ScrShell title="Add transaction">
              <div className="scr-card">
                <div className="scr-eyebrow">AMOUNT</div>
                <div style={{ borderBottom: "2px solid var(--terracotta)", padding: "6px 0", fontFamily: "var(--font-mono)", color: "var(--terracotta)" }}>—</div>
                <div style={{ fontSize: 11, color: "var(--terracotta)", marginTop: 4 }}>Enter an amount above $0.01</div>
              </div>
              <div className="scr-card">
                <div className="scr-eyebrow">DESCRIPTION</div>
                <div style={{ padding: "6px 0", fontSize: 13 }}>Whole Foods</div>
              </div>
              <Btn>Save transaction</Btn>
            </ScrShell>
            <Tabnav active="txn"/>
          </Phone>

          <Phone label="Permission denied" sublabel="Child role">
            <ScrShell title="Budgets">
              <div className="scr-card" style={{ borderLeft: "3px solid var(--coral)", background: "var(--coral-tint)" }}>
                <div className="scr-eyebrow" style={{ color: "var(--terracotta)" }}>ASK A GROWN-UP</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Budgets can be edited by Alex or Sam. You can still log your own spend.</div>
                <Btn variant="ghost" className="" >Send a request →</Btn>
              </div>
            </ScrShell>
            <Tabnav active="budget"/>
          </Phone>
        </div>
      </div>

      {/* Loading skeletons */}
      <div className="section">
        <div className="section-head"><span className="section-num">04.3</span><h2>Loading skeletons</h2><span className="note">Shimmer · 1.6s · paper-3 → paper-2</span></div>
        <div className="grid-3">
          <Phone label="Dashboard · loading">
            <ScrShell title="Dashboard" eyebrow="LOADING…" back={false}>
              <div className="scr-card">
                <div className="skel skel-line s" style={{ marginBottom: 8 }}/>
                <div className="skel" style={{ width: 80, height: 80, borderRadius: 999, margin: "0 auto" }}/>
                <div className="skel skel-line m" style={{ margin: "10px auto 4px" }}/>
                <div className="skel skel-line s" style={{ margin: "0 auto" }}/>
              </div>
              <div className="scr-card">
                <div className="skel skel-line m" style={{ marginBottom: 10 }}/>
                <div className="skel skel-line l" style={{ marginBottom: 6 }}/>
                <div className="skel skel-line l" style={{ marginBottom: 6 }}/>
                <div className="skel skel-line m"/>
              </div>
            </ScrShell>
            <Tabnav active="home"/>
          </Phone>

          <Phone label="Txn list · loading">
            <ScrShell title="Transactions">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="scr-card" style={{ display: "grid", gridTemplateColumns: "32px 1fr 70px", gap: 10, alignItems: "center" }}>
                  <div className="skel" style={{ width: 28, height: 28, borderRadius: 7 }}/>
                  <div>
                    <div className="skel skel-line m" style={{ marginBottom: 4 }}/>
                    <div className="skel skel-line s"/>
                  </div>
                  <div className="skel skel-line" style={{ width: "100%", height: 12 }}/>
                </div>
              ))}
            </ScrShell>
            <Tabnav active="txn"/>
          </Phone>

          <Phone label="Sync · offline">
            <ScrShell title="Dashboard" eyebrow="OFFLINE — CACHED" back={false}>
              <div className="scr-card" style={{ borderLeft: "3px solid var(--ink)" }}>
                <div className="scr-eyebrow">CONNECTION DROPPED</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>You're working offline. Anything you log queues up — Pip syncs when bars are back.</div>
              </div>
              <div className="scr-card" style={{ opacity: 0.6 }}>
                <div className="scr-eyebrow">PULSE · CACHED 14 MIN AGO</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 36 }}>78</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--coral)" }}/>
                3 PENDING SYNC
              </div>
            </ScrShell>
            <Tabnav active="home"/>
          </Phone>
        </div>
      </div>

      {/* Localization & FX states */}
      <div className="section">
        <div className="section-head"><span className="section-num">04.5</span><h2>Locale, currency &amp; FX states</h2><span className="note">Global-by-default</span></div>
        <div className="grid-3">
          <Phone label="Multi-currency rollup">
            <ScrShell title="Net worth" eyebrow="HOUSEHOLD · USD BASE">
              <div className="scr-card" style={{ textAlign: "center" }}>
                <div className="scr-eyebrow">FAMILY TOTAL</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, marginTop: 4 }}>$28,400</div>
                <div style={{ fontSize: 11, color: "var(--ink-mid)", marginTop: 2 }}>FX synced 8 min ago</div>
              </div>
              <div className="scr-card">
                <div className="scr-eyebrow">BY ACCOUNT</div>
                <div className="txn-row"><div className="txn-ico">🏦</div><div className="txn-meta"><span className="t">Checking · USD</span><span className="s">$4,820</span></div><div className="txn-amt">$4,820</div></div>
                <div className="txn-row"><div className="txn-ico">🏦</div><div className="txn-meta"><span className="t">Savings · EUR</span><span className="s">€11,667 → $12,600</span></div><div className="txn-amt">$12,600</div></div>
                <div className="txn-row"><div className="txn-ico">📈</div><div className="txn-meta"><span className="t">Brokerage · INR</span><span className="s">₹15,33,333 → $18,400</span></div><div className="txn-amt">$18,400</div></div>
              </div>
            </ScrShell>
            <Tabnav active="home"/>
          </Phone>

          <Phone label="FX stale" sublabel="Coral border">
            <ScrShell title="Net worth">
              <div className="scr-card" style={{ borderLeft: "3px solid var(--coral)", background: "var(--coral-tint)" }}>
                <div className="scr-eyebrow" style={{ color: "var(--terracotta)" }}>FX RATES OUT OF DATE</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Last refresh was 26h ago. Foreign-currency totals could be off by a few percent.</div>
                <Btn variant="ghost">Refresh now →</Btn>
              </div>
              <div className="scr-card" style={{ opacity: 0.6 }}>
                <div className="scr-eyebrow">CACHED TOTAL</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>$28,400</div>
              </div>
            </ScrShell>
            <Tabnav active="home"/>
          </Phone>

          <Phone label="RTL — Arabic">
            <div className="scr" dir="rtl">
              <div className="scr-head">
                <span style={{ width: 22 }}/>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div className="scr-eyebrow">أبريل ٢٠٢٦ · AED</div>
                  <div className="scr-title">مرحباً، ليلى</div>
                </div>
                <span className="scr-back">›</span>
              </div>
              <div className="scr-card" style={{ textAlign: "center" }}>
                <div className="scr-eyebrow" style={{ color: "var(--coral)" }}>نبض العائلة</div>
                <div className="pulse-mini" style={{ "--p": 78, margin: "10px auto 6px" }}>
                  <span className="pulse-num">٧٨</span>
                  <span className="pulse-lbl" style={{ direction: "rtl" }}>جيد</span>
                </div>
              </div>
              <div className="scr-card">
                <div className="scr-eyebrow">الميزانية</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, direction: "ltr", textAlign: "right" }}>د.إ ١٬٦٨٠ / د.إ ٢٬٠٠٠</div>
              </div>
            </div>
            <Tabnav active="home"/>
          </Phone>
        </div>
      </div>

      {/* Debt states */}
      <div className="section">
        <div className="section-head"><span className="section-num">04.6</span><h2>Debt states</h2><span className="note">Honest, never shaming</span></div>
        <div className="grid-3">
          <Phone label="Debt empty" sublabel="No debts logged">
            <ScrShell title="Debt">
              <div className="scr-card" style={{ textAlign: "center", padding: 22 }}>
                <Mascot size={56} mood="calm"/>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, marginTop: 10 }}>No debts on the books.</div>
                <p style={{ fontSize: 12, color: "var(--ink-mid)", marginTop: 6 }}>Add anything you owe — credit card, loan, family — and we'll plot the way out.</p>
                <div style={{ marginTop: 12 }}><Btn>+ Add debt</Btn></div>
              </div>
            </ScrShell>
            <Tabnav active="wealth"/>
          </Phone>

          <Phone label="Payoff at risk" sublabel="Schedule slipped">
            <ScrShell title="Debt">
              <div className="scr-card" style={{ borderLeft: "3px solid var(--coral)", background: "var(--coral-tint)" }}>
                <div className="scr-eyebrow" style={{ color: "var(--terracotta)" }}>SCHEDULE SLIPPED</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Credit-card payoff date moved from <b>Aug '27</b> to <b>Dec '27</b>. Adding <b>$60/mo</b> would put you back on track.</div>
                <Btn variant="ghost">Adjust plan →</Btn>
              </div>
              <div className="scr-card">
                <div className="row between"><span style={{ fontSize: 13, fontWeight: 600 }}>💳 Credit card</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>21.9% APR</span></div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 4 }}>$3,850</div>
              </div>
            </ScrShell>
            <Tabnav active="wealth"/>
          </Phone>

          <Phone label="Debt-free moment">
            <ScrShell title="Debt">
              <div className="scr-card" style={{ textAlign: "center", background: "var(--olive)", color: "#fff", borderColor: "var(--olive)" }}>
                <div className="scr-eyebrow" style={{ color: "rgba(255,255,255,0.75)" }}>YOU DID IT</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, marginTop: 6 }}>Debt-free.</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 6 }}>2 years, 4 months. Want to roll the freed-up payment into your emergency fund?</div>
                <div style={{ marginTop: 10 }}><Btn variant="ghost">Yes, redirect →</Btn></div>
              </div>
            </ScrShell>
            <Tabnav active="wealth"/>
          </Phone>
        </div>
      </div>

      {/* Transitions */}
      <div className="section">
        <div className="section-head"><span className="section-num">04.4</span><h2>Screen transitions</h2><span className="note">Six common moves</span></div>
        <div className="grid-2">
          {[
            { name: "Tab → Tab", spec: "Cross-fade · 180ms · ease-out · no slide", note: "Bottom-tab nav: instant, low cognitive cost." },
            { name: "Push (drill-in)", spec: "Slide-from-right · 240ms · spring(0.8, 1.0)", note: "Txn → detail. Back button always visible." },
            { name: "Modal / sheet", spec: "Slide-up + scrim fade · 220ms", note: "Add/edit forms. Tap scrim or swipe-down to dismiss." },
            { name: "Toast", spec: "Drop from top · 180ms · auto-dismiss 3.2s", note: "Save confirmations. Never blocks input." },
            { name: "Pulse score animate", spec: "Number 0→N tick · 1.4s ease-out · ring fills in sync", note: "Runs once per dashboard mount. Skipped on rapid re-entry." },
            { name: "Goal complete", spec: "Bar fills → confetti burst (5 colors) → mascot wow", note: "Total 1.8s. One-shot. Haptic + chime if enabled." },
          ].map((t, i) => (
            <div key={i} className="tile">
              <div className="kicker">{t.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)" }}>{t.spec}</div>
              <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--ink-mid)" }}>{t.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="canvas-foot"><span>FinFlow · Wireframe Exploration</span><span>04 / 07 — States &amp; Transitions</span></div>
  </div>
);

window.PageStates = PageStates;
