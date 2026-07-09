/* global React, CALM */
// FinFlow Mobile Wireframes — CALM screens. iOS + Android.
// Design rule: at most ONE focal element per screen. Whitespace as a feature.

const CIOS = {};
const CAND = {};

// ────────────────────────────────────────────────────────────────
// Shared data (lighter than the dense set)
// ────────────────────────────────────────────────────────────────
const TXN_TODAY = [
  ['Whole Foods Market',  'Groceries · Alex',   -84.20],
  ['Acme Co. payroll',    'Income · Jamie',     3200.00],
];
const TXN_WEEK = [
  ['Netflix',             'Entertainment · Shared', -15.99],
  ['Uber',                'Transport · Alex',       -12.40],
  ["Trader Joe's",        'Groceries · Jamie',      -62.10],
  ['ConEd electric',      'Utilities · Shared',     -94.00],
];

// Hex swatch helper to keep transaction "icons" abstract / non-emoji
const SWATCH = {
  food:    'var(--ff-honey-tint)',
  income:  'var(--ff-sage-tint)',
  ent:     'var(--ff-denim-tint)',
  trans:   'var(--ff-coral-tint)',
  util:    'var(--ff-olive-tint)',
};

// ════════════════════════════════════════════════════════════════
// HOME · iOS
// ════════════════════════════════════════════════════════════════
CIOS.Home = () => (
  <CALM.IPhone>
    <CALM.IOSNav title={null}/>
    <CALM.Body pad="0 24px 24px" style={{ gap: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <div>
          <CALM.Cap>Tuesday · Apr 28</CALM.Cap>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', marginTop: 6 }}>
            Hi, <em style={{ color: 'var(--ff-coral)' }}>Alex</em>
          </div>
        </div>
        <span style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>AR</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <CALM.Cap>Family pulse · April</CALM.Cap>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
          <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 96, fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--ff-coral)' }}>78</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: 'var(--ff-ink-3)', letterSpacing: '0.1em' }}>/ 100</span>
        </div>
        <div style={{ marginTop: 14, fontSize: 16, color: 'var(--ff-ink-2)', lineHeight: 1.5, maxWidth: '28ch' }}>
          Up <span style={{ color: 'var(--ff-olive)', fontWeight: 600 }}>+4</span> from March. You're doing well.
        </div>
      </div>

      <CALM.PipCard action="Move $25 →">
        Date-night fund is at 60%. A small nudge could finish it this week.
      </CALM.PipCard>
    </CALM.Body>
    <CALM.Fab/>
    <CALM.IOSTabs active="home"/>
  </CALM.IPhone>
);

// ════════════════════════════════════════════════════════════════
// HOME · Android
// ════════════════════════════════════════════════════════════════
CAND.Home = () => (
  <CALM.Android>
    <div style={{ padding: '8px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <CALM.Cap>Tuesday · Apr 28</CALM.Cap>
      <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 13, fontWeight: 600 }}>AR</span>
    </div>
    <div style={{ padding: '16px 20px 0', fontFamily: 'var(--ff-serif)', fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em' }}>
      Hi, <em style={{ color: 'var(--ff-coral)' }}>Alex</em>
    </div>
    <CALM.Body pad="20px 20px 24px" style={{ gap: 28 }}>
      <div>
        <CALM.Cap>Family pulse · April</CALM.Cap>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
          <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 96, fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 0.9, color: 'var(--ff-coral)' }}>78</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: 'var(--ff-ink-3)', letterSpacing: '0.1em' }}>/ 100</span>
        </div>
        <div style={{ marginTop: 14, fontSize: 16, color: 'var(--ff-ink-2)', lineHeight: 1.5, maxWidth: '28ch' }}>
          Up <span style={{ color: 'var(--ff-olive)', fontWeight: 600 }}>+4</span> from March. You're doing well.
        </div>
      </div>

      <CALM.PipCard action="Move $25 →">
        Date-night fund is at 60%. A small nudge could finish it this week.
      </CALM.PipCard>
    </CALM.Body>
    <CALM.Fab label="Add"/>
    <CALM.MdNav active="home"/>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// ACTIVITY · iOS
