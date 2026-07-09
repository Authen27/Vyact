// Platforms — Desktop consumer · Mobile web · Admin (shell theme)

const PlatformsWeb = {
  Desktop: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 4, background: 'var(--ff-coral)', flexShrink: 0 }} />
      <div style={{ height: 52, background: 'var(--ff-surface)', borderBottom: '1px solid var(--ff-line)', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FF.Pip size={28} mood="happy" />
          <FF.Wordmark size={20} />
        </div>
        <span style={{ width: 1, height: 18, background: 'var(--ff-line)' }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'var(--ff-canvas-2)', borderRadius: 'var(--ff-r-2)', fontSize: 13 }}>
          <span style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--ff-coral)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>R</span>
          Reyes Household <FF.Icon name="chevronD" size={12} />
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ height: 30, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ff-canvas-2)', border: '1px solid var(--ff-line)', borderRadius: 'var(--ff-r-2)', fontSize: 12, color: 'var(--ff-ink-3)', minWidth: 240 }}>
          <FF.Icon name="search" size={14} /> Search transactions, goals, debts… <span style={{ marginLeft: 'auto', fontFamily: 'var(--ff-mono)', fontSize: 10, padding: '1px 5px', background: 'var(--ff-surface)', borderRadius: 3, border: '1px solid var(--ff-line)' }}>⌘K</span>
        </span>
        <FF.Icon name="bell" size={18} style={{ color: 'var(--ff-ink-2)' }} />
        <span style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--ff-coral)', color: '#fff', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>NR</span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 220, background: 'var(--ff-surface)', borderRight: '1px solid var(--ff-line)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
          {[
            ['Track', [['home','Dashboard',true],['transactions','Transactions'],['budget','Budgets']]],
            ['Plan', [['goals','Goals'],['debts','Debts'],['networth','Net worth']]],
            ['Analyze', [['reports','Reports']]],
          ].map(([sec, items]) => (
            <div key={sec}>
              <FF.Caption style={{ padding: '0 6px' }}>{sec}</FF.Caption>
              <div style={{ marginTop: 4 }}>
                {items.map(([icon, name, active]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 'var(--ff-r-2)', background: active ? 'var(--ff-coral-tint)' : 'transparent', color: active ? 'var(--ff-coral-deep)' : 'var(--ff-ink-2)', fontSize: 13, fontWeight: active ? 600 : 400 }}>
                    <FF.Icon name={icon} size={17} />{name}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 'auto' }}>
            {[['settings','Settings'],['help','Help']].map(([icon, name]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', color: 'var(--ff-ink-2)', fontSize: 13 }}>
                <FF.Icon name={icon} size={17} />{name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: 28, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <FF.Caption>Dashboard · April 2026</FF.Caption>
              <h1 style={{ marginTop: 6, fontFamily: 'var(--ff-serif)', fontSize: 36, fontWeight: 400, letterSpacing: '-0.02em' }}>Hi, <FF.Serif>Naomi.</FF.Serif></h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <FF.Button kind="ghost" size="sm" icon="filter">Filter</FF.Button>
              <FF.Button kind="primary" size="sm" icon="plus">Add transaction</FF.Button>
            </div>
          </div>

          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '280px repeat(3, 1fr)', gap: 14 }}>
            <FF.Card style={{ gridRow: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <FF.Caption style={{ color: 'var(--ff-coral)' }}>Family Pulse Score</FF.Caption>
              <FF.PulseRing score={78} size={160} label="Good" />
              <div style={{ marginTop: 14 }}><FF.Badge tone="sage" dot>+4 vs last</FF.Badge></div>
            </FF.Card>
            {[['Net worth','$24,108','+$420 · 30d','sage'],['Spending','$3,247','−12% vs last','sage'],['Income','$4,400','+$200 vs last','sage'],['Debt','$12,350','3 active · 2.4yr','coral'],['Goals · 3','$7,890','of $15,000','coral'],['Cashflow','$1,153','runway 4w','denim']].map(([lbl, v, sub, t]) => (
              <FF.Card key={lbl} padding={14}>
                <FF.Caption>{lbl}</FF.Caption>
                <div style={{ marginTop: 6, fontFamily: 'var(--ff-serif)', fontSize: 24, fontStyle: 'italic', fontWeight: 400 }}>{v}</div>
                <div style={{ marginTop: 6 }}><FF.Badge tone={t} dot>{sub}</FF.Badge></div>
              </FF.Card>
            ))}
          </div>

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <FF.Card>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <FF.Caption>Net flow</FF.Caption>
                <div style={{ display: 'inline-flex', background: 'var(--ff-canvas-2)', padding: 2, borderRadius: 'var(--ff-r-2)', border: '1px solid var(--ff-line)' }}>
                  {['W','M','Q','Y'].map((t, i) => (
                    <span key={t} style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'var(--ff-mono)', background: i === 1 ? 'var(--ff-surface)' : 'transparent', color: i === 1 ? 'var(--ff-ink)' : 'var(--ff-ink-3)', borderRadius: 'var(--ff-r-1)' }}>{t}</span>
                  ))}
                </div>
              </div>
              <svg viewBox="0 0 600 160" style={{ width: '100%', marginTop: 14 }}>
                {[40, 80, 120].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="var(--ff-line)" strokeDasharray="2 4" />)}
                <path d="M0 110 L50 100 L100 115 L150 90 L200 95 L250 70 L300 85 L350 60 L400 70 L450 45 L500 50 L550 35 L600 40" fill="none" stroke="var(--ff-coral)" strokeWidth="2" />
                <path d="M0 110 L50 100 L100 115 L150 90 L200 95 L250 70 L300 85 L350 60 L400 70 L450 45 L500 50 L550 35 L600 40 L600 160 L0 160 Z" fill="var(--ff-coral-tint)" opacity="0.7" />
              </svg>
            </FF.Card>
            <FF.Card style={{ background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral-soft)', borderLeft: '3px solid var(--ff-coral)' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <FF.Pip size={42} mood="happy" />
                <div>
                  <FF.Caption style={{ color: 'var(--ff-coral-deep)' }}>Pip's pick</FF.Caption>
                  <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>Childcare's at 78% — paystub due Fri. Want me to nudge the auto-transfer two days?</div>
                  <FF.Button kind="primary" size="sm" style={{ marginTop: 12 }}>Adjust schedule</FF.Button>
                </div>
              </div>
            </FF.Card>
          </div>

          <FF.Card padding={0} style={{ marginTop: 14 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--ff-line)', display: 'flex', justifyContent: 'space-between' }}>
              <FF.Caption>Recent activity</FF.Caption>
              <span style={{ fontSize: 12, color: 'var(--ff-coral-deep)' }}>See all 247 →</span>
            </div>
            {[
              ['Apr 14','🛒','Whole Foods Market','Groceries','Chase ··4291',-127.40],
              ['Apr 13','💼','Salary · monthly','Income','Chase ··4291',4200.00],
              ['Apr 12','💊','Equinox SoHo','Health','Apple Card',-185.00],
            ].map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 36px 1fr 130px 130px 130px', alignItems: 'center', padding: '12px 18px', borderBottom: i < 2 ? '1px solid var(--ff-line)' : 'none', fontSize: 13 }}>
                <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)' }}>{r[0]}</FF.Mono>
                <span style={{ fontSize: 16 }}>{r[1]}</span>
                <span style={{ fontWeight: 600 }}>{r[2]}</span>
                <span style={{ color: 'var(--ff-ink-2)' }}>{r[3]}</span>
                <FF.Mono style={{ color: 'var(--ff-ink-3)', fontSize: 11 }}>{r[4]}</FF.Mono>
                <FF.Money v={r[5]} style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--ff-mono)' }} />
              </div>
            ))}
          </FF.Card>
        </div>
      </div>
    </div>
  ),

  Mobile: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-canvas)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: 3, background: 'var(--ff-coral)' }} />
      <div style={{ padding: '18px 18px 14px', background: 'var(--ff-surface)', borderBottom: '1px solid var(--ff-line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FF.Icon name="menu" size={20} />
          <FF.Wordmark size={18} />
          <span style={{ width: 28, height: 28, borderRadius: 14, background: 'var(--ff-coral)', color: '#fff', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>NR</span>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
        <FF.Caption>April · Reyes household</FF.Caption>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <FF.PulseRing score={78} size={120} label="Good" />
          <FF.Badge tone="sage" dot>+4 vs last</FF.Badge>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['Net worth','$24,108','+$420'],['Spending','$3,247','−12%'],['Goals','$7,890','of $15K'],['Debt','$12,350','2.4yr']].map(([l,v,s]) => (
            <FF.Card key={l} padding={14}>
              <FF.Caption>{l}</FF.Caption>
              <div style={{ marginTop: 4, fontFamily: 'var(--ff-serif)', fontSize: 22, fontStyle: 'italic', fontWeight: 400 }}>{v}</div>
              <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-3)', marginTop: 2 }}>{s}</FF.Mono>
            </FF.Card>
          ))}
        </div>

        <FF.Card style={{ marginTop: 14, background: 'var(--ff-coral-tint)', borderColor: 'var(--ff-coral-soft)', borderLeft: '3px solid var(--ff-coral)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <FF.Pip size={32} mood="happy" />
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ff-ink)' }}>Date-night fund hit 60%. Nice.</div>
          </div>
        </FF.Card>

        <FF.Card padding={0} style={{ marginTop: 14 }}>
          {[['🛒','Whole Foods','Apr 14',-127.40],['💼','Salary','Apr 13',4200],['💊','Equinox','Apr 12',-185]].map((r, i, a) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i < a.length - 1 ? '1px solid var(--ff-line)' : 'none' }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ff-canvas-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{r[0]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{r[1]}</div>
                <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-3)' }}>{r[2]}</FF.Mono>
              </div>
              <FF.Money v={r[3]} style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--ff-mono)' }} />
            </div>
          ))}
        </FF.Card>
      </div>
      <div style={{ height: 64, background: 'var(--ff-surface)', borderTop: '1px solid var(--ff-line)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexShrink: 0 }}>
        {[['home','Home',true],['transactions','Txns',false],['plus','',false],['budget','Budgets',false],['user','You',false]].map(([icon, name, on], i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: on ? 'var(--ff-coral)' : 'var(--ff-ink-3)' }}>
            {i === 2 ? (
              <span style={{ width: 46, height: 46, borderRadius: 23, background: 'var(--ff-coral)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: -16, boxShadow: '0 6px 18px rgba(226,109,92,0.45)' }}><FF.Icon name="plus" size={22} stroke={2.2} /></span>
            ) : (
              <FF.Icon name={icon} size={20} />
            )}
            {name && <FF.Mono style={{ fontSize: 9, letterSpacing: '0.1em' }}>{name}</FF.Mono>}
          </div>
        ))}
      </div>
    </div>
  ),

  Admin: () => (
    <div className="ff" style={{ width: '100%', height: '100%', background: 'var(--ff-shell)', color: 'var(--ff-ink-on-shell)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 46, background: 'var(--ff-shell-2)', borderBottom: '1px solid var(--ff-line-on-shell)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0 }}>
        <FF.Wordmark size={16} style={{ color: 'var(--ff-ink-on-shell)' }} />
        <FF.Badge soft={false} tone="coral" style={{ fontFamily: 'var(--ff-mono)' }}>Admin</FF.Badge>
        <span style={{ width: 1, height: 14, background: 'var(--ff-line-on-shell)' }} />
        {['NorthStar','Households','Subscriptions','Activity','Audit'].map((t, i) => (
          <span key={t} style={{ fontSize: 12, color: i === 0 ? 'var(--ff-ink-on-shell)' : 'var(--ff-ink-on-shell-2)', fontWeight: i === 0 ? 600 : 400 }}>{t}</span>
        ))}
        <div style={{ flex: 1 }} />
        <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-on-shell-2)' }}>prod · us-east-1</FF.Mono>
        <span style={{ width: 26, height: 26, borderRadius: 13, background: 'var(--ff-coral)', color: '#fff', fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>OP</span>
      </div>

      <div style={{ flex: 1, padding: 24, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <FF.Caption style={{ color: 'var(--ff-coral)' }}>NorthStar · last 24h</FF.Caption>
            <h1 style={{ marginTop: 6, fontFamily: 'var(--ff-serif)', fontSize: 28, fontWeight: 400, color: 'var(--ff-ink-on-shell)' }}>Operator console</h1>
          </div>
          <div style={{ display: 'inline-flex', background: 'rgba(232,222,207,0.05)', padding: 2, borderRadius: 'var(--ff-r-2)', border: '1px solid var(--ff-line-on-shell)' }}>
            {['1h','24h','7d','30d'].map((t, i) => (
              <span key={t} style={{ padding: '5px 12px', fontSize: 11, fontFamily: 'var(--ff-mono)', background: i === 1 ? 'var(--ff-shell)' : 'transparent', color: i === 1 ? 'var(--ff-ink-on-shell)' : 'var(--ff-ink-on-shell-2)', borderRadius: 'var(--ff-r-1)' }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[['Active households','12,418','+184','sage'],['MRR','$48.2k','+2.1%','sage'],['Sync errors','0.04%','−12bps','sage'],['Onboard funnel','67%','+3pt','coral'],['p99 latency','312ms','+8ms','honey']].map(([l, v, d, t]) => (
            <div key={l} style={{ background: 'var(--ff-shell-2)', border: '1px solid var(--ff-line-on-shell)', borderRadius: 'var(--ff-r-3)', padding: 14 }}>
              <FF.Caption style={{ color: 'var(--ff-ink-on-shell-2)' }}>{l}</FF.Caption>
              <div style={{ marginTop: 6, fontFamily: 'var(--ff-serif)', fontSize: 24, fontStyle: 'italic', color: 'var(--ff-ink-on-shell)' }}>{v}</div>
              <FF.Mono style={{ marginTop: 4, fontSize: 10, color: t === 'sage' ? 'var(--ff-sage)' : t === 'coral' ? 'var(--ff-coral)' : 'var(--ff-honey)' }}>{d}</FF.Mono>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div style={{ background: 'var(--ff-shell-2)', border: '1px solid var(--ff-line-on-shell)', borderRadius: 'var(--ff-r-3)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ff-line-on-shell)', display: 'flex', justifyContent: 'space-between' }}>
              <FF.Caption style={{ color: 'var(--ff-ink-on-shell-2)' }}>Households · 12,418</FF.Caption>
              <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-on-shell-2)' }}>showing 6 of 12,418</FF.Mono>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 100px 80px 90px', padding: '8px 16px', borderBottom: '1px solid var(--ff-line-on-shell)', background: 'rgba(232,222,207,0.03)' }}>
              {['ID','Owner','Members','Plan','Pulse','Status'].map(h => <FF.Caption key={h} style={{ color: 'var(--ff-ink-on-shell-2)' }}>{h}</FF.Caption>)}
            </div>
            {[
              ['HH-04821','Reyes Household','reyes@…',4,'Family',78,'sage','healthy'],
              ['HH-04822','Tan-Mendez',     'amelia@…',3,'Family',82,'sage','healthy'],
              ['HH-04823','Okonkwo',        'cn@…',    2,'Personal',54,'honey','watch'],
              ['HH-04824','Volkov',         'iv@…',    5,'Multi-biz',91,'sage','healthy'],
              ['HH-04825','Chen Family',    'ch@…',    4,'Family',38,'coral','risk'],
              ['HH-04826','Park Household', 'sj@…',    3,'Family',71,'sage','healthy'],
            ].map((r, i, a) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 100px 80px 90px', padding: '10px 16px', borderBottom: i < a.length - 1 ? '1px solid var(--ff-line-on-shell)' : 'none', alignItems: 'center', fontSize: 12, color: 'var(--ff-ink-on-shell)' }}>
                <FF.Mono style={{ color: 'var(--ff-ink-on-shell-2)', fontSize: 11 }}>{r[0]}</FF.Mono>
                <span><span style={{ fontWeight: 600 }}>{r[1]}</span> <span style={{ color: 'var(--ff-ink-on-shell-2)', marginLeft: 6 }}>{r[2]}</span></span>
                <FF.Mono style={{ color: 'var(--ff-ink-on-shell-2)' }}>{r[3]}</FF.Mono>
                <span style={{ color: 'var(--ff-ink-on-shell-2)' }}>{r[4]}</span>
                <FF.Mono style={{ color: r[6] === 'sage' ? 'var(--ff-sage)' : r[6] === 'honey' ? 'var(--ff-honey)' : 'var(--ff-coral)' }}>{r[5]}</FF.Mono>
                <FF.Badge tone={r[6]} dot>{r[7]}</FF.Badge>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--ff-shell-2)', border: '1px solid var(--ff-line-on-shell)', borderRadius: 'var(--ff-r-3)', padding: 14 }}>
              <FF.Caption style={{ color: 'var(--ff-ink-on-shell-2)' }}>Sync errors · 24h</FF.Caption>
              <svg viewBox="0 0 300 80" style={{ width: '100%', marginTop: 10 }}>
                {Array.from({length: 24}).map((_, i) => {
                  const h = 8 + Math.abs(Math.sin(i * 0.7) * 22) + (i === 17 ? 30 : 0);
                  return <rect key={i} x={i * 12} y={70 - h} width="9" height={h} fill={i === 17 ? 'var(--ff-coral)' : 'var(--ff-coral-soft)'} rx="1" />;
                })}
              </svg>
              <FF.Mono style={{ marginTop: 6, fontSize: 10, color: 'var(--ff-ink-on-shell-2)' }}>Spike at 17:00 UTC · Plaid us-east-1</FF.Mono>
            </div>
            <div style={{ background: 'var(--ff-shell-2)', border: '1px solid var(--ff-line-on-shell)', borderRadius: 'var(--ff-r-3)', padding: 14 }}>
              <FF.Caption style={{ color: 'var(--ff-ink-on-shell-2)' }}>Recent activity</FF.Caption>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['HH-04825 · subscription failed','coral','2m'],['HH-04822 · invite accepted','sage','5m'],['HH-04821 · upgraded · Family','coral','12m'],['Audit · admin role granted','honey','24m']].map(([msg, t, ago]) => (
                  <div key={msg} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: t === 'sage' ? 'var(--ff-sage)' : t === 'coral' ? 'var(--ff-coral)' : 'var(--ff-honey)' }} />
                    <span style={{ flex: 1, color: 'var(--ff-ink-on-shell-2)' }}>{msg}</span>
                    <FF.Mono style={{ color: 'var(--ff-ink-on-shell-2)', fontSize: 10 }}>{ago}</FF.Mono>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
};

Object.assign(window, { PlatformsWeb });
