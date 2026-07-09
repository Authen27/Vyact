// vy-app.jsx — Vyact REAL app (Dashboard flow) reskinned in Neumorphic Fluid.
// Grounded in Authen27/Vyact react/src: routing, Sidebar nav groups, Dashboard.tsx,
// PulseGauge, TxnRow, CategoryDonut, constants (categories/currencies), types.
// Proof-of-fit: the Dashboard is fully mapped; other routes show a mapping stub.

const { useState: aS, useEffect: aE, useMemo: aM } = React;

// ── real category lookup (constants.ts) ──────────────────────
const CATS = {
  food_dining:   { label: 'Food & Dining', icon: '🍽️', color: '#E8A87C' },
  groceries:     { label: 'Groceries',     icon: '🛒', color: '#85A88A' },
  transport:     { label: 'Transport',     icon: '🚗', color: '#4A6FA5' },
  rent_mortgage: { label: 'Rent / Mortgage', icon: '🏠', color: '#C44536' },
  utilities:     { label: 'Utilities',     icon: '⚡', color: '#F4D27A' },
  shopping:      { label: 'Shopping',      icon: '🛍️', color: '#E26D5C' },
  health:        { label: 'Health',        icon: '💊', color: '#85A88A' },
  entertainment: { label: 'Entertainment', icon: '🎬', color: '#6E4555' },
  education:     { label: 'Education',     icon: '📚', color: '#6B7C53' },
  travel:        { label: 'Travel',        icon: '✈️', color: '#4A6FA5' },
  insurance:     { label: 'Insurance',     icon: '🛡️', color: '#6B635C' },
  loan_emi:      { label: 'Loan / EMI',    icon: '💳', color: '#C44536' },
  other_expense: { label: 'Other',         icon: '📦', color: '#6B635C' },
  salary:        { label: 'Salary',        icon: '💼', color: '#85A88A' },
};
const getCat = (id) => CATS[id] || { label: id, icon: '📦', color: '#6B635C' };

