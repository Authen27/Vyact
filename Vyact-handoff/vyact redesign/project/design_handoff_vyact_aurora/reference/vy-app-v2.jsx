// vy-app-v2.jsx — Variant 2 "Aurora" shell.
// NEW navigation: top app bar + section tabs + contextual subnav + ⌘K command palette.
// Reuses validated Dashboard/Stub from vy-screens-v2.jsx. Mounts to #root.

const { useState: v2S, useEffect: v2E, useRef: v2R } = React;
const { Pip, Brand, NavIcon, Ico, Dashboard, Stub, VY2 } = window;
const { SECTIONS, ACCOUNT_ROUTES, ALL_ROUTES, routeLabel, routeSection, D } = VY2;

// accent options (v2 palette exploration; pip coral included)
const ACCENTS = {
  Indigo: { dark: ['#8B99FA', '#0B1030'], light: ['#5566E6', '#FFFFFF'] },
  Jade:   { dark: ['#4FD9AE', '#06231B'], light: ['#2E9E78', '#FFFFFF'] },
  Coral:  { dark: ['#EC8474', '#2A1712'], light: ['#E26D5C', '#2A1712'] },
};

function useNarrow(bp) {
  const [n, setN] = v2S(typeof window !== 'undefined' && window.innerWidth < bp);
  v2E(() => { const on = () => setN(window.innerWidth < bp); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  return n;
}

// ── section segmented control (sliding neu pill) ─────────────
function SectionTabs({ section, onPick }) {
  const idx = Math.max(0, SECTIONS.findIndex((s) => s.id === section));
  return (
    <div style={{ position: 'relative', display: 'inline-flex', padding: 4, borderRadius: 'var(--vy-r-pill)', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-inset)' }}>
      <span style={{
        position: 'absolute', top: 4, bottom: 4, left: `calc(4px + ${idx} * ((100% - 8px) / ${SECTIONS.length}))`,
        width: `calc((100% - 8px) / ${SECTIONS.length})`, borderRadius: 'var(--vy-r-pill)',
        background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', transition: 'left .26s var(--vy-spring)',
      }} />
      {SECTIONS.map((s) => {
        const on = s.id === section;
        return (
          <button key={s.id} onClick={() => onPick(s)} style={{
            position: 'relative', zIndex: 1, border: 'none', background: 'transparent',
            padding: '8px 20px', fontFamily: 'var(--vy-heading)', fontWeight: 600, fontSize: 13.5,
            color: on ? 'var(--vy-accent)' : 'var(--vy-ink-3)', transition: 'color .2s', whiteSpace: 'nowrap',
          }}>{s.label}</button>
        );
      })}
    </div>
  );
}

// ── account dropdown menu ────────────────────────────────────
function AccountMenu({ route, onGo, themeMode, setThemeMode }) {
  const [open, setOpen] = v2S(false);
  const ref = v2R(null);
  v2E(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Account" style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 6px 0 10px', border: 'none',
        borderRadius: 'var(--vy-r-pill)', background: 'var(--vy-canvas)', boxShadow: open ? 'var(--vy-neu-inset)' : 'var(--vy-neu-sm)', color: 'var(--vy-ink-2)',
      }}>
        <span className="vy-cap" style={{ fontSize: 9.5 }}>Family</span>
        <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--vy-rail)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: 'var(--vy-heading)' }}>MR</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 232, zIndex: 60,
          background: 'var(--vy-glass-strong)', backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)',
          border: '1px solid var(--vy-glass-line)', borderRadius: 'var(--vy-r-3)', boxShadow: 'var(--vy-cast-3)', padding: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 12px', borderBottom: '1px solid var(--vy-line)', marginBottom: 6 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--vy-rail)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--vy-heading)' }}>MR</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--vy-ink)' }}>Rowan Family</div>
              <div style={{ fontSize: 11, color: 'var(--vy-ink-3)' }}>maya@rowan.co · USD</div>
            </div>
          </div>
          {ACCOUNT_ROUTES.map(([id, label]) => (
            <button key={id} onClick={() => { onGo(id); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none',
              background: route === id ? 'var(--vy-hover)' : 'transparent', borderRadius: 9, padding: '9px 10px',
              color: route === id ? 'var(--vy-accent)' : 'var(--vy-ink-2)', fontSize: 13, fontWeight: 500,
            }}><NavIcon name={id} size={16} />{label}</button>
          ))}
          <div style={{ display: 'flex', gap: 4, padding: 4, margin: '6px 2px 2px', borderRadius: 10, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-inset)' }}>
            {[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([m, l]) => (
              <button key={m} onClick={() => setThemeMode(m)} style={{
                flex: 1, height: 28, borderRadius: 7, border: 'none', fontSize: 11, fontWeight: 600, fontFamily: 'var(--vy-heading)',
                background: themeMode === m ? 'var(--vy-canvas)' : 'transparent', boxShadow: themeMode === m ? 'var(--vy-neu-sm)' : 'none',
                color: themeMode === m ? 'var(--vy-accent)' : 'var(--vy-ink-3)',
              }}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── command palette (⌘K) — reaches every route ──────────────
const QUICK = [
  { id: 'qa-txn', label: 'Add transaction', hint: 'Create', icon: 'M12 5v14M5 12h14', to: 'transactions' },
  { id: 'qa-budget', label: 'New budget', hint: 'Create', icon: 'M3 8h15a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 8l2-3h10l2 3', to: 'budgets' },
  { id: 'qa-ask', label: 'Ask Vyact', hint: 'AI', icon: 'M4 5a2 2 0 012-2h13v14H6a2 2 0 00-2 2z', to: 'insights' },
];
function CommandPalette({ open, onClose, onGo }) {
  const [q, setQ] = v2S('');
  const [sel, setSel] = v2S(0);
  const inputRef = v2R(null);

  v2E(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);

  const ql = q.trim().toLowerCase();
  const actions = QUICK.filter((a) => a.label.toLowerCase().includes(ql));
  const groups = SECTIONS.map((s) => ({
    label: s.label,
    items: s.routes.filter(([id, l]) => l.toLowerCase().includes(ql) || id.includes(ql)).map(([id, l]) => ({ id, label: l, section: s.label })),
  })).filter((g) => g.items.length);
  const acct = ACCOUNT_ROUTES.filter(([id, l]) => l.toLowerCase().includes(ql) || id.includes(ql)).map(([id, l]) => ({ id, label: l, section: 'Account' }));
  const flat = [
    ...actions.map((a) => ({ type: 'action', ...a })),
    ...groups.flatMap((g) => g.items.map((it) => ({ type: 'route', ...it }))),
    ...acct.map((it) => ({ type: 'route', ...it })),
  ];

  v2E(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = flat[sel]; if (it) { onGo(it.to || it.id); onClose(); } }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, sel]);

  if (!open) return null;
  let running = -1;
  const Row = (it, label, icon, hint) => {
    running += 1; const i = running; const active = i === sel;
    return (
      <button key={it.type + it.id} onMouseEnter={() => setSel(i)} onClick={() => { onGo(it.to || it.id); onClose(); }} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 'none',
        background: active ? 'var(--vy-hover)' : 'transparent', borderRadius: 10, padding: '11px 13px',
        boxShadow: active ? 'var(--vy-neu-inset)' : 'none', transition: 'background .12s',
      }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--vy-accent)' : 'var(--vy-canvas)', boxShadow: active ? 'none' : 'var(--vy-neu-sm)', color: active ? 'var(--vy-accent-ink)' : 'var(--vy-ink-2)' }}>
          {icon}
        </span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: 'var(--vy-ink)' }}>{label}</span>
        <span className="vy-cap" style={{ fontSize: 9 }}>{hint}</span>
      </button>
    );
  };

  return (
    <div onMouseDown={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh', background: 'rgba(6,10,12,0.5)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
      animation: 'vy-fade .16s var(--vy-ease)',
    }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{
        width: 'min(600px, 92vw)', background: 'var(--vy-glass-strong)', backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)',
        border: '1px solid var(--vy-glass-line)', borderRadius: 'var(--vy-r-4)', boxShadow: 'var(--vy-cast-3)', overflow: 'hidden',
        animation: 'vy-pop .2s var(--vy-spring)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--vy-line)' }}>
          <Ico d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.6-3.6" size={18} color="var(--vy-ink-3)" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder="Search or jump to…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--vy-ink)', fontFamily: 'var(--vy-sans)', fontSize: 16 }} />
          <span className="vy-cap" style={{ fontSize: 9, padding: '4px 7px', borderRadius: 6, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)' }}>Esc</span>
        </div>
        <div className="vy-scroll" style={{ maxHeight: 380, overflowY: 'auto', padding: 8 }}>
          {flat.length === 0 && <div style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--vy-ink-3)', fontSize: 13.5 }}>No matches for “{q}”.</div>}
          {actions.length > 0 && <div className="vy-cap" style={{ fontSize: 9, padding: '8px 10px 4px' }}>Quick actions</div>}
          {actions.map((a) => Row({ type: 'action', id: a.id, to: a.to }, a.label, <Ico d={a.icon} size={15} color="currentColor" />, a.hint))}
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <div className="vy-cap" style={{ fontSize: 9, padding: '10px 10px 4px' }}>{g.label}</div>
              {g.items.map((it) => Row({ type: 'route', id: it.id }, it.label, <NavIcon name={it.id} size={15} />, 'Go'))}
            </React.Fragment>
          ))}
          {acct.length > 0 && <div className="vy-cap" style={{ fontSize: 9, padding: '10px 10px 4px' }}>Account</div>}
          {acct.map((it) => Row({ type: 'route', id: it.id }, it.label, <NavIcon name={it.id} size={15} />, 'Go'))}
        </div>
        <div style={{ display: 'flex', gap: 16, padding: '10px 18px', borderTop: '1px solid var(--vy-line)', color: 'var(--vy-ink-3)', fontSize: 11 }}>
          <span>↑↓ navigate</span><span>↵ open</span><span style={{ marginLeft: 'auto' }}>{flat.length} results</span>
        </div>
      </div>
    </div>
  );
}

