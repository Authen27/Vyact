/* global React, WF */
// FinFlow Android Wireframes — Material 3 conventions
// All exported under window.AND.

const AND = {};

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
// ONBOARDING
// ════════════════════════════════════════════════════════════════
AND.Splash = () => (
  <WF.Android>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', position: 'relative' }}>
      <WF.Pip size={68} mood="happy"/>
      <div style={{ marginTop: 22, fontFamily: 'var(--ff-serif)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
        Money,<br/><em style={{ color: 'var(--ff-coral)', fontStyle: 'italic' }}>together.</em>
      </div>
      <p style={{ marginTop: 14, fontSize: 13.5, color: 'rgba(42,37,34,0.65)', lineHeight: 1.5, maxWidth: 240 }}>
        A calm household ledger for couples, families, and the people who help them along.
      </p>
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 50, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 48, borderRadius: 24, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.2 }}>Create an account</div>
        <div style={{ height: 46, borderRadius: 23, border: '1px solid rgba(42,37,34,0.2)', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.2 }}>I already have one</div>
      </div>
    </div>
  </WF.Android>
);

AND.SignIn = () => (
  <WF.Android>
    <WF.MdTopBar title="" lead="back" actions={['?']}/>
    <WF.Scroll>
      <WF.Cap>STEP 1 OF 2 · EMAIL</WF.Cap>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 24, fontStyle: 'italic', color: 'var(--ff-coral)', lineHeight: 1.15 }}>Welcome back.</div>
      <div style={{ marginTop: 12, height: 56, borderRadius: 6, border: '1px solid rgba(42,37,34,0.4)', padding: '6px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--ff-coral)', fontWeight: 500 }}>Email address</div>
        <div style={{ fontSize: 14 }}>alex@reyes-household.co</div>
      </div>
      <div style={{ height: 56, borderRadius: 6, border: '1px solid rgba(42,37,34,0.2)', padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.55)' }}>Password</div>
          <div style={{ fontSize: 14, color: 'rgba(42,37,34,0.5)' }}>•••••••••••</div>
        </div>
        <span style={{ fontSize: 18, color: 'rgba(42,37,34,0.55)' }}>👁</span>
      </div>
      <div style={{ alignSelf: 'flex-end', fontSize: 12, fontWeight: 500, color: 'var(--ff-coral)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Forgot password</div>
      <div style={{ marginTop: 6, height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.4 }}>CONTINUE</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(42,37,34,0.12)' }}/>
        <WF.Cap>OR</WF.Cap>
        <div style={{ flex: 1, height: 1, background: 'rgba(42,37,34,0.12)' }}/>
      </div>
      <div style={{ height: 44, borderRadius: 22, border: '1px solid rgba(42,37,34,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
        <span style={{ width: 14, height: 14, background: 'conic-gradient(#4A6FA5, #85A88A, #E8A87C, #4A6FA5)', borderRadius: 7 }}/> Continue with Google
      </div>
      <div style={{ height: 44, borderRadius: 22, border: '1px solid rgba(42,37,34,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
        <span style={{ fontSize: 14 }}></span> Continue with Apple
      </div>
      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 11, color: 'rgba(42,37,34,0.55)' }}>Bank-level encryption · <span style={{ color: 'var(--ff-coral)' }}>Learn how</span></div>
    </WF.Scroll>
  </WF.Android>
);

AND.Biometric = () => (
  <WF.Android>
    <WF.MdTopBar title="" lead="close"/>
    <div style={{ flex: 1, padding: '0 20px 20px', display: 'flex', flexDirection: 'column' }}>
      <WF.Cap>SECURITY · STEP 3 OF 4</WF.Cap>
      <div style={{ marginTop: 8, fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 400, lineHeight: 1.15 }}>
        Use <em style={{ color: 'var(--ff-coral)' }}>fingerprint</em> to unlock FinFlow?
      </div>
      <p style={{ marginTop: 8, fontSize: 13, color: 'rgba(42,37,34,0.62)', lineHeight: 1.5 }}>
        Your fingerprint never leaves the device. We pair it with a 6-digit PIN as a backup.
      </p>
      <div style={{ margin: '20px auto', width: 130, height: 130, borderRadius: 22, background: 'var(--ff-coral-tint)', display: 'grid', placeItems: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="var(--ff-coral-deep)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M32 6c-13 0-24 11-24 24v8M32 6c13 0 24 11 24 24v8M32 14c-9 0-16 7-16 16v10c0 2 .5 4 1 6M32 14c9 0 16 7 16 16v10c0 2-.5 4-1 6M32 22c-4 0-8 4-8 9v12c0 3 1 6 2 8M32 22c4 0 8 4 8 9v12c0 3-1 6-2 8M32 30v18c0 3 1 6 2 8"/>
        </svg>
      </div>
      <WF.Card pad={12} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ff-sage-tint)', borderRadius: 24, borderColor: 'transparent' }}>
        <span style={{ fontSize: 18 }}>🛡️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Encrypted on-device</div>
          <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)' }}>Android Keystore + AES-256</div>
        </div>
      </WF.Card>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.4 }}>ENABLE FINGERPRINT</div>
        <div style={{ height: 40, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--ff-coral)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>Use 6-digit PIN</div>
      </div>
    </div>
  </WF.Android>
);

AND.Segment = () => (
  <WF.Android>
    <WF.MdTopBar title="Pick your shape" lead="back"/>
    <WF.Scroll>
      <p style={{ fontSize: 13, color: 'rgba(42,37,34,0.62)', lineHeight: 1.5 }}>
        We tune defaults, language, and categories to your household. Change this anytime.
      </p>
      {[
        ['Just us two',     'A couple — shared rent, two paychecks, weekend trips.', '👫', true],
        ['Growing family',  'Kids in the picture. Childcare, school, and a bit of chaos.', '🏡', false],
        ['Multi-generational', "Parents or in-laws under the same roof, or you're helping support them.", '🌳', false],
        ['Just me',         'Solo for now. You can invite others later.', '🧍', false],
      ].map(([t, s, ico, sel]) => (
        <WF.Card key={t} pad={14} style={{ borderRadius: 24, background: sel ? 'var(--ff-coral-tint)' : '#FBF7EE', borderColor: sel ? 'var(--ff-coral)' : 'transparent', borderWidth: sel ? 2 : 1 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 24 }}>{ico}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{t}</div>
              <div style={{ fontSize: 12, color: 'rgba(42,37,34,0.65)', marginTop: 2, lineHeight: 1.45 }}>{s}</div>
            </div>
            <span style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${sel ? 'var(--ff-coral)' : 'rgba(42,37,34,0.4)'}`, display: 'inline-grid', placeItems: 'center' }}>
              {sel && <span style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--ff-coral)' }}/>}
            </span>
          </div>
        </WF.Card>
      ))}
      <div style={{ marginTop: 'auto', height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.4 }}>CONTINUE</div>
    </WF.Scroll>
  </WF.Android>
);

AND.FirstGoal = () => (
  <WF.Android>
    <WF.MdTopBar title="" lead="back" actions={['Skip']}/>
    <WF.Scroll>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <WF.Pip size={36}/>
        <div>
          <WF.Cap>PIP SAYS</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', lineHeight: 1.15, marginTop: 2 }}>
            What's the first <span style={{ color: 'var(--ff-coral)' }}>win</span>?
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'rgba(42,37,34,0.62)', lineHeight: 1.5 }}>
        One goal to start with — you can add more after the first paycheck.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          ['🛡️', 'Emergency Fund', '3 mo. of essentials', true],
          ['✈️', 'A trip',          'Vacation savings'],
          ['💍', 'A big thing',     'Wedding, home, car'],
          ['🎓', 'School',          "Kid's or yours"],
          ['📈', 'Retirement',      'Roth or 401(k)'],
          ['🎁', 'Custom',          'Define your own'],
        ].map(([ico, t, s, on]) => (
          <div key={t} style={{
            borderRadius: 20, padding: 12,
            background: on ? 'var(--ff-coral-tint)' : '#FBF7EE',
            border: on ? '2px solid var(--ff-coral)' : '1px solid rgba(42,37,34,0.08)',
          }}>
            <div style={{ fontSize: 20 }}>{ico}</div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>{t}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(42,37,34,0.6)', marginTop: 1 }}>{s}</div>
          </div>
        ))}
      </div>
      <WF.Card pad={12} style={{ borderRadius: 20, background: 'var(--ff-sage-tint)', borderColor: 'transparent' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <WF.Cap>SUGGESTED TARGET</WF.Cap>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 24, marginTop: 2 }}>$6,000</div>
          </div>
          <span style={{ height: 32, padding: '0 14px', borderRadius: 16, background: '#FBF7EE', fontSize: 12, fontWeight: 500, color: 'var(--ff-olive)', display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase', letterSpacing: 0.4 }}>Edit</span>
        </div>
      </WF.Card>
      <div style={{ marginTop: 'auto', height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.4 }}>SET GOAL & CONTINUE</div>
    </WF.Scroll>
  </WF.Android>
);

// ════════════════════════════════════════════════════════════════
// MAIN TABS
// ════════════════════════════════════════════════════════════════
AND.Home = () => (
  <WF.Android>
    <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <WF.Cap>REYES HOUSEHOLD · APR</WF.Cap>
        <div style={{ fontSize: 22, fontWeight: 500, marginTop: 2 }}>Hello, Alex</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ width: 40, height: 40, borderRadius: 20, display: 'inline-grid', placeItems: 'center', fontSize: 16, color: 'rgba(42,37,34,0.7)' }}>🔔</span>
        <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>AR</span>
      </div>
    </div>

    {/* search bar — Material 3 */}
    <div style={{ padding: '6px 16px 8px' }}>
      <div style={{ height: 44, borderRadius: 22, background: '#ECE5D6', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', fontSize: 13, color: 'rgba(42,37,34,0.55)' }}>
        <span>⌕</span> Search transactions, goals, members
      </div>
    </div>

    <WF.Scroll pad="0 14px 14px">
      {/* Hero Net worth (M3 filled card — tonal) */}
      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 28, padding: 18 }}>
        <WF.Cap color="var(--ff-coral-deep)">PULSE · GOOD</WF.Cap>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(42,37,34,0.08)" strokeWidth="7"/>
              <circle cx="42" cy="42" r="34" fill="none" stroke="var(--ff-coral)" strokeWidth="7" strokeDasharray={`${(78/100)*214} 999`} strokeLinecap="round" transform="rotate(-90 42 42)"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 500 }}>78</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>Up <b>+4</b> vs March. Food's a touch hot — manageable.</div>
            <div style={{ marginTop: 6, height: 28, padding: '0 12px', borderRadius: 14, background: '#FBF7EE', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 500, color: 'var(--ff-olive)' }}>
              ↑ Trending OK
            </div>
          </div>
        </div>
      </div>

      {/* Filter chips — M3 */}
      <div style={{ display: 'flex', gap: 6, overflow: 'hidden' }}>
        {[['Overview', true], ['Spending'], ['Goals'], ['Debts']].map(([l, on]) => (
          <span key={l} style={{
            flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center',
            fontSize: 12.5, fontWeight: 500,
            background: on ? 'var(--ff-sage-tint)' : 'transparent',
            border: on ? '1px solid var(--ff-olive)' : '1px solid rgba(42,37,34,0.25)',
            color: on ? 'var(--ff-olive)' : '#2A2522',
          }}>{l}</span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: '#ECE5D6', borderRadius: 20, padding: 14 }}>
          <WF.Cap>NET WORTH</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>$28.4k</div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-olive)', marginTop: 1 }}>↑ $840 · 30d</div>
        </div>
        <div style={{ background: '#ECE5D6', borderRadius: 20, padding: 14 }}>
          <WF.Cap>DEBT</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>$12.3k</div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-coral)', marginTop: 1 }}>3 active · 2.4 yr</div>
        </div>
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
        <WF.SectionHead right="3 ACTIVE →">BUDGETS</WF.SectionHead>
        {[['Food', 84, 'var(--ff-honey)'], ['Transport', 42, 'var(--ff-coral)'], ['Shopping', 68, 'var(--ff-coral)']].map(([n, p, c]) => (
          <div key={n} style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ff-mono)', fontSize: 10 }}>
              <span>{n}</span><span>{p}%</span>
            </div>
            <WF.Bar pct={p} color={c}/>
          </div>
        ))}
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
        <WF.SectionHead right="VIEW ALL →">RECENT</WF.SectionHead>
        {TXNS.slice(0, 3).map((t, i, a) => (
          <WF.Row key={i} icon={t[0]} title={t[1]} sub={t[2]} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last={i === a.length - 1}/>
        ))}
      </div>
    </WF.Scroll>
    <WF.FAB label="Add transaction"/>
    <WF.MdNav active="home"/>
  </WF.Android>
);

AND.Txns = () => (
  <WF.Android>
    <WF.MdTopBar title="Activity" lead="menu" actions={['⌕', '⚙']}/>
    <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflow: 'hidden' }}>
      {[['All', true], ['Food'], ['Income'], ['Transport'], ['Shared']].map(([l, on]) => (
        <span key={l} style={{
          flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 8,
          display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 500,
          background: on ? 'var(--ff-coral-tint)' : 'transparent',
          border: on ? '1px solid var(--ff-coral)' : '1px solid rgba(42,37,34,0.25)',
          color: on ? 'var(--ff-coral-deep)' : '#2A2522',
        }}>{l}</span>
      ))}
    </div>
    <WF.Scroll pad="0 16px 14px">
      <WF.Cap>TODAY · APR 27</WF.Cap>
      <div style={{ background: '#FBF7EE', borderRadius: 20 }}>
        {TXNS.slice(0, 1).map((t, i) => (
          <div key={i} style={{ padding: '0 14px' }}>
            <WF.Row icon={t[0]} title={t[1]} sub={`${t[2].split(' · ')[0]} · ${t[4]}`} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last/>
          </div>
        ))}
      </div>
      <WF.Cap>THIS WEEK</WF.Cap>
      <div style={{ background: '#FBF7EE', borderRadius: 20 }}>
        {TXNS.slice(1, 5).map((t, i, a) => (
          <div key={i} style={{ padding: '0 14px' }}>
            <WF.Row icon={t[0]} title={t[1]} sub={`${t[2].split(' · ')[0]} · ${t[4]}`} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last={i === a.length - 1}/>
          </div>
        ))}
      </div>
      <WF.Cap>LAST WEEK</WF.Cap>
      <div style={{ background: '#FBF7EE', borderRadius: 20 }}>
        {TXNS.slice(5).map((t, i, a) => (
          <div key={i} style={{ padding: '0 14px' }}>
            <WF.Row icon={t[0]} title={t[1]} sub={`${t[2].split(' · ')[0]} · ${t[4]}`} value={WF.money(t[3], { sign: t[3] > 0 })} valTone={t[3] > 0 ? 'pos' : 'neg'} chev={false} last={i === a.length - 1}/>
          </div>
        ))}
      </div>
    </WF.Scroll>
    <WF.FAB label="Add"/>
    <WF.MdNav active="activity"/>
  </WF.Android>
);

// ── Money sub-nav (Net Worth / Budgets / Goals / Debts) ──
const MoneyChips = ({ active }) => (
  <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflow: 'hidden' }}>
    {[['Net Worth'], ['Budgets'], ['Goals'], ['Debts']].map(([l]) => {
      const on = active === l;
      return (
        <span key={l} style={{
          flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 8, display: 'inline-flex', alignItems: 'center',
          fontSize: 12.5, fontWeight: 500,
          background: on ? 'var(--ff-coral-tint)' : 'transparent',
          border: on ? '1px solid var(--ff-coral)' : '1px solid rgba(42,37,34,0.25)',
          color: on ? 'var(--ff-coral-deep)' : '#2A2522',
        }}>{l}</span>
      );
    })}
  </div>
);

AND.Budgets = () => (
  <WF.Android>
    <WF.MdTopBar title="Money" lead="menu" actions={['+']}/>
    <MoneyChips active="Budgets"/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 28, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <WF.Cap color="var(--ff-coral-deep)">APR · TOTAL SPEND</WF.Cap>
          <WF.Cap color="var(--ff-coral-deep)">68% USED</WF.Cap>
        </div>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 32, marginTop: 4 }}>
          $1,360 <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'rgba(42,37,34,0.55)' }}>/ $2,000</span>
        </div>
        <div style={{ marginTop: 8 }}><WF.Bar pct={68} color="var(--ff-coral)" h={6}/></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.65)', marginTop: 6 }}>
          <span>$640 left</span><span>3 days to month-end</span>
        </div>
      </div>

      {[
        ['🛒', 'Food',          420, 500, 'var(--ff-honey)'],
        ['🚗', 'Transport',      84, 200, 'var(--ff-coral)'],
        ['🛍', 'Shopping',      204, 300, 'var(--ff-coral)'],
        ['⚡', 'Utilities',     118, 200, 'var(--ff-olive)'],
        ['🎬', 'Entertainment', 64, 150, 'var(--ff-denim)'],
      ].map(([ico, name, spent, lim, c]) => {
        const pct = Math.round((spent / lim) * 100);
        return (
          <div key={name} style={{ background: '#FBF7EE', borderRadius: 20, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{ico} {name}</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'rgba(42,37,34,0.6)' }}>{WF.money(spent)} / {WF.money(lim)}</div>
            </div>
            <div style={{ marginTop: 6 }}><WF.Bar pct={pct} color={c}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--ff-mono)', fontSize: 9.5 }}>
              <span style={{ color: 'rgba(42,37,34,0.55)' }}>{pct}% used</span>
              <span style={{ color: pct > 80 ? 'var(--ff-coral)' : pct > 60 ? '#A06A2C' : 'var(--ff-olive)' }}>{pct > 80 ? 'Tight' : pct > 60 ? 'Watch' : 'On track'}</span>
            </div>
          </div>
        );
      })}
    </WF.Scroll>
    <WF.MdNav active="money"/>
  </WF.Android>
);

AND.Goals = () => (
  <WF.Android>
    <WF.MdTopBar title="Money" lead="menu" actions={['+']}/>
    <MoneyChips active="Goals"/>
    <WF.Scroll pad="0 16px 14px">
      {[
        ['🛡️', 'Emergency Fund',    4200, 6000, 'var(--ff-olive)', '8 mo. to go', false],
        ['✈️', 'Kyoto 2026',          1850, 4000, 'var(--ff-coral)', 'Hit by Sep', false],
        ['📈', 'Roth IRA · 2026',     4800, 7000, 'var(--ff-denim)', 'On pace', false],
        ['💍', 'Wedding · Aug',       8400, 12000,'var(--ff-plum)',  '4 mo. left', false],
        ['🎉', 'Date-night fund',     150,  250,  'var(--ff-coral)', '60% — Pip flagged', true],
      ].map(([ico, name, cur, tgt, c, sub, hot]) => {
        const pct = Math.round((cur / tgt) * 100);
        return (
          <div key={name} style={{
            background: hot ? 'var(--ff-coral-tint)' : '#FBF7EE',
            borderRadius: 24, padding: 16,
            borderLeft: hot ? '4px solid var(--ff-coral)' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{ico} {name}</div>
              <WF.Cap color={hot ? 'var(--ff-coral-deep)' : undefined}>{pct}%</WF.Cap>
            </div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>
              {WF.money(cur)} <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'rgba(42,37,34,0.55)' }}>/ {WF.money(tgt)}</span>
            </div>
            <div style={{ marginTop: 8 }}><WF.Bar pct={pct} color={c} h={6}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.6)' }}>
              <span>{sub}</span>
              <span style={{ color: 'var(--ff-coral)', fontWeight: 600 }}>+ ADD</span>
            </div>
          </div>
        );
      })}
    </WF.Scroll>
    <WF.MdNav active="money"/>
  </WF.Android>
);

AND.Wealth = () => (
  <WF.Android>
    <WF.MdTopBar title="Money" lead="menu" actions={['↗']}/>
    <MoneyChips active="Net Worth"/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: 'var(--ff-sage-tint)', borderRadius: 28, padding: 18, textAlign: 'center' }}>
        <WF.Cap color="var(--ff-olive)">NET WORTH · APR 28</WF.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 36, fontWeight: 400, marginTop: 4 }}>
          $28,400<span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: 'rgba(42,37,34,0.5)' }}>.18</span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 12px', background: '#FBF7EE', color: 'var(--ff-olive)', borderRadius: 99, fontSize: 11.5, fontWeight: 500 }}>
          ↑ +$840 last 30 days
        </div>
        <div style={{ marginTop: 10 }}><WF.Spark w={260} h={42}/></div>
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
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
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
        <WF.SectionHead right="DETAIL →">ASSETS · $40,700</WF.SectionHead>
        {[['🏦', 'Checking · Chase', 4820], ['💰', 'HYSA · Marcus', 12600], ['📈', 'Brokerage', 18400], ['🪙', 'Roth IRA', 4800]].map(([i, n, v], idx, a) => (
          <WF.Row key={n} icon={i} title={n} value={WF.money(v)} valTone="pos" chev={false} last={idx === a.length - 1}/>
        ))}
      </div>

      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 24, padding: 14, borderLeft: '4px solid var(--ff-coral)' }}>
        <WF.SectionHead right="MANAGE →">LIABILITIES · $12,350</WF.SectionHead>
        {[['💳', 'Apple Card', 3850, '21.9% APR'], ['🎓', 'Student loan', 6500, '5.8% APR'], ['🚗', 'Auto loan', 2000, '7.2% APR']].map(([i, n, v, s], idx, a) => (
          <WF.Row key={n} icon={i} title={n} sub={s} value={WF.money(v)} chev={true} last={idx === a.length - 1}/>
        ))}
      </div>
    </WF.Scroll>
    <WF.MdNav active="money"/>
  </WF.Android>
);

// ════════════════════════════════════════════════════════════════
// DETAIL / FLOW SCREENS
// ════════════════════════════════════════════════════════════════
AND.AddTxn = () => (
  <WF.Android>
    <WF.MdTopBar title="" lead="close" actions={['SAVE']}/>
    <div style={{ padding: '0 16px 8px' }}>
      <WF.Cap>NEW · APR 27</WF.Cap>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {[['Expense', true], ['Income'], ['Transfer']].map(([l, on]) => (
          <div key={l} style={{
            flex: 1, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: on ? 'var(--ff-coral-tint)' : 'transparent',
            border: on ? '1px solid var(--ff-coral)' : '1px solid rgba(42,37,34,0.25)',
            color: on ? 'var(--ff-coral-deep)' : '#2A2522',
            fontSize: 12, fontWeight: 500,
          }}>{l}</div>
        ))}
      </div>
    </div>
    <div style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: 16 }}>
        <WF.Cap>AMOUNT · USD</WF.Cap>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, color: 'rgba(42,37,34,0.5)' }}>$</span>
          <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 44, fontWeight: 400, letterSpacing: '-0.02em' }}>84.20</span>
        </div>
      </div>
      <div style={{ height: 56, borderRadius: 6, border: '1px solid rgba(42,37,34,0.4)', padding: '6px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--ff-coral)', fontWeight: 500 }}>Description</div>
        <div style={{ fontSize: 14 }}>Whole Foods Mkt.</div>
      </div>
      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 20, padding: 12, borderLeft: '3px solid var(--ff-coral)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <WF.Pip size={22}/>
          <WF.Cap color="var(--ff-coral-deep)">PIP SUGGESTS</WF.Cap>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[['🛒 Food', true], ['🏡 Household'], ['🎁 Gifts']].map(([l, on]) => (
            <span key={l} style={{ height: 32, padding: '0 12px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', fontSize: 12, background: on ? 'var(--ff-coral)' : 'transparent', color: on ? '#fff' : '#2A2522', border: on ? 'none' : '1px solid rgba(42,37,34,0.25)', fontWeight: 500 }}>{l}</span>
          ))}
        </div>
      </div>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="👤" title="Paid by" value="Alex" chev/>
        <WF.Row icon="🔁" title="Recurring" value="Off" chev/>
        <WF.Row icon="📝" title="Note" sub="optional" chev last/>
      </div>
    </div>
    {/* mock numeric keypad */}
    <div style={{ marginTop: 'auto', background: '#E3DAC9', padding: '8px 16px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
        <div key={k} style={{ height: 36, borderRadius: 8, background: k === '⌫' ? 'transparent' : '#FBF7EE', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 400 }}>{k}</div>
      ))}
    </div>
  </WF.Android>
);

AND.TxnDetail = () => (
  <WF.Android>
    <WF.MdTopBar title="" lead="back" actions={['Edit', '⋮']}/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--ff-coral-tint)', margin: '0 auto', display: 'grid', placeItems: 'center', fontSize: 26 }}>🛒</div>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 32, marginTop: 12 }}>−$84.20</div>
        <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>Whole Foods Mkt.</div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)', marginTop: 4, letterSpacing: '0.12em' }}>APR 27, 2026 · 4:18 PM · USD</div>
      </div>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="🏷️" title="Category" value="Food"/>
        <WF.Row icon="👤" title="Paid by" value="Alex"/>
        <WF.Row icon="📊" title="Budget impact" value="Food 84%" valTone="neg"/>
        <WF.Row icon="📍" title="Location" sub="Union Sq, NYC" last chev={false}/>
      </div>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: 14 }}>
        <WF.Cap>SHARED WITH</WF.Cap>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {['AR', 'JR'].map(i => (
            <span key={i} style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--ff-coral)', color: '#fff', fontSize: 11, fontWeight: 600, display: 'inline-grid', placeItems: 'center' }}>{i}</span>
          ))}
          <span style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(42,37,34,0.25)', display: 'inline-flex', alignItems: 'center', fontSize: 12 }}>+ Split</span>
        </div>
      </div>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: 14 }}>
        <WF.Cap>NOTE</WF.Cap>
        <p style={{ fontSize: 13, marginTop: 4, lineHeight: 1.45 }}>Weekly groceries + the wine for Saturday's dinner with R+M.</p>
      </div>
      <div style={{ height: 44, borderRadius: 22, border: '1px solid var(--ff-coral-deep)', color: 'var(--ff-coral-deep)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 500, marginTop: 4, letterSpacing: 0.4, textTransform: 'uppercase' }}>Delete</div>
    </WF.Scroll>
  </WF.Android>
);

AND.DebtStrategy = () => (
  <WF.Android>
    <WF.MdTopBar title="Pay off debt" lead="back" actions={['?']}/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: '#1F1B17', color: '#E8DECF', borderRadius: 28, padding: 18, textAlign: 'center' }}>
        <WF.Cap color="rgba(232,222,207,0.6)">TOTAL · USD</WF.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 34, marginTop: 4 }}>$12,350</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6, fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(232,222,207,0.55)', letterSpacing: '0.1em' }}>
          <span>MIN $495/MO</span><span>·</span><span>FREE IN 28 MO</span>
        </div>
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
        <WF.Cap>PAYOFF STRATEGY</WF.Cap>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[['Avalanche', true], ['Snowball'], ['Custom']].map(([l, on]) => (
            <div key={l} style={{
              flex: 1, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: on ? 'var(--ff-coral-tint)' : 'transparent',
              border: on ? '1px solid var(--ff-coral)' : '1px solid rgba(42,37,34,0.25)',
              color: on ? 'var(--ff-coral-deep)' : '#2A2522',
              fontSize: 11.5, fontWeight: 500,
            }}>{l}</div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'rgba(42,37,34,0.65)', lineHeight: 1.5, marginTop: 10 }}>
          Highest <b>APR</b> first — minimum interest paid. Saves <b style={{ color: 'var(--ff-olive)' }}>$340</b> vs Snowball.
        </p>
      </div>

      {[
        { ico: '💳', name: 'Apple Card',     balance: 3850, apr: 21.9, paid: 1150, total: 5000, target: true },
        { ico: '🎓', name: 'Student loan',   balance: 6500, apr: 5.8,  paid: 3500, total: 10000 },
        { ico: '🚗', name: 'Auto loan',      balance: 2000, apr: 7.2,  paid: 4000, total: 6000 },
      ].map(d => {
        const pct = Math.round((d.paid / d.total) * 100);
        return (
          <div key={d.name} style={{ background: '#FBF7EE', borderRadius: 24, padding: 14, borderLeft: d.target ? '4px solid var(--ff-coral)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                {d.ico} {d.name}
                {d.target && <span style={{ marginLeft: 8, fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--ff-coral)', letterSpacing: '0.1em' }}>NEXT TARGET</span>}
              </div>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)' }}>{d.apr}% APR</span>
            </div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>{WF.money(d.balance)}</div>
            <div style={{ marginTop: 8 }}><WF.Bar pct={pct} color="var(--ff-olive)" h={6}/></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(42,37,34,0.55)' }}>
              <span>Paid {WF.money(d.paid, { abbrev: true })} of {WF.money(d.total, { abbrev: true })}</span>
              <span>{pct}%</span>
            </div>
          </div>
        );
      })}

      <div style={{ height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>+ Log payment</div>
    </WF.Scroll>
  </WF.Android>
);

AND.AddDebt = () => (
  <WF.Android>
    <WF.MdTopBar title="Add a debt" lead="close" actions={['SAVE']}/>
    <WF.Scroll pad="0 16px 14px">
      <WF.Cap>TYPE</WF.Cap>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {[['💳', 'Card', true], ['🎓', 'Loan'], ['🚗', 'Auto'], ['🏠', 'Mort.']].map(([i, l, on]) => (
          <div key={l} style={{
            borderRadius: 18, padding: '12px 6px', textAlign: 'center',
            background: on ? 'var(--ff-coral-tint)' : '#FBF7EE',
            border: on ? '2px solid var(--ff-coral)' : '1px solid rgba(42,37,34,0.08)',
          }}>
            <div style={{ fontSize: 18 }}>{i}</div>
            <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 3 }}>{l}</div>
          </div>
        ))}
      </div>
      {[
        ['Nickname', 'Apple Card · main'],
        ['Current balance', '$3,850.00'],
        ['Interest rate (APR)', '21.9%'],
        ['Minimum payment', '$95 / month'],
        ['Payment date', '15th'],
      ].map(([l, v]) => (
        <div key={l} style={{ height: 56, borderRadius: 6, border: '1px solid rgba(42,37,34,0.25)', padding: '6px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)' }}>{l}</div>
          <div style={{ fontSize: 14 }}>{v}</div>
        </div>
      ))}
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Variable rate</div>
          <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)' }}>Prompt when rate resets</div>
        </div>
        <span style={{ width: 48, height: 28, borderRadius: 14, background: 'rgba(42,37,34,0.16)', display: 'inline-flex', alignItems: 'center', padding: 3 }}>
          <span style={{ width: 22, height: 22, borderRadius: 11, background: '#FBF7EE' }}/>
        </span>
      </div>
    </WF.Scroll>
  </WF.Android>
);

// ════════════════════════════════════════════════════════════════
// SETTINGS / SECURITY / STATES
// ════════════════════════════════════════════════════════════════
AND.Profile = () => (
  <WF.Android>
    <WF.MdTopBar title="You" lead="menu" large/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 52, height: 52, borderRadius: 26, background: 'var(--ff-coral)', color: '#fff', fontSize: 17, fontWeight: 600, display: 'inline-grid', placeItems: 'center' }}>AR</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>Alex Reyes</div>
          <div style={{ fontSize: 12, color: 'rgba(42,37,34,0.6)' }}>Reyes Household · Primary</div>
        </div>
        <span style={{ height: 24, padding: '0 10px', borderRadius: 12, background: 'var(--ff-coral-tint)', color: 'var(--ff-coral-deep)', fontFamily: 'var(--ff-mono)', fontSize: 9.5, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center' }}>SEED</span>
      </div>

      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 24, padding: 14, borderLeft: '4px solid var(--ff-coral)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <WF.Pip size={28} mood="wow"/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Unlock Family · $18/mo</div>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)' }}>Bank link · multi-currency · unlimited members</div>
          </div>
          <span style={{ height: 32, padding: '0 14px', borderRadius: 16, background: 'var(--ff-coral)', color: '#fff', fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', textTransform: 'uppercase', letterSpacing: 0.4 }}>Try free</span>
        </div>
      </div>

      <WF.SectionHead>HOUSEHOLD</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="👥" title="Members" sub="3 people · Alex, Jamie, Mia"/>
        <WF.Row icon="🏷" title="Categories"/>
        <WF.Row icon="📅" title="Pay cycle" value="Monthly"/>
        <WF.Row icon="🌐" title="Locale & currency" value="en-US · USD" last/>
      </div>

      <WF.SectionHead>SECURITY</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="🔒" title="Fingerprint & PIN" value="On" valTone="pos" chev={false}/>
        <WF.Row icon="🛡" title="Two-factor" value="SMS"/>
        <WF.Row icon="🔑" title="Sessions" value="2 devices"/>
        <WF.Row icon="📥" title="Export & data" last/>
      </div>

      <WF.SectionHead>HELP</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="❓" title="Ask Pip" sub="In-app help"/>
        <WF.Row icon="📨" title="Contact support"/>
        <WF.Row icon="📜" title="Privacy & terms" last/>
      </div>

      <div style={{ textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.5)' }}>FINFLOW · v1.0.4 · ANDROID 15</div>
    </WF.Scroll>
    <WF.MdNav active="you"/>
  </WF.Android>
);

AND.Members = () => (
  <WF.Android>
    <WF.MdTopBar title="Household" lead="back" actions={['+']}/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: 'var(--ff-sage-tint)', borderRadius: 24, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <WF.Cap color="var(--ff-olive)">REYES HOUSEHOLD · USD</WF.Cap>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>3 members · 1 pending</div>
        </div>
        <span style={{ height: 24, padding: '0 10px', borderRadius: 12, background: '#FBF7EE', fontFamily: 'var(--ff-mono)', fontSize: 9.5, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center' }}>SEED 3/3</span>
      </div>

      {[
        ['Alex Reyes',    'alex@reyes-household.co',  'Primary',   'AR', 'var(--ff-coral)',     true],
        ['Jamie Reyes',   'jamie@reyes-household.co', 'Partner',   'JR', 'var(--ff-denim)',     false],
        ['Mia Reyes',     '12 yrs · learning mode',   'Child',     'MR', 'var(--ff-honey)',     false],
        ['Patel & Dad',   "Helping w/ Dad's bills",   'Elder · view', 'PD', 'var(--ff-plum)',  false],
      ].map(([n, e, r, i, c, you]) => (
        <div key={n} style={{ background: '#FBF7EE', borderRadius: 20, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: c, color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>{i}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{n}{you && <span style={{ marginLeft: 6, fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--ff-coral)', letterSpacing: '0.1em' }}>YOU</span>}</div>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e}</div>
          </div>
          <span style={{ height: 24, padding: '0 10px', borderRadius: 12, background: 'rgba(42,37,34,0.06)', fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center' }}>{r.toUpperCase()}</span>
        </div>
      ))}

      <div style={{ background: 'transparent', border: '1.5px dashed rgba(42,37,34,0.2)', borderRadius: 20, padding: 14 }}>
        <WF.Cap>PENDING INVITE · SENT TUES</WF.Cap>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <div style={{ fontSize: 13.5 }}>noah@…edu</div>
          <span style={{ fontSize: 12, color: 'var(--ff-coral)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Resend</span>
        </div>
      </div>
    </WF.Scroll>
  </WF.Android>
);

AND.LinkedAccounts = () => (
  <WF.Android>
    <WF.MdTopBar title="Linked accounts" lead="back" actions={['↻']}/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 24, padding: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Read-only & encrypted</div>
            <div style={{ fontSize: 11.5, color: 'rgba(42,37,34,0.7)', lineHeight: 1.45, marginTop: 3 }}>
              FinFlow uses your bank's own OAuth — we never see your password. Revoke anytime.
            </div>
          </div>
        </div>
      </div>

      <WF.SectionHead right="STATUS">CONNECTED · 3</WF.SectionHead>
      {[
        ['🏦', 'Chase',           '··6204 · Checking',  'Synced 2m ago', 'ok'],
        ['🏦', 'Marcus by GS',    '··0218 · HYSA',      'Synced 6m ago', 'ok'],
        ['💳', 'Apple Card',      '··0091',             'Reconnect needed', 'warn'],
      ].map(([i, n, sub, st, tone]) => (
        <div key={n} style={{ background: '#FBF7EE', borderRadius: 20, padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(42,37,34,0.06)', display: 'inline-grid', placeItems: 'center', fontSize: 18 }}>{i}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{n}</div>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)', fontFamily: 'var(--ff-mono)' }}>{sub}</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99,
            background: tone === 'ok' ? 'var(--ff-sage-tint)' : 'var(--ff-honey-tint)',
            color: tone === 'ok' ? 'var(--ff-olive)' : '#A06A2C',
            fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'currentColor' }}/>{st}
          </span>
        </div>
      ))}

      <WF.SectionHead>ADD ANOTHER</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, border: '1.5px dashed rgba(42,37,34,0.25)', display: 'inline-grid', placeItems: 'center', fontSize: 18, color: 'var(--ff-coral)' }}>+</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Connect a bank or card</div>
          <div style={{ fontSize: 11.5, color: 'rgba(42,37,34,0.6)' }}>12,000+ institutions · via Plaid</div>
        </div>
        <span style={{ fontSize: 18, color: 'rgba(42,37,34,0.4)' }}>›</span>
      </div>
    </WF.Scroll>
  </WF.Android>
);

AND.Security = () => (
  <WF.Android>
    <WF.MdTopBar title="Security" lead="back"/>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: '#1F1B17', color: '#E8DECF', borderRadius: 28, padding: 18, textAlign: 'center' }}>
        <WF.Cap color="rgba(232,222,207,0.6)">VAULT STATUS</WF.Cap>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: 5, background: 'var(--ff-coral)' }}/>)}
        </div>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 18, marginTop: 8 }}>4 of 4 protections active</div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(232,222,207,0.55)', letterSpacing: '0.1em', marginTop: 3 }}>FINGERPRINT · PIN · 2FA · KEYSTORE</div>
      </div>

      <WF.SectionHead>SIGN-IN</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="👆" title="Fingerprint" sub="Unlocks the app" value="On" valTone="pos" chev={false}/>
        <WF.Row icon="•••" title="6-digit PIN" value="Set" valTone="pos" chev={false}/>
        <WF.Row icon="🔁" title="Auto-lock" value="1 minute"/>
        <WF.Row icon="📱" title="Lock when backgrounded" value="On" last chev={false}/>
      </div>

      <WF.SectionHead>TWO-FACTOR</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="📨" title="SMS to ··· 8821" value="Primary" valTone="pos" chev={false}/>
        <WF.Row icon="🔐" title="Authenticator app" value="Add"/>
        <WF.Row icon="🗝" title="Backup codes" sub="Generated Mar 12" last/>
      </div>

      <WF.SectionHead>ACTIVITY</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: '0 14px' }}>
        <WF.Row icon="✅" title="Pixel 9 · NYC" sub="Now · this device" chev={false}/>
        <WF.Row icon="💻" title="Chrome · MacBook" sub="2 hr ago · home"/>
        <WF.Row icon="❓" title="Unknown · Berlin" sub="Apr 14 · blocked" value="Review" valTone="neg" last/>
      </div>

      <div style={{ height: 44, borderRadius: 22, border: '1px solid var(--ff-coral-deep)', color: 'var(--ff-coral-deep)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>Sign out everywhere</div>
    </WF.Scroll>
  </WF.Android>
);

AND.AppLock = () => (
  <WF.Android dark>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center', position: 'relative' }}>
      <WF.Pip size={42} mood="calm"/>
      <div style={{ marginTop: 18, fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', color: '#E8DECF' }}>Welcome back, Alex.</div>
      <div style={{ marginTop: 4, fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(232,222,207,0.55)' }}>FINGERPRINT TO UNLOCK</div>

      <div style={{ marginTop: 36, width: 96, height: 96, borderRadius: 48, border: '2px solid rgba(232,222,207,0.35)', display: 'grid', placeItems: 'center' }}>
        <svg width="52" height="52" viewBox="0 0 64 64" fill="none" stroke="#E8DECF" strokeWidth="1.6" strokeLinecap="round">
          <path d="M32 6c-13 0-24 11-24 24v8M32 6c13 0 24 11 24 24v8M32 14c-9 0-16 7-16 16v10c0 2 .5 4 1 6M32 14c9 0 16 7 16 16v10c0 2-.5 4-1 6M32 22c-4 0-8 4-8 9v12c0 3 1 6 2 8M32 22c4 0 8 4 8 9v12c0 3-1 6-2 8M32 30v18c0 3 1 6 2 8"/>
        </svg>
      </div>
      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        {[1,2,3,4,5,6].map(i => <span key={i} style={{ width: 11, height: 11, borderRadius: 6, border: '1.5px solid rgba(232,222,207,0.4)' }}/>)}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(232,222,207,0.55)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Enter PIN</div>

      <div style={{ position: 'absolute', bottom: 30, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'rgba(232,222,207,0.55)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 500 }}>
        <span>Forgot PIN?</span>
        <span>Switch account</span>
      </div>
    </div>
  </WF.Android>
);

AND.Upgrade = () => (
  <WF.Android>
    <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 18, color: 'rgba(42,37,34,0.6)' }}>✕</span>
      <span style={{ fontSize: 12, color: 'var(--ff-coral)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Restore</span>
    </div>
    <WF.Scroll pad="0 16px 14px">
      <div style={{ textAlign: 'center', padding: '4px 0 10px' }}>
        <WF.Pip size={42} mood="wow"/>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 28, marginTop: 10, fontWeight: 400, lineHeight: 1.15 }}>
          Ready for the <em style={{ color: 'var(--ff-coral)' }}>whole family</em>?
        </div>
        <p style={{ fontSize: 13, color: 'rgba(42,37,34,0.65)', marginTop: 8, lineHeight: 1.45 }}>
          Unlimited members, every bank, every currency.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: '#FBF7EE', borderRadius: 20, padding: 14 }}>
          <WF.Cap>SEED · FREE</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>$0</div>
          <ul style={{ marginTop: 8, paddingLeft: 0, listStyle: 'none', fontSize: 11.5, lineHeight: 1.6, color: 'rgba(42,37,34,0.7)' }}>
            <li>· 3 members</li>
            <li>· 2 goals</li>
            <li>· Manual entry</li>
            <li>· 1 currency</li>
          </ul>
        </div>
        <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 20, padding: 14, border: '2px solid var(--ff-coral)' }}>
          <WF.Cap color="var(--ff-coral-deep)">FAMILY · $18/MO</WF.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, marginTop: 4 }}>$18<span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)' }}>/mo</span></div>
          <ul style={{ marginTop: 8, paddingLeft: 0, listStyle: 'none', fontSize: 11.5, lineHeight: 1.6, color: 'rgba(42,37,34,0.85)' }}>
            <li>✓ <b>Unlimited</b></li>
            <li>✓ Bank link (12k)</li>
            <li>✓ Multi-currency</li>
            <li>✓ Pip pro nudges</li>
            <li>✓ Priority help</li>
          </ul>
        </div>
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 20, padding: 14 }}>
        <WF.Cap>COMMITMENT</WF.Cap>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '2px solid var(--ff-coral)', background: 'var(--ff-coral-tint)' }}>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)' }}>Monthly</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>$18</div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(42,37,34,0.15)' }}>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.65)' }}>Annual <span style={{ color: 'var(--ff-olive)' }}>−2 mo.</span></div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>$180</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.4 }}>START 14-DAY TRIAL</div>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: 'rgba(42,37,34,0.55)' }}>No charge today · cancel anytime in Settings</div>
      </div>
    </WF.Scroll>
  </WF.Android>
);

AND.Empty = () => (
  <WF.Android>
    <WF.MdTopBar title="Activity" lead="menu"/>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', position: 'relative' }}>
      <WF.Pip size={48} mood="calm"/>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', marginTop: 12 }}>Clean slate.</div>
      <p style={{ fontSize: 13, color: 'rgba(42,37,34,0.65)', marginTop: 6, lineHeight: 1.5, maxWidth: 220 }}>
        Log your first expense — Pip will figure out the category from a few words.
      </p>
      <div style={{ marginTop: 20, height: 44, padding: '0 20px', borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        <span style={{ fontSize: 18, fontWeight: 300 }}>+</span> Add first transaction
      </div>
      <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--ff-coral)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>or link a bank →</div>
      <div style={{ position: 'absolute', bottom: 110, left: 24, right: 24 }}>
        <div style={{ background: 'var(--ff-honey-tint)', borderRadius: 16, padding: 12, borderLeft: '4px solid var(--ff-honey)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Sync paused · 4 days</div>
              <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.7)' }}>Apple Card needs a re-auth.</div>
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--ff-coral)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Fix</span>
          </div>
        </div>
      </div>
    </div>
    <WF.MdNav active="activity"/>
  </WF.Android>
);

Object.assign(window, { AND });