// ════════════════════════════════════════════════════════════════
const TxnRow = ({ name, sub, amt, accent, last }) => (
  <CALM.Row title={name} sub={sub} value={CALM.money(amt, { sign: amt > 0 })} valTone={amt > 0 ? 'pos' : 'neg'} accent={accent} last={last}/>
);

CIOS.Activity = () => (
  <CALM.IPhone>
    <CALM.IOSNav title="Activity" sub="This week, every cent."/>
    <CALM.Body pad="16px 24px 24px" style={{ gap: 20 }}>
      <div style={{ height: 48, borderRadius: 16, background: 'var(--ff-surface)', border: '1px solid var(--ff-line)', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: 'var(--ff-ink-3)' }}>
        <span style={{ fontSize: 16 }}>⌕</span>
        Search transactions
      </div>

      <div>
        <CALM.Section>Today</CALM.Section>
        <div style={{ marginTop: 8 }}>
          {TXN_TODAY.map(([n, s, a], i, arr) => (
            <TxnRow key={i} name={n} sub={s} amt={a} accent={a > 0 ? SWATCH.income : SWATCH.food} last={i === arr.length - 1}/>
          ))}
        </div>
      </div>

      <div>
        <CALM.Section>This week</CALM.Section>
        <div style={{ marginTop: 8 }}>
          {TXN_WEEK.slice(0,3).map(([n, s, a], i, arr) => (
            <TxnRow key={i} name={n} sub={s} amt={a} accent={SWATCH.ent} last={i === arr.length - 1}/>
          ))}
        </div>
      </div>
    </CALM.Body>
    <CALM.Fab/>
    <CALM.IOSTabs active="activity"/>
  </CALM.IPhone>
);