// ── money helpers (lib/format.ts semantics) ──────────────────
const money = (n) => (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
const short = (n) => {
  const a = Math.abs(n), s = n < 0 ? '−$' : '$';
  if (a >= 1000) return s + (a / 1000).toFixed(a >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return s + Math.round(a);
};

// ── real demo data (types.ts shapes; persona: Maya Rowan · family · USD) ──
const D = {
  profile: { name: 'Maya Rowan', baseCurrency: 'USD', household: 'family' },
  month: { key: 'July', income: 8600, expense: 5940 },
  netWorth: { assets: 214300, liabilities: 38100 },
  pulse: { total: 76, label: 'On Track', components: { budget: 68, savings: 79, trend: 64, debt: 88 } },
  insights: [
    { tone: 'good', icon: '📈', text: 'Savings rate 31% — above your 20% target.', detail: 'You kept $2,660 this month.', to: 'reports' },
    { tone: 'warn', icon: '🍽️', text: 'Dining is trending up 14%.', detail: 'Mostly weekend delivery — 6 orders.', to: 'reports' },
    { tone: 'alert', icon: '🛒', text: 'Groceries at 92% of budget.', detail: '8 days left in the month.', to: 'budgets' },
    { tone: 'info', icon: '⚖️', text: 'Debt-to-income 8% — healthy.', detail: 'Well under the 36% guideline.', to: null },
  ],
  budgets: [
    { catId: 'groceries', spent: 690, limit: 750 },
    { catId: 'rent_mortgage', spent: 2100, limit: 2100 },
    { catId: 'food_dining', spent: 420, limit: 500 },
    { catId: 'transport', spent: 180, limit: 300 },
    { catId: 'entertainment', spent: 95, limit: 150 },
  ],
  recent: [
    { catId: 'groceries', desc: 'Whole Foods', amount: 86.4, type: 'expense', date: 'Today', pm: 'visa' },
    { catId: 'salary', desc: 'Salary — Acme Inc', amount: 8600, type: 'income', date: 'Jul 1', pm: 'chase' },
    { catId: 'transport', desc: 'Shell', amount: 52.1, type: 'expense', date: 'Yesterday', pm: 'amex' },
    { catId: 'entertainment', desc: 'Netflix', amount: 15.49, type: 'expense', date: 'Jul 3', pm: 'visa', recurring: true },
    { catId: 'rent_mortgage', desc: 'Rent', amount: 2100, type: 'expense', date: 'Jul 1', pm: 'chase' },
  ],
  spend: [
    { catId: 'rent_mortgage', amount: 2100 }, { catId: 'groceries', amount: 690 },
    { catId: 'food_dining', amount: 420 }, { catId: 'shopping', amount: 610 },
    { catId: 'transport', amount: 320 }, { catId: 'travel', amount: 470 },
    { catId: 'utilities', amount: 240 }, { catId: 'health', amount: 180 },
    { catId: 'entertainment', amount: 210 }, { catId: 'other_expense', amount: 700 },
  ],
  debt: { total: 38100, accounts: 3, monthlyMin: 720 },
};
const PM = { visa: { abbr: 'V', color: '#1A1F71' }, amex: { abbr: 'AX', color: '#2E77BB' }, chase: { abbr: 'CH', color: '#117ACA' } };

// ── line-icon set for nav (lucide equivalents) ───────────────
const NAVI = {
  dashboard: 'M4 4h7v6H4zM13 4h7v9h-7zM4 13h7v7H4zM13 16h7v4h-7z',
  transactions: 'M7 8h13M16 4l4 4-4 4M17 16H4M8 12l-4 4 4 4',
  splits: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 11a3 3 0 000-6M21.5 20a6 6 0 00-4.5-5.8',
  recurring: 'M4 10a8 8 0 0113-6l3 2M20 14a8 8 0 01-13 6l-3-2M20 4v4h-4M4 20v-4h4',
  budgets: 'M3 8h15a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 8l2-3h10l2 3M16.5 13h1.5',
  debts: 'M3 6h18v12H3zM3 10h18M7 15h4',
  networth: 'M12 3v17M6 21h12M6 7l-3 6a3 3 0 006 0zM18 7l-3 6a3 3 0 006 0M5 7l7-2 7 2',
  accounts: 'M3 6h18v12H3zM3 10h18M6.5 15h4',
  reports: 'M4 20V11M9.5 20V5M15 20v-6M20.5 20V8',
  insights: 'M4 5a2 2 0 012-2h13v14H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13M9 7h6M9 10h4',
  households: 'M4 11l8-7 8 7M6 10v9h5v-5h2v5h5v-9',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a1.7 1.7 0 00.3 1.9 2 2 0 11-2.8 2.8 1.7 1.7 0 00-2.9 1.2 2 2 0 11-4 0 1.7 1.7 0 00-2.9-1.2 2 2 0 11-2.8-2.8A1.7 1.7 0 004 13.4a2 2 0 010-4 1.7 1.7 0 001.5-2.5 2 2 0 112.8-2.8A1.7 1.7 0 0011 3.6a2 2 0 014 0 1.7 1.7 0 002.9 1.2 2 2 0 112.8 2.8A1.7 1.7 0 0021 12a2 2 0 01-1.6 1z',
  help: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.6 9.5a2.4 2.4 0 014.4 1.3c0 1.6-2 2-2 3.2M12 17h.01',
};
function NavIcon({ name, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={NAVI[name] || NAVI.dashboard} />
    </svg>
  );
}
function Ico({ d, size = 15, w = 1.9, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={d} /></svg>;
}

// ── brand mark (pip) + wordmark ──────────────────────────────
function Pip({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="pip" style={{ flexShrink: 0, filter: 'drop-shadow(0 3px 9px rgba(226,109,92,0.4))' }}>
      <defs><radialGradient id="pipg-app" cx="50%" cy="40%" r="62%"><stop offset="0%" stopColor="#F4B6A8" /><stop offset="100%" stopColor="#E26D5C" /></radialGradient></defs>
      <path d="M18 3 C 27 3, 33 9, 33 18 C 33 27, 27 33, 18 33 C 9 33, 3 27, 3 18 C 3 9, 9 3, 18 3 Z" fill="url(#pipg-app)" stroke="#2A2522" strokeWidth="1.2" />
      <ellipse cx="13" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
      <ellipse cx="23" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
      <circle cx="9.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      <circle cx="26.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.8" />
    </svg>
  );
}
function Brand({ size = 30 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Pip size={size + 2} />
      <span style={{ fontFamily: 'var(--vy-heading)', fontWeight: 700, fontSize: size * 0.72, letterSpacing: '-0.02em', color: 'var(--vy-ink)' }}>Vy<span style={{ color: 'var(--vy-accent)' }}>act</span></span>
    </div>
  );
}

// ── SIDEBAR (real nav groups) ────────────────────────────────
const NAV_GROUPS = [
  { label: 'TRACK', items: [['dashboard', 'Dashboard'], ['transactions', 'Transactions'], ['splits', 'Splits'], ['recurring', 'Recurring']] },
  { label: 'PLAN', items: [['budgets', 'Budgets'], ['debts', 'Debts'], ['networth', 'Net Worth'], ['accounts', 'Accounts']] },
  { label: 'ANALYZE', items: [['reports', 'Reports'], ['insights', 'Insights']] },
  { label: 'ACCOUNT', items: [['households', 'Households']] },
];
function Sidebar({ route, setRoute, themeMode, setThemeMode }) {
  const NavRow = (id, label) => {
    const on = route === id;
    return (
      <button key={id} onClick={() => setRoute(id)} style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
        padding: '9px 14px', margin: '1px 0', border: 'none', borderRadius: 10,
        background: on ? 'var(--vy-canvas)' : 'transparent',
        boxShadow: on ? 'var(--vy-neu-inset)' : 'none',
        color: on ? 'var(--vy-accent)' : 'var(--vy-ink-3)',
        fontFamily: 'var(--vy-heading)', fontWeight: on ? 600 : 500, fontSize: 13.5,
        transition: 'color .18s, box-shadow .18s',
      }}><NavIcon name={id} />{label}</button>
    );
  };
  return (
    <aside style={{
      width: 244, flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
      background: 'var(--vy-canvas)', borderRight: '1px solid var(--vy-line)',
      display: 'flex', flexDirection: 'column', boxShadow: 'var(--vy-neu-sm)', zIndex: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 16px' }}>
        <Brand size={26} />
        <button aria-label="Notifications" style={{ position: 'relative', width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', color: 'var(--vy-ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ico d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 004 0" size={16} />
          <span style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: '50%', background: 'var(--vy-warn)', boxShadow: '0 0 0 2px var(--vy-canvas)' }} />
        </button>
      </div>

      {/* profile switcher */}
      <div style={{ margin: '0 12px 8px', padding: '10px 12px', borderRadius: 12, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--vy-rail)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--vy-heading)' }}>MR</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--vy-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Rowan Family</div>
          <div style={{ fontSize: 11, color: 'var(--vy-ink-3)' }}>Family · USD</div>
        </div>
        <Ico d="M8 9l4-4 4 4M8 15l4 4 4-4" size={14} color="var(--vy-ink-4)" />
      </div>

      <nav className="vy-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
        {NAV_GROUPS.map((g) => (
          <div key={g.label} style={{ marginBottom: 6 }}>
            <div className="vy-cap" style={{ fontSize: 9.5, padding: '10px 14px 4px' }}>{g.label}</div>
            {g.items.map(([id, label]) => NavRow(id, label))}
          </div>
        ))}
        <div style={{ height: 1, background: 'var(--vy-line)', margin: '8px 12px' }} />
        {NavRow('settings', 'Settings')}
        {NavRow('help', 'Help & Guide')}
      </nav>

      {/* theme control (real: warm/dark/system) */}
      <div style={{ padding: 12, borderTop: '1px solid var(--vy-line)' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-inset)' }}>
          {[['light', 'M12 4.5a1 1 0 010-1M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19'],
            ['dark', 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'], ['auto', 'M4 5h16v11H4zM9 20h6M12 16v4']].map(([m, d]) => {
            const on = themeMode === m;
            return (
              <button key={m} onClick={() => setThemeMode(m)} title={m} style={{
                flex: 1, height: 30, borderRadius: 7, border: 'none',
                background: on ? 'var(--vy-canvas)' : 'transparent', boxShadow: on ? 'var(--vy-neu-sm)' : 'none',
                color: on ? 'var(--vy-accent)' : 'var(--vy-ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Ico d={d} size={15} /></button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ── shells ───────────────────────────────────────────────────
function Panel({ title, sub, action, children, style = {} }) {
  return (
    <div style={{ background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-3)', boxShadow: 'var(--vy-neu)', overflow: 'hidden', ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--vy-line)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            {title && <h2 className="vy-cap" style={{ fontSize: 11, color: 'var(--vy-ink)' }}>{title}</h2>}
            {sub && <span className="vy-cap" style={{ fontSize: 10 }}>{sub}</span>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
const ViewAll = ({ label = 'View all →', onClick }) => (
  <button onClick={onClick} className="vy-cap" style={{ border: 'none', background: 'transparent', color: 'var(--vy-accent)', fontSize: 10, cursor: 'pointer' }}>{label}</button>
);

// ── hero cards ───────────────────────────────────────────────
function Hero({ spine, label, labelIcon, value, valueColor, a, b }) {
  const [h, setH] = aS(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      position: 'relative', background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-3)', padding: '20px 22px',
      boxShadow: h ? 'var(--vy-neu-hover)' : 'var(--vy-neu)', transform: h ? 'translateY(-2px)' : 'none',
      transition: 'box-shadow .24s var(--vy-ease), transform .24s var(--vy-ease)', cursor: 'pointer', overflow: 'hidden',
    }}>
      <span style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: 3, background: spine }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        {labelIcon}<span className="vy-cap" style={{ fontSize: 10 }}>{label}</span>
      </div>
      <div data-num style={{ fontSize: 32, fontWeight: 700, color: valueColor, letterSpacing: '-0.01em', fontFamily: 'var(--vy-mono)' }}>{value}</div>
      <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--vy-ink-3)' }}>{a.k} <b data-num style={{ color: a.c }}>{a.v}</b></span>
        <span style={{ fontSize: 13, color: 'var(--vy-ink-3)' }}>{b.k} <b data-num style={{ color: b.c }}>{b.v}</b></span>
      </div>
    </div>
  );
}

// ── metric card ──────────────────────────────────────────────
function Metric({ spine, label, value, sub, valueColor = 'var(--vy-ink)' }) {
  const [h, setH] = aS(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      position: 'relative', background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-2)', padding: 16,
      boxShadow: h ? 'var(--vy-neu-hover)' : 'var(--vy-neu)', transform: h ? 'translateY(-2px)' : 'none',
      transition: 'box-shadow .2s, transform .2s', overflow: 'hidden', cursor: 'pointer',
    }}>
      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: spine }} />
      <div className="vy-cap" style={{ fontSize: 9.5, marginBottom: 10 }}>{label}</div>
      <div data-num style={{ fontSize: 26, fontWeight: 700, color: valueColor, lineHeight: 1, marginBottom: 6, fontFamily: 'var(--vy-mono)' }}>{value}</div>
      <div className="vy-cap" style={{ fontSize: 9 }}>{sub}</div>
    </div>
  );
}

// ── Pulse gauge (custom conic ring, real component structure) ─
function Pulse({ score }) {
  const [deg, setDeg] = aS(0);
  const total = score.total ?? 0;
  const status = total >= 75 ? { c: 'var(--vy-good)', label: score.label } : total >= 50 ? { c: 'var(--vy-warn)', label: score.label } : { c: 'var(--vy-crit)', label: 'Needs care' };
  aE(() => { const t = setTimeout(() => setDeg(total / 100 * 360), 80); return () => clearTimeout(t); }, [total]);
  const comps = [['Budgets', score.components.budget, true], ['Savings', score.components.savings, true], ['Trend', score.components.trend, true], ['Debt', score.components.debt, true]];
  return (
    <div style={{ background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-3)', boxShadow: 'var(--vy-neu)', padding: 20, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div className="vy-cap" style={{ fontSize: 9.5, color: 'var(--vy-accent)', marginBottom: 16 }}>Family Pulse Score™</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ width: 128, height: 128, borderRadius: '50%', boxShadow: 'var(--vy-neu-inset)', padding: 8 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: `conic-gradient(${status.c} ${deg}deg, var(--vy-sunken) ${deg}deg)`, transition: 'background .9s var(--vy-ease)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 12, borderRadius: '50%', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div data-num style={{ fontFamily: 'var(--vy-heading)', fontWeight: 700, fontSize: 40, lineHeight: 1, color: status.c }}>{score.total ?? '—'}</div>
              <div className="vy-cap" style={{ fontSize: 8.5, marginTop: 2 }}>{status.label}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {comps.map(([label, val]) => {
          const c = val >= 70 ? 'var(--vy-good)' : val >= 45 ? 'var(--vy-warn)' : 'var(--vy-crit)';
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--vy-mono)', fontSize: 10, color: 'var(--vy-ink-3)', width: 54, textAlign: 'left', letterSpacing: '0.04em' }}>{label}</span>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--vy-sunken)', boxShadow: 'var(--vy-neu-inset)', overflow: 'hidden' }}>
                <div style={{ width: `${val}%`, height: '100%', borderRadius: 3, background: c, transition: 'width .9s var(--vy-ease)' }} />
              </div>
              <span data-num style={{ fontSize: 11, fontWeight: 600, color: c, width: 20, textAlign: 'right' }}>{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── insight chip ─────────────────────────────────────────────
function Insight({ c }) {
  const tone = { good: 'var(--vy-good)', warn: 'var(--vy-warn)', alert: 'var(--vy-crit)', info: 'var(--vy-info)' }[c.tone];
  const [h, setH] = aS(false);
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      position: 'relative', display: 'flex', gap: 12, padding: '13px 15px 13px 16px', background: 'var(--vy-canvas)',
      borderRadius: 'var(--vy-r-2)', boxShadow: h && c.to ? 'var(--vy-neu-hover)' : 'var(--vy-neu-sm)',
      transition: 'box-shadow .2s', cursor: c.to ? 'pointer' : 'default', overflow: 'hidden',
    }}>
      <span style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 3, background: tone }} />
      <span style={{ fontSize: 17, lineHeight: '20px', flexShrink: 0 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--vy-ink)', lineHeight: 1.4 }}>{c.text}</div>
        {c.detail && <div style={{ fontSize: 12, color: 'var(--vy-ink-3)', marginTop: 2 }}>{c.detail}</div>}
      </div>
      {c.to && <Ico d="M9 6l6 6-6 6" size={14} color="var(--vy-accent)" />}
    </div>
  );
}

// ── txn row (real TxnRow structure) ──────────────────────────
function TxnRow({ t }) {
  const cat = getCat(t.catId);
  const [h, setH] = aS(false);
  const sign = t.type === 'income' ? '+' : '−';
  const amtColor = t.type === 'income' ? 'var(--vy-good)' : 'var(--vy-ink)';
  const pm = PM[t.pm];
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', borderBottom: '1px solid var(--vy-line)',
      background: h ? 'var(--vy-hover)' : 'transparent', transition: 'background .16s', cursor: 'pointer',
    }}>
      {pm && <span style={{ width: 22, height: 22, borderRadius: 6, background: pm.color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--vy-mono)' }}>{pm.abbr}</span>}
      <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, background: cat.color + '26', boxShadow: 'var(--vy-neu-sm)' }}>{cat.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--vy-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
        <div style={{ fontFamily: 'var(--vy-mono)', fontSize: 10.5, color: 'var(--vy-ink-3)', marginTop: 1 }}>{cat.label} · {t.date}{t.recurring ? ' · ↻' : ''}</div>
      </div>
      <div data-num style={{ fontSize: 13.5, fontWeight: 600, color: amtColor, whiteSpace: 'nowrap' }}>{sign}{money(t.amount).replace(/^−?\$/, '$')}</div>
    </div>
  );
}

// ── budget row ───────────────────────────────────────────────
function BudgetRow({ b }) {
  const cat = getCat(b.catId);
  const pct = Math.min(100, Math.round(b.spent / b.limit * 100));
  const color = pct >= 100 ? 'var(--vy-crit)' : pct >= 80 ? 'var(--vy-warn)' : 'var(--vy-accent)';
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--vy-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vy-ink)' }}>{cat.icon} {cat.label}</span>
        <span data-num style={{ fontSize: 11.5, color: 'var(--vy-ink-2)' }}>{short(b.spent)} / {short(b.limit)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--vy-sunken)', boxShadow: 'var(--vy-neu-inset)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width .6s var(--vy-ease)' }} />
      </div>
      <div className="vy-cap" style={{ fontSize: 8.5, marginTop: 5 }}>{pct}% used</div>
    </div>
  );
}

// ── category donut (CSS conic) ───────────────────────────────
function Donut({ data }) {
  const total = data.reduce((s, e) => s + e.amount, 0);
  const sorted = [...data].sort((a, b) => b.amount - a.amount);
  let acc = 0; const stops = [];
  sorted.forEach((e) => { const start = acc / total * 360; acc += e.amount; const end = acc / total * 360; stops.push(`${getCat(e.catId).color} ${start}deg ${end}deg`); });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 20, padding: 18, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 170, height: 170, justifySelf: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'var(--vy-neu-inset)' }} />
        <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: `conic-gradient(${stops.join(',')})` }} />
        <div style={{ position: 'absolute', inset: 40, borderRadius: '50%', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div data-num style={{ fontFamily: 'var(--vy-heading)', fontWeight: 700, fontSize: 22, color: 'var(--vy-ink)' }}>{short(total)}</div>
          <div className="vy-cap" style={{ fontSize: 8 }}>Total</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 190, overflowY: 'auto' }} className="vy-scroll">
        {sorted.slice(0, 8).map((e) => {
          const cat = getCat(e.catId); const pct = Math.round(e.amount / total * 100);
          return (
            <div key={e.catId} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto 34px', gap: 9, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--vy-line)' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color }} />
              <span style={{ fontSize: 12.5, color: 'var(--vy-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.icon} {cat.label}</span>
              <span data-num style={{ fontSize: 11.5, color: 'var(--vy-ink-2)' }}>{short(e.amount)}</span>
              <span data-num style={{ fontSize: 10.5, color: 'var(--vy-ink-3)', textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
function Dashboard() {
  const cashFlow = D.month.income - D.month.expense;
  const nw = D.netWorth.assets - D.netWorth.liabilities;
  const rate = Math.round((D.month.income - D.month.expense) / D.month.income * 100);
  const dti = Math.round(D.debt.monthlyMin / D.month.income * 100);
  const advice = 'Spending is trending up — see what changed.';
  return (
    <div style={{ maxWidth: 1120 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--vy-heading)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', color: 'var(--vy-ink)', marginBottom: 5, whiteSpace: 'nowrap' }}>Good morning, Maya</h1>
          <div className="vy-cap">Family Finance Overview · {D.month.key}</div>
        </div>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', border: 'none', borderRadius: 'var(--vy-r-2)', background: 'var(--vy-accent)', color: 'var(--vy-accent-ink)', boxShadow: 'var(--vy-neu)', fontFamily: 'var(--vy-heading)', fontWeight: 600, fontSize: 14 }}>
          <Ico d="M12 5v14M5 12h14" size={17} color="var(--vy-accent-ink)" /> Add transaction
        </button>
      </div>

      {/* two honest numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Hero spine="var(--vy-good)" label={`Cash Flow · ${D.month.key}`} labelIcon={<Ico d="M7 13l5 5 5-5M7 6l5 5 5-5" size={13} color="var(--vy-good)" />}
          value={money(cashFlow)} valueColor={cashFlow >= 0 ? 'var(--vy-good)' : 'var(--vy-warn)'}
          a={{ k: 'In', v: short(D.month.income), c: 'var(--vy-good)' }} b={{ k: 'Out', v: short(D.month.expense), c: 'var(--vy-ink-2)' }} />
        <Hero spine="var(--vy-info)" label="Net Worth · today" labelIcon={<Ico d="M12 3v17M6 21h12M6 8l-3 6a3 3 0 006 0zM18 8l-3 6a3 3 0 006 0" size={13} color="var(--vy-info)" />}
          value={money(nw)} valueColor="var(--vy-ink)"
          a={{ k: 'Assets', v: short(D.netWorth.assets), c: 'var(--vy-good)' }} b={{ k: 'Debts', v: short(D.netWorth.liabilities), c: 'var(--vy-ink-2)' }} />
      </div>

      {/* pulse + metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '224px 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <Pulse score={D.pulse} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '9px 6px 0', fontSize: 12, color: 'var(--vy-ink-2)' }}>
            <span>{advice}</span><Ico d="M9 6l6 6-6 6" size={13} color="var(--vy-accent)" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <Metric spine="var(--vy-good)" label="Monthly Income" value={short(D.month.income)} sub="This month" valueColor="var(--vy-good)" />
            <Metric spine="var(--vy-ink-3)" label="Monthly Expenses" value={short(D.month.expense)} sub="This month" />
            <Metric spine="var(--vy-warn)" label="Savings Rate" value={`${rate}%`} sub="of income not spent" valueColor={rate >= 20 ? 'var(--vy-good)' : 'var(--vy-warn)'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {D.insights.map((c, i) => <Insight key={i} c={c} />)}
          </div>
        </div>
      </div>

      {/* budgets + recent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Panel title="Budget Progress" action={<ViewAll />}>
          {D.budgets.map((b) => <BudgetRow key={b.catId} b={b} />)}
        </Panel>
        <Panel title="Recent Transactions" action={<ViewAll />}>
          {D.recent.map((t, i) => <TxnRow key={i} t={t} />)}
        </Panel>
      </div>

      {/* donut */}
      <div style={{ marginBottom: 14 }}>
        <Panel title="Spending by Category" sub="This month" action={<ViewAll label="View all →" />}>
          <Donut data={D.spend} />
        </Panel>
      </div>

      {/* debt overview */}
      <Panel title="Debt Overview" action={<ViewAll label="View →" />}>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DebtLine label={`Total · ${D.debt.accounts} accounts`} value={money(D.debt.total)} color="var(--vy-ink)" />
          <DebtLine label="Monthly minimum" value={money(D.debt.monthlyMin)} color="var(--vy-warn)" />
          <DebtLine label="Debt-to-income" value={`${dti}%`} color={dti <= 25 ? 'var(--vy-good)' : dti <= 36 ? 'var(--vy-warn)' : 'var(--vy-crit)'} />
        </div>
      </Panel>
    </div>
  );
}
function DebtLine({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5 }}>
      <span style={{ color: 'var(--vy-ink-2)' }}>{label}</span>
      <span data-num style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

// ── mapping stub for not-yet-restyled routes ─────────────────
function Stub({ route }) {
  const label = [...NAV_GROUPS.flatMap((g) => g.items), ['settings', 'Settings'], ['help', 'Help & Guide']].find(([id]) => id === route)?.[1] || route;
  return (
    <div style={{ maxWidth: 1120, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-4)', boxShadow: 'var(--vy-neu)', padding: '48px 56px', maxWidth: 460 }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 18px', borderRadius: 16, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vy-accent)' }}><NavIcon name={route} size={24} /></div>
        <h2 style={{ fontFamily: 'var(--vy-heading)', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>{label}</h2>
        <p style={{ fontSize: 14, color: 'var(--vy-ink-2)', lineHeight: 1.55 }}>This flow maps next. The <b>Dashboard</b> is the proof-of-fit — it re-skins the real screen (Pulse, Cash Flow, Net Worth, budgets, transactions, categories) in Neumorphic Fluid with your actual data model.</p>
        <button onClick={() => window.dispatchEvent(new CustomEvent('vygo', { detail: 'dashboard' }))} style={{ marginTop: 20, height: 42, padding: '0 20px', border: 'none', borderRadius: 'var(--vy-r-2)', background: 'var(--vy-accent)', color: 'var(--vy-accent-ink)', boxShadow: 'var(--vy-neu)', fontFamily: 'var(--vy-heading)', fontWeight: 600, fontSize: 13.5 }}>← Back to Dashboard</button>
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────
function AppRoot() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "themeMode": "dark",
    "headFont": "Outfit"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = aS('dashboard');
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = t.themeMode === 'dark' || (t.themeMode === 'auto' && prefersDark);

  aE(() => {
    document.documentElement.setAttribute('data-vy-theme', dark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--vy-head', t.headFont === 'Inter Tight' ? "'Inter Tight'" : "'Outfit'");
  }, [dark, t.headFont]);
  aE(() => { const h = (e) => setRoute(e.detail); window.addEventListener('vygo', h); return () => window.removeEventListener('vygo', h); }, []);

  return (
    <div className="vy" data-vy-theme={dark ? 'dark' : 'light'} style={{ display: 'flex', minHeight: '100vh', background: 'var(--vy-canvas)' }}>
      <Sidebar route={route} setRoute={setRoute} themeMode={t.themeMode} setThemeMode={(m) => setTweak('themeMode', m)} />
      <main className="vy-scroll" style={{ flex: 1, minWidth: 0, padding: '30px 40px 60px', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--vy-ambient)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>{route === 'dashboard' ? <Dashboard /> : <Stub route={route} />}</div>
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.themeMode} options={['light', 'dark', 'auto']} onChange={(v) => setTweak('themeMode', v)} />
        <TweakRadio label="Headings" value={t.headFont} options={['Outfit', 'Inter Tight']} onChange={(v) => setTweak('headFont', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
