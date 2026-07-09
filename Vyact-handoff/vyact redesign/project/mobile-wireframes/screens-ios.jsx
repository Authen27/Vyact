/* global React, WF */
// FinFlow iOS Wireframes — full app, medium fidelity
// All exported under window.IOS.

const IOS = {};

// ════════════════════════════════════════════════════════════════
// SHARED DATA
// ════════════════════════════════════════════════════════════════
const TXNS = [
  ['🛒', 'Whole Foods Mkt.',  'Food · Apr 27',         -84.20, 'Alex'],
  ['💼', 'Acme Co. payroll',   'Income · Apr 25',       3200,  'Jamie'],
  ['🎬', 'Netflix',            'Entertainment · Apr 24', -15.99,'Shared'],
  ['🚗', 'Uber',               'Transport · Apr 23',     -12.40,'Alex'],
  ['🛒', "Trader Joe's",       'Food · Apr 22',         -62.10, 'Jamie'],
  ['⚡', 'ConEd electric',      'Utilities · Apr 21',    -94.00, 'Shared'],
  ['☕', 'Blue Bottle Coffee', 'Food · Apr 21',          -7.25, 'Alex'],
];

// ════════════════════════════════════════════════════════════════
// ONBOARDING & AUTH
// ════════════════════════════════════════════════════════════════
IOS.Splash = () => (
  <WF.IPhone>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', position: 'relative' }}>
      <WF.Pip size={68} mood="happy"/>
      <div style={{ marginTop: 22, fontFamily: 'var(--ff-serif)', fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
        Money,<br/><em style={{ color: 'var(--ff-coral)', fontStyle: 'italic' }}>together.</em>
      </div>
      <p style={{ marginTop: 14, fontSize: 13.5, color: 'rgba(42,37,34,0.65)', lineHeight: 1.5, maxWidth: 240 }}>
        A calm household ledger for couples, families, and the people who help them along.
      </p>
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 60, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 46, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>Create an account</div>
        <div style={{ height: 44, borderRadius: 12, border: '1px solid rgba(42,37,34,0.16)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 500 }}>I already have one</div>
      </div>
    </div>
  </WF.IPhone>
);

IOS.SignIn = () => (
  <WF.IPhone>
    <WF.IOSNav title="Welcome back" lead={null}/>
    <WF.Scroll>
      <WF.Cap>Step 1 of 2 · Email</WF.Cap>
      <div style={{ marginTop: 4, fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', color: 'var(--ff-coral)' }}>Good to see you.</div>
      <div style={{ marginTop: 14, height: 48, borderRadius: 12, background: '#FBF7EE', border: '1px solid rgba(42,37,34,0.12)', padding: '0 14px', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#2A2522' }}>alex@reyes-household.co</span>
      </div>
      <div style={{ height: 48, borderRadius: 12, background: '#FBF7EE', border: '1px solid rgba(42,37,34,0.12)', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, color: 'rgba(42,37,34,0.5)' }}>•••••••••••</span>
        <span style={{ fontSize: 12, color: 'var(--ff-coral)' }}>Show</span>
      </div>
      <WF.Cap style={{ alignSelf: 'flex-end', color: 'var(--ff-coral)' }}>Forgot password?</WF.Cap>
      <div style={{ marginTop: 8, height: 48, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>Continue</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(42,37,34,0.12)' }}/>
        <WF.Cap>or</WF.Cap>
        <div style={{ flex: 1, height: 1, background: 'rgba(42,37,34,0.12)' }}/>
      </div>
      <div style={{ height: 44, borderRadius: 12, border: '1px solid rgba(42,37,34,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
        <span></span> Continue with Apple
      </div>
      <div style={{ height: 44, borderRadius: 12, border: '1px solid rgba(42,37,34,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 500 }}>
        <span style={{ width: 14, height: 14, background: 'conic-gradient(#4A6FA5, #85A88A, #E8A87C, #4A6FA5)', borderRadius: 7 }}/> Continue with Google
      </div>
      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 11, color: 'rgba(42,37,34,0.55)' }}>
        We use bank-level encryption. <span style={{ color: 'var(--ff-coral)' }}>Learn how →</span>
      </div>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.Biometric = () => (
  <WF.IPhone>
    <WF.IOSNav title="" lead="close"/>
    <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column' }}>
      <WF.Cap>SECURITY · STEP 3 OF 4</WF.Cap>
      <div style={{ marginTop: 8, fontFamily: 'var(--ff-serif)', fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        Use <em style={{ color: 'var(--ff-coral)' }}>Face ID</em> to unlock FinFlow?
      </div>
      <p style={{ marginTop: 10, fontSize: 13, color: 'rgba(42,37,34,0.62)', lineHeight: 1.5 }}>
        Your face never leaves the device. We pair it with a 6-digit PIN as a backup.
      </p>
      <div style={{ margin: '22px auto', width: 130, height: 130, borderRadius: 22, border: '2px dashed var(--ff-coral)', display: 'grid', placeItems: 'center', position: 'relative' }}>
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="var(--ff-coral)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M8 18V12a4 4 0 0 1 4-4h6M52 18V12a4 4 0 0 0-4-4h-6M8 42v6a4 4 0 0 0 4 4h6M52 42v6a4 4 0 0 1-4 4h-6"/>
          <circle cx="22" cy="26" r="1.6" fill="var(--ff-coral)"/>
          <circle cx="38" cy="26" r="1.6" fill="var(--ff-coral)"/>
          <path d="M22 36c2 3 6 4 8 4s6-1 8-4"/>
        </svg>
      </div>
      <WF.Card pad={12} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral-soft)' }}>
        <span style={{ fontSize: 18 }}>🛡️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Bank-grade vault</div>
          <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)' }}>End-to-end encrypted · Secure Enclave</div>
        </div>
      </WF.Card>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 46, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>Enable Face ID</div>
        <div style={{ height: 42, display: 'grid', placeItems: 'center', fontSize: 13, color: 'rgba(42,37,34,0.6)' }}>Use 6-digit PIN instead</div>
      </div>
    </div>
  </WF.IPhone>
);

IOS.Segment = () => (
  <WF.IPhone>
    <WF.IOSNav title="Pick your shape" lead="back"/>
    <WF.Scroll>
      <p style={{ fontSize: 13, color: 'rgba(42,37,34,0.62)', lineHeight: 1.5, marginTop: -4 }}>
        We tune defaults, language, and categories to your household. You can change this later.
      </p>
      {[
        ['Just us two',     'A couple — shared rent, two paychecks, weekend trips.', '👫', true],
        ['Growing family',  'Kids in the picture. Childcare, school, and a bit of chaos.', '🏡', false],
        ['Multi-generational', "Parents or in-laws under the same roof, or you're helping support them.", '🌳', false],
        ['Just me',         'Solo for now. You can invite others later.', '🧍', false],
      ].map(([t, s, ico, sel]) => (
        <WF.Card key={t} pad={14} style={{ borderColor: sel ? 'var(--ff-coral)' : undefined, borderWidth: sel ? 2 : 1, background: sel ? 'var(--ff-coral-tint)' : '#FBF7EE' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24 }}>{ico}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 12, color: 'rgba(42,37,34,0.65)', marginTop: 2, lineHeight: 1.45 }}>{s}</div>
            </div>
            <span style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${sel ? 'var(--ff-coral)' : 'rgba(42,37,34,0.2)'}`, display: 'inline-grid', placeItems: 'center', background: sel ? 'var(--ff-coral)' : 'transparent', color: '#fff', fontSize: 11 }}>{sel ? '✓' : ''}</span>
          </div>
        </WF.Card>
      ))}
      <div style={{ marginTop: 'auto', height: 48, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>Continue</div>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.FirstGoal = () => (
  <WF.IPhone>
    <WF.IOSNav title="" lead="back" trail="Skip"/>
    <WF.Scroll>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <WF.Pip size={36} mood="happy"/>
        <div>
          <WF.Cap>PIP SAYS</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', lineHeight: 1.15, color: 'var(--ff-ink)', marginTop: 2 }}>
            What's the first <span style={{ color: 'var(--ff-coral)' }}>win</span> we'll work on?
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'rgba(42,37,34,0.62)', lineHeight: 1.5, marginTop: 6 }}>
        One small goal. You can add more after the first paycheck lands.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
        {[
          ['🛡️', 'Emergency Fund', '3 mo. of essentials', true],
          ['✈️', 'A trip',          'Vacation savings'],
          ['💍', 'A big thing',     'Wedding, home, car'],
          ['🎓', 'School',          "Kid's or yours"],
          ['📈', 'Retirement',      'Roth or 401(k)'],
          ['🎁', 'Custom',          'Define your own'],
        ].map(([ico, t, s, on]) => (
          <div key={t} style={{
            border: `1.5px solid ${on ? 'var(--ff-coral)' : 'rgba(42,37,34,0.12)'}`,
            background: on ? 'var(--ff-coral-tint)' : '#FBF7EE',
            borderRadius: 14, padding: 12,
          }}>
            <div style={{ fontSize: 20 }}>{ico}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{t}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(42,37,34,0.6)', marginTop: 1 }}>{s}</div>
          </div>
        ))}
      </div>
      <WF.Card pad={12} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <WF.Cap>SUGGESTED TARGET</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 24, marginTop: 2 }}>$6,000</div>
          <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)' }}>Based on a household of 2 · adjust later</div>
        </div>
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--ff-coral)', fontWeight: 600 }}>Edit</span>
      </WF.Card>
      <div style={{ marginTop: 'auto', height: 48, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>Set goal & continue</div>
    </WF.Scroll>
  </WF.IPhone>
);

// ════════════════════════════════════════════════════════════════
// MAIN TABS
// ════════════════════════════════════════════════════════════════
IOS.Home = () => (
  <WF.IPhone>
    <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <WF.Cap>APR · USD</WF.Cap>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 1 }}>Hi, Alex</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ width: 30, height: 30, borderRadius: 15, background: 'rgba(42,37,34,0.06)', display: 'inline-grid', placeItems: 'center', fontSize: 13 }}>🔔</span>
        <span style={{ width: 30, height: 30, borderRadius: 15, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>AR</span>
      </div>
    </div>
    <WF.Scroll pad="2px 14px 14px">
      {/* Pulse hero */}
      <WF.Card pad={16} style={{ background: '#FBF7EE', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 78, height: 78, flexShrink: 0 }}>
          <svg width="78" height="78" viewBox="0 0 78 78">
            <circle cx="39" cy="39" r="32" fill="none" stroke="rgba(42,37,34,0.08)" strokeWidth="6"/>
            <circle cx="39" cy="39" r="32" fill="none" stroke="var(--ff-coral)" strokeWidth="6" strokeDasharray={`${(78/100)*201} 999`} strokeLinecap="round" transform="rotate(-90 39 39)"/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 24, fontWeight: 500 }}>78</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <WF.Cap color="var(--ff-coral)">FAMILY PULSE · GOOD</WF.Cap>
          <div style={{ fontSize: 13, lineHeight: 1.4, marginTop: 3 }}>Up <b>+4</b> vs March. Food's a touch hot — manageable.</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '3px 8px', background: 'var(--ff-sage-tint)', color: 'var(--ff-olive)', borderRadius: 99, fontFamily: 'var(--ff-mono)', fontSize: 9.5 }}>↑ TREND OK</div>
        </div>
      </WF.Card>

      {/* Snapshot tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <WF.Card pad={12}>
          <WF.Cap>NET WORTH</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 2 }}>$28.4k</div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-olive)', marginTop: 1 }}>↑ $840 30d</div>
        </WF.Card>
        <WF.Card pad={12}>
          <WF.Cap>DEBT</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 2 }}>$12.3k</div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-coral)', marginTop: 1 }}>3 active · 2.4 yr</div>
        </WF.Card>
      </div>

      {/* Pip nudge */}
      <WF.Card pad={12} accent style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--ff-coral-tint)' }}>
        <WF.Pip size={28}/>
        <div style={{ fontSize: 12.5, lineHeight: 1.4, flex: 1 }}>
          <b>Date-night fund</b> hit 60% this week. Wanna nudge it +$25?
        </div>
        <span style={{ fontSize: 18, color: 'var(--ff-coral)' }}>›</span>
      </WF.Card>

      {/* Budgets compact */}
      <WF.Card pad={14}>
        <WF.SectionHead right="3 active →">BUDGETS</WF.SectionHead>
        {[['Food', 84, 'var(--ff-honey)'], ['Transport', 42, 'var(--ff-coral)'], ['Shopping', 68, 'var(--ff-coral)']].map(([n, p, c]) => (
          <div key={n} style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
              <span>{n}</span><span>{p}%</span>
            </div>
            <WF.Bar pct={p} color={c}/>
          </div>
        ))}
      </WF.Card>

      {/* Recent */}
      <WF.Card pad={12}>
        <WF.SectionHead right="VIEW ALL →">RECENT</WF.SectionHead>
        {TXNS.slice(0, 3).map((t, i, a) => (
          <WF.Row key={i} icon={t[0]} title={t[1]} sub={t[2]} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last={i === a.length - 1}/>
        ))}
      </WF.Card>
    </WF.Scroll>
    <WF.IOSFab/>
    <WF.IOSTabs active="home"/>
  </WF.IPhone>
);

IOS.Txns = () => (
  <WF.IPhone>
    <WF.IOSNav title="Transactions" lead={null} trail="⌄"/>
    <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6 }}>
      <div style={{ flex: 1, height: 34, borderRadius: 10, background: 'rgba(42,37,34,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, fontSize: 13, color: 'rgba(42,37,34,0.5)' }}>
        <span>⌕</span> Search
      </div>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(42,37,34,0.06)', display: 'inline-grid', placeItems: 'center', fontSize: 13 }}>⚙</div>
    </div>
    <div style={{ padding: '0 16px 6px', display: 'flex', gap: 6, overflow: 'hidden' }}>
      {[['All', true], ['Food'], ['Income'], ['Transport'], ['Shared']].map(([l, on]) => (
        <span key={l} style={{ flexShrink: 0, height: 28, padding: '0 12px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 500, background: on ? 'var(--ff-ink)' : '#FBF7EE', color: on ? '#FBF7EE' : '#2A2522', border: on ? 'none' : '1px solid rgba(42,37,34,0.12)' }}>{l}</span>
      ))}
    </div>
    <WF.Scroll pad="2px 14px 14px">
      <WF.Card pad={12}>
        <WF.Cap style={{ marginBottom: 4 }}>TODAY · APR 27</WF.Cap>
        {TXNS.slice(0, 1).map((t, i) => (
          <WF.Row key={i} icon={t[0]} title={t[1]} sub={`${t[2].split(' · ')[0]} · ${t[4]}`} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last/>
        ))}
      </WF.Card>
      <WF.Card pad={12}>
        <WF.Cap style={{ marginBottom: 4 }}>THIS WEEK</WF.Cap>
        {TXNS.slice(1, 5).map((t, i, a) => (
          <WF.Row key={i} icon={t[0]} title={t[1]} sub={`${t[2].split(' · ')[0]} · ${t[4]}`} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last={i === a.length - 1}/>
        ))}
      </WF.Card>
      <WF.Card pad={12}>
        <WF.Cap style={{ marginBottom: 4 }}>LAST WEEK</WF.Cap>
        {TXNS.slice(5).map((t, i, a) => (
          <WF.Row key={i} icon={t[0]} title={t[1]} sub={`${t[2].split(' · ')[0]} · ${t[4]}`} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last={i === a.length - 1}/>
        ))}
      </WF.Card>
    </WF.Scroll>
    <WF.IOSFab/>
    <WF.IOSTabs active="activity"/>
  </WF.IPhone>
);

IOS.Budgets = () => (
  <WF.IPhone>
    <WF.IOSNav title="Money" lead={null} trail="+ Add"/>
    <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflow: 'hidden' }}>
      {[['Net Worth'], ['Budgets', true], ['Goals'], ['Debts']].map(([l, on]) => (
        <span key={l} style={{ flexShrink: 0, height: 28, padding: '0 12px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 500, background: on ? 'var(--ff-ink)' : '#FBF7EE', color: on ? '#FBF7EE' : '#2A2522', border: on ? 'none' : '1px solid rgba(42,37,34,0.12)' }}>{l}</span>
      ))}
    </div>
    <WF.Scroll>
      <WF.Card pad={14}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <WF.Cap>APR · TOTAL SPEND</WF.Cap>
          <WF.Cap color="var(--ff-coral)">68% USED</WF.Cap>
        </div>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 28, marginTop: 4 }}>$1,360 <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'rgba(42,37,34,0.5)' }}>/ $2,000</span></div>
        <WF.Bar pct={68} color="var(--ff-coral)"/>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)', marginTop: 6 }}>
          <span>$640 left</span><span>3 days to month-end</span>
        </div>
      </WF.Card>

      {[
        ['🛒', 'Food',          420, 500, 'var(--ff-honey)'],
        ['🚗', 'Transport',      84, 200, 'var(--ff-coral)'],
        ['🛍', 'Shopping',      204, 300, 'var(--ff-coral)'],
        ['⚡', 'Utilities',     118, 200, 'var(--ff-olive)'],
        ['🎬', 'Entertainment', 64, 150, 'var(--ff-denim)'],
      ].map(([ico, name, spent, lim, c]) => {
        const pct = Math.round((spent / lim) * 100);
        return (
          <WF.Card key={name} pad={12}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ico} {name}</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'rgba(42,37,34,0.6)' }}>{WF.money(spent)} / {WF.money(lim)}</div>
            </div>
            <div style={{ marginTop: 6 }}><WF.Bar pct={pct} color={c}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(42,37,34,0.55)' }}>
              <span>{pct}% used</span>
              <span style={{ color: pct > 80 ? 'var(--ff-coral)' : pct > 60 ? '#A06A2C' : 'var(--ff-olive)' }}>{pct > 80 ? 'Tight' : pct > 60 ? 'Watch' : 'On track'}</span>
            </div>
          </WF.Card>
        );
      })}
    </WF.Scroll>
    <WF.IOSTabs active="money"/>
  </WF.IPhone>
);

IOS.Goals = () => (
  <WF.IPhone>
    <WF.IOSNav title="Money" lead={null} trail="+ New"/>
    <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflow: 'hidden' }}>
      {[['Net Worth'], ['Budgets'], ['Goals', true], ['Debts']].map(([l, on]) => (
        <span key={l} style={{ flexShrink: 0, height: 28, padding: '0 12px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 500, background: on ? 'var(--ff-ink)' : '#FBF7EE', color: on ? '#FBF7EE' : '#2A2522', border: on ? 'none' : '1px solid rgba(42,37,34,0.12)' }}>{l}</span>
      ))}
    </div>
    <WF.Scroll>
      {[
        ['🛡️', 'Emergency Fund',    4200, 6000, 'var(--ff-olive)', '8 mo. to go', false],
        ['✈️', 'Kyoto 2026',          1850, 4000, 'var(--ff-coral)', 'Hit by Sep', false],
        ['📈', 'Roth IRA · 2026',     4800, 7000, 'var(--ff-denim)', 'On pace', false],
        ['💍', 'Wedding · Aug',       8400, 12000,'var(--ff-plum)',  '4 mo. left', false],
        ['🎉', 'Date-night fund',     150,  250,  'var(--ff-coral)', '60% — Pip flagged', true],
      ].map(([ico, name, cur, tgt, c, sub, hot]) => {
        const pct = Math.round((cur / tgt) * 100);
        return (
          <WF.Card key={name} pad={14} accent={hot}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{ico} {name}</div>
              <WF.Cap color={hot ? 'var(--ff-coral)' : undefined}>{pct}%</WF.Cap>
            </div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 20, marginTop: 4 }}>
              {WF.money(cur)} <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'rgba(42,37,34,0.55)' }}>/ {WF.money(tgt)}</span>
            </div>
            <div style={{ marginTop: 8 }}><WF.Bar pct={pct} color={c}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)' }}>
              <span>{sub}</span><span style={{ color: 'var(--ff-coral)' }}>+ Log progress</span>
            </div>
          </WF.Card>
        );
      })}
    </WF.Scroll>
    <WF.IOSTabs active="money"/>
  </WF.IPhone>
);

IOS.Wealth = () => (
  <WF.IPhone>
    <WF.IOSNav title="Money" lead={null} trail="·"/>
    <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflow: 'hidden' }}>
      {[['Net Worth', true], ['Budgets'], ['Goals'], ['Debts']].map(([l, on]) => (
        <span key={l} style={{ flexShrink: 0, height: 28, padding: '0 12px', borderRadius: 14, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 500, background: on ? 'var(--ff-ink)' : '#FBF7EE', color: on ? '#FBF7EE' : '#2A2522', border: on ? 'none' : '1px solid rgba(42,37,34,0.12)' }}>{l}</span>
      ))}
    </div>
    <WF.Scroll>
      <WF.Card pad={16} style={{ textAlign: 'center' }}>
        <WF.Cap>NET WORTH · APR 28, 2026</WF.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', marginTop: 4 }}>
          $28,400<span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: 'rgba(42,37,34,0.5)' }}>.18</span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', background: 'var(--ff-sage-tint)', color: 'var(--ff-olive)', borderRadius: 99, fontSize: 11, fontWeight: 500 }}>
          ↑ +$840 last 30 days
        </div>
        <div style={{ marginTop: 10 }}><WF.Spark w={272} h={42}/></div>
      </WF.Card>

      <WF.Card pad={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <WF.Cap>ASSETS VS LIABILITIES</WF.Cap>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)' }}>D/A 30%</span>
        </div>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'rgba(42,37,34,0.06)', marginTop: 8 }}>
          <div style={{ width: '70%', background: 'var(--ff-olive)' }}/>
          <div style={{ width: '30%', background: 'var(--ff-coral)' }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
          <span style={{ color: 'var(--ff-olive)' }}>● Assets $40.7k</span>
          <span style={{ color: 'var(--ff-coral)' }}>● Liabilities $12.3k</span>
        </div>
      </WF.Card>

      <WF.Card pad={12}>
        <WF.SectionHead right="DETAIL →">ASSETS · $40,700</WF.SectionHead>
        {[['🏦', 'Checking · Chase', 4820], ['💰', 'HYSA · Marcus', 12600], ['📈', 'Brokerage', 18400], ['🪙', 'Roth IRA', 4800]].map(([i, n, v], idx, a) => (
          <WF.Row key={n} icon={i} title={n} value={WF.money(v)} valTone="pos" chev={false} last={idx === a.length - 1}/>
        ))}
      </WF.Card>

      <WF.Card pad={12} accent>
        <WF.SectionHead right="MANAGE →">LIABILITIES · $12,350</WF.SectionHead>
        {[['💳', 'Apple Card', 3850, '21.9% APR'], ['🎓', 'Student loan', 6500, '5.8% APR'], ['🚗', 'Auto loan', 2000, '7.2% APR']].map(([i, n, v, s], idx, a) => (
          <WF.Row key={n} icon={i} title={n} sub={s} value={WF.money(v)} chev={true} last={idx === a.length - 1}/>
        ))}
      </WF.Card>
    </WF.Scroll>
    <WF.IOSTabs active="money"/>
  </WF.IPhone>
);

// ════════════════════════════════════════════════════════════════
// DETAIL / FLOW SCREENS
// ════════════════════════════════════════════════════════════════
IOS.AddTxn = () => (
  <WF.IPhone>
    <WF.IOSNav title="" lead="close" trail="Save"/>
    <div style={{ padding: '0 16px 8px' }}>
      <WF.Cap>NEW TRANSACTION · APR 27</WF.Cap>
      <div style={{ display: 'flex', background: 'rgba(42,37,34,0.06)', borderRadius: 10, padding: 3, marginTop: 8 }}>
        {[['Expense', true], ['Income'], ['Transfer']].map(([l, on]) => (
          <div key={l} style={{ flex: 1, padding: 7, borderRadius: 8, background: on ? '#FBF7EE' : 'transparent', textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.08em', color: on ? 'var(--ff-coral-deep)' : 'rgba(42,37,34,0.55)', fontWeight: on ? 600 : 500, textTransform: 'uppercase' }}>{l}</div>
        ))}
      </div>
    </div>
    <div style={{ padding: '14px 16px 0' }}>
      <WF.Card pad={16}>
        <WF.Cap>AMOUNT · USD</WF.Cap>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
          <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 28, color: 'rgba(42,37,34,0.5)' }}>$</span>
          <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 44, fontWeight: 400, letterSpacing: '-0.02em' }}>84.20</span>
        </div>
      </WF.Card>
      <WF.Card pad={12} style={{ marginTop: 8 }}>
        <WF.Cap>DESCRIPTION</WF.Cap>
        <div style={{ fontSize: 15, marginTop: 4 }}>Whole Foods Mkt.</div>
      </WF.Card>
      <WF.Card pad={12} accent style={{ marginTop: 8, background: 'var(--ff-coral-tint)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <WF.Pip size={22}/>
          <WF.Cap color="var(--ff-coral-deep)">PIP SUGGESTS</WF.Cap>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[['🛒 Food', true], ['🏡 Household'], ['🎁 Gifts']].map(([l, on]) => (
            <span key={l} style={{ height: 26, padding: '0 10px', borderRadius: 13, display: 'inline-flex', alignItems: 'center', fontSize: 11.5, background: on ? 'var(--ff-coral)' : '#FBF7EE', color: on ? '#fff' : '#2A2522', border: on ? 'none' : '1px solid rgba(42,37,34,0.12)', fontWeight: 500 }}>{l}</span>
          ))}
        </div>
      </WF.Card>
      <WF.Card pad={0} style={{ marginTop: 8 }}>
        <WF.Row icon="👤" title="Paid by" value="Alex" valTone="" chev/>
        <WF.Row icon="🔁" title="Recurring" value="Off" chev/>
        <WF.Row icon="📝" title="Note" sub="optional" chev last/>
      </WF.Card>
    </div>
    {/* mock keyboard */}
    <div style={{ marginTop: 'auto', background: '#D9D2C2', padding: '8px 4px 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
        <div key={k} style={{ height: 36, borderRadius: 8, background: k === '⌫' ? 'transparent' : '#FBF7EE', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 400, color: '#2A2522' }}>{k}</div>
      ))}
    </div>
  </WF.IPhone>
);

IOS.TxnDetail = () => (
  <WF.IPhone>
    <WF.IOSNav title="" lead="back" trail="Edit"/>
    <WF.Scroll>
      <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ff-coral-tint)', margin: '0 auto', display: 'grid', placeItems: 'center', fontSize: 26 }}>🛒</div>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 32, marginTop: 12 }}>−$84.20</div>
        <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>Whole Foods Mkt.</div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)', marginTop: 4, letterSpacing: '0.12em' }}>APR 27, 2026 · 4:18 PM · USD</div>
      </div>
      <WF.Card pad={0}>
        <WF.Row icon="🏷️" title="Category" value="Food"/>
        <WF.Row icon="👤" title="Paid by" value="Alex"/>
        <WF.Row icon="📊" title="Budget impact" value="Food 84%" valTone="neg"/>
        <WF.Row icon="📍" title="Location" sub="Union Sq, NYC" last chev={false}/>
      </WF.Card>
      <WF.Card pad={12}>
        <WF.Cap>SHARED WITH</WF.Cap>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {['AR', 'JM'].map(i => (
            <span key={i} style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--ff-coral)', color: '#fff', fontSize: 10, fontWeight: 600, display: 'inline-grid', placeItems: 'center' }}>{i}</span>
          ))}
          <span style={{ height: 28, padding: '0 10px', borderRadius: 14, border: '1px dashed rgba(42,37,34,0.25)', display: 'inline-flex', alignItems: 'center', fontSize: 11, color: 'rgba(42,37,34,0.55)' }}>+ Split</span>
        </div>
      </WF.Card>
      <WF.Card pad={12}>
        <WF.Cap>NOTE</WF.Cap>
        <p style={{ fontSize: 13, marginTop: 4, color: 'rgba(42,37,34,0.85)', lineHeight: 1.45 }}>Weekly groceries + the wine for Saturday's dinner with R+M.</p>
      </WF.Card>
      <div style={{ height: 44, borderRadius: 12, border: '1px solid var(--ff-coral-deep)', color: 'var(--ff-coral-deep)', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>Delete transaction</div>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.DebtStrategy = () => (
  <WF.IPhone>
    <WF.IOSNav title="Pay off debt" lead="back"/>
    <WF.Scroll>
      <WF.Card pad={16} style={{ background: '#1F1B17', borderColor: '#1F1B17', color: '#E8DECF', textAlign: 'center' }}>
        <WF.Cap color="rgba(232,222,207,0.6)">TOTAL · USD</WF.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 32, marginTop: 4 }}>$12,350</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6, fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(232,222,207,0.55)', letterSpacing: '0.1em' }}>
          <span>MIN $495/MO</span><span>·</span><span>FREE IN 28 MO</span>
        </div>
      </WF.Card>

      <WF.Card pad={14}>
        <WF.Cap>PAYOFF STRATEGY</WF.Cap>
        <div style={{ display: 'flex', background: 'rgba(42,37,34,0.06)', borderRadius: 10, padding: 3, marginTop: 8 }}>
          {[['Avalanche', true], ['Snowball'], ['Custom']].map(([l, on]) => (
            <div key={l} style={{ flex: 1, padding: 8, textAlign: 'center', borderRadius: 8, background: on ? 'var(--ff-coral-tint)' : 'transparent', color: on ? 'var(--ff-coral-deep)' : 'rgba(42,37,34,0.55)', fontFamily: 'var(--ff-mono)', fontSize: 9.5, fontWeight: on ? 600 : 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{l}</div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'rgba(42,37,34,0.65)', lineHeight: 1.5, marginTop: 10 }}>
          Highest <b>APR</b> first — minimum interest paid. <b style={{ color: '#2A2522' }}>Mathematically optimal.</b> Saves <b style={{ color: 'var(--ff-olive)' }}>$340</b> vs. Snowball.
        </p>
      </WF.Card>

      {[
        { ico: '💳', name: 'Apple Card',     balance: 3850, apr: 21.9, paid: 1150, total: 5000, target: true },
        { ico: '🎓', name: 'Student loan',   balance: 6500, apr: 5.8,  paid: 3500, total: 10000 },
        { ico: '🚗', name: 'Auto loan',      balance: 2000, apr: 7.2,  paid: 4000, total: 6000 },
      ].map(d => {
        const pct = Math.round((d.paid / d.total) * 100);
        return (
          <WF.Card key={d.name} pad={12} accent={d.target}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                {d.ico} {d.name}
                {d.target && <span style={{ marginLeft: 8, fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--ff-coral)', letterSpacing: '0.1em' }}>NEXT TARGET</span>}
              </div>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)' }}>{d.apr}% APR</span>
            </div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 20, marginTop: 4 }}>{WF.money(d.balance)}</div>
            <div style={{ marginTop: 8 }}><WF.Bar pct={pct} color="var(--ff-olive)"/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(42,37,34,0.55)' }}>
              <span>Paid {WF.money(d.paid, { abbrev: true })} of {WF.money(d.total, { abbrev: true })}</span>
              <span>{pct}%</span>
            </div>
          </WF.Card>
        );
      })}

      <div style={{ height: 46, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>+ Log a payment</div>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.AddDebt = () => (
  <WF.IPhone>
    <WF.IOSNav title="Add a debt" lead="close" trail="Save"/>
    <WF.Scroll>
      <WF.Cap>TYPE</WF.Cap>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {[['💳', 'Card', true], ['🎓', 'Loan'], ['🚗', 'Auto'], ['🏠', 'Mort.']].map(([i, l, on]) => (
          <div key={l} style={{ borderRadius: 10, border: `1.5px solid ${on ? 'var(--ff-coral)' : 'rgba(42,37,34,0.12)'}`, background: on ? 'var(--ff-coral-tint)' : '#FBF7EE', padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>{i}</div>
            <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
      {[
        ['NICKNAME', 'Apple Card · main'],
        ['CURRENT BALANCE', '$3,850.00'],
        ['INTEREST RATE (APR)', '21.9%'],
        ['MINIMUM PAYMENT', '$95 / month'],
        ['PAYMENT DATE', '15th'],
      ].map(([l, v]) => (
        <div key={l}>
          <WF.Cap>{l}</WF.Cap>
          <div style={{ marginTop: 4, height: 42, borderRadius: 10, background: '#FBF7EE', border: '1px solid rgba(42,37,34,0.12)', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 14 }}>{v}</div>
        </div>
      ))}
      <WF.Card pad={12} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Variable rate</div>
          <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)' }}>We'll prompt you when the next reset is due.</div>
        </div>
        <span style={{ width: 38, height: 22, borderRadius: 11, background: 'rgba(42,37,34,0.16)', display: 'inline-flex', alignItems: 'center', padding: 2 }}>
          <span style={{ width: 18, height: 18, borderRadius: 9, background: '#FBF7EE' }}/>
        </span>
      </WF.Card>
    </WF.Scroll>
  </WF.IPhone>
);

// ════════════════════════════════════════════════════════════════
// SETTINGS / SECURITY / STATES
// ════════════════════════════════════════════════════════════════
IOS.Profile = () => (
  <WF.IPhone>
    <WF.IOSNav title="Settings" lead={null}/>
    <WF.Scroll>
      <WF.Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--ff-coral)', color: '#fff', fontSize: 16, fontWeight: 600, display: 'inline-grid', placeItems: 'center' }}>AR</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Alex Reyes</div>
          <div style={{ fontSize: 11.5, color: 'rgba(42,37,34,0.6)' }}>Reyes Household · Primary</div>
        </div>
        <span style={{ height: 22, padding: '0 9px', borderRadius: 11, background: 'var(--ff-coral-tint)', color: 'var(--ff-coral-deep)', fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center' }}>SEED · FREE</span>
      </WF.Card>

      <WF.Card pad={12} accent style={{ background: 'var(--ff-coral-tint)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <WF.Pip size={28} mood="wow"/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Unlock Family</div>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)', lineHeight: 1.4 }}>Bank link, unlimited members, multi-currency — $18/mo</div>
          </div>
          <span style={{ height: 30, padding: '0 12px', borderRadius: 8, background: 'var(--ff-coral)', color: '#fff', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>Try free</span>
        </div>
      </WF.Card>

      <WF.SectionHead>HOUSEHOLD</WF.SectionHead>
      <WF.Card pad={0}>
        <WF.Row icon="👥" title="Members" sub="3 people · Alex, Jamie, Mia"/>
        <WF.Row icon="🏷️" title="Categories"/>
        <WF.Row icon="📅" title="Pay cycle" value="Monthly"/>
        <WF.Row icon="🌐" title="Locale & currency" value="en-US · USD" last/>
      </WF.Card>

      <WF.SectionHead>SECURITY</WF.SectionHead>
      <WF.Card pad={0}>
        <WF.Row icon="🔒" title="Face ID & PIN" value="On" valTone="pos"/>
        <WF.Row icon="🛡️" title="Two-factor" value="SMS"/>
        <WF.Row icon="🔑" title="Connected sessions" value="2 devices"/>
        <WF.Row icon="📥" title="Export & data" last/>
      </WF.Card>

      <WF.SectionHead>HELP</WF.SectionHead>
      <WF.Card pad={0}>
        <WF.Row icon="❓" title="Ask Pip" sub="In-app help"/>
        <WF.Row icon="📨" title="Contact support"/>
        <WF.Row icon="📜" title="Privacy & terms" last/>
      </WF.Card>

      <div style={{ textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.5)', marginTop: 6 }}>FINFLOW · v1.0.4 (build 318) · iOS 26</div>
    </WF.Scroll>
    <WF.IOSTabs active="you"/>
  </WF.IPhone>
);

IOS.Members = () => (
  <WF.IPhone>
    <WF.IOSNav title="Household" lead="back" trail="+ Invite"/>
    <WF.Scroll>
      <WF.Card pad={12} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <WF.Cap>REYES HOUSEHOLD · USD</WF.Cap>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>3 members · 1 pending</div>
        </div>
        <span style={{ height: 22, padding: '0 8px', borderRadius: 11, background: 'var(--ff-canvas-2)', fontFamily: 'var(--ff-mono)', fontSize: 9.5, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center' }}>SEED 3 / 3</span>
      </WF.Card>

      {[
        ['Alex Reyes',    'alex@reyes-household.co',  'Primary',   'AR', 'var(--ff-coral)',     true],
        ['Jamie Reyes',   'jamie@reyes-household.co', 'Partner',   'JR', 'var(--ff-denim)',     false],
        ['Mia Reyes',     '12 yrs · learning mode',   'Child',     'MR', 'var(--ff-honey)',     false],
        ['Patel & Dad',   "Helping w/ Dad's bills",   'Elder · view', 'PD', 'var(--ff-plum)',  false],
      ].map(([n, e, r, i, c, you], idx) => (
        <WF.Card key={n} pad={12} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: c, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 11.5, fontWeight: 600 }}>{i}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n}{you && <span style={{ marginLeft: 6, fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--ff-coral)', letterSpacing: '0.1em' }}>YOU</span>}</div>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e}</div>
          </div>
          <span style={{ height: 22, padding: '0 8px', borderRadius: 11, background: 'rgba(42,37,34,0.06)', fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center' }}>{r.toUpperCase()}</span>
        </WF.Card>
      ))}

      <WF.Card pad={12} style={{ background: 'rgba(42,37,34,0.04)', borderStyle: 'dashed' }}>
        <WF.Cap>PENDING INVITE · SENT TUES</WF.Cap>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>noah@…edu</div>
          <span style={{ fontSize: 12, color: 'var(--ff-coral)', fontWeight: 600 }}>Resend</span>
        </div>
      </WF.Card>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.LinkedAccounts = () => (
  <WF.IPhone>
    <WF.IOSNav title="Linked accounts" lead="back"/>
    <WF.Scroll>
      <WF.Card pad={14} style={{ background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral-soft)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Read-only & encrypted</div>
            <div style={{ fontSize: 11.5, color: 'rgba(42,37,34,0.7)', lineHeight: 1.45, marginTop: 3 }}>
              FinFlow uses your bank's own OAuth — we never see your password. You can revoke access anytime.
            </div>
          </div>
        </div>
      </WF.Card>

      <WF.SectionHead right="STATUS">CONNECTED · 3</WF.SectionHead>
      {[
        ['🏦', 'Chase',           '··6204 · Checking',  'Synced 2 min ago', 'ok'],
        ['🏦', 'Marcus by GS',    '··0218 · HYSA',      'Synced 6 min ago', 'ok'],
        ['💳', 'Apple Card',      '··0091',             'Reconnect needed', 'warn'],
      ].map(([i, n, sub, st, tone], idx, a) => (
        <WF.Card key={n} pad={12}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(42,37,34,0.06)', display: 'inline-grid', placeItems: 'center', fontSize: 17 }}>{i}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n}</div>
              <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)', fontFamily: 'var(--ff-mono)' }}>{sub}</div>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99,
              background: tone === 'ok' ? 'var(--ff-sage-tint)' : 'var(--ff-honey-tint)',
              color: tone === 'ok' ? 'var(--ff-olive)' : '#A06A2C',
              fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.08em',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }}/>{st}
            </span>
          </div>
        </WF.Card>
      ))}

      <WF.SectionHead>ADD ANOTHER</WF.SectionHead>
      <WF.Card pad={12}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, border: '1px dashed rgba(42,37,34,0.25)', display: 'inline-grid', placeItems: 'center', fontSize: 18, color: 'var(--ff-coral)' }}>+</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Connect a bank or card</div>
            <div style={{ fontSize: 11.5, color: 'rgba(42,37,34,0.6)' }}>12,000+ U.S. institutions · powered by Plaid</div>
          </div>
          <span style={{ fontSize: 18, color: 'rgba(42,37,34,0.4)' }}>›</span>
        </div>
      </WF.Card>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.Security = () => (
  <WF.IPhone>
    <WF.IOSNav title="Security" lead="back"/>
    <WF.Scroll>
      <WF.Card pad={14} style={{ textAlign: 'center', background: '#1F1B17', borderColor: '#1F1B17', color: '#E8DECF' }}>
        <WF.Cap color="rgba(232,222,207,0.6)">VAULT STATUS</WF.Cap>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--ff-coral)' }}/>)}
        </div>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 18, marginTop: 8 }}>4 of 4 protections active</div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(232,222,207,0.55)', letterSpacing: '0.1em', marginTop: 3 }}>FACE ID · PIN · 2FA · ENCRYPTION</div>
      </WF.Card>

      <WF.SectionHead>SIGN-IN</WF.SectionHead>
      <WF.Card pad={0}>
        <WF.Row icon="👁" title="Face ID" sub="Used to unlock the app" value="On" valTone="pos" chev={false}/>
        <WF.Row icon="•••" title="6-digit PIN" value="Set" valTone="pos" chev={false}/>
        <WF.Row icon="🔁" title="Auto-lock" value="After 1 minute"/>
        <WF.Row icon="📱" title="Lock when backgrounded" value="On" last chev={false}/>
      </WF.Card>

      <WF.SectionHead>TWO-FACTOR</WF.SectionHead>
      <WF.Card pad={0}>
        <WF.Row icon="📨" title="SMS to ···(415) ··· 8821" value="Primary" valTone="pos" chev={false}/>
        <WF.Row icon="🔐" title="Authenticator app" value="Add"/>
        <WF.Row icon="🗝" title="Backup codes" sub="Generated Mar 12" last/>
      </WF.Card>

      <WF.SectionHead>ACTIVITY</WF.SectionHead>
      <WF.Card pad={0}>
        <WF.Row icon="✅" title="iPhone 16 · NYC" sub="Now · this device" chev={false}/>
        <WF.Row icon="💻" title="Safari · MacBook" sub="2 hr ago · home"/>
        <WF.Row icon="❓" title="Unknown · Berlin" sub="Apr 14 · blocked" value="Review" valTone="neg" chev last/>
      </WF.Card>

      <div style={{ height: 44, borderRadius: 12, border: '1px solid var(--ff-coral-deep)', color: 'var(--ff-coral-deep)', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>Sign out of all sessions</div>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.AppLock = () => (
  <WF.IPhone dark hideHomeIndicator={false}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', position: 'relative' }}>
      <WF.Pip size={42} mood="calm"/>
      <div style={{ marginTop: 18, fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', color: '#E8DECF' }}>Welcome back, Alex.</div>
      <div style={{ marginTop: 4, fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(232,222,207,0.55)' }}>FACE ID TO UNLOCK</div>

      <div style={{ marginTop: 36, width: 90, height: 90, borderRadius: 18, border: '2px solid rgba(232,222,207,0.4)', display: 'grid', placeItems: 'center', position: 'relative' }}>
        <svg width="48" height="48" viewBox="0 0 60 60" fill="none" stroke="#E8DECF" strokeWidth="1.6">
          <path d="M8 18V12a4 4 0 0 1 4-4h6M52 18V12a4 4 0 0 0-4-4h-6M8 42v6a4 4 0 0 0 4 4h6M52 42v6a4 4 0 0 1-4 4h-6"/>
          <circle cx="22" cy="26" r="1.2" fill="#E8DECF"/><circle cx="38" cy="26" r="1.2" fill="#E8DECF"/>
          <path d="M22 36c2 3 6 4 8 4s6-1 8-4"/>
        </svg>
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
        {[1,2,3,4,5,6].map(i => <span key={i} style={{ width: 11, height: 11, borderRadius: 6, border: '1.5px solid rgba(232,222,207,0.4)' }}/>)}
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: 'rgba(232,222,207,0.55)' }}>or enter PIN</div>

      <div style={{ position: 'absolute', bottom: 38, left: 28, right: 28, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(232,222,207,0.5)' }}>
        <span>Forgot PIN?</span>
        <span>Switch account</span>
      </div>
    </div>
  </WF.IPhone>
);

IOS.Upgrade = () => (
  <WF.IPhone>
    <div style={{ padding: '6px 16px', display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 16, color: 'rgba(42,37,34,0.6)' }}>✕</span>
      <span style={{ fontSize: 13, color: 'var(--ff-coral)', fontWeight: 600 }}>Restore</span>
    </div>
    <WF.Scroll>
      <div style={{ textAlign: 'center', padding: '4px 0 10px' }}>
        <WF.Pip size={42} mood="wow"/>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 28, marginTop: 10, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Ready for the <em style={{ color: 'var(--ff-coral)' }}>whole family</em>?
        </div>
        <p style={{ fontSize: 13, color: 'rgba(42,37,34,0.65)', marginTop: 8, lineHeight: 1.45 }}>
          Unlimited members, every bank, every currency.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <WF.Card pad={14} style={{ background: '#FBF7EE' }}>
          <WF.Cap>SEED · FREE</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>$0</div>
          <ul style={{ marginTop: 8, paddingLeft: 0, listStyle: 'none', fontSize: 11.5, lineHeight: 1.6, color: 'rgba(42,37,34,0.7)' }}>
            <li>· 3 members</li>
            <li>· 2 goals</li>
            <li>· Manual entry</li>
            <li>· 1 currency</li>
          </ul>
        </WF.Card>
        <WF.Card pad={14} style={{ background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral)', borderWidth: 2 }}>
          <WF.Cap color="var(--ff-coral-deep)">FAMILY · $18/MO</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>$18<span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)' }}>/mo</span></div>
          <ul style={{ marginTop: 8, paddingLeft: 0, listStyle: 'none', fontSize: 11.5, lineHeight: 1.6, color: 'rgba(42,37,34,0.85)' }}>
            <li>✓ <b>Unlimited</b></li>
            <li>✓ Bank link (12k)</li>
            <li>✓ Multi-currency</li>
            <li>✓ Pip pro nudges</li>
            <li>✓ Priority help</li>
          </ul>
        </WF.Card>
      </div>

      <WF.Card pad={12}>
        <WF.Cap>COMMITMENT</WF.Cap>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--ff-coral)', background: 'var(--ff-coral-tint)' }}>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)' }}>Monthly</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>$18</div>
          </div>
          <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(42,37,34,0.12)' }}>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)' }}>Annual <span style={{ color: 'var(--ff-olive)' }}>−2 mo.</span></div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>$180</div>
          </div>
        </div>
      </WF.Card>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 48, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>Start 14-day trial</div>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: 'rgba(42,37,34,0.55)' }}>No charge today · cancel anytime in Settings</div>
      </div>
    </WF.Scroll>
  </WF.IPhone>
);

IOS.Empty = () => (
  <WF.IPhone>
    <WF.IOSNav title="Transactions" lead={null}/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <WF.Pip size={48} mood="calm"/>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', marginTop: 12 }}>Clean slate.</div>
      <p style={{ fontSize: 13, color: 'rgba(42,37,34,0.65)', marginTop: 6, lineHeight: 1.5, maxWidth: 220 }}>
        Log your first expense — Pip will figure out the category from a few words.
      </p>
      <div style={{ marginTop: 20, height: 44, padding: '0 18px', borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600 }}>
        <span style={{ fontSize: 18, fontWeight: 300 }}>+</span> Add first transaction
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ff-coral)' }}>or link a bank →</div>
      <div style={{ position: 'absolute', bottom: 110, left: 24, right: 24 }}>
        <WF.Card pad={12} style={{ background: 'var(--ff-honey-tint)', borderColor: 'var(--ff-honey)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Sync paused · 4 days</div>
              <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.7)' }}>Apple Card needs a re-auth.</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ff-coral)', fontWeight: 600 }}>Fix</span>
          </div>
        </WF.Card>
      </div>
    </div>
    <WF.IOSTabs active="activity"/>
  </WF.IPhone>
);

Object.assign(window, { IOS });
