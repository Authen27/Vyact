/* global React */
// FinFlow Mobile Wireframes — CALM variant primitives.
// Larger device, generous type, fewer competing cards. All under window.CALM.

const CALM = {};

// ── iPhone shell · 390 × 820 ────────────────────────────────────
CALM.IPhone = function ({ children, dark = false, time = "9:41", style = {}, hideHomeIndicator = false }) {
  const bg = dark ? '#0E0C0A' : 'var(--ff-canvas)';
  const txt = dark ? '#E8DECF' : 'var(--ff-ink)';
  return (
    <div className="ff" style={{
      width: 390, height: 820, borderRadius: 52, position: 'relative',
      background: bg, color: txt, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 26px 60px rgba(42,37,34,0.16), 0 0 0 1px rgba(42,37,34,0.18)',
      fontFamily: 'var(--ff-sans)',
      ...style,
    }}>
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 116, height: 34, borderRadius: 22, background: '#0a0907', zIndex: 50 }}></div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, padding: '0 30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 40, fontSize: 15, fontWeight: 600 }}>
        <span>{time}</span>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <svg width="17" height="10" viewBox="0 0 17 10"><rect x="0" y="7" width="3" height="3" rx=".6" fill={txt}/><rect x="4.5" y="5" width="3" height="5" rx=".6" fill={txt}/><rect x="9" y="2.5" width="3" height="7.5" rx=".6" fill={txt}/><rect x="13.5" y="0" width="3" height="10" rx=".6" fill={txt}/></svg>
          <svg width="25" height="11" viewBox="0 0 25 11"><rect x=".6" y=".6" width="22" height="9.8" rx="2.6" stroke={txt} strokeOpacity=".4" fill="none"/><rect x="2.4" y="2.4" width="15" height="6.2" rx="1.1" fill={txt}/></svg>
        </span>
      </div>
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {!hideHomeIndicator && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 9, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
          <div style={{ width: 134, height: 5, borderRadius: 99, background: dark ? 'rgba(232,222,207,0.7)' : 'rgba(42,37,34,0.28)' }}></div>
        </div>
      )}
    </div>
  );
};

// ── Android shell · 390 × 820 (Material 3) ───────────────────────
CALM.Android = function ({ children, dark = false, time = "9:30", style = {}, hideNav = false }) {
  const bg = dark ? '#10130F' : 'var(--ff-canvas)';
  const txt = dark ? '#E8DECF' : 'var(--ff-ink)';
  return (
    <div className="ff" style={{
      width: 390, height: 820, borderRadius: 38, position: 'relative',
      background: bg, color: txt, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 26px 60px rgba(42,37,34,0.16), 0 0 0 1px rgba(42,37,34,0.18)',
      fontFamily: 'Roboto, "Roboto Flex", system-ui, sans-serif',
      ...style,
    }}>
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: 99, background: '#0a0907', zIndex: 50 }}></div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 40, fontSize: 14 }}>
        <span style={{ letterSpacing: 0.2 }}>{time}</span>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <svg width="13" height="11" viewBox="0 0 13 11"><path d="M6.5 10.5L.5 4.5a8 8 0 0112 0L6.5 10.5z" fill={txt}/></svg>
          <svg width="16" height="11" viewBox="0 0 16 11"><rect x="2" y="1" width="7" height="9" rx=".9" fill={txt}/><rect x="3.8" y="0" width="3.4" height="1.4" rx=".3" fill={txt}/></svg>
        </span>
      </div>
      <div style={{ position: 'absolute', top: 40, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {!hideNav && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 7, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
          <div style={{ width: 110, height: 3.5, borderRadius: 99, background: dark ? 'rgba(232,222,207,0.6)' : 'rgba(42,37,34,0.28)' }}></div>
        </div>
      )}
    </div>
  );
};

