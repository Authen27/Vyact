// vy-mobile.jsx — Vyact mobile web screens (Android-style frame)
// Reuses vy-components.jsx + vyact-tokens.css. 5 tabs shown as a gallery.

const { useState: mS, useEffect: mE } = React;

function useNarrow(bp) {
  const [n, setN] = mS(typeof window !== 'undefined' && window.innerWidth < bp);
  mE(() => { const on = () => setN(window.innerWidth < bp); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return n;
}

// ── extra icons for chrome / tabs ────────────────────────────
const MPATHS = {
  home: 'M4 11l8-7 8 7M6 10v9h12v-9',
  activity: 'M3 12h4l3 7 4-15 3 8h4',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM5.5 20a6.5 6.5 0 0113 0',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.6-3.6',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.2A1.7 1.7 0 006.7 19l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 13.4H3a2 2 0 110-4h.2A1.7 1.7 0 005 6.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0011 3.6V3a2 2 0 114 0v.2a1.7 1.7 0 003 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.2a1.7 1.7 0 00-1.4 1z',
  download: 'M12 3v12M7 11l5 5 5-5M5 20h14',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M8 15v4',
  bell: 'M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 004 0',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3',
  chev: 'M9 6l6 6-6 6',
  spark: 'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
};
function MIcon({ name, size = 20, color = 'currentColor', stroke = 1.9, style }) {
  const solid = name === 'spark' || name === 'bolt';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}
      fill={solid ? color : 'none'} stroke={solid ? 'none' : color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={MPATHS[name] || MPATHS.home} />
    </svg>
  );
}

// ── phone chrome ─────────────────────────────────────────────
function StatusBar({ dark }) {
  const c = 'var(--vy-ink)';
  return (
    <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', flexShrink: 0 }}>
      <span data-num style={{ fontSize: 14, fontWeight: 600, color: c }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c }}>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><rect x="0" y="7" width="3" height="5" rx="1"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1"/><rect x="9" y="2" width="3" height="10" rx="1" opacity="0.9"/><rect x="13.5" y="0" width="3" height="12" rx="1" opacity="0.35"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 11.2L1 5a9.3 9.3 0 0114 0L8 11.2z" opacity="0.9"/></svg>
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="1" y="1.5" width="19" height="9" rx="2.5" stroke="currentColor" strokeOpacity="0.5"/><rect x="3" y="3.5" width="13" height="5" rx="1" fill="currentColor"/><rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" fillOpacity="0.5"/></svg>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'insights', label: 'Insights', icon: 'spark' },
  { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'profile', label: 'Me', icon: 'user' },
];
function TabBar({ active, onTab }) {
  return (
    <div style={{ flexShrink: 0, padding: '8px 12px 6px', background: 'var(--vy-canvas)', borderTop: '1px solid var(--vy-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <button key={t.id} onClick={() => onTab && onTab(t.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0',
              border: 'none', background: 'transparent', color: on ? 'var(--vy-accent)' : 'var(--vy-ink-3)',
            }}>
              <div style={{
                width: 46, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? 'color-mix(in srgb, var(--vy-accent) 16%, transparent)' : 'transparent', transition: 'background .2s',
              }}><MIcon name={t.icon} size={21} stroke={on ? 2.2 : 1.9} /></div>
              <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, fontFamily: 'var(--vy-heading)', letterSpacing: '0.01em' }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VyPhone({ theme, active, onTab, children }) {
  return (
    <div className="vy" data-vy-theme={theme} style={{
      width: 384, height: 812, borderRadius: 46, padding: 11, flexShrink: 0,
      background: 'linear-gradient(160deg, #23272e, #0c0e12)',
      boxShadow: '0 40px 90px rgba(0,0,0,0.5), inset 0 0 0 1.5px rgba(255,255,255,0.06)',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 36, overflow: 'hidden',
        background: 'var(--vy-canvas)', display: 'flex', flexDirection: 'column', position: 'relative',
      }}>
        <StatusBar dark={theme === 'dark'} />
        <div className="vy-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>{children}</div>
        <TabBar active={active} onTab={onTab} />
        <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--vy-canvas)' }}>
          <div style={{ width: 128, height: 5, borderRadius: 3, background: 'var(--vy-ink-4)' }} />
        </div>
      </div>
    </div>
  );
}

function FullPhone({ theme, active, onTab, children }) {
  return (
    <div className="vy" data-vy-theme={theme} style={{ width: '100vw', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--vy-canvas)', overflow: 'hidden' }}>
      <StatusBar dark={theme === 'dark'} />
      <div className="vy-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>{children}</div>
      <TabBar active={active} onTab={onTab} />
      <div style={{ height: 'calc(env(safe-area-inset-bottom, 6px) + 6px)', background: 'var(--vy-canvas)' }} />
    </div>
  );
}

// shared bits
function Avatar({ size = 40, initials = 'MR' }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: 'var(--vy-rail)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700,
      fontFamily: 'var(--vy-heading)', fontSize: size * 0.36, boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}>{initials}</div>
  );
}
function ScreenHead({ title, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px 14px' }}>
      <h1 style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h1>
      {right}
    </div>
  );
}
const PAD = { padding: '0 20px' };

