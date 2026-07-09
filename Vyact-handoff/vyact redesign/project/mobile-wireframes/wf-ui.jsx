// FinFlow Mobile Wireframes — shared primitives (compact, wireframe-grade)
// All exported to window. Uses FF design tokens but at a flatter fidelity.

const WF = {};

// ── Compact iOS phone shell ────────────────────────────────────
WF.IPhone = function ({ children, dark = false, time = "9:41", style = {}, hideHomeIndicator = false }) {
  const bg = dark ? '#0E0C0A' : '#F2EDE2';
  const txt = dark ? '#E8DECF' : '#2A2522';
  return (
    <div style={{
      width: 320, height: 680, borderRadius: 42, position: 'relative',
      background: bg, color: txt, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 18px 40px rgba(42,37,34,0.14), 0 0 0 1px rgba(42,37,34,0.16)',
      fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif',
      ...style,
    }}>
      {/* dynamic island */}
      <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 96, height: 28, borderRadius: 22, background: '#0a0907', zIndex: 50 }} />
      {/* iOS status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 40, fontSize: 13, fontWeight: 600 }}>
        <span>{time}</span>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
          <svg width="15" height="9" viewBox="0 0 15 9"><rect x="0" y="6" width="2.4" height="3" rx=".5" fill={txt}/><rect x="3.6" y="4" width="2.4" height="5" rx=".5" fill={txt}/><rect x="7.2" y="2" width="2.4" height="7" rx=".5" fill={txt}/><rect x="10.8" y="0" width="2.4" height="9" rx=".5" fill={txt}/></svg>
          <svg width="14" height="9" viewBox="0 0 14 9"><path d="M7 2C9 2 10.7 2.7 12 4l1-1C11.4 1.4 9.3.5 7 .5S2.6 1.4 1 3l1 1c1.3-1.3 3-2 5-2z" fill={txt}/><circle cx="7" cy="7.5" r="1.2" fill={txt}/></svg>
          <svg width="22" height="10" viewBox="0 0 22 10"><rect x=".5" y=".5" width="19" height="9" rx="2.4" stroke={txt} strokeOpacity=".4" fill="none"/><rect x="2" y="2" width="13" height="6" rx="1" fill={txt}/></svg>
        </span>
      </div>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {/* home indicator */}
      {!hideHomeIndicator && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 7, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
          <div style={{ width: 110, height: 4, borderRadius: 99, background: dark ? 'rgba(232,222,207,0.7)' : 'rgba(42,37,34,0.28)' }} />
        </div>
      )}
    </div>
  );
};

// ── Compact Android (Material 3) phone shell ────────────────────
WF.Android = function ({ children, dark = false, time = "9:30", style = {}, hideNav = false }) {
  const bg = dark ? '#10130F' : '#F4EFE5';
  const txt = dark ? '#E8DECF' : '#2A2522';
  return (
    <div style={{
      width: 320, height: 680, borderRadius: 30, position: 'relative',
      background: bg, color: txt, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(0,0,0,0.06), 0 18px 40px rgba(42,37,34,0.14), 0 0 0 1px rgba(42,37,34,0.16)',
      fontFamily: 'Roboto, "Roboto Flex", system-ui, sans-serif',
      ...style,
    }}>
      {/* punch-hole */}
      <div style={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 16, height: 16, borderRadius: 99, background: '#0a0907', zIndex: 50 }} />
      {/* status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32, padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 40, fontSize: 12 }}>
        <span style={{ letterSpacing: 0.2 }}>{time}</span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <svg width="11" height="9" viewBox="0 0 11 9"><path d="M5.5 8.5L.5 3.5a7 7 0 0110 0L5.5 8.5z" fill={txt}/></svg>
          <svg width="10" height="9" viewBox="0 0 10 9"><path d="M9 8.5V.5L1 8.5h8z" fill={txt}/></svg>
          <svg width="14" height="9" viewBox="0 0 14 9"><rect x="2" y="1" width="6" height="7" rx=".8" fill={txt}/><rect x="3.5" y="0" width="3" height="1.2" rx=".3" fill={txt}/></svg>
        </span>
      </div>
      <div style={{ position: 'absolute', top: 32, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {/* gesture pill */}
      {!hideNav && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
          <div style={{ width: 96, height: 3, borderRadius: 99, background: dark ? 'rgba(232,222,207,0.6)' : 'rgba(42,37,34,0.28)' }} />
        </div>
      )}
    </div>
  );
};