// ── iOS nav (large title) ────────────────────────────────────────
CALM.IOSNav = function ({ title, lead = null, trail, dark = false, sub }) {
  const txt = dark ? '#E8DECF' : 'var(--ff-ink)';
  return (
    <div style={{ padding: '8px 24px 4px', flexShrink: 0 }}>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 17, color: 'var(--ff-coral)', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {lead === "back" && <>‹ Back</>}
          {lead === "close" && <>Cancel</>}
          {lead === null && null}
        </span>
        <span style={{ fontSize: 17, color: 'var(--ff-coral)', fontWeight: 500 }}>{trail || ''}</span>
      </div>
      {title && (
        <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 38, fontWeight: 400, letterSpacing: '-0.025em', color: txt, marginTop: 8, lineHeight: 1.05 }}>{title}</div>
      )}
      {sub && (
        <div style={{ fontSize: 15, color: 'var(--ff-ink-2)', marginTop: 8, lineHeight: 1.5 }}>{sub}</div>
      )}
    </div>
  );
};

// ── Android top app bar ──────────────────────────────────────────
CALM.MdTopBar = function ({ title, lead = null, actions = [], dark = false, sub }) {
  const txt = dark ? '#E8DECF' : 'var(--ff-ink)';
  const dim = dark ? 'rgba(232,222,207,0.65)' : 'var(--ff-ink-3)';
  return (
    <div style={{ padding: '4px 8px 0', flexShrink: 0 }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 48, height: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: txt, fontSize: 22 }}>
          {lead === "back" && '←'}{lead === "menu" && '≡'}{lead === "close" && '✕'}
        </span>
        <div style={{ flex: 1 }}></div>
        {actions.map((a, i) => (
          <span key={i} style={{ width: 48, height: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: dim, fontSize: 18 }}>{a}</span>
        ))}
      </div>
      {title && (
        <div style={{ padding: '16px 20px 12px', fontFamily: 'var(--ff-serif)', fontSize: 34, fontWeight: 400, letterSpacing: '-0.02em', color: txt, lineHeight: 1.05 }}>{title}</div>
      )}
      {sub && (
        <div style={{ padding: '0 20px 8px', fontSize: 15, color: 'var(--ff-ink-2)', lineHeight: 1.5 }}>{sub}</div>
      )}
    </div>
  );
};