// ── SCREEN · Dashboard ───────────────────────────────────────
function DashScreen() {
  const spark = [30, 33, 31, 36, 34, 40, 38, 44, 42, 48, 46, 52];
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 16px' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--vy-ink-3)' }}>Good morning</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--vy-heading)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>Maya Rowan</div>
        </div>
        <Avatar />
      </div>

      <div style={{ ...PAD, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 'var(--vy-r-2)', background: 'var(--vy-good-t)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--vy-good) 24%, transparent)' }}>
          <MIcon name="spark" size={17} color="var(--vy-good)" />
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--vy-ink)' }}>You're on track this week — <b style={{ color: 'var(--vy-good)' }}>$220 under</b> budget.</span>
        </div>
      </div>

      <div style={{ ...PAD, marginBottom: 16 }}>
        <VyGlass pad={22} tint="var(--vy-violet-b)" style={{ borderRadius: 'var(--vy-r-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="vy-cap" style={{ marginBottom: 8 }}>Net worth</div>
              <VyNumber value={148250} size={40} />
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 999, background: 'var(--vy-good-t)', color: 'var(--vy-good)', fontWeight: 600, fontSize: 12.5 }}>
              <VyIcon name="arrowUR" size={12} color="var(--vy-good)" /> 4.2%
            </span>
          </div>
          <div style={{ margin: '12px -6px 6px' }}><VyLine points={spark} height={72} color="var(--vy-violet-b)" /></div>
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <Mini label="Assets" val="$162.4k" tone="var(--vy-ink)" />
            <Mini label="Debts" val="$14.1k" tone="var(--vy-ink-2)" />
            <Mini label="Saved" val="+$2,340" tone="var(--vy-good)" />
          </div>
        </VyGlass>
      </div>

      <div style={{ ...PAD, marginBottom: 16 }}>
        <VyCard hover={false} style={{ borderRadius: 'var(--vy-r-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontFamily: 'var(--vy-heading)', fontSize: 15 }}>Spending this month</div>
            <div style={{ fontSize: 12, color: 'var(--vy-ink-3)' }}>$3,180 of $3,400</div>
          </div>
          <VyBars height={120} data={[
            { label: 'Food', value: 640 }, { label: 'Home', value: 1200 },
            { label: 'Fun', value: 410, note: 'up 12%', color: 'var(--vy-amber-b)' },
            { label: 'Trans', value: 280 }, { label: 'Other', value: 650 },
          ]} />
        </VyCard>
      </div>

      <div style={{ ...PAD, display: 'flex', gap: 12 }}>
        <VyButton variant="primary" icon="plus" style={{ flex: 1 }}>Log expense</VyButton>
        <VyButton icon="spark" style={{ flex: 1 }}>Categorize</VyButton>
      </div>
    </div>
  );
}
function Mini({ label, val, tone }) {
  return (<div style={{ flex: 1 }}><div style={{ fontSize: 11, color: 'var(--vy-ink-3)', marginBottom: 2 }}>{label}</div><div data-num style={{ fontWeight: 600, fontSize: 14, color: tone }}>{val}</div></div>);
}

