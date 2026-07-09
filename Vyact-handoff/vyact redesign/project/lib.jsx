// FinFlow shared UI primitives v2 — paper-warm, coral lead, Pip mascot.
// All exported to window for use in other Babel scripts.

const FF = {
  // ── Pip mascot (from wireframes research) ──
  Pip: ({ size = 36, mood = "happy", style = {} }) => (
    <span style={{ display: 'inline-block', width: size, height: size, ...style }}>
      <svg viewBox="0 0 36 36" width={size} height={size}>
        <defs>
          <radialGradient id={`pip-grad-${size}-${mood}`} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#F4B6A8" />
            <stop offset="100%" stopColor="#E26D5C" />
          </radialGradient>
        </defs>
        <path d="M18 3 C 27 3, 33 9, 33 18 C 33 27, 27 33, 18 33 C 9 33, 3 27, 3 18 C 3 9, 9 3, 18 3 Z"
              fill={`url(#pip-grad-${size}-${mood})`} stroke="#2A2522" strokeWidth="1.2" />
        <ellipse cx="13" cy="16" rx="1.4" ry={mood === "sleep" ? 0.4 : 1.8} fill="#2A2522" />
        <ellipse cx="23" cy="16" rx="1.4" ry={mood === "sleep" ? 0.4 : 1.8} fill="#2A2522" />
        <circle cx="9.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
        <circle cx="26.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
        {mood === "happy" && <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round" />}
        {mood === "wow"   && <ellipse cx="18" cy="23" rx="2" ry="2.3" fill="#2A2522" />}
        {mood === "calm"  && <path d="M14 23 L 22 23" stroke="#2A2522" strokeWidth="1.2" strokeLinecap="round" />}
        {mood === "sleep" && <path d="M14 23 Q 16 22, 18 23 Q 20 24, 22 23" stroke="#2A2522" strokeWidth="1" fill="none" />}
        <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.8" />
      </svg>
    </span>
  ),

  // ── Wordmark ──
  Wordmark: ({ size = 22, style = {} }) => (
    <span style={{
      fontFamily: 'var(--ff-serif)', fontWeight: 500, fontSize: size,
      letterSpacing: '-0.015em', color: 'var(--ff-ink)',
      display: 'inline-flex', alignItems: 'baseline', gap: 0.5,
      lineHeight: 1, ...style,
    }}>
      <span>Fin</span>
      <span style={{ fontStyle: 'italic', color: 'var(--ff-coral)' }}>Flow</span>
    </span>
  ),

  // ── Icons — single stroke, 1.5px, 24×24 ──
  Icon: ({ name, size = 18, stroke = 1.5, style = {} }) => {
    const paths = {
      home:         'M3 12 L12 3 L21 12 M5 10 V21 H19 V10',
      transactions: 'M4 7 H20 M4 12 H20 M4 17 H14',
      budget:       'M3 12 A9 9 0 1 0 12 3 V12 Z M12 3 A9 9 0 0 1 21 12 H12 Z',
      goals:        'M12 21V11M5 11l7-7 7 7M9 21h6',
      debts:        'M3 6h18M3 12h18M3 18h12',
      networth:     'M3 17l5-5 4 4 8-8M14 5h6v6',
      reports:      'M4 20 V8 M9 20 V4 M14 20 V12 M19 20 V6',
      settings:     'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19 12l1.5-2-2-2-2 1L15 7l-2 1-2-1L9 8l-1.5-1-2 2L7 11l-1.5 2 2 2L9 14l1 2.5L11 16l1 2 1-2 1 .5L16 14l1.5 1 2-2L18 11l1-1z',
      help:         'M9 9a3 3 0 1 1 5 2.3c-1 .7-2 1.2-2 2.7M12 17.5h.01',
      plus:         'M12 4 V20 M4 12 H20',
      check:        'M4 12l5 5L20 6',
      x:            'M5 5l14 14M19 5L5 19',
      chevronD:     'M5 9l7 7 7-7',
      chevronR:     'M9 5l7 7-7 7',
      chevronL:     'M15 5l-7 7 7 7',
      arrowU:       'M12 19V5M5 12l7-7 7 7',
      arrowD:       'M12 5v14M5 12l7 7 7-7',
      arrowR:       'M5 12h14M13 5l7 7-7 7',
      search:       'M11 4 A7 7 0 1 0 11 18 A7 7 0 1 0 11 4 M16 16 L21 21',
      filter:       'M4 6h16M7 12h10M10 18h4',
      bell:         'M6 18 H18 V10 A6 6 0 0 0 6 10 Z M10 21 H14',
      user:         'M12 12 A4 4 0 1 0 12 4 A4 4 0 0 0 12 12 M4 21 A8 8 0 0 1 20 21',
      lock:         'M6 11 V8 A6 6 0 0 1 18 8 V11 M5 11 H19 V21 H5 Z',
      eye:          'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      card:         'M3 8h18M3 8v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1zM6 14h4',
      bank:         'M3 9l9-5 9 5v1H3zM5 10v8M9 10v8M15 10v8M19 10v8M3 19h18',
      sparkle:      'M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z',
      shield:       'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
      flag:         'M5 21V4M5 4h12l-2 4 2 4H5',
      menu:         'M4 6h16M4 12h16M4 18h16',
      grid:         'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
      heart:        'M12 21s-8-5-8-12a5 5 0 0 1 8-3 5 5 0 0 1 8 3c0 7-8 12-8 12z',
      globe:        'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18',
      wifi:         'M2 9a16 16 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8 17a4 4 0 0 1 8 0M12 21h.01',
      refresh:      'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
    };
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d={paths[name] || paths.x} />
      </svg>
    );
  },

  // ── Typography helpers ──
  Mono: ({ children, style = {} }) => (
    <span style={{ fontFamily: 'var(--ff-mono)', fontFeatureSettings: '"tnum","zero"', ...style }}>{children}</span>
  ),
  Serif: ({ children, italic = true, style = {} }) => (
    <span style={{ fontFamily: 'var(--ff-serif)', fontStyle: italic ? 'italic' : 'normal', fontWeight: 400, ...style }}>{children}</span>
  ),

  // ── Hatched slot placeholder ──
  Slot: ({ label = 'image', style = {}, children }) => (
    <div className="ff-placeholder" style={{ borderRadius: 'var(--ff-r-3)', minHeight: 80, ...style }}>
      {children || `[ ${label} ]`}
    </div>
  ),

  // ── Money — sign + color + tabular ──
  Money: ({ v, sign = 'auto', style = {} }) => {
    const n = Math.abs(v);
    const f = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const positive = v > 0;
    const color = sign === 'auto'
      ? (v === 0 ? 'var(--ff-ink-2)' : positive ? 'var(--ff-olive)' : 'var(--ff-ink)')
      : sign === 'pos' ? 'var(--ff-olive)'
      : sign === 'neg' ? 'var(--ff-coral-deep)'
      : 'inherit';
    return (
      <span data-num style={{ color, fontFeatureSettings: '"tnum","zero"', ...style }}>
        {v > 0 ? '+' : v < 0 ? '−' : ''}${f}
      </span>
    );
  },

  // ── Color swatch ──
  Swatch: ({ name, value, token, role, large = false, darkLabel = false }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        height: large ? 96 : 64, borderRadius: 'var(--ff-r-3) var(--ff-r-3) 0 0',
        background: value,
        display: 'flex', alignItems: 'flex-end', padding: 10,
      }}>
        <span style={{
          fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.08em',
          padding: '2px 6px', borderRadius: 3,
          background: darkLabel ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)',
          color: darkLabel ? '#fff' : 'var(--ff-ink)',
        }}>{value}</span>
      </div>
      <div style={{ padding: '10px 12px', background: 'var(--ff-surface)', borderRadius: '0 0 var(--ff-r-3) var(--ff-r-3)', border: '1px solid var(--ff-line)', borderTop: 'none' }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
        {token && <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-ink-3)', marginTop: 2 }}>{token}</div>}
        {role && <div style={{ fontSize: 11, color: 'var(--ff-ink-2)', marginTop: 4, lineHeight: 1.45 }}>{role}</div>}
      </div>
    </div>
  ),

  // ── Buttons ──
  Button: ({ children, kind = 'primary', size = 'md', icon, full = false, style = {} }) => {
    const sizes = {
      sm: { h: 28, px: 10, fs: 12, gap: 6 },
      md: { h: 38, px: 14, fs: 13, gap: 8 },
      lg: { h: 46, px: 18, fs: 14, gap: 10 },
    }[size];
    const skins = {
      primary: { bg: 'var(--ff-coral)', col: '#fff', bd: 'var(--ff-coral)' },
      ink:     { bg: 'var(--ff-ink)', col: 'var(--ff-canvas)', bd: 'var(--ff-ink)' },
      ghost:   { bg: 'transparent', col: 'var(--ff-ink)', bd: 'var(--ff-line-2)' },
      subtle:  { bg: 'var(--ff-surface)', col: 'var(--ff-ink)', bd: 'transparent' },
      destruct:{ bg: 'var(--ff-coral-deep)', col: '#fff', bd: 'var(--ff-coral-deep)' },
    }[kind];
    return (
      <button style={{
        height: sizes.h, padding: `0 ${sizes.px}px`,
        background: skins.bg, color: skins.col,
        border: `1px solid ${skins.bd}`, borderRadius: 9,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: sizes.gap,
        fontSize: sizes.fs, fontWeight: 600, letterSpacing: '0.01em',
        cursor: 'pointer', width: full ? '100%' : 'auto',
        transition: 'background var(--ff-dur-1) var(--ff-ease-out), transform var(--ff-dur-1)',
        ...style,
      }}>
        {icon && <FF.Icon name={icon} size={sizes.fs + 2} stroke={1.8} />}
        {children}
      </button>
    );
  },

  // ── Input ──
  Input: ({ placeholder, label, prefix, value, hint, error, style = {} }) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 500, color: 'var(--ff-ink-3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{label}</span>}
      <span style={{
        height: 40, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--ff-surface)', border: `1px solid ${error ? 'var(--ff-coral-deep)' : 'var(--ff-line-2)'}`,
        borderRadius: 'var(--ff-r-3)',
      }}>
        {prefix && <span style={{ color: 'var(--ff-ink-3)', fontFamily: 'var(--ff-mono)', fontSize: 13 }}>{prefix}</span>}
        <span style={{ flex: 1, color: value ? 'var(--ff-ink)' : 'var(--ff-ink-4)', fontSize: 14 }}>
          {value || placeholder}
        </span>
      </span>
      {hint && <span style={{ fontSize: 11, color: error ? 'var(--ff-coral-deep)' : 'var(--ff-ink-3)' }}>{hint}</span>}
    </label>
  ),

  // ── Badge / pill ──
  Badge: ({ children, tone = 'neutral', soft = true, dot = false, style = {} }) => {
    const tones = {
      neutral: ['var(--ff-canvas-2)', 'var(--ff-ink-2)'],
      coral:   ['var(--ff-coral-tint)', 'var(--ff-coral-deep)'],
      sage:    ['var(--ff-sage-tint)', 'var(--ff-olive)'],
      honey:   ['var(--ff-honey-tint)', '#A06A2C'],
      denim:   ['var(--ff-denim-tint)', 'var(--ff-denim)'],
      plum:    ['var(--ff-plum-tint)', 'var(--ff-plum)'],
      ink:     ['var(--ff-ink)', '#fff'],
    }[tone];
    const [bg, fg] = tones;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 22, padding: '0 9px',
        background: soft ? bg : fg, color: soft ? fg : '#fff',
        borderRadius: 'var(--ff-r-pill)',
        fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
        ...style,
      }}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: soft ? fg : '#fff' }} />}
        {children}
      </span>
    );
  },

  // ── Card / tile ──
  Card: ({ children, padding = 18, style = {} }) => (
    <div style={{
      background: 'var(--ff-surface)',
      border: '1px solid var(--ff-line)',
      borderRadius: 'var(--ff-r-3)',
      padding,
      ...style,
    }}>{children}</div>
  ),

  // ── Caption / kicker (mono uppercase) ──
  Caption: ({ children, style = {} }) => (
    <div style={{
      fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 500,
      color: 'var(--ff-ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase',
      ...style,
    }}>{children}</div>
  ),

  // ── Page head (used in section artboards) ──
  PageHead: ({ section, title, lede, meta }) => (
    <div style={{
      paddingBottom: 22, marginBottom: 28,
      borderBottom: '1px solid var(--ff-line-2)',
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'end',
    }}>
      <div>
        <FF.Caption style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 7, height: 7, background: 'var(--ff-coral)', borderRadius: 4 }} />
          {section}
        </FF.Caption>
        <h1 style={{ fontFamily: 'var(--ff-serif)', fontSize: 'var(--ff-text-5xl)', fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {lede && <p style={{ marginTop: 14, fontSize: 'var(--ff-text-md)', lineHeight: 1.55, color: 'var(--ff-ink-2)', maxWidth: '64ch' }}>{lede}</p>}
      </div>
      {meta && <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ff-ink-3)', textAlign: 'right', lineHeight: 1.8 }}>{meta}</div>}
    </div>
  ),

  // ── Pulse ring (mini, used in patterns + states) ──
  PulseRing: ({ score = 78, size = 80, label = 'Good', dark = false }) => {
    const stroke = Math.max(6, size * 0.1);
    const r = (size - stroke) / 2;
    const C = 2 * Math.PI * r;
    return (
      <div style={{ width: size, height: size, position: 'relative', display: 'inline-block' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={dark ? 'rgba(232,222,207,0.18)' : 'var(--ff-canvas-2)'} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ff-coral)" strokeWidth={stroke}
            strokeDasharray={`${(score/100)*C} ${C}`} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}>
          <span style={{ fontFamily: 'var(--ff-serif)', fontSize: size * 0.36, fontWeight: 500, color: dark ? 'var(--ff-canvas)' : 'var(--ff-ink)' }}>{score}</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: size * 0.1, letterSpacing: '0.14em', textTransform: 'uppercase', color: dark ? 'var(--ff-ink-on-shell-2)' : 'var(--ff-ink-3)', marginTop: 3 }}>{label}</span>
        </div>
      </div>
    );
  },

  // ── Voice card (do/dont style) ──
  VoiceCard: ({ context, quote, note, style = {} }) => (
    <div style={{
      borderLeft: '3px solid var(--ff-coral)',
      background: 'var(--ff-surface)',
      padding: '14px 18px',
      borderRadius: '0 var(--ff-r-3) var(--ff-r-3) 0',
      ...style,
    }}>
      <FF.Caption style={{ marginBottom: 6 }}>{context}</FF.Caption>
      <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 18, fontStyle: 'italic', lineHeight: 1.4, color: 'var(--ff-ink)' }}>
        <span style={{ color: 'var(--ff-coral)' }}>“</span>{quote}<span style={{ color: 'var(--ff-coral)' }}>”</span>
      </div>
      {note && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--ff-ink-2)' }}>{note}</p>}
    </div>
  ),

  // ── Flow step pill ──
  FlowStep: ({ children, idx, tone = 'mid' }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 14px',
      borderRadius: 999,
      fontFamily: 'var(--ff-mono)', fontSize: 11, letterSpacing: '0.05em',
      background: tone === 'start' ? 'var(--ff-ink)' : tone === 'end' ? 'var(--ff-coral)' : 'var(--ff-surface)',
      color: tone === 'mid' ? 'var(--ff-ink)' : '#fff',
      border: tone === 'mid' ? '1px solid var(--ff-line)' : 'none',
    }}>
      {idx !== undefined && (
        <span style={{
          width: 16, height: 16, borderRadius: 8, display: 'inline-grid', placeItems: 'center',
          background: tone === 'mid' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)',
          fontSize: 9,
        }}>{idx}</span>
      )}
      {children}
    </span>
  ),
};

Object.assign(window, { FF });
