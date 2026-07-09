// Foundations: Manifesto, Voice & Pip, Personas, Color (light + shell), Type, Spacing, Iconography

const Foundations = {
  // ─── Manifesto ─────────────────────────────
  Manifesto: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 64, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--ff-coral)' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <FF.Caption style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--ff-coral)' }} />
          01 / Brand · Voice · Mascot
        </FF.Caption>
        <FF.Caption>v1.0 · May 2026</FF.Caption>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 28 }}>
          <FF.Pip size={88} mood="happy" />
          <div>
            <FF.Wordmark size={56} />
            <div style={{ marginTop: 8, fontFamily: 'var(--ff-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ff-ink-3)' }}>
              Family finance OS · with Pip
            </div>
          </div>
        </div>
        <h1 style={{ fontFamily: 'var(--ff-serif)', fontSize: 88, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.03em', maxWidth: '16ch' }}>
          A finance app that feels <FF.Serif>warm,</FF.Serif><br />
          not <FF.Serif>cold.</FF.Serif>
        </h1>
        <p style={{ marginTop: 26, maxWidth: '58ch', fontSize: 17, lineHeight: 1.55, color: 'var(--ff-ink-2)' }}>
          Most fintech leans clinical — navy charts, sterile numerics, robotic affirmations. FinFlow goes the other way:
          warm cream paper, hand-set serif headlines, a coral accent that signals <FF.Serif>care</FF.Serif>,
          and a gentle mascot named <strong>Pip</strong> who knows when to cheer and when to stay quiet.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, paddingTop: 28, borderTop: '1px solid var(--ff-line-2)' }}>
        {[
          ['Calm, not corporate', 'Cool fintech reads as banks-and-bills. Warm paper reads as kitchen-table conversation.'],
          ['Honest, never preachy', 'Name the win, name the slip. Never shame. Never breezy about debt.'],
          ['Refuse the slop', 'No gradient walls, no chart-junk, no fake confetti. One accent does the work of three.'],
          ['Numerals are sacred', 'Mono numerals everywhere. Tabular. Sign and color carry meaning before words do.'],
        ].map(([h, p], i) => (
          <div key={h}>
            <FF.Caption style={{ color: 'var(--ff-coral)', marginBottom: 8 }}>0{i + 1}</FF.Caption>
            <div style={{ fontWeight: 500, fontSize: 15, letterSpacing: '-0.005em', marginBottom: 6 }}>{h}</div>
            <div style={{ fontSize: 13, color: 'var(--ff-ink-2)', lineHeight: 1.5 }}>{p}</div>
          </div>
        ))}
      </div>
    </div>
  ),

  // ─── Pip — mascot moods ────────────────────
  Pip: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="01.1 / Mascot"
        title={<>Meet <FF.Serif>Pip.</FF.Serif></>}
        lede={<>Pip is the system's narrator. Round, sage-leafed, never twee. Used <strong>sparingly</strong> — never as decoration. Pip appears for empty states, milestones, anomalies, and the daily save. The mascot speaks in first person; one self-deprecating beat per moment, max.</>}
        meta={<>4 moods<br/>SVG · 36/56/84/120</>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 32 }}>
        {[
          { mood: 'happy', when: 'Goal hit, savings up, new milestone', say: 'Onwards!' },
          { mood: 'calm',  when: 'Steady state — daily logging, no alarms', say: 'All steady.' },
          { mood: 'wow',   when: 'Anomaly — weird txn or big charge', say: 'Hmm, this one\'s new.' },
          { mood: 'sleep', when: 'Inactive 7+ days — gentle re-engage', say: 'Just resting. Tap me.' },
        ].map((p, i) => (
          <FF.Card key={i} style={{ textAlign: 'center', padding: 24 }}>
            <FF.Pip size={96} mood={p.mood} />
            <FF.Caption style={{ marginTop: 14 }}>{p.mood}</FF.Caption>
            <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 17, fontStyle: 'italic', marginTop: 6, color: 'var(--ff-ink)' }}>"{p.say}"</div>
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--ff-ink-2)' }}>{p.when}</p>
          </FF.Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <FF.Card>
          <FF.Caption>Usage rules</FF.Caption>
          <ul style={{ marginTop: 12, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ff-ink-2)' }}>
            <li>• Empty states · daily save toast · milestones · anomalies. <strong>That's it.</strong></li>
            <li>• Never on dashboards by default. Earn the appearance.</li>
            <li>• Speaks in <strong>first person</strong>: "I'll start spotting patterns…"</li>
            <li>• Mood follows score delta — never random.</li>
            <li>• On RTL locales, Pip's antenna mirrors. Eyes don't.</li>
          </ul>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Anti-patterns</FF.Caption>
          <ul style={{ marginTop: 12, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ff-ink-2)' }}>
            <li>✕ Pip on every screen — dilutes the appearance.</li>
            <li>✕ Pip "winking" on debt screens. We don't joke about debt.</li>
            <li>✕ Pip in business / admin views — wrong audience.</li>
            <li>✕ Animated mascot during data tables — distracts from numerals.</li>
          </ul>
        </FF.Card>
      </div>
    </div>
  ),

  // ─── Voice & Tone ──────────────────────────
  Voice: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="01.2 / Voice & tone"
        title={<>Plainspoken. <FF.Serif>Warm. Honest.</FF.Serif></>}
        lede="Friendly, observational, never shame-y. Verbs do the heavy lifting. Present-tense, concrete. Name the win. Don't oversell. One self-deprecating beat per onboarding screen, max."
        meta={<>13 do/dont pairs<br/>Every state</>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
        <FF.VoiceCard
          context="Notification · over-budget"
          quote="Heads up — Food's munched 92% of its budget. 4 days left in the month."
          note="Friendly, observational, never shame-y. Verbs do the work."
        />
        <FF.VoiceCard
          context="Goal complete · celebration"
          quote="You did it. Emergency Fund — fully stocked. That's six months of breathing room."
          note="Present-tense, concrete. Name the win. Don't oversell."
        />
        <FF.VoiceCard
          context="Empty state · first run"
          quote="Hi, I'm Pip. Add your first transaction and I'll start spotting patterns. Promise I'm useful."
          note="Mascot speaks first person. One self-deprecating beat, max."
        />
      </div>

      <FF.Caption style={{ marginBottom: 12 }}>Do · Don't matrix</FF.Caption>
      <FF.Card padding={0}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', padding: '10px 16px', background: 'var(--ff-canvas-2)', borderBottom: '1px solid var(--ff-line)' }}>
          {['Context','Do', "Don't"].map(h => <FF.Caption key={h}>{h}</FF.Caption>)}
        </div>
        {[
          ['Saved a txn', 'Saved · pulse +2', 'Transaction successfully recorded.'],
          ['Over budget', "Food's munched 92% of its budget. 4 days left.", 'Warning: budget threshold exceeded.'],
          ['Goal hit 100%', "You did it. That's $4,000 banked.", 'Congratulations on achieving your goal!'],
          ['Network offline', "You're working offline. Anything you log queues up — I'll sync when bars are back.", 'Network error. Please check your connection.'],
          ['Permission denied (child)', "Budgets can be edited by Alex or Sam. You can still log your own spend.", 'Access denied. Insufficient permissions.'],
          ['Soft paywall', "Add a partner with Family — $18/month. Or keep flying solo, that's good too.", 'Upgrade now to unlock this feature!'],
          ['Score dropped 10+', "Pulse is down 12 this month. Want to look at why?", 'Your financial health has decreased significantly.'],
          ['Debt added', "Logged. Here's the road out — 28 months at the current pace.", 'Liability successfully created.'],
          ['Negative net worth', "You're at −$2,140 today. Plenty of folks have been here. Let's pick a strategy.", 'Warning: net worth below zero.'],
          ['Debt-free milestone', "That's it. You're debt-free. Two years, four months — want to roll that payment into savings?", 'Congratulations on debt elimination!'],
          ['FX rates stale', "Last rate refresh was 26 hours ago. Foreign totals could be off by a percent or two.", 'Error: currency exchange rate data is outdated.'],
        ].map((r, i, a) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', padding: '12px 16px', borderBottom: i < a.length - 1 ? '1px solid var(--ff-line)' : 'none', alignItems: 'start', gap: 16 }}>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--ff-ink-2)' }}>{r[0]}</span>
            <span style={{ fontSize: 13, color: 'var(--ff-ink)', position: 'relative', paddingLeft: 18 }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--ff-olive)', fontWeight: 600 }}>✓</span>{r[1]}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ff-ink-3)', textDecoration: 'line-through', textDecorationColor: 'var(--ff-line-strong)', position: 'relative', paddingLeft: 18 }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--ff-coral-deep)', fontWeight: 600, textDecoration: 'none' }}>✕</span>{r[2]}
            </span>
          </div>
        ))}
      </FF.Card>
    </div>
  ),

  // ─── Personas ──────────────────────────────
  Personas: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="01.3 / Personas"
        title={<>Four households. <FF.Serif>One system.</FF.Serif></>}
        lede="The four segments FinFlow ships against. Each segment tunes default surfaces, vocabulary, and goal templates — same component library underneath."
        meta={<>4 segments<br/>Tier-aware</>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          {
            name: 'Young couple', age: '25–35', color: 'var(--ff-denim)',
            who: 'Dual-income, urban, no kids yet. Optimising for the down payment.',
            pains: ['Splitting bills without resentment', 'Knowing if rent is "too much"', 'Shared vs. personal accounts'],
            touch: 'Joint goals · split-tracking · date-night budget',
            anchor: 'Pulse Score · Down-payment goal',
          },
          {
            name: 'Growing family', age: '30–42', color: 'var(--ff-coral)',
            who: 'Parents with young kids. Childcare is the #1 line item.',
            pains: ['Cashflow gaps around paydays', 'Surprise medical / school bills', 'Both parents need to see it'],
            touch: 'Childcare category · kid-allowance goals · school-year budget',
            anchor: 'Cashflow forecast · Childcare card',
          },
          {
            name: 'Multi-gen', age: '35–60', color: 'var(--ff-plum)',
            who: 'Adults supporting both kids and aging parents.',
            pains: ['Elder care expenses', 'Sub-budgets per household member', 'Cross-currency remittances'],
            touch: 'Elder role · medical sub-budgets · caregiver permissions',
            anchor: 'Member sub-views · Plum accent',
          },
          {
            name: 'Single parent', age: '28–48', color: 'var(--ff-sage)',
            who: 'Solo navigator. Resilience & emergency fund matter most.',
            pains: ['Living one bill from the edge', 'No partner to backstop decisions', 'School-fee timing'],
            touch: 'Bigger emergency target · simplified UI · school-fee reminders',
            anchor: 'Emergency fund hero · weekly digest',
          },
        ].map((p, i) => (
          <FF.Card key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: p.color, marginBottom: 14 }} />
            <h3 style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>{p.name}</h3>
            <FF.Caption style={{ marginTop: 2 }}>Age {p.age}</FF.Caption>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ff-ink-2)', lineHeight: 1.55 }}>{p.who}</p>

            <FF.Caption style={{ marginTop: 18, color: 'var(--ff-coral-deep)' }}>Pains</FF.Caption>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 6, fontSize: 12, color: 'var(--ff-ink-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p.pains.map(x => <li key={x}>· {x}</li>)}
            </ul>

            <div style={{ marginTop: 'auto', padding: 12, marginTop: 16, background: 'var(--ff-canvas-2)', borderRadius: 'var(--ff-r-2)', borderLeft: `2px solid ${p.color}` }}>
              <FF.Caption style={{ marginBottom: 4 }}>System touch</FF.Caption>
              <div style={{ fontSize: 12, color: 'var(--ff-ink-2)', marginBottom: 8 }}>{p.touch}</div>
              <FF.Caption style={{ marginBottom: 4 }}>Default surface anchor</FF.Caption>
              <div style={{ fontSize: 12, color: 'var(--ff-ink)' }}>{p.anchor}</div>
            </div>
          </FF.Card>
        ))}
      </div>
    </div>
  ),

  // ─── Color · Light (paper-warm) ────────────
  ColorLight: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56, overflow: 'hidden' }}>
      <FF.PageHead
        section="02.1 / Color · Paper-warm"
        title={<>The warm <FF.Serif>palette.</FF.Serif></>}
        lede={<>Coral leads. Sage and olive grow. Honey and butter warn. Terracotta breaks. Denim and plum carry trust and depth. The cream paper holds everything — never <FF.Mono>#fff</FF.Mono>, never <FF.Mono>#000</FF.Mono>.</>}
        meta={<>9 hues<br/>Semantic, not decorative</>}
      />

      <FF.Caption style={{ marginBottom: 12 }}>Primary &amp; surface</FF.Caption>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 26 }}>
        <FF.Swatch large name="Coral" value="#E26D5C" token="--ff-coral" role="Primary action, focus, brand" darkLabel />
        <FF.Swatch large name="Cream" value="#F5EFE6" token="--ff-canvas" role="Canvas, app background" />
        <FF.Swatch large name="Bone"  value="#FBF7EE" token="--ff-surface" role="Card, panel surface" />
        <FF.Swatch large name="Ink"   value="#2A2522" token="--ff-ink" role="Primary text, headings" darkLabel />
      </div>

      <FF.Caption style={{ marginBottom: 12 }}>Semantic — tuned warm, not neon</FF.Caption>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <FF.Swatch name="Sage" value="#85A88A" token="--ff-sage" role="Income, positive trend" darkLabel />
        <FF.Swatch name="Olive" value="#6B7C53" token="--ff-olive" role="Savings, deeper positive" darkLabel />
        <FF.Swatch name="Honey" value="#E8A87C" token="--ff-honey" role="Warning, near-budget" darkLabel />
        <FF.Swatch name="Butter" value="#F4D27A" token="--ff-butter" role="Highlight, soft caution" darkLabel />
        <FF.Swatch name="Terracotta" value="#C44536" token="--ff-coral-deep" role="Error, destructive, over-budget" darkLabel />
        <FF.Swatch name="Denim" value="#4A6FA5" token="--ff-denim" role="Trust, banking, links" darkLabel />
        <FF.Swatch name="Plum" value="#6E4555" token="--ff-plum" role="Multi-gen, elder accent" darkLabel />
        <FF.Swatch name="Mid Ink" value="#5C544D" token="--ff-ink-2" role="Secondary text, meta" darkLabel />
      </div>

      <FF.Card style={{ borderLeft: '3px solid var(--ff-coral)', background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral-soft)' }}>
        <FF.Caption style={{ color: 'var(--ff-coral-deep)' }}>Why warm coral over electric blue</FF.Caption>
        <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ff-ink-2)', lineHeight: 1.55, maxWidth: '78ch' }}>
          Family-finance research shows households associate cool fintech palettes with banks and bills — i.e. the things they're stressed about.
          Warm cream + coral reads as <FF.Serif>kitchen-table conversation</FF.Serif>, not <FF.Serif>quarterly statement.</FF.Serif>
          The dark FinFlow shell still ships as the admin / power-user theme — paper-warm is the consumer default.
        </p>
      </FF.Card>
    </div>
  ),

  // ─── Color · Shell (admin / power-user) ────
  ColorShell: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-shell)', padding: 56, color: 'var(--ff-ink-on-shell)' }}>
      <div style={{ paddingBottom: 22, marginBottom: 28, borderBottom: '1px solid var(--ff-line-on-shell)' }}>
        <FF.Caption style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ff-coral)' }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--ff-coral)' }} />
          02.2 / Color · Shell theme
        </FF.Caption>
        <h1 style={{ fontFamily: 'var(--ff-serif)', fontSize: 56, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 8, color: 'var(--ff-ink-on-shell)' }}>
          The <FF.Serif>shell</FF.Serif> theme — admin &amp; power-user.
        </h1>
        <p style={{ marginTop: 14, fontSize: 15, color: 'var(--ff-ink-on-shell-2)', maxWidth: '64ch', lineHeight: 1.55 }}>
          Same palette, inverted hierarchy. Used for the admin console, NorthStar dashboard, and an opt-in night theme on the consumer app. Coral, sage, honey all lift slightly to maintain ≥ 4.5:1 contrast on warm ink.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          ['Shell BG',  '#1F1B17', '--ff-shell',   'Page background'],
          ['Shell 2',   '#2A2520', '--ff-shell-2', 'Card / elevated'],
          ['Ink on shell', '#E8DECF', '--ff-ink-on-shell', 'Primary text'],
          ['Ink dim',   'rgba(232,222,207,.55)', '--ff-ink-on-shell-2', 'Secondary text'],
        ].map(([n, v, tok, r]) => (
          <div key={n} style={{ background: 'var(--ff-shell-2)', borderRadius: 'var(--ff-r-3)', border: '1px solid var(--ff-line-on-shell)', overflow: 'hidden' }}>
            <div style={{ height: 80, background: v, display: 'flex', alignItems: 'flex-end', padding: 10 }}>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(0,0,0,0.5)', color: '#fff' }}>{v}</span>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n}</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-ink-on-shell-2)', marginTop: 2 }}>{tok}</div>
              <div style={{ fontSize: 11, color: 'var(--ff-ink-on-shell-2)', marginTop: 4 }}>{r}</div>
            </div>
          </div>
        ))}
      </div>

      <FF.Caption style={{ color: 'var(--ff-ink-on-shell-2)', marginBottom: 12 }}>Accents on shell — sample composition</FF.Caption>
      <div style={{ background: 'var(--ff-shell-2)', borderRadius: 'var(--ff-r-3)', padding: 24, border: '1px solid var(--ff-line-on-shell)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <FF.PulseRing score={78} size={96} dark />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Budgets', 82, '#85A88A'], ['Savings', 71, '#F4D27A'], ['Goals', 64, '#E8A87C'], ['Trend', 88, '#85A88A']].map(([n, v, c]) => (
              <div key={n}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--ff-ink-on-shell-2)', fontFamily: 'var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{n}</span>
                  <FF.Mono style={{ color: 'var(--ff-ink-on-shell)' }}>{v}</FF.Mono>
                </div>
                <div style={{ marginTop: 4, height: 4, background: 'rgba(232,222,207,0.12)', borderRadius: 2 }}>
                  <div style={{ width: `${v}%`, height: '100%', background: c, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),

  // ─── Typography ────────────────────────────
  Type: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="03 / Type"
        title={<>Three faces. <FF.Serif>One voice.</FF.Serif></>}
        lede={<>Newsreader (display, italic for accent words). Inter Tight (UI, body). JetBrains Mono (data, status, labels). The serif sets tone; the sans does the work; the mono keeps numbers honest.</>}
        meta={<>3 typefaces<br/>9-step scale</>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 32 }}>
        {[
          { name: 'Newsreader', kind: 'Display · italic accent', fam: 'var(--ff-serif)', sty: 'italic', weight: 500, sample: 'good with money', note: 'Hero titles, large numbers, milestones. Italic for accent words only.' },
          { name: 'Inter Tight', kind: 'UI · body · 400/500/600', fam: 'var(--ff-sans)', sty: 'normal', weight: 500, sample: '$8,420.36', note: 'Workhorse: body, buttons, list rows. Slightly condensed — breathing room on dense screens.' },
          { name: 'JetBrains Mono', kind: 'Data · status · 400/500', fam: 'var(--ff-mono)', sty: 'normal', weight: 500, sample: 'BUDGETS 82', note: 'Data, metadata, status pins. Always tracked, uppercase below 14px. Never body prose.' },
        ].map((t) => (
          <FF.Card key={t.name}>
            <FF.Caption>{t.kind}</FF.Caption>
            <div style={{
              fontFamily: t.fam, fontStyle: t.sty, fontWeight: t.weight,
              fontSize: 40, lineHeight: 1.05, marginTop: 14, letterSpacing: t.fam === 'var(--ff-sans)' ? '-0.01em' : 'normal',
              color: t.name === 'Newsreader' ? 'var(--ff-coral)' : 'var(--ff-ink)',
            }}>{t.sample}</div>
            <div style={{ marginTop: 18, fontWeight: 500, fontSize: 15 }}>{t.name}</div>
            <p style={{ fontSize: 12, color: 'var(--ff-ink-2)', marginTop: 8, lineHeight: 1.55 }}>{t.note}</p>
          </FF.Card>
        ))}
      </div>

      <FF.Caption style={{ marginBottom: 12 }}>Type scale</FF.Caption>
      <FF.Card padding={0}>
        {[
          ['display-xl', 56, 'serif',  'italic', 'Hero titles'],
          ['display-l',  40, 'serif',  'italic', 'Section opens'],
          ['display-m',  28, 'serif',  'normal', 'Card hero numbers'],
          ['title',      20, 'sans',   'normal', 'Panel headings · 500'],
          ['body-l',     16, 'sans',   'normal', 'Lead paragraph · 400'],
          ['body',       14, 'sans',   'normal', 'Default body · 400'],
          ['caption',    12, 'sans',   'normal', 'Secondary meta'],
          ['mono',       11, 'mono',   'normal', 'Labels, status, data'],
          ['mono-xs',     9, 'mono',   'normal', 'Pin tags only'],
        ].map((r, i, a) => (
          <div key={r[0]} style={{ display: 'grid', gridTemplateColumns: '110px 60px 1fr 200px', padding: '12px 18px', borderBottom: i < a.length - 1 ? '1px dashed var(--ff-line)' : 'none', alignItems: 'baseline', gap: 16 }}>
            <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)' }}>{r[0]}</FF.Mono>
            <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-2)' }}>{r[1]}px</FF.Mono>
            <span style={{
              fontFamily: r[2] === 'serif' ? 'var(--ff-serif)' : r[2] === 'sans' ? 'var(--ff-sans)' : 'var(--ff-mono)',
              fontStyle: r[3],
              fontSize: Math.min(r[1], 28),
              fontWeight: r[2] === 'sans' ? 500 : 400,
              letterSpacing: r[2] === 'sans' && r[1] >= 20 ? '-0.015em' : r[2] === 'serif' ? '-0.02em' : 'normal',
            }}>The quick brown fox · $1,247.50</span>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--ff-ink-3)', letterSpacing: '0.06em' }}>{r[4]}</span>
          </div>
        ))}
      </FF.Card>
    </div>
  ),

  // ─── Spacing · Radii · Elevation ───────────
  Spacing: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="04 / Spacing · Radii · Elevation"
        title={<>The <FF.Serif>4-pt grid.</FF.Serif></>}
        lede="Every gap and padding aligns to 4. Card padding 16, page gutter 20–24 on mobile. Radii are restrained — cards 8, sheets 14, pills 999, buttons 9. Shadows live on warm ink, never pure black."
        meta={<>10 steps<br/>4 elevations</>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20 }}>
        <FF.Card>
          <FF.Caption>Spacing scale</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['s-1', 4], ['s-2', 8], ['s-3', 12], ['s-4', 16], ['s-5', 20], ['s-6', 24], ['s-7', 32], ['s-8', 40], ['s-9', 56], ['s-10', 80]].map(([t, v]) => (
              <div key={t} style={{ display: 'grid', gridTemplateColumns: '60px 50px 1fr', gap: 12, alignItems: 'center' }}>
                <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)' }}>{t}</FF.Mono>
                <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-2)' }}>{v}px</FF.Mono>
                <span style={{ display: 'block', height: 8, background: 'var(--ff-coral)', width: v, borderRadius: 2 }} />
              </div>
            ))}
          </div>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Radii</FF.Caption>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {[['r-1', 4, 'fields'], ['r-2', 6, 'buttons'], ['r-3', 8, 'cards'], ['r-4', 14, 'sheets'], ['r-5', 20, 'modals'], ['pill', 9999, 'chips']].map(([t, v, lbl]) => (
              <div key={t}>
                <div style={{ height: 56, background: 'var(--ff-coral)', borderRadius: v }} />
                <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-3)', marginTop: 6 }}>--ff-{t} · {v === 9999 ? 'pill' : v + 'px'}</FF.Mono>
                <div style={{ fontSize: 11, color: 'var(--ff-ink-2)' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Elevation</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[['1', 'var(--ff-shadow-1)', 'rest'], ['2', 'var(--ff-shadow-2)', 'card · sheet'], ['3', 'var(--ff-shadow-3)', 'popover · toast'], ['4', 'var(--ff-shadow-4)', 'modal']].map(([n, sh, lbl]) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 14, alignItems: 'center' }}>
                <div style={{ height: 40, background: '#fff', borderRadius: 'var(--ff-r-3)', boxShadow: sh, border: '1px solid var(--ff-line)' }} />
                <div>
                  <FF.Mono style={{ fontSize: 11 }}>shadow-{n}</FF.Mono>
                  <div style={{ fontSize: 11, color: 'var(--ff-ink-2)' }}>{lbl}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 11, color: 'var(--ff-ink-3)', lineHeight: 1.55 }}>Sheets at 2, modals at 4, toasts at 2. Never go higher — this is paper, not glass.</p>
        </FF.Card>
      </div>
    </div>
  ),

  // ─── Iconography ───────────────────────────
  Icons: () => {
    const icons = ['home','transactions','budget','goals','debts','networth','reports','settings','help','plus','search','filter','bell','user','lock','eye','card','bank','sparkle','shield','flag','menu','grid','heart','globe','wifi','refresh','arrowU','arrowD','chevronR','check','x'];
    return (
      <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
        <FF.PageHead
          section="05 / Iconography"
          title={<>Outline. <FF.Serif>1.5px.</FF.Serif> Square caps.</>}
          lede="Single-stroke outlines on a 24×24 grid. Currentcolor only — icons inherit text color. Categories keep their emoji (existing FinFlow convention). System icons stay neutral."
          meta={<>32 system icons<br/>3 sizes</>}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', border: '1px solid var(--ff-line)', borderRadius: 'var(--ff-r-3)', overflow: 'hidden', background: 'var(--ff-surface)' }}>
          {icons.map((n, i) => (
            <div key={n} style={{
              padding: '20px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              borderRight: (i % 8 !== 7) ? '1px solid var(--ff-line)' : 'none',
              borderBottom: i < icons.length - 8 ? '1px solid var(--ff-line)' : 'none',
              color: 'var(--ff-ink)',
            }}>
              <FF.Icon name={n} size={22} />
              <FF.Mono style={{ fontSize: 9, color: 'var(--ff-ink-3)' }}>{n}</FF.Mono>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            ['18px', 'inline · chips · row leading', 18],
            ['22px', 'buttons · sidebar nav', 22],
            ['28px', 'tab bars · empty states', 28],
          ].map(([sz, use, n]) => (
            <FF.Card key={sz} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <FF.Icon name="sparkle" size={n} />
              <div>
                <FF.Mono style={{ fontSize: 11 }}>{sz}</FF.Mono>
                <div style={{ fontSize: 12, color: 'var(--ff-ink-2)', marginTop: 2 }}>{use}</div>
              </div>
            </FF.Card>
          ))}
        </div>
      </div>
    );
  },
};

Object.assign(window, { Foundations });