// ── top app bar ──────────────────────────────────────────────
function TopBar({ route, section, onSection, onGo, onOpenPalette, themeMode, setThemeMode, narrow }) {
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--vy-glass)', backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)', borderBottom: '1px solid var(--vy-line)' }}>
      <div style={{ height: 3, background: 'var(--vy-rail)', opacity: 0.85 }} />
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: narrow ? '10px 16px' : '12px 28px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', rowGap: 10 }}>
        <button onClick={() => onGo('dashboard')} style={{ border: 'none', background: 'transparent', padding: 0 }}><Brand size={24} /></button>
        <div style={narrow ? { order: 3, flexBasis: '100%', display: 'flex', justifyContent: 'center' } : { flex: '0 0 auto', margin: '0 auto' }}>
          <SectionTabs section={section} onPick={(s) => onSection(s)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <button onClick={onOpenPalette} style={{
            display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 12px 0 14px', border: 'none',
            borderRadius: 'var(--vy-r-pill)', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-inset)', color: 'var(--vy-ink-3)',
          }}>
            <Ico d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.6-3.6" size={15} />
            {!narrow && <span style={{ fontSize: 13, fontFamily: 'var(--vy-sans)' }}>Jump to…</span>}
            {!narrow && <span className="vy-cap" style={{ fontSize: 9, padding: '3px 7px', borderRadius: 6, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', color: 'var(--vy-ink-3)' }}>{mac ? '⌘K' : 'Ctrl K'}</span>}
          </button>
          <button aria-label="Notifications" style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', color: 'var(--vy-ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 004 0" size={17} />
            <span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: '50%', background: 'var(--vy-warn)', boxShadow: '0 0 0 2px var(--vy-canvas)' }} />
          </button>
          <AccountMenu route={route} onGo={onGo} themeMode={themeMode} setThemeMode={setThemeMode} />
        </div>
      </div>
    </header>
  );
}