// ════════════════════════════════════════════════════════════════
// ACTIVITY · Android
// ════════════════════════════════════════════════════════════════
CAND.Activity = () => (
  <CALM.Android>
    <CALM.MdTopBar title="Activity" sub="This week, every cent."/>
    <CALM.Body pad="16px 20px 24px" style={{ gap: 20 }}>
      <div style={{ height: 48, borderRadius: 24, background: 'var(--ff-surface)', border: '1px solid var(--ff-line)', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: 'var(--ff-ink-3)' }}>
        <span style={{ fontSize: 16 }}>⌕</span>
        Search transactions
      </div>
      <div>
        <CALM.Section>Today</CALM.Section>
        <div style={{ marginTop: 8 }}>
          {TXN_TODAY.map(([n, s, a], i, arr) => (
            <TxnRow key={i} name={n} sub={s} amt={a} accent={a > 0 ? SWATCH.income : SWATCH.food} last={i === arr.length - 1}/>
          ))}
        </div>
      </div>
      <div>
        <CALM.Section>This week</CALM.Section>
        <div style={{ marginTop: 8 }}>
          {TXN_WEEK.slice(0,3).map(([n, s, a], i, arr) => (
            <TxnRow key={i} name={n} sub={s} amt={a} accent={SWATCH.ent} last={i === arr.length - 1}/>
          ))}
        </div>
      </div>
    </CALM.Body>
    <CALM.Fab label="Add"/>
    <CALM.MdNav active="activity"/>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// PLAN · iOS  (the AI tab)
// ════════════════════════════════════════════════════════════════
CIOS.Plan = () => (
  <CALM.IPhone>
    <CALM.IOSNav title="Plan" sub="Three things, in order of impact."/>
    <CALM.Body pad="8px 24px 24px" style={{ gap: 20 }}>
      <CALM.PipCard action="See how →">
        I looked at this month. If you do one thing, do <b>#1</b>. The rest can wait a week.
      </CALM.PipCard>

      {[
        ['01', 'Move $200 to the Apple Card', 'Saves $52 in interest this year', true],
        ['02', 'Pause the Costco subscription', "You haven't used it since January", false],
        ['03', 'Top up the emergency fund $50', 'Keeps the 6-mo. cushion intact',  false],
      ].map(([num, title, sub, hot]) => (
        <div key={num} style={{
          borderTop: '1px solid var(--ff-line)', paddingTop: 18,
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: hot ? 'var(--ff-coral)' : 'var(--ff-ink-3)', letterSpacing: '0.16em', paddingTop: 2 }}>{num}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em', lineHeight: 1.2, color: 'var(--ff-ink)' }}>{title}</div>
            <div style={{ marginTop: 6, fontSize: 14, color: 'var(--ff-ink-2)', lineHeight: 1.45 }}>{sub}</div>
          </div>
          <span style={{ color: 'var(--ff-coral)', fontSize: 22, fontWeight: 300 }}>›</span>
        </div>
      ))}
    </CALM.Body>
    <CALM.IOSTabs active="plan"/>
  </CALM.IPhone>
);

CAND.Plan = () => (
  <CALM.Android>
    <CALM.MdTopBar title="Plan" sub="Three things, in order of impact."/>
    <CALM.Body pad="8px 20px 24px" style={{ gap: 20 }}>
      <CALM.PipCard action="See how →">
        I looked at this month. If you do one thing, do <b>#1</b>. The rest can wait a week.
      </CALM.PipCard>
      {[
        ['01', 'Move $200 to the Apple Card', 'Saves $52 in interest this year', true],
        ['02', 'Pause the Costco subscription', "You haven't used it since January", false],
        ['03', 'Top up the emergency fund $50', 'Keeps the 6-mo. cushion intact',  false],
      ].map(([num, title, sub, hot]) => (
        <div key={num} style={{
          borderTop: '1px solid var(--ff-line)', paddingTop: 18,
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, color: hot ? 'var(--ff-coral)' : 'var(--ff-ink-3)', letterSpacing: '0.16em', paddingTop: 2 }}>{num}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontWeight: 400, letterSpacing: '-0.015em', lineHeight: 1.2, color: 'var(--ff-ink)' }}>{title}</div>
            <div style={{ marginTop: 6, fontSize: 14, color: 'var(--ff-ink-2)', lineHeight: 1.45 }}>{sub}</div>
          </div>
          <span style={{ color: 'var(--ff-coral)', fontSize: 22, fontWeight: 300 }}>›</span>
        </div>
      ))}
    </CALM.Body>
    <CALM.MdNav active="plan"/>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// BUDGETS · iOS
// ════════════════════════════════════════════════════════════════
CIOS.Budgets = () => (
  <CALM.IPhone>
    <CALM.IOSNav title="Money" trail="+ Add"/>
    <div style={{ padding: '0 24px 8px' }}>
      <CALM.Segmented items={[['Net worth'], ['Budgets', true], ['Goals'], ['Debts']]}/>
    </div>
    <CALM.Body pad="16px 24px 24px" style={{ gap: 24 }}>
      <div>
        <CALM.Cap>Spent in April</CALM.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 56, fontWeight: 400, letterSpacing: '-0.03em', marginTop: 8, lineHeight: 1 }}>
          $1,360
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 14, fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--ff-ink-3)', letterSpacing: '0.06em' }}>
          <span>of $2,000</span>
          <span>·</span>
          <span style={{ color: 'var(--ff-olive)' }}>$640 left</span>
          <span>·</span>
          <span>3 days to go</span>
        </div>
        <div style={{ marginTop: 16 }}><CALM.Bar pct={68} color="var(--ff-coral)" h={10}/></div>
      </div>

      <div>
        <CALM.Section right="See all →">By category</CALM.Section>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            ['Food',          84,  'var(--ff-honey)'],
            ['Shopping',      68,  'var(--ff-coral)'],
            ['Transport',     42,  'var(--ff-olive)'],
          ].map(([name, pct, c]) => (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{name}</span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: 'var(--ff-ink-3)' }} data-num>{pct}%</span>
              </div>
              <CALM.Bar pct={pct} color={c} h={8}/>
            </div>
          ))}
        </div>
      </div>
    </CALM.Body>
    <CALM.IOSTabs active="money"/>
  </CALM.IPhone>
);

