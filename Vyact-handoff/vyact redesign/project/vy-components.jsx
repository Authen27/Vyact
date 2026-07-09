// vy-components.jsx — Vyact "Neumorphic Fluid" component library
// Reusable primitives built on vyact-tokens.css variables.
// Exported to window at end for cross-file (doc + screens) use.

const { useState, useEffect, useRef, useCallback } = React;

// ─────────────────────────────────────────────────────────────
// Minimal line-icon set (simple glyphs only)
// ─────────────────────────────────────────────────────────────
const VY_ICON = {
  spark:  'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z',
  check:  'M4 12.5l5 5 11-11',
  plus:   'M12 5v14M5 12h14',
  arrowUR:'M7 17L17 7M9 7h8v8',
  arrowD: 'M12 5v14M6 13l6 6 6-6',
  bolt:   'M13 2L4 14h7l-1 8 9-12h-7z',
  bell:   'M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 004 0',
  cardico:'M3 7h18v10H3zM3 11h18',
  cart:   'M4 5h2l2 11h10l2-7H7',
  coffee: 'M4 9h13v4a4 4 0 01-4 4H8a4 4 0 01-4-4zM17 10h2a2 2 0 010 4h-2',
  home:   'M4 11l8-7 8 7M6 10v9h12v-9',
  chev:   'M9 6l6 6-6 6',
};
function VyIcon({ name, size = 18, stroke = 2, fill = 'none', color = 'currentColor', style }) {
  const solid = name === 'spark' || name === 'bolt';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0, ...style }}
         fill={solid ? color : 'none'} stroke={solid ? 'none' : color}
         strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={VY_ICON[name] || VY_ICON.spark} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Button — neumorphic, with full state machine
