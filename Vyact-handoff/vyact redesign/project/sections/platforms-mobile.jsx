// Platforms — iOS iPhone + iPad · Android Material 3

const PlatformsMobile = {
  IPhone: () => (
    <IOSDevice width={390} height={780}>
      <div style={{ padding: '8px 20px 24px', fontFamily: '-apple-system, system-ui' }}>
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8077' }}>April · USD</div>
            <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontStyle: 'italic', fontWeight: 500, fontSize: 30, color: '#2A2522', letterSpacing: '-0.01em', marginTop: 2 }}>Hi, Naomi</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#E26D5C', color: '#fff', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>NR</div>
        </div>

        {/* Pulse hero */}
        <div style={{ marginTop: 18, background: '#FBF7EE', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #E6DDCF' }}>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#E26D5C', fontWeight: 600 }}>Family Pulse Score</div>
          <FF.PulseRing score={78} size={120} label="Good" />
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: '#DDE8DE', color: '#6B7C53', borderRadius: 100, fontSize: 11, fontFamily: 'JetBrains Mono', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: '#6B7C53' }} />+4 vs last
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['Net worth','$24,108','+$420'],['Spending','$3,247','−12%']].map(([l, v, s]) => (
            <div key={l} style={{ background: '#FBF7EE', border: '1px solid #E6DDCF', borderRadius: 14, padding: 14 }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8077' }}>{l}</div>
              <div style={{ marginTop: 4, fontFamily: 'Newsreader, Georgia', fontStyle: 'italic', fontSize: 22, color: '#2A2522' }}>{v}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: '#5C544D' }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, background: '#FBE4DD', borderLeft: '3px solid #E26D5C', borderRadius: '4px 14px 14px 4px', padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <FF.Pip size={36} mood="happy" />
          <div style={{ fontSize: 13, color: '#2A2522', lineHeight: 1.5 }}>
            <strong>Date-night fund hit 60%.</strong> Nice. Want to bump weekly auto-save by $10 to land it before June?
          </div>
        </div>

        <div style={{ marginTop: 16, fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8077', padding: '0 4px' }}>Recent</div>
        <div style={{ marginTop: 8, background: '#FBF7EE', border: '1px solid #E6DDCF', borderRadius: 14, overflow: 'hidden' }}>
          {[['🛒','Whole Foods','Apr 14 · Groceries',-127.40],['💼','Salary','Apr 13 · Income',4200],['💊','Equinox','Apr 12 · Health',-185]].map((r, i, a) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < a.length - 1 ? '1px solid #E6DDCF' : 'none' }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: '#F5EFE6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{r[0]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#2A2522' }}>{r[1]}</div>
                <div style={{ fontSize: 11, color: '#8A8077' }}>{r[2]}</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono', color: r[3] > 0 ? '#6B7C53' : '#2A2522' }}>
                {r[3] > 0 ? '+' : '−'}${Math.abs(r[3]).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </IOSDevice>
  ),

  IPad: () => (
    <IOSDevice width={820} height={600}>
      <div style={{ display: 'flex', height: '100%', fontFamily: '-apple-system, system-ui', background: '#F5EFE6' }}>
        <div style={{ width: 240, background: '#FBF7EE', padding: '8px 12px', borderRight: '1px solid #E6DDCF' }}>
          <div style={{ padding: '8px 8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FF.Pip size={26} mood="happy" />
            <span style={{ fontFamily: 'Newsreader, Georgia', fontStyle: 'italic', fontWeight: 500, fontSize: 18, color: '#2A2522' }}>Reyes Household</span>
          </div>
          {[
            ['TRACK', [['Dashboard',true],['Transactions'],['Budgets']]],
            ['PLAN', [['Goals'],['Debts'],['Net worth']]],
            ['ACCOUNTS', [['Chase ··6204'],['Apple Card ··0091'],['Vanguard 401k']]],
          ].map(([sec, items]) => (
            <div key={sec} style={{ marginTop: 8 }}>
              <div style={{ padding: '4px 10px', fontFamily: 'JetBrains Mono', fontSize: 10, color: '#8A8077', letterSpacing: '0.16em' }}>{sec}</div>
              {items.map(([n, on]) => (
                <div key={n} style={{ padding: '7px 10px', borderRadius: 8, background: on ? '#FBE4DD' : 'transparent', color: on ? '#C44536' : '#2A2522', fontSize: 14, fontWeight: on ? 600 : 400 }}>{n}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '14px 22px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A8077' }}>Dashboard · April</div>
              <div style={{ marginTop: 2, fontFamily: 'Newsreader, Georgia', fontStyle: 'italic', fontWeight: 500, fontSize: 28, color: '#2A2522', letterSpacing: '-0.02em' }}>Hi, Naomi.</div>
            </div>
            <span style={{ height: 36, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E26D5C', color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(226,109,92,0.3)' }}>+ Add transaction</span>
          </div>

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '220px repeat(3, 1fr)', gap: 10 }}>
            <div style={{ gridRow: 'span 2', background: '#FBF7EE', border: '1px solid #E6DDCF', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#E26D5C', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>Pulse</div>
              <FF.PulseRing score={78} size={120} label="Good" />
            </div>
            {[['Net worth','$24,108','+$420'],['Spending','$3,247','−12%'],['Income','$4,400','+5%'],['Goals','$7,890','of $15K'],['Debt','$12,350','2.4yr'],['Cashflow','$1,153','4w runway']].map(([l, v, s]) => (
              <div key={l} style={{ background: '#FBF7EE', border: '1px solid #E6DDCF', borderRadius: 12, padding: 12 }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#8A8077', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{l}</div>
                <div style={{ marginTop: 4, fontFamily: 'Newsreader, Georgia', fontStyle: 'italic', fontSize: 19, color: '#2A2522' }}>{v}</div>
                <div style={{ marginTop: 2, fontSize: 11, color: '#5C544D' }}>{s}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, background: '#FBF7EE', border: '1px solid #E6DDCF', borderRadius: 14, padding: 16 }}>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#8A8077', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Net flow · 12 months</div>
            <svg viewBox="0 0 600 110" style={{ width: '100%', marginTop: 10 }}>
              {[30, 60, 90].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#E6DDCF" strokeDasharray="2 4" />)}
              <path d="M0 80 L50 75 L100 85 L150 60 L200 68 L250 45 L300 58 L350 35 L400 42 L450 25 L500 30 L550 18 L600 22" fill="none" stroke="#E26D5C" strokeWidth="2" />
              <path d="M0 80 L50 75 L100 85 L150 60 L200 68 L250 45 L300 58 L350 35 L400 42 L450 25 L500 30 L550 18 L600 22 L600 110 L0 110 Z" fill="#FBE4DD" opacity="0.7" />
            </svg>
          </div>
        </div>
      </div>
    </IOSDevice>
  ),

  Android: () => (
    <AndroidDevice width={400} height={780}>
      <div style={{ padding: '4px 16px 20px', fontFamily: 'Roboto, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#5C544D', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Reyes household</div>
            <div style={{ marginTop: 2, fontFamily: 'Newsreader, Georgia', fontStyle: 'italic', fontWeight: 500, fontSize: 24, color: '#2A2522', letterSpacing: '-0.01em' }}>Hi, Naomi</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: '#E26D5C', color: '#fff', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>NR</div>
        </div>

        <div style={{ marginTop: 12, background: '#FBE4DD', borderRadius: 28, padding: 20, display: 'flex', alignItems: 'center', gap: 18 }}>
          <FF.PulseRing score={78} size={92} label="Good" />
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#C44536', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>Family Pulse</div>
            <div style={{ marginTop: 4, fontFamily: 'Newsreader, Georgia', fontStyle: 'italic', fontSize: 22, color: '#2A2522' }}>+4 vs last</div>
            <div style={{ marginTop: 2, fontSize: 11, color: '#5C544D' }}>Savings rate up, debt steady</div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, overflow: 'hidden' }}>
          {[['Overview',true],['Spend'],['Goals'],['Debts']].map(([l, on]) => (
            <span key={l} style={{ height: 32, padding: '0 14px', display: 'inline-flex', alignItems: 'center', borderRadius: 8, fontSize: 13, fontWeight: 500, background: on ? '#FBE4DD' : 'transparent', border: on ? 'none' : '1px solid #C9BBA2', color: on ? '#C44536' : '#2A2522' }}>{l}</span>
          ))}
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['Spending','$3,247','12% under'],['Income','$4,400','+5%']].map(([l, v, s]) => (
            <div key={l} style={{ background: '#FBF7EE', borderRadius: 20, padding: 14 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#5C544D', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{l}</div>
              <div style={{ marginTop: 4, fontFamily: 'Newsreader, Georgia', fontStyle: 'italic', fontSize: 22, color: '#2A2522' }}>{v}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: '#5C544D' }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ padding: '0 4px', fontFamily: 'monospace', fontSize: 10, color: '#5C544D', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>Recent</div>
          <div style={{ marginTop: 6, background: '#FBF7EE', borderRadius: 20, overflow: 'hidden' }}>
            {[['🛒','Whole Foods','Apr 14',-127.40],['💼','Salary','Apr 13',4200],['💊','Equinox','Apr 12',-185]].map((r, i, a) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < a.length - 1 ? '1px solid #E6DDCF' : 'none' }}>
                <span style={{ width: 36, height: 36, borderRadius: 18, background: '#F5EFE6', fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{r[0]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#2A2522' }}>{r[1]}</div>
                  <div style={{ fontSize: 12, color: '#5C544D' }}>{r[2]}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: r[3] > 0 ? '#6B7C53' : '#2A2522', fontFamily: 'Roboto Mono, monospace' }}>
                  {r[3] > 0 ? '+' : '−'}${Math.abs(r[3]).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FAB · extended */}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ height: 56, padding: '0 20px', display: 'inline-flex', alignItems: 'center', gap: 10, background: '#E26D5C', color: '#fff', borderRadius: 16, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(226,109,92,0.4)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
            Add transaction
          </span>
        </div>
      </div>
    </AndroidDevice>
  ),
};

Object.assign(window, { PlatformsMobile });