CAND.Budgets = () => (
  <CALM.Android>
    <CALM.MdTopBar title="Money" actions={['+']}/>
    <div style={{ padding: '0 20px 8px' }}>
      <CALM.Segmented items={[['Net worth'], ['Budgets', true], ['Goals'], ['Debts']]}/>
    </div>
    <CALM.Body pad="16px 20px 24px" style={{ gap: 24 }}>
      <div>
        <CALM.Cap>Spent in April</CALM.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 56, fontWeight: 400, letterSpacing: '-0.03em', marginTop: 8, lineHeight: 1 }}>
          $1,360
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 14, fontFamily: 'var(--ff-mono)', fontSize: 12, color: 'var(--ff-ink-3)', letterSpacing: '0.06em' }}>
          <span>of $2,000</span>
          <span>·</span>
          <span style={{ color: 'var(--ff-olive)' }}>$640 left</span>
          <span>·</span>
          <span>3 days to go</span>
        </div>
        <div style={{ marginTop: 16 }}><CALM.Bar pct={68} color="var(--ff-coral)" h={10}/></div>
      </div>
      <div>
        <CALM.Section right="See all →">By category</CALM.Section>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            ['Food',          84,  'var(--ff-honey)'],
            ['Shopping',      68,  'var(--ff-coral)'],
            ['Transport',     42,  'var(--ff-olive)'],
          ].map(([name, pct, c]) => (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{name}</span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: 'var(--ff-ink-3)' }} data-num>{pct}%</span>
              </div>
              <CALM.Bar pct={pct} color={c} h={8}/>
            </div>
          ))}
        </div>
      </div>
    </CALM.Body>
    <CALM.MdNav active="money"/>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// GOALS · iOS
// ════════════════════════════════════════════════════════════════
const GoalBlock = ({ name, cur, tgt, sub, color, hot }) => {
  const pct = Math.round((cur / tgt) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.005em' }}>{name}</span>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: hot ? 'var(--ff-coral)' : 'var(--ff-ink-3)' }} data-num>{pct}%</span>
      </div>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', marginTop: 8, lineHeight: 1 }}>
        {CALM.money(cur)} <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, color: 'var(--ff-ink-3)', letterSpacing: '0.04em' }}>/ {CALM.money(tgt)}</span>
      </div>
      <div style={{ marginTop: 12 }}><CALM.Bar pct={pct} color={color} h={8}/></div>
      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ff-ink-3)' }}>{sub}</div>
    </div>
  );
};

CIOS.Goals = () => (
  <CALM.IPhone>
    <CALM.IOSNav title="Money" trail="+ New"/>
    <div style={{ padding: '0 24px 8px' }}>
      <CALM.Segmented items={[['Net worth'], ['Budgets'], ['Goals', true], ['Debts']]}/>
    </div>
    <CALM.Body pad="20px 24px 24px" style={{ gap: 28 }}>
      <GoalBlock name="Emergency fund"  cur={4200} tgt={6000} sub="On pace · 8 months to go" color="var(--ff-olive)"/>
      <GoalBlock name="Kyoto 2026"      cur={1850} tgt={4000} sub="Pip flagged · could finish by Sep" color="var(--ff-coral)" hot/>
      <GoalBlock name="Wedding · Aug"   cur={8400} tgt={12000} sub="4 months left" color="var(--ff-plum)"/>
    </CALM.Body>
    <CALM.IOSTabs active="money"/>
  </CALM.IPhone>
);