// variant: primary | neu | glass | ghost   state: (auto) | disabled
// async: click runs resting → loading → success
// ─────────────────────────────────────────────────────────────
function VyButton({ children, variant = 'neu', disabled = false, forceState,
                    async: isAsync = false, icon, onClick, style = {} }) {
  const [pressed, setPressed] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | loading | success
  const st = forceState || (disabled ? 'disabled' : pressed ? 'active' : 'idle');

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, padding: '0 22px', borderRadius: 'var(--vy-r-2)', border: 'none',
    fontFamily: 'var(--vy-heading)', fontWeight: 600, fontSize: 15, letterSpacing: '0.01em',
    position: 'relative', overflow: 'hidden', whiteSpace: 'nowrap',
    transition: 'box-shadow .18s var(--vy-ease), transform .1s var(--vy-ease), background .2s, opacity .2s, color .2s',
    userSelect: 'none',
  };
  const skins = {
    primary: {
      background: st === 'active' ? 'var(--vy-accent)' : 'var(--vy-accent)',
      color: 'var(--vy-accent-ink)',
      boxShadow: st === 'active'
        ? 'var(--vy-neu-inset), 0 0 0 3px var(--vy-info-t)'
        : st === 'hover' ? 'var(--vy-neu-hover), 0 0 22px var(--vy-info-t)'
        : 'var(--vy-neu)',
    },
    neu: {
      background: 'var(--vy-canvas)', color: 'var(--vy-ink)',
      boxShadow: st === 'active' ? 'var(--vy-neu-inset)'
        : st === 'hover' ? 'var(--vy-neu-hover)' : 'var(--vy-neu)',
    },
    glass: {
      background: 'var(--vy-glass)', color: 'var(--vy-ink)',
      border: '1px solid var(--vy-glass-line)',
      backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)',
      boxShadow: st === 'active' ? 'var(--vy-neu-inset)' : 'var(--vy-cast-2)',
    },
    ghost: {
      background: 'transparent', color: 'var(--vy-ink-2)',
      boxShadow: st === 'hover' ? 'var(--vy-neu-sm)' : 'none',
    },
  };
  const skin = skins[variant] || skins.neu;
  if (st === 'disabled') { skin.opacity = 0.42; skin.boxShadow = 'none'; }

  const handleClick = (e) => {
    if (disabled || phase !== 'idle') return;
    if (isAsync) {
      setPhase('loading');
      setTimeout(() => { setPhase('success'); }, 1150);
      setTimeout(() => { setPhase('idle'); }, 2600);
    }
    onClick && onClick(e);
  };

  const successGlow = phase === 'success'
    ? { boxShadow: `${skin.boxShadow}, 0 0 0 3px var(--vy-good-t)` } : null;

  return (
    <button
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={handleClick}
      disabled={disabled || phase !== 'idle'}
      style={{ ...base, ...skin, ...successGlow, transform: pressed ? 'translateY(1px)' : 'none', ...style }}>
      {phase === 'loading' && <span className="vy-spin" />}
      {phase === 'success' && <VyIcon name="check" size={18} stroke={2.6} />}
      {phase === 'idle' && icon && <VyIcon name={icon} size={17} />}
      {phase === 'loading' ? 'Working…' : phase === 'success' ? 'Done' : children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Input — alive states: resting | focused | filled | error
// ─────────────────────────────────────────────────────────────
function VyInput({ label, placeholder = '', value: initial = '', error, prefix,
                   forceState, style = {} }) {
  const [val, setVal] = useState(initial);
  const [focus, setFocus] = useState(false);
  const state = forceState || (error ? 'error' : focus ? 'focused' : val ? 'filled' : 'resting');

  const ring = {
    resting: 'var(--vy-neu-inset)',
    filled:  'var(--vy-neu-inset)',
    focused: 'var(--vy-neu-inset), 0 0 0 2px var(--vy-accent)',
    error:   'var(--vy-neu-inset), inset 3px 0 0 var(--vy-crit)',
  }[state];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, ...style }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--vy-ink-2)', fontFamily: 'var(--vy-heading)' }}>{label}</label>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 16px',
        background: state === 'filled' || state === 'focused' ? 'var(--vy-sunken)' : 'var(--vy-canvas)',
        borderRadius: 'var(--vy-r-2)', boxShadow: ring,
        transition: 'box-shadow .2s var(--vy-ease), background .2s',
        animation: state === 'error' ? 'vy-shake .34s var(--vy-ease)' : 'none',
      }}>
        {prefix && <span style={{ color: 'var(--vy-ink-3)', fontFamily: 'var(--vy-mono)', fontSize: 15 }}>{prefix}</span>}
        <input value={val} placeholder={placeholder}
          onChange={(e) => setVal(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            color: 'var(--vy-ink)', fontFamily: 'var(--vy-sans)', fontSize: 15,
          }} />
        {state === 'focused' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--vy-accent)', boxShadow: '0 0 8px var(--vy-accent)' }} />}
        {state === 'error' && <VyIcon name="bell" size={16} color="var(--vy-crit)" />}
      </div>
      {error && <span style={{ fontSize: 12, color: 'var(--vy-crit)', fontWeight: 500 }}>{error}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card shells
// ─────────────────────────────────────────────────────────────
function VyCard({ children, accent, hover = true, pad = 20, style = {}, ...rest }) {
  const [h, setH] = useState(false);
  return (
    <div {...rest}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-3)',
        padding: pad, boxShadow: hover && h ? 'var(--vy-neu-hover)' : 'var(--vy-neu)',
        transform: hover && h ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow .24s var(--vy-ease), transform .24s var(--vy-ease)',
        overflow: 'hidden', ...style,
      }}>
      {accent && <span style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 3, background: accent }} />}
      {children}
    </div>
  );
}

function VyGlass({ children, pad = 20, tint, style = {} }) {
  return (
    <div style={{
      position: 'relative', background: 'var(--vy-glass)',
      backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)',
      border: '1px solid var(--vy-glass-line)', borderRadius: 'var(--vy-r-3)',
      padding: pad, boxShadow: 'var(--vy-cast-3), inset 0 1px 0 var(--vy-glass-hi)',
      overflow: 'hidden', ...style,
    }}>
      {tint && <span style={{ position: 'absolute', inset: 0, background: tint, opacity: 0.06, pointerEvents: 'none' }} />}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Transaction card — accent · icon · desc · amount · AI insight
// ─────────────────────────────────────────────────────────────
function VyTxn({ icon = 'cart', name, meta, amount, positive, accent = 'var(--vy-violet-b)', insight }) {
  const [tip, setTip] = useState(false);
  return (
    <VyCard accent={accent} pad={0} hover style={{ borderRadius: 'var(--vy-r-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px 14px 20px' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 'var(--vy-r-2)', flexShrink: 0,
          background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vy-ink-2)',
        }}><VyIcon name={icon} size={19} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--vy-ink)', fontFamily: 'var(--vy-heading)' }}>{name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--vy-ink-3)' }}>{meta}</div>
        </div>
        {insight && (
          <div style={{ position: 'relative' }} onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--vy-fore-t)', color: 'var(--vy-fore)', cursor: 'default',
            }}><VyIcon name="spark" size={13} color="var(--vy-fore)" /></div>
            {tip && (
              <div style={{
                position: 'absolute', bottom: '130%', right: -6, width: 200, zIndex: 5,
                background: 'var(--vy-glass-strong)', backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)',
                border: '1px solid var(--vy-glass-line)', borderRadius: 12, padding: '10px 12px',
                boxShadow: 'var(--vy-cast-3)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--vy-ink-2)',
              }}>{insight}</div>
            )}
          </div>
        )}
        <div data-num style={{
          fontWeight: 600, fontSize: 15.5, minWidth: 82, textAlign: 'right',
          color: positive ? 'var(--vy-good)' : 'var(--vy-ink)',
        }}>{positive ? '+' : '−'}${amount}</div>
      </div>
    </VyCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Number ticker — tally animation to a target