// ── SCREEN · Transactions ────────────────────────────────────
function TxnScreen() {
  const [f, setF] = mS('All');
  return (
    <div style={{ paddingBottom: 24 }}>
      <ScreenHead title="Activity" right={<div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vy-ink-2)' }}><MIcon name="sliders" size={19} /></div>} />
      <div style={{ ...PAD, marginBottom: 14 }}><VyInput placeholder="Search transactions" prefix="⌕" /></div>
      <div style={{ ...PAD, marginBottom: 18 }}><VySeg options={['All', 'Income', 'Spending']} value={f} onChange={setF} /></div>

      <DayGroup label="Today · $92.65">
        <VyTxn icon="cart" name="Whole Foods" meta="Groceries" amount="86.40" accent="var(--vy-green-b)" insight="15% higher than usual — check the receipt?" />
        <VyTxn icon="coffee" name="Blue Bottle" meta="Coffee" amount="6.25" accent="var(--vy-amber-b)" />
      </DayGroup>
      <DayGroup label="Yesterday · +$4,184.51">
        <VyTxn icon="arrowUR" name="Paycheck" meta="Acme Inc · Income" amount="4,200.00" positive accent="var(--vy-green-b)" />
        <VyTxn icon="cardico" name="Netflix" meta="Subscription" amount="15.49" accent="var(--vy-violet-b)" insight="1 of 6 subscriptions — $84/mo together." />
      </DayGroup>
      <div style={{ ...PAD, textAlign: 'center', marginTop: 8 }}>
        <span className="vy-cap">Swipe a row to categorize →</span>
      </div>
    </div>
  );
}
function DayGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="vy-cap" style={{ ...PAD, marginBottom: 10 }}>{label}</div>
      <div style={{ ...PAD, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

// ── SCREEN · Insights ────────────────────────────────────────
function InsightScreen() {
  return (
    <div style={{ paddingBottom: 24 }}>
      <ScreenHead title="Insights" right={<Avatar size={38} initials="AI" />} />
      <div style={{ ...PAD, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <VyGlass pad={18} tint="var(--vy-amber-b)" style={{ borderRadius: 'var(--vy-r-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <MIcon name="bolt" size={15} color="var(--vy-warn)" /><span className="vy-cap" style={{ color: 'var(--vy-warn)' }}>Budget anomaly</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--vy-ink)' }}>Dining is <b>up 12%</b> vs last month. Most of it: 3 late-night deliveries.</p>
        </VyGlass>

        <VyCard accent="var(--vy-violet-b)" hover={false} style={{ borderRadius: 'var(--vy-r-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <VyIcon name="spark" size={15} color="var(--vy-fore)" /><span className="vy-cap" style={{ color: 'var(--vy-fore)' }}>Opportunity</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--vy-ink)', marginBottom: 14 }}>You have <b data-num>6 subscriptions</b> totalling <b data-num>$84/mo</b>. Two haven't been used in 60 days.</p>
          <VyButton variant="primary" style={{ height: 40, width: '100%' }}>Review subscriptions</VyButton>
        </VyCard>

        <VyCard hover={false} style={{ borderRadius: 'var(--vy-r-3)' }}>
          <div style={{ fontWeight: 600, fontFamily: 'var(--vy-heading)', fontSize: 14.5, marginBottom: 4 }}>Where it goes</div>
          <div style={{ fontSize: 12.5, color: 'var(--vy-ink-3)', marginBottom: 16 }}>Tap a bar for the breakdown</div>
          <VyBars height={110} data={[
            { label: 'Jan', value: 2900 }, { label: 'Feb', value: 3100 }, { label: 'Mar', value: 3400, note: 'peak', color: 'var(--vy-amber-b)' }, { label: 'Apr', value: 3180 },
          ]} color="var(--vy-fore)" />
        </VyCard>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--vy-r-pill)', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-inset)' }}>
          <VyIcon name="spark" size={17} color="var(--vy-accent)" />
          <span style={{ flex: 1, fontSize: 14, color: 'var(--vy-ink-3)' }}>Ask Vyact about your money…</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--vy-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><VyIcon name="arrowUR" size={15} color="var(--vy-accent-ink)" /></div>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN · Goals ───────────────────────────────────────────
function GoalScreen() {
  const [fire, setFire] = mS(0);
  const [done, setDone] = mS(false);
  return (
    <div style={{ paddingBottom: 24 }}>
      <ScreenHead title="Goals" right={<VyStreak days={7} />} />
      <div style={{ ...PAD, marginBottom: 16 }}>
        <VyCard hover={false} style={{ borderRadius: 'var(--vy-r-3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <VyRing value={done ? 1 : 0.68} size={120} color="var(--vy-good)" label="of goal" trigger={fire} />
              <VyConfetti fire={fire} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontFamily: 'var(--vy-heading)', fontSize: 17, marginBottom: 4 }}>Emergency fund</div>
              <VyNumber value={done ? 10000 : 6800} size={22} trigger={fire} />
              <div style={{ fontSize: 12.5, color: 'var(--vy-ink-3)' }}>of $10,000 · {done ? 'reached 🎉' : 'Oct 2026'}</div>
            </div>
          </div>
          <VyButton variant="primary" icon="bolt" style={{ width: '100%', marginTop: 16 }}
            onClick={() => { setFire((x) => x + 1); setDone(true); setTimeout(() => setDone(false), 4200); }}>Add $200 today</VyButton>
        </VyCard>
      </div>
      <div className="vy-cap" style={{ ...PAD, marginBottom: 10 }}>Other goals</div>
      <div style={{ ...PAD, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <GoalRow name="Japan trip" amt="$3,200 / $6,000" pct={0.53} color="var(--vy-fore)" />
        <GoalRow name="New laptop" amt="$1,400 / $2,000" pct={0.7} color="var(--vy-warn)" />
      </div>
    </div>
  );
}
function GoalRow({ name, amt, pct, color }) {
  return (
    <VyCard hover style={{ borderRadius: 'var(--vy-r-2)' }} pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <VyRing value={pct} size={56} stroke={7} color={color} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontFamily: 'var(--vy-heading)', fontSize: 14.5 }}>{name}</div>
          <div data-num style={{ fontSize: 12.5, color: 'var(--vy-ink-3)' }}>{amt}</div>
        </div>
        <MIcon name="chev" size={18} color="var(--vy-ink-4)" />
      </div>
    </VyCard>
  );
}

// ── SCREEN · Profile ─────────────────────────────────────────
function ProfileScreen({ theme, onToggleTheme }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <ScreenHead title="Me" />
      <div style={{ ...PAD, marginBottom: 18 }}>
        <VyCard hover={false} style={{ borderRadius: 'var(--vy-r-3)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar size={58} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--vy-heading)', whiteSpace: 'nowrap' }}>Maya Rowan</div>
            <div style={{ fontSize: 13, color: 'var(--vy-ink-3)' }}>maya@rowan.co</div>
          </div>
        </VyCard>
      </div>
      <div style={{ ...PAD, marginBottom: 20 }}>
        <VyBadge icon="spark" title="Budget Detective" sub="3 spikes caught" color="var(--vy-fore)" />
      </div>
      <div className="vy-cap" style={{ ...PAD, marginBottom: 10 }}>Settings</div>
      <div style={{ ...PAD, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SetRow icon="sliders" label="Budget presets" />
        <SetRow icon="spark" label="AI personalization" />
        <SetRow icon="bell" label="Notifications" />
        <SetRow icon="download" label="Export data" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-2)', boxShadow: 'var(--vy-neu-sm)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--vy-info-t)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vy-accent)' }}><MIcon name="settings" size={18} /></div>
          <span style={{ flex: 1, fontWeight: 500, fontSize: 14.5 }}>Dark mode</span>
          <button onClick={onToggleTheme} aria-label="theme" style={{ position: 'relative', width: 46, height: 26, borderRadius: 999, border: 'none', background: theme === 'dark' ? 'var(--vy-good)' : 'var(--vy-sunken)', boxShadow: 'var(--vy-neu-inset)', transition: 'background .2s' }}>
            <span style={{ position: 'absolute', top: 3, left: theme === 'dark' ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left .2s var(--vy-spring)' }} />
          </button>
        </div>
      </div>
      <div style={{ ...PAD, marginTop: 18 }}><VyButton variant="ghost" style={{ width: '100%', color: 'var(--vy-crit)' }}>Sign out</VyButton></div>
    </div>
  );
}
function SetRow({ icon, label }) {
  return (
    <button style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-2)', boxShadow: 'var(--vy-neu-sm)', border: 'none', width: '100%', textAlign: 'left', color: 'var(--vy-ink)' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--vy-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vy-ink-2)' }}><MIcon name={icon} size={18} /></div>
      <span style={{ flex: 1, fontWeight: 500, fontSize: 14.5 }}>{label}</span>
      <MIcon name="chev" size={18} color="var(--vy-ink-4)" />
    </button>
  );
}