// ── contextual subnav (routes within active section) ─────────
function SubNav({ section, route, onGo, narrow }) {
  const sec = SECTIONS.find((s) => s.id === section);
  const routes = sec ? sec.routes : ACCOUNT_ROUTES;
  return (
    <div style={{ position: narrow ? 'static' : 'sticky', top: narrow ? 'auto' : 68, zIndex: 40, background: 'var(--vy-canvas)', borderBottom: '1px solid var(--vy-line)', boxShadow: 'var(--vy-neu-sm)' }}>
      <div className="vy-scroll" style={{ maxWidth: 1320, margin: '0 auto', padding: narrow ? '10px 16px' : '10px 28px', display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto' }}>
        <span className="vy-cap" style={{ fontSize: 9.5, marginRight: 4, flexShrink: 0 }}>{sec ? sec.label : 'Account'}</span>
        {routes.map(([id, label]) => {
          const on = route === id;
          return (
            <button key={id} onClick={() => onGo(id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, border: 'none',
              padding: '8px 15px', borderRadius: 'var(--vy-r-pill)', fontFamily: 'var(--vy-heading)', fontWeight: on ? 600 : 500, fontSize: 13,
              background: 'var(--vy-canvas)', boxShadow: on ? 'var(--vy-neu-inset)' : 'var(--vy-neu-sm)',
              color: on ? 'var(--vy-accent)' : 'var(--vy-ink-3)', transition: 'color .18s, box-shadow .18s',
            }}><NavIcon name={id} size={15} />{label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────
function AppV2() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "themeMode": "dark",
    "headFont": "Outfit",
    "accentColor": "Coral"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = v2S('dashboard');
  const [section, setSection] = v2S('track');
  const [palette, setPalette] = v2S(false);
  const narrow = useNarrow(880);

  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = t.themeMode === 'dark' || (t.themeMode === 'auto' && prefersDark);

  // navigate + keep section in sync with route
  const go = (id) => { setRoute(id); const s = routeSection(id); if (s !== 'account') setSection(s); setPalette(false); };
  const pickSection = (s) => { setSection(s.id); setRoute(s.routes[0][0]); };

  v2E(() => {
    document.documentElement.setAttribute('data-vy-theme', dark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--vy-head', t.headFont === 'Inter Tight' ? "'Inter Tight'" : "'Outfit'");
  }, [dark, t.headFont]);

  // accent override (theme-aware)
  v2E(() => {
    const a = ACCENTS[t.accentColor] || ACCENTS.Coral;
    const [ac, ink] = a[dark ? 'dark' : 'light'];
    const el = document.getElementById('vy2root');
    if (el) { el.style.setProperty('--vy-accent', ac); el.style.setProperty('--vy-accent-ink', ink); }
  }, [t.accentColor, dark]);

  // ⌘K
  v2E(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div id="vy2root" className="vy" data-vy-theme={dark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--vy-canvas)' }}>
      <TopBar route={route} section={section} onSection={pickSection} onGo={go} onOpenPalette={() => setPalette(true)}
        themeMode={t.themeMode} setThemeMode={(m) => setTweak('themeMode', m)} narrow={narrow} />
      <SubNav section={section} route={route} onGo={go} narrow={narrow} />

      <main style={{ position: 'relative', minHeight: 'calc(100vh - 120px)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--vy-ambient)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 1320, margin: '0 auto', padding: narrow ? '22px 16px 60px' : '30px 28px 70px' }}>
          {route === 'dashboard' ? <Dashboard onGo={go} /> : <Stub route={route} onGo={go} />}
        </div>
      </main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onGo={go} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakRadio label="Theme" value={t.themeMode} options={['light', 'dark', 'auto']} onChange={(v) => setTweak('themeMode', v)} />
        <TweakRadio label="Accent" value={t.accentColor} options={['Coral', 'Indigo', 'Jade']} onChange={(v) => setTweak('accentColor', v)} />
        <TweakRadio label="Headings" value={t.headFont} options={['Outfit', 'Inter Tight']} onChange={(v) => setTweak('headFont', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppV2 />);