// ── iOS large title nav bar ─────────────────────────────────────
WF.IOSNav = function ({ title, lead = "back", trail, dark = false, large = true }) {
  const txt = dark ? '#E8DECF' : '#2A2522';
  const dim = dark ? 'rgba(232,222,207,0.55)' : 'rgba(42,37,34,0.55)';
  return (
    <div style={{ padding: large ? '6px 16px 8px' : '4px 16px', display: 'flex', flexDirection: 'column', gap: large ? 6 : 0 }}>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 17, color: 'var(--ff-coral)', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {lead === "back" && <>‹ Back</>}
          {lead === "close" && <>Cancel</>}
          {lead === "menu" && <span style={{ width: 22, height: 22, display: 'inline-grid', placeItems: 'center', color: txt }}>≡</span>}
          {lead === null && null}
        </span>
        <span style={{ fontSize: 17, color: 'var(--ff-coral)', fontWeight: 600 }}>{trail || ''}</span>
      </div>
      {large && (
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: txt, marginTop: 2 }}>{title}</div>
      )}
      {!large && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 50, textAlign: 'center', fontSize: 16, fontWeight: 600, color: txt, pointerEvents: 'none' }}>{title}</div>
      )}
    </div>
  );
};

// ── Android M3 top app bar ──────────────────────────────────────
WF.MdTopBar = function ({ title, lead = "back", actions = [], large = false, dark = false }) {
  const txt = dark ? '#E8DECF' : '#1F1B17';
  const dim = dark ? 'rgba(232,222,207,0.65)' : 'rgba(42,37,34,0.62)';
  return (
    <div style={{ padding: '4px 4px 0', flexShrink: 0 }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: txt, fontSize: 20 }}>
          {lead === "back" && '←'}{lead === "menu" && '≡'}{lead === "close" && '✕'}{lead === null && ''}
        </span>
        {!large && <span style={{ flex: 1, fontSize: 20, fontWeight: 500, color: txt, letterSpacing: 0.1 }}>{title}</span>}
        {large && <div style={{ flex: 1 }} />}
        {actions.map((a, i) => (
          <span key={i} style={{ width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: dim, fontSize: 16 }}>{a}</span>
        ))}
      </div>
      {large && (
        <div style={{ padding: '12px 16px 18px', fontSize: 28, fontWeight: 400, letterSpacing: 0, color: txt }}>{title}</div>
      )}
    </div>
  );
};