CAND.Goals = () => (
  <CALM.Android>
    <CALM.MdTopBar title="Money" actions={['+']}/>
    <div style={{ padding: '0 20px 8px' }}>
      <CALM.Segmented items={[['Net worth'], ['Budgets'], ['Goals', true], ['Debts']]}/>
    </div>
    <CALM.Body pad="20px 20px 24px" style={{ gap: 28 }}>
      <GoalBlock name="Emergency fund"  cur={4200} tgt={6000} sub="On pace · 8 months to go" color="var(--ff-olive)"/>
      <GoalBlock name="Kyoto 2026"      cur={1850} tgt={4000} sub="Pip flagged · could finish by Sep" color="var(--ff-coral)" hot/>
      <GoalBlock name="Wedding · Aug"   cur={8400} tgt={12000} sub="4 months left" color="var(--ff-plum)"/>
    </CALM.Body>
    <CALM.MdNav active="money"/>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// NET WORTH · iOS
// ════════════════════════════════════════════════════════════════
CIOS.Wealth = () => (
  <CALM.IPhone>
    <CALM.IOSNav title="Money"/>
    <div style={{ padding: '0 24px 8px' }}>
      <CALM.Segmented items={[['Net worth', true], ['Budgets'], ['Goals'], ['Debts']]}/>
    </div>
    <CALM.Body pad="20px 24px 24px" style={{ gap: 28 }}>
      <div>
        <CALM.Cap>Net worth · April 28</CALM.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 56, fontWeight: 400, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1 }}>
          $28,400
        </div>
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--ff-sage-tint)', color: 'var(--ff-olive)', borderRadius: 99, fontSize: 13, fontWeight: 500 }}>
          ↑ $840 over 30 days
        </div>
        <div style={{ marginTop: 18 }}><CALM.Spark w={342} h={64}/></div>
      </div>

      <div>
        <CALM.Section right="Detail →">Assets · $40,700</CALM.Section>
        <div style={{ marginTop: 6 }}>
          <CALM.Row title="Checking" sub="Chase" value={CALM.money(4820)} chev accent="var(--ff-denim-tint)"/>
          <CALM.Row title="HYSA"    sub="Marcus" value={CALM.money(12600)} chev accent="var(--ff-sage-tint)"/>
          <CALM.Row title="Brokerage" sub="Fidelity" value={CALM.money(18400)} chev accent="var(--ff-olive-tint)" last/>
        </div>
      </div>
    </CALM.Body>
    <CALM.IOSTabs active="money"/>
  </CALM.IPhone>
);

CAND.Wealth = () => (
  <CALM.Android>
    <CALM.MdTopBar title="Money"/>
    <div style={{ padding: '0 20px 8px' }}>
      <CALM.Segmented items={[['Net worth', true], ['Budgets'], ['Goals'], ['Debts']]}/>
    </div>
    <CALM.Body pad="20px 20px 24px" style={{ gap: 28 }}>
      <div>
        <CALM.Cap>Net worth · April 28</CALM.Cap>
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 56, fontWeight: 400, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1 }}>
          $28,400
        </div>
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--ff-sage-tint)', color: 'var(--ff-olive)', borderRadius: 99, fontSize: 13, fontWeight: 500 }}>
          ↑ $840 over 30 days
        </div>
        <div style={{ marginTop: 18 }}><CALM.Spark w={350} h={64}/></div>
      </div>
      <div>
        <CALM.Section right="Detail →">Assets · $40,700</CALM.Section>
        <div style={{ marginTop: 6 }}>
          <CALM.Row title="Checking" sub="Chase" value={CALM.money(4820)} chev accent="var(--ff-denim-tint)"/>
          <CALM.Row title="HYSA"    sub="Marcus" value={CALM.money(12600)} chev accent="var(--ff-sage-tint)"/>
          <CALM.Row title="Brokerage" sub="Fidelity" value={CALM.money(18400)} chev accent="var(--ff-olive-tint)" last/>
        </div>
      </div>
    </CALM.Body>
    <CALM.MdNav active="money"/>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// ADD TRANSACTION · iOS  (amount is the screen)