// ── Bottom tab bar (iOS) — labels + roomier ──────────────────────
CALM.IOSTabs = function ({ active = "home", dark = false }) {
  const bg = dark ? 'rgba(28,24,20,0.86)' : 'rgba(245,239,230,0.92)';
  const dim = dark ? 'rgba(232,222,207,0.5)' : 'var(--ff-ink-3)';
  const items = [
    ['home',     'Home'],
    ['activity', 'Activity'],
    ['plan',     'Plan'],
    ['money',    'Money'],
    ['you',      'You'],
  ];
  return (
    <div style={{
      flexShrink: 0, height: 92, paddingBottom: 22,
      background: bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: `0.5px solid ${dark ? 'rgba(232,222,207,0.12)' : 'rgba(42,37,34,0.10)'}`,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center',
    }}>
      {items.map(([k, label]) => {
        const on = active === k;
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: on ? 'var(--ff-coral)' : dim }}>
            <span style={{
              width: 28, height: 28, borderRadius: 14,
              border: `1.5px solid ${on ? 'var(--ff-coral)' : 'currentColor'}`,
              background: on ? 'var(--ff-coral)' : 'transparent',
              display: 'inline-block', position: 'relative',
              opacity: on ? 1 : 0.55,
            }}></span>
            <span style={{ fontSize: 11, fontWeight: on ? 600 : 500, letterSpacing: 0.1 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Bottom nav (Android M3) ──────────────────────────────────────
CALM.MdNav = function ({ active = "home", dark = false }) {
  const bg = dark ? '#1A1E1A' : 'var(--ff-surface)';
  const txt = dark ? '#E8DECF' : 'var(--ff-ink)';
  const dim = dark ? 'rgba(232,222,207,0.65)' : 'var(--ff-ink-3)';
  const items = [
    ['home',     'Home'],
    ['activity', 'Activity'],
    ['plan',     'Plan'],
    ['money',    'Money'],
    ['you',      'You'],
  ];
  return (
    <div style={{
      flexShrink: 0, height: 90, paddingBottom: 18,
      background: bg, borderTop: `1px solid ${dark ? 'rgba(232,222,207,0.08)' : 'var(--ff-line)'}`,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center',
    }}>
      {items.map(([k, label]) => {
        const on = active === k;
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 64, height: 32, borderRadius: 20, display: 'inline-grid', placeItems: 'center',
              background: on ? 'var(--ff-coral-tint)' : 'transparent',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 10,
                border: `1.5px solid ${on ? 'var(--ff-coral-deep)' : txt}`,
                background: on ? 'var(--ff-coral-deep)' : 'transparent',
                opacity: on ? 1 : 0.55, display: 'inline-block',
              }}></span>
            </span>
            <span style={{ fontSize: 12, fontWeight: on ? 600 : 500, letterSpacing: 0.2, color: on ? txt : dim }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Body container · big breathing room ──────────────────────────
CALM.Body = function ({ children, pad = '8px 24px 24px', style = {} }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', padding: pad, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', ...style }}>
      {children}
    </div>
  );
};

// ── Caption (small mono) ─────────────────────────────────────────
CALM.Cap = function ({ children, color, style = {} }) {
  return (
    <div style={{
      fontFamily: 'var(--ff-mono)', fontSize: 10.5, fontWeight: 500,
      color: color || 'var(--ff-ink-3)',
      letterSpacing: '0.16em', textTransform: 'uppercase', ...style,
    }}>{children}</div>
  );
};

// ── Section label (between blocks) ───────────────────────────────
CALM.Section = function ({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
      <CALM.Cap>{children}</CALM.Cap>
      {right && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, color: 'var(--ff-coral)', letterSpacing: '0.12em' }}>{right}</span>}
    </div>
  );
};

// ── Hero number — the page's one big subject ─────────────────────
CALM.Hero = function ({ label, value, sub, valueColor }) {
  return (
    <div>
      <CALM.Cap>{label}</CALM.Cap>
      <div style={{
        fontFamily: 'var(--ff-serif)', fontSize: 56, fontWeight: 400,
        letterSpacing: '-0.03em', lineHeight: 1, marginTop: 10,
        color: valueColor || 'var(--ff-ink)',
      }}>{value}</div>
      {sub && <div style={{ marginTop: 12, fontSize: 15, color: 'var(--ff-ink-2)', lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
};

// ── Big-touch list row (56px tall min) ───────────────────────────
CALM.Row = function ({ title, sub, value, valTone, chev = false, dark = false, last = false, accent, style = {} }) {
  const txt = dark ? '#E8DECF' : 'var(--ff-ink)';
  const dim = dark ? 'rgba(232,222,207,0.6)' : 'var(--ff-ink-3)';
  const valCol = valTone === 'pos' ? 'var(--ff-olive)' : valTone === 'neg' ? 'var(--ff-ink)' : valTone === 'coral' ? 'var(--ff-coral)' : txt;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0',
      borderBottom: last ? 'none' : `0.5px solid ${dark ? 'rgba(232,222,207,0.10)' : 'var(--ff-line)'}`,
      ...style,
    }}>
      {accent !== undefined && (
        <span style={{
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: accent || 'var(--ff-canvas-2)',
        }}></span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, color: txt, fontWeight: 500, letterSpacing: '-0.005em' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: dim, marginTop: 3 }}>{sub}</div>}
      </div>
      {value && (
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: valCol, fontWeight: 500 }} data-num>{value}</span>
      )}
      {!value && chev && <span style={{ color: dim, fontSize: 18, fontWeight: 300 }}>›</span>}
    </div>
  );
};

// ── Progress bar (taller, friendlier) ────────────────────────────
CALM.Bar = function ({ pct, color = 'var(--ff-coral)', dark = false, h = 8 }) {
  return (
    <div style={{ height: h, background: dark ? 'rgba(232,222,207,0.10)' : 'rgba(42,37,34,0.07)', borderRadius: h, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: h }}></div>
    </div>
  );
};

// ── Pip mascot (sized for calm screens) ──────────────────────────
CALM.Pip = function ({ size = 32, mood = 'happy' }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size}>
      <defs><radialGradient id={`pipc-${size}-${mood}`} cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#F4B6A8"/><stop offset="100%" stopColor="#E26D5C"/></radialGradient></defs>
      <circle cx="18" cy="18" r="15" fill={`url(#pipc-${size}-${mood})`} stroke="#2A2522" strokeWidth="1.2"/>
      <ellipse cx="13" cy="16" rx="1.4" ry={mood === 'sleep' ? 0.4 : 1.6} fill="#2A2522"/>
      <ellipse cx="23" cy="16" rx="1.4" ry={mood === 'sleep' ? 0.4 : 1.6} fill="#2A2522"/>
      {mood === 'happy' && <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round"/>}
      {mood === 'calm' && <path d="M14 23 L 22 23" stroke="#2A2522" strokeWidth="1.2" strokeLinecap="round"/>}
      <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.6"/>
    </svg>
  );
};

// ── Pip card (the friendly nudge) ────────────────────────────────
CALM.PipCard = function ({ children, action }) {
  return (
    <div style={{
      background: 'var(--ff-coral-tint)',
      border: '1px solid var(--ff-coral-soft)',
      borderRadius: 18, padding: 18,
      display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <CALM.Pip size={36}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10.5, color: 'var(--ff-coral-deep)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Pip · today</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ff-ink)', marginTop: 6 }}>{children}</div>
        {action && (
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 99, background: 'var(--ff-coral)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Money (re-used) ──────────────────────────────────────────────
CALM.money = function (n, { sign = false, cur = '$' } = {}) {
  const v = Math.abs(n);
  const str = v.toLocaleString('en-US', { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  const s = n < 0 ? '−' : sign ? '+' : '';
  return `${s}${cur}${str}`;
};

// ── Primary button (full width, generous height) ─────────────────
CALM.Btn = function ({ children, variant = 'primary', style = {} }) {
  const variants = {
    primary: { background: 'var(--ff-coral)', color: '#fff', border: 'none' },
    ghost:   { background: 'transparent', color: 'var(--ff-ink)', border: '1px solid var(--ff-line-2)' },
    danger:  { background: 'transparent', color: 'var(--ff-coral-deep)', border: '1px solid var(--ff-coral-deep)' },
  };
  return (
    <div style={{
      height: 54, borderRadius: 16, display: 'grid', placeItems: 'center',
      fontSize: 16, fontWeight: 600, letterSpacing: '-0.005em',
      ...variants[variant], ...style,
    }}>{children}</div>
  );
};

// ── FAB ───────────────────────────────────────────────────────────
CALM.Fab = function ({ icon = '+', label, style = {} }) {
  return (
    <div style={{
      position: 'absolute', right: 24, bottom: 110,
      height: 56, minWidth: 56, padding: label ? '0 22px' : 0, borderRadius: 28,
      background: 'var(--ff-coral)', color: '#fff',
      display: 'inline-flex', alignItems: 'center', gap: 10,
      justifyContent: 'center',
      fontSize: 15, fontWeight: 600,
      boxShadow: '0 8px 22px rgba(226,109,92,0.45)', ...style,
    }}>
      <span style={{ fontSize: 26, fontWeight: 300, lineHeight: 1 }}>{icon}</span>
      {label && <span>{label}</span>}
    </div>
  );
};

// ── Sparkline (wider, lighter) ───────────────────────────────────
CALM.Spark = function ({ w = 320, h = 56, color = 'var(--ff-coral)' }) {
  const pts = [10, 14, 12, 18, 16, 22, 20, 26, 24, 30, 28, 36, 34, 42];
  const max = 44;
  const path = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - (v / max) * (h - 6) - 3}`).join(' L ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={`M ${path}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={`M 0,${h} L ${path} L ${w},${h} Z`} fill={color} opacity={0.08}/>
    </svg>
  );
};

// ── Segmented control (chips) — fewer, bigger ────────────────────
CALM.Segmented = function ({ items, dark = false }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
      {items.map(([label, on], i) => (
        <span key={i} style={{
          flex: 1, height: 40, borderRadius: 20,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: on ? 600 : 500,
          background: on ? 'var(--ff-ink)' : 'transparent',
          color: on ? 'var(--ff-canvas)' : 'var(--ff-ink-2)',
          border: on ? 'none' : '1px solid var(--ff-line-2)',
        }}>{label}</span>
      ))}
    </div>
  );
};

Object.assign(window, { CALM });