// ─────────────────────────────────────────────────────────────
function VyNumber({ value, prefix = '$', decimals = 0, duration = 900, size = 32, weight = 700, color = 'var(--vy-ink)', trigger }) {
  const [disp, setDisp] = useState(value); // rest at final value (correct even if rAF is paused)
  const raf = useRef(0);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisp(value); return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisp(value * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setDisp(value);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration, trigger]);
  const s = disp.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span data-num style={{ fontSize: size, fontWeight: weight, color, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{s}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Progress ring — animated arc with label inside
// ─────────────────────────────────────────────────────────────
function VyRing({ value = 0.68, size = 120, stroke = 12, color = 'var(--vy-good)', label, sub, trigger }) {
  const [p, setP] = useState(value); // rest at final value
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setP(value); return; }
    const start = performance.now(), dur = 900;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      setP(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setP(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, trigger]);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'var(--vy-neu-inset)' }} />
      <svg width={size} height={size} style={{ position: 'relative', transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--vy-line)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          style={{ filter: 'drop-shadow(0 0 6px ' + color + ')' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span data-num style={{ fontSize: size * 0.22, fontWeight: 700, color: 'var(--vy-ink)' }}>{Math.round(p * 100)}%</span>
        {label && <span style={{ fontSize: 11, color: 'var(--vy-ink-3)', marginTop: 1 }}>{label}</span>}
      </div>
      {sub}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Confetti burst — subtle, celebratory
// ─────────────────────────────────────────────────────────────
function VyConfetti({ fire }) {
  const [parts, setParts] = useState([]);
  useEffect(() => {
    if (!fire) return;
    const colors = ['var(--vy-green-b)', 'var(--vy-blue-b)', 'var(--vy-violet-b)', 'var(--vy-amber-b)'];
    const p = Array.from({ length: 14 }, (_, i) => ({
      id: fire + '-' + i,
      x: (Math.random() - 0.5) * 220, y: -60 - Math.random() * 120,
      rot: (Math.random() - 0.5) * 320, c: colors[i % colors.length],
      d: 0.7 + Math.random() * 0.5, delay: Math.random() * 0.08,
      w: 6 + Math.random() * 5,
    }));
    setParts(p);
    const t = setTimeout(() => setParts([]), 1600);
    return () => clearTimeout(t);
  }, [fire]);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {parts.map((pt) => (
        <span key={pt.id} style={{
          position: 'absolute', left: '50%', top: '46%', width: pt.w, height: pt.w * 0.6,
          background: pt.c, borderRadius: 1.5,
          animation: `vy-confetti ${pt.d}s var(--vy-ease) ${pt.delay}s forwards`,
          '--cx': pt.x + 'px', '--cy': pt.y + 'px', '--cr': pt.rot + 'deg',
        }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bar chart — spring grow, hover tooltip
// ─────────────────────────────────────────────────────────────
function VyBars({ data, height = 150, color = 'var(--vy-accent)', trigger }) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(-1);
  const max = Math.max(...data.map((d) => d.value));
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, [trigger]);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height, position: 'relative' }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        const active = hover === i;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}
               onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
            {active && (
              <div style={{
                position: 'absolute', top: -6, transform: 'translateY(-100%)', zIndex: 4,
                background: 'var(--vy-glass-strong)', backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)',
                border: '1px solid var(--vy-glass-line)', borderRadius: 10, padding: '7px 11px',
                boxShadow: 'var(--vy-cast-2)', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--vy-ink)',
              }}>
                <b data-num>${d.value}</b> {d.note && <span style={{ color: 'var(--vy-ink-3)' }}>· {d.note}</span>}
              </div>
            )}
            <div style={{
              width: '100%', maxWidth: 40, borderRadius: '6px 6px 3px 3px',
              height: mounted ? `${h}%` : '0%',
              background: active
                ? `linear-gradient(180deg, ${d.color || color}, color-mix(in srgb, ${d.color || color} 55%, transparent))`
                : `linear-gradient(180deg, ${d.color || color}, color-mix(in srgb, ${d.color || color} 30%, transparent))`,
              boxShadow: active ? `0 0 18px ${d.color || color}` : 'none',
              transition: `height .7s var(--vy-spring) ${i * 60}ms, box-shadow .2s, background .2s`,
            }} />
            <span style={{ fontSize: 11, color: active ? 'var(--vy-ink)' : 'var(--vy-ink-3)', fontWeight: active ? 600 : 400 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Line / area sparkline — smooth path, gradient fill
// ─────────────────────────────────────────────────────────────
function VyLine({ points, width = 320, height = 96, color = 'var(--vy-good)', trigger }) {
  const pathRef = useRef(null);
  const [len, setLen] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const min = Math.min(...points), max = Math.max(...points);
  const nx = (i) => (i / (points.length - 1)) * width;
  const ny = (v) => height - 8 - ((v - min) / (max - min || 1)) * (height - 20);
  // smooth path (catmull-rom-ish via quadratic midpoints)
  let d = `M ${nx(0)} ${ny(points[0])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = nx(i), y1 = ny(points[i]), x2 = nx(i + 1), y2 = ny(points[i + 1]);
    const mx = (x1 + x2) / 2;
    d += ` C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;
  const ptsKey = points.join(',');
  React.useLayoutEffect(() => { if (pathRef.current) setLen(pathRef.current.getTotalLength()); }, [ptsKey, width, height]);
  useEffect(() => {
    setDrawn(false);
    const id = setTimeout(() => setDrawn(true), 80);
    return () => clearTimeout(id);
  }, [ptsKey, trigger, len]);
  const gid = 'vln-' + Math.random().toString(36).slice(2, 7);
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity .6s .25s var(--vy-ease)' }} />
      <path ref={pathRef} d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={len || undefined} strokeDashoffset={drawn ? 0 : (len || 0)}
        style={{ transition: 'stroke-dashoffset 1s var(--vy-ease)', filter: `drop-shadow(0 3px 8px ${color}44)` }} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Badge — achievement chip (earned)
// ─────────────────────────────────────────────────────────────
function VyBadge({ icon = 'spark', title, sub, color = 'var(--vy-fore)', earned = true }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13, padding: '12px 16px 12px 12px',
      background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-2)', boxShadow: 'var(--vy-neu-sm)',
      opacity: earned ? 1 : 0.5, filter: earned ? 'none' : 'grayscale(1)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${color} 55%, transparent), color-mix(in srgb, ${color} 18%, transparent))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent), 0 0 16px color-mix(in srgb, ${color} 30%, transparent)`,
        color: '#fff',
      }}><VyIcon name={icon} size={20} color="#fff" /></div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--vy-ink)', fontFamily: 'var(--vy-heading)', whiteSpace: 'nowrap' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--vy-ink-3)' }}>{sub}</div>
      </div>
    </div>
  );
}