// ════════════════════════════════════════════════════════════════
CIOS.AddTxn = () => (
  <CALM.IPhone>
    <CALM.IOSNav title={null} lead="close" trail="Save"/>
    <div style={{ padding: '8px 24px 0' }}>
      <CALM.Cap>New expense · Apr 28</CALM.Cap>
    </div>
    <div style={{ padding: '20px 24px 0', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 44, color: 'var(--ff-ink-3)' }}>$</span>
        <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 88, fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 1 }}>84</span>
        <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 36, color: 'var(--ff-ink-3)' }}>.20</span>
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--ff-ink-3)', letterSpacing: '0.16em' }}>AMOUNT · USD</div>
    </div>

    <CALM.Body pad="28px 24px 16px" style={{ gap: 0 }}>
      <CALM.Row title="Whole Foods Mkt." sub="Pip suggests · Groceries" value="Food" valTone="coral" chev/>
      <CALM.Row title="Paid by"          sub="Alex"     chev/>
      <CALM.Row title="Split"            sub="With Jamie · 50/50" chev/>
      <CALM.Row title="Note"             sub="Optional" chev last/>
    </CALM.Body>

    {/* Mock keypad — generous keys */}
    <div style={{ background: 'var(--ff-canvas-2)', padding: '12px 8px 36px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
        <div key={k} style={{ height: 52, borderRadius: 12, background: k === '⌫' ? 'transparent' : 'var(--ff-surface)', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 400, color: 'var(--ff-ink)' }}>{k}</div>
      ))}
    </div>
  </CALM.IPhone>
);

CAND.AddTxn = () => (
  <CALM.Android>
    <CALM.MdTopBar title={null} lead="close" actions={['Save']}/>
    <div style={{ padding: '0 20px' }}>
      <CALM.Cap>New expense · Apr 28</CALM.Cap>
    </div>
    <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 44, color: 'var(--ff-ink-3)' }}>$</span>
        <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 88, fontWeight: 400, letterSpacing: '-0.04em', lineHeight: 1 }}>84</span>
        <span style={{ fontFamily: 'var(--ff-serif)', fontSize: 36, color: 'var(--ff-ink-3)' }}>.20</span>
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--ff-ink-3)', letterSpacing: '0.16em' }}>AMOUNT · USD</div>
    </div>
    <CALM.Body pad="28px 20px 16px" style={{ gap: 0 }}>
      <CALM.Row title="Whole Foods Mkt." sub="Pip suggests · Groceries" value="Food" valTone="coral" chev/>
      <CALM.Row title="Paid by"          sub="Alex"     chev/>
      <CALM.Row title="Split"            sub="With Jamie · 50/50" chev/>
      <CALM.Row title="Note"             sub="Optional" chev last/>
    </CALM.Body>
    <div style={{ background: 'var(--ff-canvas-2)', padding: '12px 8px 28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
        <div key={k} style={{ height: 52, borderRadius: 12, background: k === '⌫' ? 'transparent' : 'var(--ff-surface)', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 400, color: 'var(--ff-ink)' }}>{k}</div>
      ))}
    </div>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// YOU / Profile · iOS  (settings as breathing list)
