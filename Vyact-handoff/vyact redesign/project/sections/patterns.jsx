// Patterns: amounts, transaction rows, charts, modals, pulse, flows, states, motion

const Patterns = {
  Amounts: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="12 / Amount displays"
        title={<>How money <FF.Serif>is set</FF.Serif> on the page.</>}
        lede="Cents de-emphasised in mono, one tier smaller. Hero numbers are serif italic — hand-set, not engineered. Sign before color. Sage for income, ink for expense, terracotta reserved for over-budget or destructive."
        meta="6 patterns"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <FF.Card>
          <FF.Caption>Hero · serif italic</FF.Caption>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 14 }}>
            <span style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 72, lineHeight: 1, fontWeight: 400 }}>$24,108</span>
            <FF.Mono style={{ fontSize: 20, color: 'var(--ff-ink-3)' }}>.74</FF.Mono>
          </div>
          <FF.Caption style={{ marginTop: 10 }}>Net worth · USD</FF.Caption>
        </FF.Card>
        <FF.Card>
          <FF.Caption>KPI · sans 500</FF.Caption>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 14 }}>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"' }}>$3,247</span>
            <FF.Mono style={{ fontSize: 13, color: 'var(--ff-ink-3)' }}>.50</FF.Mono>
          </div>
          <FF.Caption style={{ marginTop: 10 }}>Spending · April</FF.Caption>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Inline · mono</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Tax refund', 245.0], ['Rent · Mateo', -1450.0], ['Con Edison', -94.20], ['Salary', 4200.00]].map(([n, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--ff-ink-2)' }}>{n}</span>
                <FF.Money v={v} />
              </div>
            ))}
          </div>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Multi-currency</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['€1,247.50','EUR','$1,358.20'],['£820.00','GBP','$1,047.10'],['¥45,000','JPY','$298.40'],['₹85,000','INR','$1,020.40']].map(([o, c, k]) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FF.Mono style={{ width: 32, fontSize: 11, color: 'var(--ff-ink-3)' }}>{c}</FF.Mono>
                <span style={{ fontWeight: 500, fontFeatureSettings: '"tnum"', fontSize: 14 }}>{o}</span>
                <span style={{ flex: 1 }} />
                <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)' }}>≈ {k}</FF.Mono>
              </div>
            ))}
          </div>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Privacy mode</FF.Caption>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 40, fontStyle: 'italic', letterSpacing: 6 }}>•••••</div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ff-ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FF.Icon name="eye" size={13} /> Tap to reveal · biometric
            </div>
          </div>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Trend pair</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 28, fontStyle: 'italic', fontWeight: 400 }}>$8,420</span>
            <FF.Badge tone="sage" dot>+5.3%</FF.Badge>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ff-ink-3)' }}>vs last month · $7,996</div>
        </FF.Card>
      </div>
    </div>
  ),

  TransactionRows: () => {
    const Row = ({ d, name, cat, m, v, priv, split, recur }) => (
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 80px 130px', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--ff-line)', fontSize: 13, position: 'relative' }}>
        {priv && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'repeating-linear-gradient(45deg, var(--ff-ink-3) 0 4px, transparent 4px 8px)' }} />}
        <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)' }}>{d}</FF.Mono>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ff-canvas-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {cat === 'Groceries' ? '🛒' : cat === 'Income' ? '💼' : cat === 'Investment' ? '📈' : cat === 'Rent' ? '🏠' : cat === 'Healthcare' ? '💊' : '🎬'}
          </span>
          <span>
            <span style={{ fontWeight: 600, marginRight: 6 }}>{name}</span>
            {priv && <FF.Badge>🔒 priv</FF.Badge>}
            {split && <FF.Badge tone="denim">split · 3</FF.Badge>}
            {recur && <FF.Badge tone="coral">recur</FF.Badge>}
          </span>
        </div>
        <span style={{ color: 'var(--ff-ink-2)' }}>{cat}</span>
        <FF.Mono style={{ color: 'var(--ff-ink-3)', fontSize: 11 }}>{m}</FF.Mono>
        <FF.Money v={v} style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--ff-mono)' }} />
      </div>
    );
    return (
      <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
        <FF.PageHead
          section="13 / Transaction row"
          title={<>The <FF.Serif>atomic unit.</FF.Serif></>}
          lede="Every other surface in FinFlow composes from this row. Category emoji is sacred — the brand's existing icon family. Privacy stripe is a 3px diagonal hatch on the row's leading edge. Inline badges for recurring · private · split."
          meta="5 row variants"
        />
        <FF.Card padding={0}>
          <Row d="Apr 14" name="Whole Foods Market" cat="Groceries" m="Chase ··4291" v={-127.40} />
          <Row d="Apr 13" name="Salary · monthly"     cat="Income"     m="Chase ··4291" v={4200.00} recur />
          <Row d="Apr 12" name="Therapist · Dr. Vega"  cat="Healthcare" m="Apple Card"   v={-180.00} priv />
          <Row d="Apr 11" name="Rent · April"          cat="Rent"       m="Venmo"        v={-1450.00} split />
          <Row d="Apr 10" name="Vanguard VTSAX"        cat="Investment" m="Chase ··4291" v={-500.00} recur />
        </FF.Card>
      </div>
    );
  },

  Charts: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="14 / Charts"
        title={<>Charts wear <FF.Serif>the same suit.</FF.Serif></>}
        lede="Coral for trend lines. Sage for positive bars. Donut categories pull from the semantic palette. Grid lines are dashed warm ink. Hero numbers inside charts stay serif italic. No 3D, no neon, no chart-junk."
        meta="4 chart frames"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FF.Card>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <FF.Caption>Net flow · 12 weeks</FF.Caption>
            <FF.Mono style={{ fontSize: 11, color: 'var(--ff-sage)' }}>+$4,820</FF.Mono>
          </div>
          <svg viewBox="0 0 400 160" style={{ width: '100%', marginTop: 14 }}>
            {[40, 80, 120].map(y => <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="var(--ff-line)" strokeDasharray="2 4" />)}
            <path d="M0 100 L33 90 L66 105 L100 80 L133 88 L166 70 L200 78 L233 60 L266 65 L300 50 L333 55 L366 40 L400 45" fill="none" stroke="var(--ff-coral)" strokeWidth="2" />
            <path d="M0 100 L33 90 L66 105 L100 80 L133 88 L166 70 L200 78 L233 60 L266 65 L300 50 L333 55 L366 40 L400 45 L400 160 L0 160 Z" fill="var(--ff-coral-tint)" opacity="0.7" />
            <circle cx="300" cy="50" r="4" fill="var(--ff-coral)" />
          </svg>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Income · expense · 6 months</FF.Caption>
          <svg viewBox="0 0 400 160" style={{ width: '100%', marginTop: 14 }}>
            {[[4200, 3200], [4200, 2800], [4200, 3700], [4400, 3400], [4400, 3100], [4400, 3247]].map(([inc, exp], i) => {
              const x = 30 + i * 60;
              const incH = (inc / 5000) * 130;
              const expH = (exp / 5000) * 130;
              return (
                <g key={i}>
                  <rect x={x} y={140 - incH} width="20" height={incH} fill="var(--ff-sage)" rx="2" />
                  <rect x={x + 22} y={140 - expH} width="20" height={expH} fill="var(--ff-coral)" rx="2" opacity="0.9" />
                </g>
              );
            })}
            <line x1="0" x2="400" y1="140" y2="140" stroke="var(--ff-line-2)" />
          </svg>
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ff-sage)' }} />Income</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ff-coral)' }} />Expense</span>
          </div>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Spending breakdown</FF.Caption>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 14 }}>
            <svg viewBox="0 0 120 120" width="140" height="140">
              <circle cx="60" cy="60" r="42" fill="none" stroke="var(--ff-canvas-2)" strokeWidth="14" />
              {[[0, 30, 'var(--ff-coral)'], [30, 22, 'var(--ff-denim)'], [52, 18, 'var(--ff-sage)'], [70, 14, 'var(--ff-honey)'], [84, 16, 'var(--ff-plum)']].map(([s, len, c], i) => {
                const r = 42, C = 2 * Math.PI * r;
                return <circle key={i} cx="60" cy="60" r={r} fill="none" stroke={c} strokeWidth="14" strokeDasharray={`${(len/100)*C} ${C}`} strokeDashoffset={-((s/100)*C)} transform="rotate(-90 60 60)" />;
              })}
              <text x="60" y="56" textAnchor="middle" style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 16, fill: 'var(--ff-ink)' }}>$3,247</text>
              <text x="60" y="68" textAnchor="middle" style={{ fontFamily: 'var(--ff-mono)', fontSize: 7, fill: 'var(--ff-ink-3)', letterSpacing: 1.2 }}>APRIL</text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, flex: 1 }}>
              {[['Rent', 30, 'var(--ff-coral)'], ['Groceries', 22, 'var(--ff-denim)'], ['Healthcare', 18, 'var(--ff-sage)'], ['Travel', 14, 'var(--ff-honey)'], ['Other', 16, 'var(--ff-plum)']].map(([n, p, c]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                  <span style={{ color: 'var(--ff-ink-2)', flex: 1 }}>{n}</span>
                  <FF.Mono style={{ color: 'var(--ff-ink-3)', fontSize: 10 }}>{p}%</FF.Mono>
                </div>
              ))}
            </div>
          </div>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Family Pulse Score · breakdown</FF.Caption>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 14 }}>
            <FF.PulseRing score={78} size={132} label="Good" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, flex: 1 }}>
              {[['Budget compliance', 82], ['Savings rate', 71], ['Goal progress', 64], ['Expense trend', 88], ['Debt health', 80]].map(([n, v]) => (
                <div key={n}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-2)' }}>{n}</FF.Mono>
                    <FF.Mono style={{ color: 'var(--ff-ink-2)' }}>{v}</FF.Mono>
                  </div>
                  <div style={{ marginTop: 3, height: 3, background: 'var(--ff-canvas-2)', borderRadius: 2 }}>
                    <div style={{ width: `${v}%`, height: '100%', background: v >= 80 ? 'var(--ff-sage)' : v >= 60 ? 'var(--ff-coral)' : 'var(--ff-honey)', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FF.Card>
      </div>
    </div>
  ),

  Modals: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="15 / Modals · sheets · toasts"
        title={<>Overlays, <FF.Serif>specified.</FF.Serif></>}
        lede="Modals: slide-up + scrim fade · 220ms. Sheets: drag-handle on top, swipe-down to dismiss. Toasts: drop from top, 3.2s auto-dismiss. Destructive uses ink card on cream — not white-on-coral."
        meta="4 patterns"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ position: 'relative', height: 420, background: 'var(--ff-overlay)', borderRadius: 'var(--ff-r-4)', overflow: 'hidden', border: '1px solid var(--ff-line)' }}>
          <div style={{ position: 'absolute', inset: 24, background: 'var(--ff-surface)', borderRadius: 'var(--ff-r-4)', boxShadow: 'var(--ff-shadow-4)', padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <FF.Caption>New transaction</FF.Caption>
                <h3 style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontWeight: 400, fontStyle: 'italic', marginTop: 4 }}>Add an expense</h3>
              </div>
              <FF.Icon name="x" size={16} />
            </div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FF.Input label="Description" placeholder="What did you buy?" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <FF.Input label="Amount" prefix="USD" value="127.40" />
                <FF.Input label="Date" value="2025-04-14" />
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <FF.Button kind="ghost">Cancel</FF.Button>
              <FF.Button kind="primary">Save transaction</FF.Button>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', height: 420, background: 'var(--ff-overlay)', borderRadius: 'var(--ff-r-4)', overflow: 'hidden', border: '1px solid var(--ff-line)' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--ff-surface)', borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: 'var(--ff-shadow-4)', padding: 20 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--ff-line-2)', margin: '0 auto 14px' }} />
            <FF.Caption>Filter transactions</FF.Caption>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[['Type', ['Expense','Income','Transfer']], ['Method', ['Chase ··4291','BofA ··0017','Venmo']]].map(([h, opts]) => (
                <div key={h}>
                  <FF.Caption style={{ marginBottom: 8 }}>{h}</FF.Caption>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {opts.map((o, i) => (
                      <span key={o} style={{ padding: '6px 12px', borderRadius: 'var(--ff-r-pill)', fontSize: 12, fontWeight: 500, background: i === 0 ? 'var(--ff-coral-tint)' : 'var(--ff-canvas-2)', color: i === 0 ? 'var(--ff-coral-deep)' : 'var(--ff-ink-2)', border: `1px solid ${i === 0 ? 'var(--ff-coral-soft)' : 'var(--ff-line)'}` }}>{o}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <FF.Button kind="ghost" full>Clear</FF.Button>
                <FF.Button kind="primary" full>Apply (24)</FF.Button>
              </div>
            </div>
          </div>
        </div>

        <FF.Card>
          <FF.Caption>Toasts · 3.2s auto-dismiss</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--ff-ink)', color: 'var(--ff-canvas)', borderRadius: 'var(--ff-r-3)', fontSize: 13, boxShadow: 'var(--ff-shadow-3)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--ff-sage)' }} />
              Saved · pulse +2
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--ff-honey-tint)', borderRadius: 'var(--ff-r-3)', fontSize: 13, boxShadow: 'var(--ff-shadow-2)', borderLeft: '3px solid var(--ff-honey)' }}>
              <FF.Icon name="wifi" size={14} />
              Working offline · 3 queued
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--ff-coral-tint)', color: 'var(--ff-coral-deep)', borderRadius: 'var(--ff-r-3)', fontSize: 13, boxShadow: 'var(--ff-shadow-2)', borderLeft: '3px solid var(--ff-coral-deep)' }}>
              <FF.Icon name="x" size={14} stroke={2.4} />
              Couldn't reach Chase <span style={{ fontWeight: 600, marginLeft: 4 }}>· Retry</span>
            </div>
          </div>
        </FF.Card>

        <FF.Card style={{ background: 'var(--ff-ink)', color: 'var(--ff-canvas)', borderColor: 'var(--ff-ink)' }}>
          <FF.Caption style={{ color: 'rgba(232,222,207,0.55)' }}>Confirm destructive</FF.Caption>
          <h3 style={{ marginTop: 8, fontFamily: 'var(--ff-serif)', fontSize: 22, fontWeight: 400, fontStyle: 'italic' }}>Delete this transaction?</h3>
          <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(232,222,207,0.8)', lineHeight: 1.55 }}>
            Removes Whole Foods — $127.40 from April. Your Pulse score will recalculate. Can't undo.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <FF.Button kind="ghost" style={{ borderColor: 'rgba(232,222,207,0.3)', color: 'var(--ff-canvas)' }}>Keep</FF.Button>
            <FF.Button kind="destruct">Delete</FF.Button>
          </div>
        </FF.Card>
      </div>
    </div>
  ),

  // ── User flows ──
  Flows: () => {
    const flows = [
      { num: '16.1', title: 'First-run onboarding', happy: ['Open', 'Welcome + Pip', 'Email + name', 'Pick segment', 'Add household', 'Pick goal', 'First txn', 'Dashboard'] },
      { num: '16.2', title: 'Log a transaction',    happy: ['Tap +', 'Amount + desc', 'Smart-cat', 'Confirm', 'Toast + slot-in'] },
      { num: '16.3', title: 'Weekly Pulse review',  happy: ['Open dash', 'Pulse animates', 'Insight chip', 'Drill-in', 'Adjust budget', 'Score updates'] },
      { num: '16.4', title: 'Debt payoff plan',     happy: ['Add debt', 'Pick strategy', 'See schedule', 'Save', 'Log payment', 'Balance ticks'] },
      { num: '16.5', title: 'Localization',         happy: ['Detect locale', 'Pick base currency', 'Optional 2nd ccy', 'App reformats'] },
      { num: '16.6', title: 'Household invite',     happy: ['Settings · Members', '+ Add', 'Pick role', 'Send invite', 'Member joins'] },
    ];
    return (
      <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
        <FF.PageHead
          section="16 / User flows"
          title={<>Six <FF.Serif>rails.</FF.Serif></>}
          lede="The flows the system must accommodate. Happy paths shown — each branches with alt cases (e.g. RTL locale, FX stale, child role, sole-owner-leaves). Full branch tables live in the spec."
          meta="6 primary · 24+ alts"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {flows.map(f => (
            <FF.Card key={f.num}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
                <FF.Mono style={{ fontSize: 11, color: 'var(--ff-coral)' }}>{f.num}</FF.Mono>
                <h3 style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', fontWeight: 400 }}>{f.title}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {f.happy.map((s, i) => (
                  <React.Fragment key={i}>
                    <FF.FlowStep idx={i + 1} tone={i === 0 ? 'start' : i === f.happy.length - 1 ? 'end' : 'mid'}>{s}</FF.FlowStep>
                    {i < f.happy.length - 1 && <FF.Icon name="arrowR" size={14} style={{ color: 'var(--ff-ink-3)' }} />}
                  </React.Fragment>
                ))}
              </div>
            </FF.Card>
          ))}
        </div>
      </div>
    );
  },

  // ── Screen states (empty / error / loading / offline) ──
  States: () => {
    const Tile = ({ kind, title, body, accent = 'coral', pip }) => (
      <FF.Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: 22 }}>
        <FF.Badge tone={accent}>{kind}</FF.Badge>
        {pip && <FF.Pip size={48} mood={pip} />}
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 18, fontStyle: 'italic', fontWeight: 400 }}>{title}</div>
        <p style={{ fontSize: 12.5, color: 'var(--ff-ink-2)', lineHeight: 1.55 }}>{body}</p>
      </FF.Card>
    );
    return (
      <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
        <FF.PageHead
          section="17 / Screen states"
          title={<>Empty, loading, error — <FF.Serif>designed.</FF.Serif></>}
          lede="A finance app lives or dies in its non-happy states. First run is empty. Networks drop. Forms get rejected. Each state below is anchored on the screen it lives on, with Pip's exact recovery copy."
          meta="12 states"
        />

        <FF.Caption style={{ marginBottom: 14 }}>Empty · first-run</FF.Caption>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          <Tile kind="Empty" title={"Hi — I'm Pip."} body="Add your first transaction and I'll start spotting patterns. Promise I'm useful." pip="happy" accent="coral" />
          <Tile kind="Empty" title="No budgets yet" body="Pick a category. We'll suggest a limit from your history — or start blank and tune it." accent="ink" />
          <Tile kind="Empty" title="What are we aiming at?" body="Pick a goal type — emergency fund, savings, debt payoff. I'll track the rest." pip="calm" accent="sage" />
        </div>

        <FF.Caption style={{ marginBottom: 14 }}>Errors · warnings · permission</FF.Caption>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          <Tile kind="Heads up" title="Food's munched 92% of its budget." body="4 days left in the month. Want to look at where it went?" accent="honey" />
          <Tile kind="Error" title="Amount required." body="Enter an amount above $0.01 — even an estimate is fine. You can edit later." accent="coral" />
          <Tile kind="Ask a grown-up" title="Budgets locked." body="Budgets can be edited by Alex or Sam. You can still log your own spend." accent="plum" />
        </div>

        <FF.Caption style={{ marginBottom: 14 }}>Loading · offline · debt-free · stale FX</FF.Caption>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <FF.Card style={{ padding: 22 }}>
            <FF.Badge tone="ink">Loading</FF.Badge>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="ff-skel" style={{ height: 12, width: '30%' }} />
              <div className="ff-skel" style={{ height: 80, width: 80, borderRadius: 40, margin: '6px auto' }} />
              <div className="ff-skel" style={{ height: 10, width: '60%', margin: '0 auto' }} />
              <div className="ff-skel" style={{ height: 8, width: '40%', margin: '0 auto' }} />
            </div>
            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ff-ink-2)' }}>Shimmer · 1.6s · paper-3 → line.</p>
          </FF.Card>
          <Tile kind="Offline" title="You're working offline." body="Anything you log queues up — I'll sync when bars are back." pip="sleep" accent="ink" />
          <FF.Card style={{ padding: 22, background: 'var(--ff-olive)', color: '#fff', borderColor: 'var(--ff-olive)' }}>
            <FF.Caption style={{ color: 'rgba(255,255,255,0.7)' }}>You did it</FF.Caption>
            <div style={{ marginTop: 8, fontFamily: 'var(--ff-serif)', fontSize: 26, fontStyle: 'italic' }}>Debt-free.</div>
            <p style={{ marginTop: 8, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>2 years, 4 months. Want to roll that payment into your emergency fund?</p>
          </FF.Card>
        </div>
      </div>
    );
  },

  // ── Motion specs ──
  Motion: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="18 / Motion"
        title={<>Every touch <FF.Serif>answers back.</FF.Serif></>}
        lede="None of this is decoration. Every motion has a job: confirm input, hint at relationship, reward progress. Easings are warm — never linear. Confetti is one-shot, never ambient."
        meta="9 specs"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[
          ['Button press', 'scale(0.96) · 80ms in · 120ms out · ease-out', 'Universal. Coral primary also brightens 4% on press.'],
          ['Toast drop-in', 'translateY(-12px → 0) + opacity 0→1 · 180ms · spring(0.7, 0.9) · auto-dismiss 3.2s', 'Always top-center. Never overlaps tab bar.'],
          ['Card hover (web)', 'translateY(-2px) + shadow 0→12% · 160ms ease-out', 'Mobile uses press-down 0.98 scale instead.'],
          ['Pulse score reveal', '0 → N tick · 1.4s ease-out · ring fills in sync', 'Runs once per dashboard mount. Skipped on rapid re-entry.'],
          ['Goal complete', 'Bar fills · confetti burst (5 colors) · Pip "wow"', 'Total 1.8s. One-shot. Haptic + chime if enabled.'],
          ['Number ticker', 'Increment frame-by-frame · monospace stable · 60fps', 'Pulse, balance, goal $. Skipped on rapid re-render.'],
          ['Pull-to-refresh', 'Drag 80px → release → spinner · 600ms min · haptic', 'Mobile only. Hides FAB while pulling.'],
          ['Tab switch', 'Cross-fade 180ms · indicator slides + scales (0.85→1)', 'Indicator under-line is the same coral, with subtle shadow.'],
          ['Sheet dismiss', 'Swipe-down > 600px/s OR drag past 30% · 220ms snap', 'Backdrop fades in lock-step. ESC also dismisses on web.'],
        ].map(([n, s, note]) => (
          <FF.Card key={n}>
            <FF.Caption>{n}</FF.Caption>
            <FF.Mono style={{ fontSize: 12, color: 'var(--ff-ink)', marginTop: 8, lineHeight: 1.55, display: 'block' }}>{s}</FF.Mono>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--ff-ink-2)' }}>{note}</p>
          </FF.Card>
        ))}
      </div>
    </div>
  ),
};

Object.assign(window, { Patterns });