// ── Bottom tab bar (iOS) ────────────────────────────────────────
WF.IOSTabs = function ({ active = "home", dark = false }) {
  const bg = dark ? 'rgba(28,24,20,0.78)' : 'rgba(251,247,238,0.86)';
  const txt = dark ? '#E8DECF' : '#2A2522';
  const dim = dark ? 'rgba(232,222,207,0.55)' : 'rgba(42,37,34,0.5)';
  const items = [
    ['home',     'Home',     '⌂'],
    ['activity', 'Activity', '≡'],
    ['plan',     'Plan',     '✧'],
    ['money',    'Money',    '◇'],
    ['you',      'You',      '○'],
  ];
  return (
    <div style={{
      flexShrink: 0, height: 78, paddingBottom: 16,
      background: bg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: `0.5px solid ${dark ? 'rgba(232,222,207,0.12)' : 'rgba(42,37,34,0.12)'}`,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center',
    }}>
      {items.map(([k, label, ico]) => {
        const on = active === k;
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: on ? 'var(--ff-coral)' : dim }}>
            <span style={{ fontSize: 19, lineHeight: 1 }}>{ico}</span>
            <span style={{ fontSize: 10, fontWeight: on ? 600 : 500, letterSpacing: 0.1 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Bottom nav bar (Android M3) ─────────────────────────────────
WF.MdNav = function ({ active = "home", dark = false }) {
  const bg = dark ? '#1A1E1A' : '#EFE9DC';
  const txt = dark ? '#E8DECF' : '#1F1B17';
  const dim = dark ? 'rgba(232,222,207,0.65)' : 'rgba(42,37,34,0.62)';
  const items = [
    ['home',     'Home',     '⌂'],
    ['activity', 'Activity', '⇋'],
    ['plan',     'Plan',     '✧'],
    ['money',    'Money',    '◇'],
    ['you',      'You',      '○'],
  ];
  return (
    <div style={{
      flexShrink: 0, height: 80, paddingBottom: 14,
      background: bg, borderTop: `1px solid ${dark ? 'rgba(232,222,207,0.08)' : 'rgba(42,37,34,0.08)'}`,
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center',
    }}>
      {items.map(([k, label, ico]) => {
        const on = active === k;
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 56, height: 28, borderRadius: 16, display: 'inline-grid', placeItems: 'center',
              background: on ? 'var(--ff-coral-tint)' : 'transparent', color: on ? 'var(--ff-coral-deep)' : txt,
              fontSize: 16, transition: 'all .2s',
            }}>{ico}</span>
            <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500, letterSpacing: 0.2, color: on ? txt : dim }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Building blocks ─────────────────────────────────────────────
WF.Block = function ({ h = 12, w = '100%', dark = false, style = {}, children, hatched = false, outlined = false, label }) {
  const fill = dark ? 'rgba(232,222,207,0.08)' : 'rgba(42,37,34,0.07)';
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: hatched ? `repeating-linear-gradient(135deg, ${fill} 0 6px, transparent 6px 12px)` : fill,
      border: outlined ? `1px dashed ${dark ? 'rgba(232,222,207,0.25)' : 'rgba(42,37,34,0.2)'}` : 'none',
      display: label ? 'flex' : 'block', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--ff-mono)', fontSize: 10, color: dark ? 'rgba(232,222,207,0.55)' : 'rgba(42,37,34,0.5)',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      ...style,
    }}>{children || label}</div>
  );
};

// ── Card frame ──────────────────────────────────────────────────
WF.Card = function ({ children, dark = false, pad = 14, accent = false, style = {} }) {
  return (
    <div style={{
      background: dark ? '#161412' : '#FBF7EE',
      border: `1px solid ${dark ? 'rgba(232,222,207,0.10)' : 'rgba(42,37,34,0.10)'}`,
      borderLeft: accent ? '3px solid var(--ff-coral)' : undefined,
      borderRadius: 14, padding: pad,
      ...style,
    }}>{children}</div>
  );
};

// ── Caption (mono uppercase) ────────────────────────────────────
WF.Cap = function ({ children, dark = false, color, style = {} }) {
  return (
    <div style={{
      fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 500,
      color: color || (dark ? 'rgba(232,222,207,0.6)' : 'rgba(42,37,34,0.55)'),
      letterSpacing: '0.14em', textTransform: 'uppercase', ...style,
    }}>{children}</div>
  );
};

// ── List row (generic) ──────────────────────────────────────────
WF.Row = function ({ icon, title, sub, value, valTone, chev = true, dark = false, last = false, style = {} }) {
  const txt = dark ? '#E8DECF' : '#2A2522';
  const dim = dark ? 'rgba(232,222,207,0.6)' : 'rgba(42,37,34,0.58)';
  const valCol = valTone === 'pos' ? 'var(--ff-olive)' : valTone === 'neg' ? 'var(--ff-ink)' : txt;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px',
      borderBottom: last ? 'none' : `0.5px solid ${dark ? 'rgba(232,222,207,0.10)' : 'rgba(42,37,34,0.08)'}`,
      ...style,
    }}>
      {icon !== undefined && (
        <span style={{ width: 28, height: 28, borderRadius: 8, background: dark ? 'rgba(232,222,207,0.08)' : 'rgba(42,37,34,0.06)', display: 'inline-grid', placeItems: 'center', fontSize: 13, color: dim, flexShrink: 0 }}>{icon}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: txt, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: dim, marginTop: 1 }}>{sub}</div>}
      </div>
      {value && (
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12.5, color: valCol, fontWeight: 500 }}>{value}</span>
      )}
      {!value && chev && <span style={{ color: dim, fontSize: 14 }}>›</span>}
    </div>
  );
};

// ── Progress bar ────────────────────────────────────────────────
WF.Bar = function ({ pct, color = 'var(--ff-coral)', dark = false, h = 5 }) {
  return (
    <div style={{ height: h, background: dark ? 'rgba(232,222,207,0.10)' : 'rgba(42,37,34,0.08)', borderRadius: h, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: h }} />
    </div>
  );
};