// ── Gallery App ──────────────────────────────────────────────
const SCREENS = [
  { id: 'home', label: 'Dashboard', C: DashScreen },
  { id: 'activity', label: 'Transactions', C: TxnScreen },
  { id: 'insights', label: 'Insights', C: InsightScreen },
  { id: 'goals', label: 'Goals', C: GoalScreen },
  { id: 'profile', label: 'Profile', C: ProfileScreen },
];

function MobileApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "dark": true,
    "headFont": "Outfit"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = t.dark ? 'dark' : 'light';
  const narrow = useNarrow(640);
  const [active, setActive] = mS('home');
  mE(() => { document.documentElement.style.setProperty('--vy-head', t.headFont === 'Inter Tight' ? "'Inter Tight'" : "'Outfit'"); }, [t.headFont]);

  const Tweaks = (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Appearance" />
      <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />
      <TweakRadio label="Headings" value={t.headFont} options={['Outfit', 'Inter Tight']} onChange={(v) => setTweak('headFont', v)} />
    </TweaksPanel>
  );

  if (narrow) {
    const C = (SCREENS.find((s) => s.id === active) || SCREENS[0]).C;
    return (
      <React.Fragment>
        <FullPhone theme={theme} active={active} onTab={setActive}>
          <C theme={theme} onToggleTheme={() => setTweak('dark', !t.dark)} />
        </FullPhone>
        {Tweaks}
      </React.Fragment>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b0d11', padding: '48px 40px 80px',
      backgroundImage: 'radial-gradient(80% 50% at 50% 0%, rgba(59,130,246,0.10), transparent 60%)' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="vy" data-vy-theme="dark" style={{ marginBottom: 40 }}>
          <div className="vy-cap" style={{ marginBottom: 8 }}>Vyact · Mobile web</div>
          <h1 style={{ fontFamily: 'var(--vy-heading)', fontWeight: 700, fontSize: 34, letterSpacing: '-0.02em', color: '#E8EDF5' }}>Five tabs, one companion</h1>
          <p style={{ color: '#AEB9CC', fontSize: 15, marginTop: 8, maxWidth: 560 }}>Neumorphic Fluid applied end-to-end. Tap the tab bar on any device to navigate; toggle theme in Tweaks or on the Profile screen.</p>
        </div>

        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          {SCREENS.map(({ id, label, C }) => (
            <Device key={id} id={id} label={label} theme={theme} setTweak={setTweak} dark={t.dark} />
          ))}
        </div>
      </div>
      {Tweaks}
    </div>
  );
}

// each device keeps its own active tab, defaulting to its screen
function Device({ id, label, theme, setTweak, dark }) {
  const [active, setActive] = mS(id);
  const scr = SCREENS.find((s) => s.id === active) || SCREENS[0];
  const C = scr.C;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <VyPhone theme={theme} active={active} onTab={setActive}>
        <C theme={theme} onToggleTheme={() => setTweak('dark', !dark)} />
      </VyPhone>
      <div className="vy" data-vy-theme="dark" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--vy-heading)', fontWeight: 600, fontSize: 14, color: '#E8EDF5' }}>{label}</div>
        <div className="vy-cap" style={{ fontSize: 10 }}>{id}</div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp />);