// ════════════════════════════════════════════════════════════════
CIOS.You = () => (
  <CALM.IPhone>
    <CALM.IOSNav title="You"/>
    <CALM.Body pad="8px 24px 24px" style={{ gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 22, fontWeight: 600 }}>AR</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 24, fontWeight: 400, letterSpacing: '-0.015em' }}>Alex Reyes</div>
          <div style={{ marginTop: 2, fontSize: 14, color: 'var(--ff-ink-3)' }}>Primary · Reyes household</div>
        </div>
      </div>

      <div>
        <CALM.Section>Household</CALM.Section>
        <div style={{ marginTop: 4 }}>
          <CALM.Row title="Members" sub="3 people" chev/>
          <CALM.Row title="Linked accounts" sub="6 connected · 1 needs attention" chev valTone="coral"/>
          <CALM.Row title="Upgrade to Family" sub="Bank-link · roles · audit" chev last/>
        </div>
      </div>

      <div>
        <CALM.Section>Security</CALM.Section>
        <div style={{ marginTop: 4 }}>
          <CALM.Row title="Face ID & PIN" sub="On" chev/>
          <CALM.Row title="Privacy & data" chev last/>
        </div>
      </div>
    </CALM.Body>
    <CALM.IOSTabs active="you"/>
  </CALM.IPhone>
);

CAND.You = () => (
  <CALM.Android>
    <CALM.MdTopBar title="You"/>
    <CALM.Body pad="0 20px 24px" style={{ gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 22, fontWeight: 600 }}>AR</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 24, fontWeight: 400, letterSpacing: '-0.015em' }}>Alex Reyes</div>
          <div style={{ marginTop: 2, fontSize: 14, color: 'var(--ff-ink-3)' }}>Primary · Reyes household</div>
        </div>
      </div>
      <div>
        <CALM.Section>Household</CALM.Section>
        <div style={{ marginTop: 4 }}>
          <CALM.Row title="Members" sub="3 people" chev/>
          <CALM.Row title="Linked accounts" sub="6 connected · 1 needs attention" chev valTone="coral"/>
          <CALM.Row title="Upgrade to Family" sub="Bank-link · roles · audit" chev last/>
        </div>
      </div>
      <div>
        <CALM.Section>Security</CALM.Section>
        <div style={{ marginTop: 4 }}>
          <CALM.Row title="Fingerprint & PIN" sub="On" chev/>
          <CALM.Row title="Privacy & data" chev last/>
        </div>
      </div>
    </CALM.Body>
    <CALM.MdNav active="you"/>
  </CALM.Android>
);

// ════════════════════════════════════════════════════════════════
// WELCOME · iOS  (the first impression — generous)
// ════════════════════════════════════════════════════════════════
CIOS.Welcome = () => (
  <CALM.IPhone>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 28px 32px', position: 'relative' }}>
      <div style={{ paddingTop: 60 }}>
        <CALM.Pip size={60}/>
        <div style={{ marginTop: 36, fontFamily: 'var(--ff-serif)', fontSize: 48, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.02 }}>
          Money,<br/><em style={{ color: 'var(--ff-coral)' }}>together.</em>
        </div>
        <p style={{ marginTop: 20, fontSize: 17, color: 'var(--ff-ink-2)', lineHeight: 1.55, maxWidth: '24ch' }}>
          A calm household ledger for couples, families, and the people who help them along.
        </p>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CALM.Btn>Create an account</CALM.Btn>
        <CALM.Btn variant="ghost">I already have one</CALM.Btn>
      </div>
    </div>
  </CALM.IPhone>
);

CAND.Welcome = () => (
  <CALM.Android>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 24px 32px', position: 'relative' }}>
      <div style={{ paddingTop: 56 }}>
        <CALM.Pip size={60}/>
        <div style={{ marginTop: 36, fontFamily: 'var(--ff-serif)', fontSize: 48, fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.02 }}>
          Money,<br/><em style={{ color: 'var(--ff-coral)' }}>together.</em>
        </div>
        <p style={{ marginTop: 20, fontSize: 17, color: 'var(--ff-ink-2)', lineHeight: 1.55, maxWidth: '24ch' }}>
          A calm household ledger for couples, families, and the people who help them along.
        </p>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CALM.Btn>Create an account</CALM.Btn>
        <CALM.Btn variant="ghost">I already have one</CALM.Btn>
      </div>
    </div>
  </CALM.Android>
);

Object.assign(window, { CIOS, CAND });
