// Components: buttons, inputs, cards, badges, tables, navigation

const Components = {
  Buttons: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="06 / Buttons"
        title={<>Five kinds. <FF.Serif>Three sizes.</FF.Serif></>}
        lede="One primary action per surface. Coral for the day-to-day commitment (save a transaction, add a goal). Ink for the heavier confirmation. Destruct for terracotta moments only."
        meta="5 × 3 grid"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24, marginBottom: 36 }}>
        {[['primary', 'Coral · primary'], ['ink', 'Ink · confirm'], ['ghost', 'Ghost'], ['subtle', 'Subtle'], ['destruct', 'Destruct']].map(([k, lbl]) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
            <FF.Caption>{lbl}</FF.Caption>
            <FF.Button kind={k} size="lg" icon="plus">Add transaction</FF.Button>
            <FF.Button kind={k} size="md">Continue</FF.Button>
            <FF.Button kind={k} size="sm" icon="filter">Filter</FF.Button>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <FF.Card>
          <FF.Caption>States</FF.Caption>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <FF.Button kind="primary">Default</FF.Button>
            <FF.Button kind="primary" style={{ background: '#D4604E' }}>Hover</FF.Button>
            <FF.Button kind="primary" style={{ background: '#C04D3C', transform: 'scale(0.96)' }}>Pressed</FF.Button>
            <FF.Button kind="primary" style={{ opacity: 0.4, cursor: 'not-allowed' }}>Disabled</FF.Button>
            <FF.Button kind="ghost" style={{ boxShadow: '0 0 0 2px var(--ff-coral)' }}>Focused</FF.Button>
          </div>
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ff-ink-2)', lineHeight: 1.55 }}>
            Press scales <FF.Mono>0.96</FF.Mono> for <FF.Mono>80ms</FF.Mono> in, <FF.Mono>120ms</FF.Mono> out. Coral primary brightens 4% on press. Focus ring uses the same coral, 2px offset.
          </p>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Icon-only · segmented</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            {['plus','search','filter','bell','settings','x'].map(n => (
              <button key={n} style={{ width: 38, height: 38, borderRadius: 'var(--ff-r-2)', border: '1px solid var(--ff-line-2)', background: 'var(--ff-surface)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ff-ink)' }}>
                <FF.Icon name={n} size={18} />
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'inline-flex', background: 'var(--ff-canvas-2)', padding: 3, borderRadius: 'var(--ff-r-2)', border: '1px solid var(--ff-line)' }}>
            {['Day','Week','Month','Quarter','Year'].map((t, i) => (
              <span key={t} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'var(--ff-mono)', letterSpacing: '0.06em', textTransform: 'uppercase',
                background: i === 2 ? 'var(--ff-surface)' : 'transparent',
                color: i === 2 ? 'var(--ff-ink)' : 'var(--ff-ink-3)',
                borderRadius: 'var(--ff-r-1)',
                boxShadow: i === 2 ? 'var(--ff-shadow-1)' : 'none',
              }}>{t[0]}</span>
            ))}
          </div>
          <p style={{ marginTop: 14, fontSize: 12, color: 'var(--ff-ink-2)' }}>
            Segmented control for period selection. Selected index lives in URL. Tab-switch animates the indicator slide+scale (0.85→1).
          </p>
        </FF.Card>
      </div>
    </div>
  ),

  Inputs: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="07 / Forms · Inputs"
        title={<>Money asks for <FF.Serif>clarity.</FF.Serif></>}
        lede="Inputs lean dense and neutral until they need attention. Amount fields use mono numerals. Categories are pills, not dropdowns. Privacy and recurring are sticky."
        meta="6 controls"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <FF.Card>
          <FF.Caption>Text inputs</FF.Caption>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FF.Input label="Description" placeholder="Whole Foods, weekly groceries" />
            <FF.Input label="Amount" prefix="USD" value="247.50" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FF.Input label="Date" value="2025-04-12" />
              <FF.Input label="Currency" value="USD" />
            </div>
            <FF.Input label="Email" value="not-an-email" hint="Add a valid email." error />
          </div>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Selectors</FF.Caption>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <FF.Caption style={{ marginBottom: 8 }}>Type</FF.Caption>
              <div style={{ display: 'flex', padding: 3, background: 'var(--ff-canvas-2)', borderRadius: 'var(--ff-r-2)', border: '1px solid var(--ff-line)' }}>
                {['Expense','Income','Transfer','Investment'].map((t, i) => (
                  <span key={t} style={{ flex: 1, textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600, fontFamily: 'var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: i === 0 ? 'var(--ff-coral-tint)' : 'transparent',
                    color: i === 0 ? 'var(--ff-coral-deep)' : 'var(--ff-ink-3)',
                    borderRadius: 'var(--ff-r-1)' }}>{t}</span>
                ))}
              </div>
            </div>
            <div>
              <FF.Caption style={{ marginBottom: 8 }}>Categories</FF.Caption>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[['🍔 Food', true], ['🛒 Groceries', false], ['🚗 Transport', false], ['🎬 Entertainment', false], ['⚡ Utilities', false], ['💊 Health', false]].map(([t, on]) => (
                  <span key={t} style={{ padding: '6px 12px', borderRadius: 'var(--ff-r-pill)', fontSize: 12, fontWeight: 500,
                    background: on ? 'var(--ff-coral-tint)' : 'var(--ff-surface)', color: on ? 'var(--ff-coral-deep)' : 'var(--ff-ink-2)',
                    border: `1px solid ${on ? 'var(--ff-coral-soft)' : 'var(--ff-line-2)'}` }}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--ff-coral)', background: 'var(--ff-coral)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <FF.Icon name="check" size={11} stroke={2.6} />
                </span>
                Recurring · monthly
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--ff-line-strong)', background: 'var(--ff-surface)' }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FF.Icon name="lock" size={13} /> Mark as private</span>
              </label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ width: 38, height: 22, borderRadius: 11, background: 'var(--ff-coral)', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: 'var(--ff-shadow-1)' }} />
                </span>
                <span style={{ width: 38, height: 22, borderRadius: 11, background: 'var(--ff-line-2)', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: 'var(--ff-shadow-1)' }} />
                </span>
                <span style={{ fontSize: 12, color: 'var(--ff-ink-2)' }}>Toggles · on / off</span>
              </div>
            </div>
          </div>
        </FF.Card>
      </div>
    </div>
  ),

  Cards: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="08 / Cards"
        title={<>Container <FF.Serif>types.</FF.Serif></>}
        lede="Cards live on bone (#FBF7EE) over cream paper. Subtle hairline borders. The hero numeric is always serif italic. Coral-tinted cards are reserved for Pip's insights and over-budget alerts."
        meta="7 patterns"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <FF.Card>
          <FF.Caption>This month · spending</FF.Caption>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 12 }}>
            <span style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 56, lineHeight: 1, fontWeight: 400 }}>$3,247</span>
            <FF.Mono style={{ fontSize: 15, color: 'var(--ff-ink-3)' }}>.50</FF.Mono>
          </div>
          <div style={{ marginTop: 14 }}><FF.Badge tone="sage" dot>−12% vs last</FF.Badge></div>
          <div style={{ fontSize: 11, color: 'var(--ff-ink-3)', marginTop: 6 }}>against $3,700 budget</div>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Goal · vacation 2026</FF.Caption>
          <div style={{ marginTop: 12, fontFamily: 'var(--ff-serif)', fontSize: 28, fontWeight: 500 }}>$2,840 <span style={{ color: 'var(--ff-ink-3)', fontSize: 14, fontFamily: 'var(--ff-sans)' }}>of $5,000</span></div>
          <div style={{ marginTop: 14, height: 6, background: 'var(--ff-canvas-2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: '57%', height: '100%', background: 'var(--ff-coral)' }} />
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--ff-ink-2)' }}>57% · on track</span>
            <FF.Mono style={{ color: 'var(--ff-ink-3)' }}>by Aug 2026</FF.Mono>
          </div>
        </FF.Card>

        <FF.Card style={{ background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral-soft)', borderLeft: '3px solid var(--ff-coral)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <FF.Pip size={42} mood="happy" />
            <div>
              <FF.Caption style={{ color: 'var(--ff-coral-deep)' }}>Pip's pick · this week</FF.Caption>
              <div style={{ marginTop: 6, fontSize: 14, color: 'var(--ff-ink)', lineHeight: 1.5, fontWeight: 500 }}>
                Date-night fund hit 60%. Nice. Want to bump weekly auto-save by $10 to land it before June?
              </div>
            </div>
          </div>
        </FF.Card>

        <FF.Card style={{ background: 'var(--ff-shell)', color: 'var(--ff-ink-on-shell)', borderColor: 'var(--ff-shell)' }}>
          <FF.Caption style={{ color: 'var(--ff-coral-soft)' }}>Family Pulse Score</FF.Caption>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 12 }}>
            <FF.PulseRing score={78} size={72} dark />
            <div style={{ fontSize: 13, color: 'var(--ff-ink-on-shell-2)', lineHeight: 1.5 }}>Up 4 vs last month. Savings rate and budget compliance both lifted.</div>
          </div>
        </FF.Card>

        <FF.Card style={{ background: 'var(--ff-honey-tint)', borderColor: 'var(--ff-honey)', borderLeft: '3px solid var(--ff-honey)' }}>
          <FF.Caption style={{ color: '#A06A2C' }}>Heads up</FF.Caption>
          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--ff-ink)', lineHeight: 1.5, fontWeight: 500 }}>Food's munched 92% of its budget. 4 days left in the month.</div>
          <div style={{ marginTop: 10, height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 3 }}>
            <div style={{ width: '92%', height: '100%', background: 'var(--ff-honey)', borderRadius: 3 }} />
          </div>
        </FF.Card>

        <FF.Card style={{ textAlign: 'center', padding: 28 }}>
          <FF.Pip size={56} mood="calm" />
          <div style={{ marginTop: 12, fontFamily: 'var(--ff-serif)', fontSize: 18, fontStyle: 'italic' }}>What are we aiming at?</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ff-ink-2)', lineHeight: 1.5 }}>Pick a goal type — emergency fund, savings, debt payoff. I'll track the rest.</div>
          <div style={{ marginTop: 16 }}><FF.Button kind="primary" size="md">+ Set a goal</FF.Button></div>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Account · Chase ··4291</FF.Caption>
          <div style={{ marginTop: 10, fontFamily: 'var(--ff-serif)', fontSize: 24, fontWeight: 500 }}>$8,420.18</div>
          <svg viewBox="0 0 200 40" preserveAspectRatio="none" style={{ width: '100%', height: 40, marginTop: 10 }}>
            <path d="M0 28 L20 26 L40 30 L60 22 L80 24 L100 18 L120 22 L140 14 L160 18 L180 8 L200 12" fill="none" stroke="var(--ff-coral)" strokeWidth="1.6" />
            <path d="M0 28 L20 26 L40 30 L60 22 L80 24 L100 18 L120 22 L140 14 L160 18 L180 8 L200 12 L200 40 L0 40 Z" fill="var(--ff-coral-tint)" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-3)' }}>30D</FF.Mono>
            <FF.Badge tone="sage" dot>+$420 · 5.3%</FF.Badge>
          </div>
        </FF.Card>
      </div>
    </div>
  ),

  Badges: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="09 / Badges &amp; status"
        title={<>Status, <FF.Serif>at a glance.</FF.Serif></>}
        lede="Pills carry meta. Sage = positive · honey = caution · coral = action · ink = neutral. Mono caps, never sentence case. Soft (tinted) is default; strong (filled) for the small handful of CTAs."
        meta="6 tones × 2"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <FF.Card>
          <FF.Caption>Soft</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <FF.Badge dot>Pending</FF.Badge>
            <FF.Badge tone="coral" dot>Over budget</FF.Badge>
            <FF.Badge tone="sage" dot>On track</FF.Badge>
            <FF.Badge tone="honey" dot>Near limit</FF.Badge>
            <FF.Badge tone="denim" dot>Linked bank</FF.Badge>
            <FF.Badge tone="plum" dot>Elder</FF.Badge>
            <FF.Badge tone="coral">Recurring</FF.Badge>
            <FF.Badge tone="sage">Split · 3</FF.Badge>
          </div>
        </FF.Card>
        <FF.Card>
          <FF.Caption>Strong</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <FF.Badge soft={false} tone="ink">Default</FF.Badge>
            <FF.Badge soft={false} tone="coral">Critical</FF.Badge>
            <FF.Badge soft={false} tone="sage">+$420</FF.Badge>
            <FF.Badge soft={false} tone="honey">Watch</FF.Badge>
            <FF.Badge soft={false} tone="denim">Beta</FF.Badge>
          </div>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Payment-method chips</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[['Chase','JPM','#117ACA'],['BofA','BAC','#E11B23'],['Apple Card','APL','#000'],['Venmo','VEN','#3D95CE'],['Cash','CSH','#5C544D']].map(([n, c, col]) => (
              <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, padding: '0 12px 0 4px', background: 'var(--ff-canvas-2)', borderRadius: 'var(--ff-r-pill)', fontSize: 12 }}>
                <span style={{ width: 24, height: 20, borderRadius: 3, background: col, color: '#fff', fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.05em' }}>{c}</span>
                {n}
              </span>
            ))}
          </div>
        </FF.Card>

        <FF.Card>
          <FF.Caption>Status indicators</FF.Caption>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['Synced 2 minutes ago','sage'],['Reconnecting…','honey'],['Sync failed · tap to retry','coral'],['Offline · 3 queued','ink']].map(([msg, tone]) => (
              <div key={msg} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: tone === 'sage' ? 'var(--ff-sage)' : tone === 'honey' ? 'var(--ff-honey)' : tone === 'coral' ? 'var(--ff-coral)' : 'var(--ff-ink-3)' }} />
                <span style={{ fontSize: 13, color: 'var(--ff-ink-2)' }}>{msg}</span>
              </div>
            ))}
          </div>
        </FF.Card>
      </div>
    </div>
  ),

  Tables: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="10 / Tables"
        title={<>Dense data, <FF.Serif>calm to read.</FF.Serif></>}
        lede="Numerals tabular, right-aligned, mono. Rows separate with hairlines — never zebra striping. The first column is identity (date). A privacy stripe runs the row's leading edge for excluded transactions."
        meta="8 rows · 6 cols"
      />

      <FF.Card padding={0}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px 110px 80px 140px', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--ff-line)', background: 'var(--ff-canvas-2)' }}>
          {['Date','Description','Category','Method','','Amount'].map((h, i) => (
            <FF.Caption key={i} style={{ textAlign: i === 5 ? 'right' : 'left' }}>{h}</FF.Caption>
          ))}
        </div>
        {[
          ['Apr 14', 'Whole Foods Market',     'Groceries',     'Chase',  null,    -127.40],
          ['Apr 13', 'Salary · monthly',        'Income',        'Chase',  'recur', 4200.00],
          ['Apr 12', 'Therapist · Dr. Vega',    'Healthcare',    'Apple',  'priv',  -180.00],
          ['Apr 11', 'Rent · April',            'Rent',          'Venmo',  'split', -1450.00],
          ['Apr 10', 'Vanguard VTSAX',          'Investment',    'Chase',  'inv',   -500.00],
          ['Apr 09', 'Refund · United',         'Travel',        'Chase',  null,     320.00],
          ['Apr 08', 'Niche Coffee',            'Dining',        'Cash',   null,    -6.50],
          ['Apr 07', 'Con Edison',              'Utilities',     'BofA',   'recur', -94.20],
        ].map((r, i, a) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '110px 1fr 130px 110px 80px 140px', alignItems: 'center',
            padding: '13px 18px', borderBottom: i < a.length - 1 ? '1px solid var(--ff-line)' : 'none', fontSize: 13,
            position: 'relative',
            background: r[4] === 'priv' ? 'transparent' : 'transparent',
          }}>
            {r[4] === 'priv' && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'repeating-linear-gradient(45deg, var(--ff-ink-3) 0 4px, transparent 4px 8px)' }} />}
            <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)' }}>{r[0]}</FF.Mono>
            <span style={{ fontWeight: 500 }}>{r[1]}</span>
            <span style={{ color: 'var(--ff-ink-2)' }}>{r[2]}</span>
            <FF.Mono style={{ color: 'var(--ff-ink-3)', fontSize: 11 }}>{r[3]}</FF.Mono>
            <span>
              {r[4] === 'recur' && <FF.Badge tone="coral">recur</FF.Badge>}
              {r[4] === 'priv'  && <FF.Badge>🔒 priv</FF.Badge>}
              {r[4] === 'split' && <FF.Badge tone="denim">split · 3</FF.Badge>}
              {r[4] === 'inv'   && <FF.Badge tone="sage">inv</FF.Badge>}
            </span>
            <FF.Money v={r[5]} style={{ textAlign: 'right', fontWeight: 500, fontFamily: 'var(--ff-mono)' }} />
          </div>
        ))}
      </FF.Card>
    </div>
  ),

  Nav: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', padding: 56 }}>
      <FF.PageHead
        section="11 / Navigation"
        title={<>One pattern <FF.Serif>per surface.</FF.Serif></>}
        lede="Sidebar on desktop. Bottom tabs on mobile. Top tabs inside dense pages. Floating coral FAB for the single most-common action: add a transaction."
        meta="4 patterns"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <FF.Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px 14px', borderBottom: '1px solid var(--ff-line)' }}>
            <FF.Pip size={26} mood="happy" />
            <FF.Wordmark size={18} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['Track', [['home','Dashboard',true],['transactions','Transactions',false],['budget','Budgets',false]]],
              ['Plan', [['goals','Goals',false],['debts','Debts',false],['networth','Net worth',false]]],
              ['Analyze', [['reports','Reports',false]]],
            ].map(([sec, items]) => (
              <div key={sec}>
                <FF.Caption style={{ padding: '0 6px' }}>{sec}</FF.Caption>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {items.map(([icon, name, active]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--ff-r-2)', background: active ? 'var(--ff-coral-tint)' : 'transparent', color: active ? 'var(--ff-coral-deep)' : 'var(--ff-ink-2)', fontSize: 13, fontWeight: active ? 600 : 400 }}>
                      <FF.Icon name={icon} size={17} />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </FF.Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FF.Card padding={0}>
            <FF.Caption style={{ padding: '14px 20px 0' }}>Top tabs · in-page</FF.Caption>
            <div style={{ display: 'flex', padding: '8px 20px 0', borderBottom: '1px solid var(--ff-line)', marginTop: 8 }}>
              {[['Overview',true],['By category',false],['By member',false],['Recurring',false],['Upcoming',false]].map(([n, on]) => (
                <span key={n} style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: on ? 'var(--ff-coral-deep)' : 'var(--ff-ink-2)', borderBottom: on ? '2px solid var(--ff-coral)' : '2px solid transparent', marginBottom: -1 }}>{n}</span>
              ))}
            </div>
            <div style={{ padding: 20 }}>
              <FF.Slot label="content area" style={{ height: 80 }} />
            </div>
          </FF.Card>

          <FF.Card padding={0} style={{ overflow: 'hidden' }}>
            <FF.Caption style={{ padding: '14px 20px 6px' }}>Mobile tab bar</FF.Caption>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--ff-line)', display: 'flex', justifyContent: 'space-around' }}>
              {[['home','Home',true],['transactions','Txns',false],['plus','',false],['budget','Budget',false],['user','You',false]].map(([icon, name, on], i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: on ? 'var(--ff-coral)' : 'var(--ff-ink-3)' }}>
                  {i === 2 ? (
                    <span style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--ff-coral)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: -18, boxShadow: '0 6px 18px rgba(226,109,92,0.45)' }}><FF.Icon name="plus" size={20} stroke={2.2} /></span>
                  ) : (
                    <FF.Icon name={icon} size={20} />
                  )}
                  {name && <FF.Mono style={{ fontSize: 9, letterSpacing: '0.1em' }}>{name}</FF.Mono>}
                </div>
              ))}
            </div>
          </FF.Card>

          <FF.Card>
            <FF.Caption>Filter bar · saved views</FF.Caption>
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ height: 30, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ff-canvas-2)', borderRadius: 'var(--ff-r-pill)', fontSize: 12, border: '1px solid var(--ff-line)' }}><FF.Icon name="search" size={13}/> Search</span>
              <span style={{ height: 30, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ff-ink)', color: 'var(--ff-canvas)', borderRadius: 'var(--ff-r-pill)', fontSize: 12 }}>Last 30 days <FF.Icon name="x" size={11}/></span>
              <span style={{ height: 30, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--ff-ink)', color: 'var(--ff-canvas)', borderRadius: 'var(--ff-r-pill)', fontSize: 12 }}>Expense <FF.Icon name="x" size={11}/></span>
              <span style={{ height: 30, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ff-ink-2)', borderRadius: 'var(--ff-r-pill)', fontSize: 12, border: '1px dashed var(--ff-line-strong)' }}>+ Add filter</span>
              <span style={{ marginLeft: 'auto' }}>
                <FF.Badge tone="coral" style={{ fontFamily: 'var(--ff-sans)', textTransform: 'none', letterSpacing: 0 }}>Save view…</FF.Badge>
              </span>
            </div>
          </FF.Card>
        </div>
      </div>
    </div>
  ),
};

Object.assign(window, { Components });
