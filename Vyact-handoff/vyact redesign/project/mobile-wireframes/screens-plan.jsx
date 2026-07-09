/* global React, WF */
// FinFlow — Plan tab (AI assistant + personalized planner)
// Builds on the desktop concept: rules-based recs PLUS Pip's "what would I do" advice,
// each rec has a one-click "Do it" path (the desktop's biggest gap closed on mobile).
//
// Two screens per platform:
//   Plan          — the tab itself: Pip chat thread + recommendation cards
//   PlanDetail    — one rec opened: explanation, math, and the execution sheet
//
// Exported under window.IOS and window.AND.

// ── Shared data ────────────────────────────────────────────────
const RECS = [
  {
    id: 'avalanche-card',
    tone: 'coral',
    eyebrow: 'DEBT · HIGH IMPACT',
    title: "Send $200 more to your Apple Card next month",
    why: "It's your highest-APR debt (21.9%). Redirecting from the date-night fund — already 60% full — saves $340 in interest and finishes the card 4 months sooner.",
    impactA: { label: 'Saves', value: '$340', tone: 'pos' },
    impactB: { label: 'Pays off', value: '4 mo sooner', tone: 'pos' },
    action: 'Schedule one-time + $200',
  },
  {
    id: 'budget-food',
    tone: 'honey',
    eyebrow: 'BUDGET · WATCH',
    title: 'Food is on pace to hit $520 — $20 over',
    why: "Three weeks in and you're at 84%. The last two weeks tracked $130/week. Bumping the cap to $520 (5%) keeps the budget honest without nudging every Friday.",
    impactA: { label: 'New cap', value: '$520' },
    impactB: { label: 'Vs avg', value: 'matches 3-mo' },
    action: 'Adjust Food budget',
  },
  {
    id: 'auto-transfer',
    tone: 'sage',
    eyebrow: 'SAVINGS · QUIET WIN',
    title: 'Round up debit purchases into your Emergency Fund',
    why: "If we'd been doing this for the last 90 days you'd be $84 further along. Turning it on now adds ~$28/mo on average — fully reversible.",
    impactA: { label: 'Adds', value: '~$28/mo', tone: 'pos' },
    impactB: { label: 'Hit goal', value: '6 wks sooner', tone: 'pos' },
    action: 'Turn on round-ups',
  },
  {
    id: 'recurring-review',
    tone: 'denim',
    eyebrow: 'SUBSCRIPTIONS',
    title: '3 subscriptions are creeping up — review them?',
    why: "Spotify, Equinox, and an iCloud tier renewed at higher prices since January. Combined: +$11.40/mo. Quick pass to keep or cancel.",
    impactA: { label: 'Reclaim', value: '$11.40/mo' },
    impactB: { label: 'Time', value: '~2 min' },
    action: 'Review 3 charges',
  },
];

const CHAT = [
  { who: 'pip', text: "Hey Alex — Sunday review's ready. Pulse held at 78. Food's a touch hot but everything else is on track." },
  { who: 'you', text: "Should I worry about the credit card?" },
  { who: 'pip', text: "Worry — no. But it's costing the most. If you can swing $200 more next month I'd send it there before the date-night fund. Want me to schedule it?", action: 'avalanche-card' },
];

const toneMap = {
  coral: ['var(--ff-coral)', 'var(--ff-coral-deep)', 'var(--ff-coral-tint)'],
  honey: ['var(--ff-honey)', '#A06A2C', 'var(--ff-honey-tint)'],
  sage:  ['var(--ff-olive)', 'var(--ff-olive)', 'var(--ff-sage-tint)'],
  denim: ['var(--ff-denim)', 'var(--ff-denim)', 'var(--ff-denim-tint)'],
};