// streak chip
function VyStreak({ days = 7 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 10px',
      borderRadius: 'var(--vy-r-pill)', background: 'var(--vy-warn-t)',
      boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--vy-warn) 30%, transparent)',
    }}>
      <VyIcon name="bolt" size={16} color="var(--vy-warn)" />
      <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--vy-warn)' }} data-num>{days}-day streak</span>
    </div>
  );
}

// pill toggle (segmented)
function VySeg({ options, value, onChange }) {
  const i = Math.max(0, options.findIndex((o) => (o.value ?? o) === value));
  return (
    <div style={{ position: 'relative', display: 'inline-flex', padding: 4, borderRadius: 'var(--vy-r-pill)', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-inset)' }}>
      <span style={{
        position: 'absolute', top: 4, bottom: 4, left: `calc(4px + ${i} * ((100% - 8px) / ${options.length}))`,
        width: `calc((100% - 8px) / ${options.length})`, borderRadius: 'var(--vy-r-pill)',
        background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)',
        transition: 'left .24s var(--vy-spring)',
      }} />
      {options.map((o) => {
        const v = o.value ?? o, l = o.label ?? o;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            position: 'relative', zIndex: 1, flex: 1, border: 'none', background: 'transparent',
            padding: '7px 16px', fontFamily: 'var(--vy-heading)', fontWeight: 600, fontSize: 13,
            color: v === value ? 'var(--vy-ink)' : 'var(--vy-ink-3)', transition: 'color .2s', whiteSpace: 'nowrap',
          }}>{l}</button>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  VyIcon, VyButton, VyInput, VyCard, VyGlass, VyTxn, VyNumber, VyRing,
  VyConfetti, VyBars, VyLine, VyBadge, VyStreak, VySeg,
});