// ── Pip mascot (mini) ───────────────────────────────────────────
WF.Pip = function ({ size = 22, mood = 'happy' }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size}>
      <defs><radialGradient id={`pip-${size}-${mood}`} cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#F4B6A8"/><stop offset="100%" stopColor="#E26D5C"/></radialGradient></defs>
      <circle cx="18" cy="18" r="15" fill={`url(#pip-${size}-${mood})`} stroke="#2A2522" strokeWidth="1.2"/>
      <ellipse cx="13" cy="16" rx="1.4" ry={mood === 'sleep' ? 0.4 : 1.6} fill="#2A2522"/>
      <ellipse cx="23" cy="16" rx="1.4" ry={mood === 'sleep' ? 0.4 : 1.6} fill="#2A2522"/>
      {mood === 'happy' && <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round"/>}
      {mood === 'calm' && <path d="M14 23 L 22 23" stroke="#2A2522" strokeWidth="1.2" strokeLinecap="round"/>}
      {mood === 'wow' && <ellipse cx="18" cy="23" rx="2" ry="2.3" fill="#2A2522"/>}
      <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.6"/>
    </svg>
  );
};

// ── Money formatter (compact wireframe) ─────────────────────────
WF.money = function (n, { sign = false, abbrev = false, cur = '$' } = {}) {
  const v = Math.abs(n);
  let str;
  if (abbrev && v >= 1000) str = (v / 1000).toFixed(v >= 10000 ? 1 : 2) + 'k';
  else str = v.toLocaleString('en-US', { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
  const s = n < 0 ? '−' : sign ? '+' : '';
  return `${s}${cur}${str}`;
};

// ── Sparkline ───────────────────────────────────────────────────
WF.Spark = function ({ w = 280, h = 36, color = 'var(--ff-coral)', dark = false }) {
  const pts = [4, 12, 8, 16, 11, 20, 18, 24, 22, 28, 26, 32];
  const max = 32;
  const path = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' L ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={`M ${path}`} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={`M 0,${h} L ${path} L ${w},${h} Z`} fill={color} opacity={dark ? 0.18 : 0.08}/>
    </svg>
  );
};

// ── FAB (Android extended) ──────────────────────────────────────
WF.FAB = function ({ label = 'Add transaction', icon = '+', style = {} }) {
  return (
    <div style={{
      position: 'absolute', right: 16, bottom: 96,
      height: 48, padding: '0 18px', borderRadius: 14,
      background: 'var(--ff-coral)', color: '#fff',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 14px rgba(226,109,92,0.40)', ...style,
    }}>
      <span style={{ fontSize: 18, fontWeight: 400 }}>{icon}</span>
      {label}
    </div>
  );
};

// ── Floating + button (iOS) ─────────────────────────────────────
WF.IOSFab = function ({ icon = '+', style = {} }) {
  return (
    <div style={{
      position: 'absolute', right: 16, bottom: 92,
      width: 48, height: 48, borderRadius: 24,
      background: 'var(--ff-coral)', color: '#fff',
      display: 'inline-grid', placeItems: 'center',
      fontSize: 24, fontWeight: 300,
      boxShadow: '0 6px 18px rgba(226,109,92,0.45)', ...style,
    }}>{icon}</div>
  );
};

// ── Section heading (in-screen) ─────────────────────────────────
WF.SectionHead = function ({ children, right, dark = false }) {
  const dim = dark ? 'rgba(232,222,207,0.6)' : 'rgba(42,37,34,0.55)';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 2px', marginBottom: 6 }}>
      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, fontWeight: 500, color: dim, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{children}</div>
      {right && <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9.5, color: 'var(--ff-coral)', letterSpacing: '0.1em' }}>{right}</div>}
    </div>
  );
};

// ── Scroll container helper ─────────────────────────────────────
WF.Scroll = function ({ children, dark = false, pad = '6px 14px 14px', style = {} }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', padding: pad, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', ...style }}>
      {children}
    </div>
  );
};

// ── Annotation pill (sits beside artboard in canvas, not used here) ──
WF.Annot = function ({ children, color = 'var(--ff-coral)' }) {
  return (
    <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color, letterSpacing: '0.14em', textTransform: 'uppercase' }}>● {children}</span>
  );
};

Object.assign(window, { WF });