// ── Shared rec card (renders same on both platforms; chrome is the diff) ──
const RecCard = ({ rec, ranked, platform = 'ios' }) => {
  const [accent, ink, tint] = toneMap[rec.tone] || toneMap.coral;
  const radius = platform === 'android' ? 24 : 14;
  return (
    <div style={{
      background: '#FBF7EE',
      border: `1px solid rgba(42,37,34,0.10)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: radius,
      padding: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, fontWeight: 500, color: ink, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{rec.eyebrow}</span>
        {ranked && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'rgba(42,37,34,0.5)', letterSpacing: '0.1em' }}>#{ranked}</span>}
      </div>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 17, lineHeight: 1.25, marginTop: 4, color: '#2A2522' }}>
        {rec.title}
      </div>
      <p style={{ fontSize: 12, color: 'rgba(42,37,34,0.65)', lineHeight: 1.45, marginTop: 6 }}>{rec.why}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {[rec.impactA, rec.impactB].map((m, i) => (
          <div key={i} style={{ flex: 1, padding: '6px 10px', background: tint, borderRadius: 8 }}>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'rgba(42,37,34,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 16, color: m.tone === 'pos' ? 'var(--ff-olive)' : '#2A2522' }}>{m.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <div style={{
          flex: 1, height: platform === 'android' ? 40 : 38,
          borderRadius: platform === 'android' ? 20 : 10,
          background: accent, color: '#fff',
          display: 'grid', placeItems: 'center',
          fontSize: 13, fontWeight: platform === 'android' ? 500 : 600,
          letterSpacing: platform === 'android' ? 0.4 : 0,
          textTransform: platform === 'android' ? 'uppercase' : 'none',
        }}>{rec.action}</div>
        <div style={{
          width: platform === 'android' ? 40 : 38, height: platform === 'android' ? 40 : 38,
          borderRadius: platform === 'android' ? 20 : 10,
          border: '1px solid rgba(42,37,34,0.15)',
          display: 'grid', placeItems: 'center', fontSize: 16, color: 'rgba(42,37,34,0.55)',
        }}>⋯</div>
      </div>
    </div>
  );
};

// ── Chat bubble (cross-platform) ──
const Bubble = ({ who, text, action, platform }) => {
  const isPip = who === 'pip';
  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isPip ? 'row' : 'row-reverse', alignItems: 'flex-end' }}>
      {isPip && <WF.Pip size={22}/>}
      <div style={{
        maxWidth: '78%',
        background: isPip ? '#FBF7EE' : 'var(--ff-coral)',
        color: isPip ? '#2A2522' : '#fff',
        padding: '8px 12px',
        borderRadius: isPip ? '4px 14px 14px 14px' : '14px 14px 4px 14px',
        fontSize: 13, lineHeight: 1.45,
        border: isPip ? '1px solid rgba(42,37,34,0.08)' : 'none',
      }}>
        {text}
        {action && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(42,37,34,0.06)', color: '#2A2522',
            fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--ff-coral)' }}/>
            Suggested action attached →
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// iOS — Plan tab
// ══════════════════════════════════════════════════════════════════
window.IOS.Plan = () => (
  <WF.IPhone>
    <div style={{ padding: '4px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        <WF.Cap>YOUR PLAN · MAY 2026</WF.Cap>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
          Plan
          <span style={{ height: 18, padding: '0 7px', borderRadius: 9, background: 'var(--ff-coral-tint)', color: 'var(--ff-coral-deep)', fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.1em', display: 'inline-flex', alignItems: 'center' }}>BETA</span>
        </div>
      </div>
      <span style={{ fontSize: 18, color: 'rgba(42,37,34,0.5)' }}>⋯</span>
    </div>

    {/* segmented Pip / Recs */}
    <div style={{ padding: '4px 16px 8px' }}>
      <div style={{ display: 'flex', background: 'rgba(42,37,34,0.06)', borderRadius: 10, padding: 3 }}>
        {[['Ask Pip', false], ['For you', true]].map(([l, on]) => (
          <div key={l} style={{ flex: 1, padding: 7, borderRadius: 8, background: on ? '#FBF7EE' : 'transparent', textAlign: 'center', fontSize: 12, fontWeight: on ? 600 : 500, color: on ? '#2A2522' : 'rgba(42,37,34,0.55)' }}>{l}</div>
        ))}
      </div>
    </div>

    <WF.Scroll pad="2px 14px 14px">
      {/* Pulse banner — context for the recs */}
      <WF.Card pad={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <WF.Pip size={28} mood="calm"/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
            <b>4 things</b> Pip thinks are worth a look — ranked by impact on your <b>Pulse</b>.
          </div>
        </div>
        <span style={{ height: 28, padding: '0 10px', borderRadius: 14, background: 'var(--ff-coral)', color: '#fff', fontSize: 11.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>Run all</span>
      </WF.Card>

      <WF.SectionHead right="WHY THESE?">PERSONALIZED FOR YOU</WF.SectionHead>
      {RECS.map((r, i) => <RecCard key={r.id} rec={r} ranked={i + 1} platform="ios"/>)}

      {/* Recent advice — chat preview */}
      <WF.SectionHead right="OPEN CHAT →">RECENT ADVICE</WF.SectionHead>
      <WF.Card pad={12} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CHAT.slice(0, 3).map((c, i) => <Bubble key={i} {...c} platform="ios"/>)}
        <div style={{ display: 'flex', gap: 8, marginTop: 4, padding: '8px 12px', background: 'rgba(42,37,34,0.04)', borderRadius: 10, fontSize: 12, color: 'rgba(42,37,34,0.5)', alignItems: 'center' }}>
          <span>Ask anything about your money…</span>
          <span style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 13, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 13 }}>↑</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {['Can we afford Kyoto?', 'How much did we spend on takeout?', 'Best month to refinance?'].map(q => (
            <span key={q} style={{ height: 26, padding: '0 10px', borderRadius: 13, border: '1px solid rgba(42,37,34,0.12)', display: 'inline-flex', alignItems: 'center', fontSize: 11, color: 'rgba(42,37,34,0.7)' }}>{q}</span>
          ))}
        </div>
      </WF.Card>

      <div style={{ textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(42,37,34,0.45)', letterSpacing: '0.1em' }}>
        PIP IS A FINANCIAL HELPER — NOT A LICENSED ADVISOR.
      </div>
    </WF.Scroll>
    <WF.IOSTabs active="plan"/>
  </WF.IPhone>
);

window.IOS.PlanDetail = () => (
  <WF.IPhone>
    <WF.IOSNav title="" lead="back" trail="Snooze"/>
    <WF.Scroll>
      <WF.Cap color="var(--ff-coral-deep)">DEBT · HIGH IMPACT · MAY 2026</WF.Cap>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.15, marginTop: 4 }}>
        Send <em style={{ color: 'var(--ff-coral)' }}>$200 more</em> to your Apple Card next month.
      </div>

      <WF.Card pad={14} style={{ background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral-soft)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <WF.Pip size={26}/>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: '#2A2522' }}>
          "Your Apple Card sits at <b>21.9%</b> — the highest rate in the household. You're already <b>60%</b> of the way to the date-night fund and not on a deadline for it. Borrow from there for one month and pay it back in June. Math's tidy. Vibes intact."
        </div>
      </WF.Card>

      <WF.Card pad={14}>
        <WF.Cap>WHAT IT DOES</WF.Cap>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['🔻', 'Cuts interest by', '$340 over 14 months', 'pos'],
            ['⏱', 'Pays off card', '4 months earlier (Aug → Apr)', 'pos'],
            ['↩', 'Pauses', 'Date-night fund deposit · 1 month', 'neutral'],
            ['📈', 'Pulse impact', '+3 points', 'pos'],
          ].map(([i, l, v, t]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(42,37,34,0.05)', display: 'inline-grid', placeItems: 'center', fontSize: 13 }}>{i}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{l}</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11.5, color: t === 'pos' ? 'var(--ff-olive)' : '#2A2522', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </WF.Card>

      <WF.Card pad={14}>
        <WF.Cap>SHOW MY WORK</WF.Cap>
        <div style={{ marginTop: 8, fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'rgba(42,37,34,0.7)', background: 'rgba(42,37,34,0.04)', padding: 10, borderRadius: 8, lineHeight: 1.5 }}>
          Balance &nbsp;$3,850 @ 21.9%<br/>
          Current pay &nbsp;$95/mo&nbsp; → 51 mo<br/>
          With <b>+$200</b> &nbsp;$295/mo &nbsp;→ <b>14 mo</b><br/>
          Δ Interest &nbsp;<span style={{ color: 'var(--ff-olive)' }}>−$340</span>
        </div>
      </WF.Card>

      <WF.SectionHead>EXECUTE</WF.SectionHead>
      <WF.Card pad={14}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>One-time, scheduled for May 15</div>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)', marginTop: 2 }}>From Chase ··6204 → Apple Card</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ff-coral)', fontWeight: 600 }}>Edit</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[['One-time', true], ['Recurring · monthly'], ['Custom']].map(([l, on]) => (
            <span key={l} style={{
              flex: 1, height: 32, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11.5, fontWeight: 500,
              background: on ? 'var(--ff-coral)' : '#FBF7EE',
              color: on ? '#fff' : '#2A2522',
              border: on ? 'none' : '1px solid rgba(42,37,34,0.12)',
            }}>{l}</span>
          ))}
        </div>
      </WF.Card>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 48, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600 }}>Schedule + $200 payment</div>
        <div style={{ height: 40, display: 'grid', placeItems: 'center', fontSize: 13, color: 'rgba(42,37,34,0.6)' }}>Not now</div>
      </div>
    </WF.Scroll>
  </WF.IPhone>
);

// ══════════════════════════════════════════════════════════════════
// Android — Plan tab
// ══════════════════════════════════════════════════════════════════
window.AND.Plan = () => (
  <WF.Android>
    <WF.MdTopBar title="Plan" lead="menu" actions={['⌕', '⋮']}/>
    {/* segmented buttons (M3) */}
    <div style={{ padding: '0 16px 8px' }}>
      <div style={{ display: 'flex', borderRadius: 20, border: '1px solid rgba(42,37,34,0.25)', overflow: 'hidden' }}>
        {[['Ask Pip', false], ['For you', true]].map(([l, on]) => (
          <div key={l} style={{
            flex: 1, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: on ? 'var(--ff-sage-tint)' : 'transparent',
            color: on ? 'var(--ff-olive)' : '#2A2522',
            fontSize: 12.5, fontWeight: 500,
          }}>{on && '✓ '}{l}</div>
        ))}
      </div>
    </div>

    <WF.Scroll pad="0 16px 14px">
      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 28, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <WF.Pip size={32} mood="calm"/>
          <div style={{ flex: 1 }}>
            <WF.Cap color="var(--ff-coral-deep)">YOUR PLAN · MAY</WF.Cap>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 18, lineHeight: 1.2, marginTop: 2 }}>
              4 small moves. Ranked by impact on your Pulse.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <div style={{ flex: 1, height: 40, borderRadius: 20, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>Run all</div>
          <div style={{ height: 40, padding: '0 16px', borderRadius: 20, border: '1px solid var(--ff-coral)', color: 'var(--ff-coral-deep)', display: 'inline-flex', alignItems: 'center', fontSize: 12.5, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase' }}>Why these</div>
        </div>
      </div>

      <WF.SectionHead>PERSONALIZED FOR YOU</WF.SectionHead>
      {RECS.map((r, i) => <RecCard key={r.id} rec={r} ranked={i + 1} platform="android"/>)}

      <WF.SectionHead right="OPEN CHAT →">RECENT ADVICE</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CHAT.slice(0, 3).map((c, i) => <Bubble key={i} {...c} platform="android"/>)}
        <div style={{ marginTop: 4, height: 48, borderRadius: 24, background: 'rgba(42,37,34,0.04)', display: 'flex', alignItems: 'center', padding: '0 6px 0 16px', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: 'rgba(42,37,34,0.5)', flex: 1 }}>Ask anything about your money…</span>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--ff-coral)', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 16 }}>↑</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          {['Can we afford Kyoto?', 'How much on takeout?', 'Best time to refinance?'].map(q => (
            <span key={q} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(42,37,34,0.2)', display: 'inline-flex', alignItems: 'center', fontSize: 11.5, color: 'rgba(42,37,34,0.7)' }}>{q}</span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'rgba(42,37,34,0.45)', letterSpacing: '0.1em' }}>
        PIP IS A FINANCIAL HELPER — NOT A LICENSED ADVISOR.
      </div>
    </WF.Scroll>
    <WF.MdNav active="plan"/>
  </WF.Android>
);

window.AND.PlanDetail = () => (
  <WF.Android>
    <WF.MdTopBar title="" lead="back" actions={['Snooze', '⋮']}/>
    <WF.Scroll pad="0 16px 14px">
      <WF.Cap color="var(--ff-coral-deep)">DEBT · HIGH IMPACT · MAY 2026</WF.Cap>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 4 }}>
        Send <em style={{ color: 'var(--ff-coral)' }}>$200 more</em> to your Apple Card next month.
      </div>

      <div style={{ background: 'var(--ff-coral-tint)', borderRadius: 24, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start', borderLeft: '4px solid var(--ff-coral)' }}>
        <WF.Pip size={26}/>
        <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          "Your Apple Card sits at <b>21.9%</b> — highest rate in the household. You're <b>60%</b> to the date-night fund and not on a deadline. Borrow from there for one month, pay it back in June."
        </div>
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
        <WF.Cap>WHAT IT DOES</WF.Cap>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['🔻', 'Cuts interest by', '$340 over 14 months', 'pos'],
            ['⏱', 'Pays off card', '4 months earlier (Aug → Apr)', 'pos'],
            ['↩', 'Pauses', 'Date-night fund · 1 month', 'neutral'],
            ['📈', 'Pulse impact', '+3 points', 'pos'],
          ].map(([i, l, v, t]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(42,37,34,0.05)', display: 'inline-grid', placeItems: 'center', fontSize: 13 }}>{i}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{l}</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11.5, color: t === 'pos' ? 'var(--ff-olive)' : '#2A2522', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
        <WF.Cap>SHOW MY WORK</WF.Cap>
        <div style={{ marginTop: 8, fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'rgba(42,37,34,0.7)', background: 'rgba(42,37,34,0.04)', padding: 10, borderRadius: 12, lineHeight: 1.5 }}>
          Balance &nbsp;$3,850 @ 21.9%<br/>
          Current pay &nbsp;$95/mo&nbsp; → 51 mo<br/>
          With <b>+$200</b> &nbsp;$295/mo &nbsp;→ <b>14 mo</b><br/>
          Δ Interest &nbsp;<span style={{ color: 'var(--ff-olive)' }}>−$340</span>
        </div>
      </div>

      <WF.SectionHead>EXECUTE</WF.SectionHead>
      <div style={{ background: '#FBF7EE', borderRadius: 24, padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>One-time, scheduled May 15</div>
            <div style={{ fontSize: 11, color: 'rgba(42,37,34,0.6)', marginTop: 2 }}>Chase ··6204 → Apple Card</div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--ff-coral)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Edit</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[['One-time', true], ['Recurring'], ['Custom']].map(([l, on]) => (
            <span key={l} style={{
              flex: 1, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11.5, fontWeight: 500,
              background: on ? 'var(--ff-coral-tint)' : 'transparent',
              border: on ? '1px solid var(--ff-coral)' : '1px solid rgba(42,37,34,0.25)',
              color: on ? 'var(--ff-coral-deep)' : '#2A2522',
            }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 500, letterSpacing: 0.4 }}>SCHEDULE + $200 PAYMENT</div>
        <div style={{ height: 40, display: 'grid', placeItems: 'center', fontSize: 12.5, color: 'rgba(42,37,34,0.6)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 500 }}>Not now</div>
      </div>
    </WF.Scroll>
  </WF.Android>
);
