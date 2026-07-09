// vy-doc.jsx — Vyact Design System reference page
// Composes vy-components.jsx primitives into a documented spec sheet.

const { useState: uS, useEffect: uE, useRef: uR } = React;

// ── layout helpers ───────────────────────────────────────────
function Section({ id, kicker, title, desc, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 90, marginBottom: 'var(--vy-9)' }}>
      <div style={{ marginBottom: 'var(--vy-6)', maxWidth: 720 }}>
        <div className="vy-cap" style={{ marginBottom: 10 }}>{kicker}</div>
        <h2 style={{ fontSize: 'var(--vy-t-1)', letterSpacing: '-0.01em', marginBottom: desc ? 10 : 0 }}>{title}</h2>
        {desc && <p style={{ fontSize: 16, color: 'var(--vy-ink-2)', lineHeight: 1.6 }}>{desc}</p>}
      </div>
      {children}
    </section>
  );
}
function Panel({ children, style = {} }) {
  return <div style={{ background: 'var(--vy-canvas)', borderRadius: 'var(--vy-r-3)', boxShadow: 'var(--vy-neu-inset)', padding: 'var(--vy-6)', ...style }}>{children}</div>;
}
function SubHead({ children }) {
  return <div className="vy-cap" style={{ marginBottom: 16, color: 'var(--vy-ink-2)' }}>{children}</div>;
}

// ── COVER ────────────────────────────────────────────────────
function Cover({ dark, onToggle, headFont }) {
  const [tick, setTick] = uS(0);
  uE(() => { const t = setInterval(() => setTick((x) => x + 1), 6000); return () => clearInterval(t); }, []);
  return (
    <header style={{ position: 'relative', padding: 'var(--vy-9) 0 var(--vy-8)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--vy-ambient)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,1fr)', gap: 'var(--vy-8)', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <Logo />
            <span className="vy-cap" style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)' }}>Design System</span>
          </div>
          <h1 style={{ fontSize: 'var(--vy-t-mega)', lineHeight: 1.02, letterSpacing: '-0.025em', fontWeight: 700, marginBottom: 20 }}>
            Neumorphic<br />Fluid
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--vy-ink-2)', maxWidth: 460, marginBottom: 30 }}>
            The financial-storytelling system behind Vyact. Soft tactile surfaces and layered glass, tuned so data entry feels like play — not a chore.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <VyButton variant="primary" icon="arrowUR" onClick={() => { const el = document.getElementById('color'); if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' }); }}>Explore the system</VyButton>
            <ModeToggle dark={dark} onToggle={onToggle} />
            <span className="vy-cap" style={{ marginLeft: 4 }}>Headings · {headFont}</span>
          </div>
        </div>
        <HeroCard trigger={tick} dark={dark} />
      </div>
    </header>
  );
}

function Pip({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="pip" style={{ flexShrink: 0, filter: 'drop-shadow(0 3px 9px rgba(226,109,92,0.4))' }}>
      <defs><radialGradient id="pipg-doc" cx="50%" cy="40%" r="62%"><stop offset="0%" stopColor="#F4B6A8" /><stop offset="100%" stopColor="#E26D5C" /></radialGradient></defs>
      <path d="M18 3 C 27 3, 33 9, 33 18 C 33 27, 27 33, 18 33 C 9 33, 3 27, 3 18 C 3 9, 9 3, 18 3 Z" fill="url(#pipg-doc)" stroke="#2A2522" strokeWidth="1.2" />
      <ellipse cx="13" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
      <ellipse cx="23" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
      <circle cx="9.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      <circle cx="26.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.8" />
    </svg>
  );
}
function Logo({ size = 30 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <Pip size={size + 2} />
      <span style={{ fontFamily: 'var(--vy-heading)', fontWeight: 700, fontSize: size * 0.82, letterSpacing: '-0.02em', color: 'var(--vy-ink)' }}>Vy<span style={{ color: 'var(--vy-accent)' }}>act</span></span>
    </div>
  );
}

function ModeToggle({ dark, onToggle }) {
  return (
    <button onClick={onToggle} aria-label="Toggle theme" style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 16px',
      borderRadius: 'var(--vy-r-2)', border: 'none', background: 'var(--vy-canvas)',
      boxShadow: 'var(--vy-neu-sm)', color: 'var(--vy-ink-2)', fontFamily: 'var(--vy-heading)', fontWeight: 600, fontSize: 14,
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dark ? <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /> : <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" /></>}
      </svg>
      {dark ? 'Dark' : 'Light'}
    </button>
  );
}

function HeroCard({ trigger, dark }) {
  const spark = [12, 14, 13, 16, 15, 19, 18, 22, 21, 26, 24, 29];
  return (
    <VyGlass pad={26} tint="var(--vy-violet-b)" style={{ borderRadius: 'var(--vy-r-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div className="vy-cap" style={{ marginBottom: 8 }}>Net worth</div>
          <VyNumber value={148250} size={46} trigger={trigger} />
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: 'var(--vy-good-t)', color: 'var(--vy-good)', fontWeight: 600, fontSize: 13 }}>
          <VyIcon name="arrowUR" size={13} color="var(--vy-good)" /> +4.2%
        </span>
      </div>
      <div style={{ margin: '10px -6px 4px' }}><VyLine points={spark} height={80} color="var(--vy-violet-b)" trigger={trigger} /></div>
      <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
        <MiniStat label="Saved" value="$2,340" tone="var(--vy-good)" />
        <MiniStat label="This month" value="−$3,180" tone="var(--vy-ink)" />
        <MiniStat label="On track" value="92%" tone="var(--vy-fore)" />
      </div>
    </VyGlass>
  );
}
function MiniStat({ label, value, tone }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--vy-ink-3)', marginBottom: 3 }}>{label}</div>
      <div data-num style={{ fontWeight: 600, fontSize: 15, color: tone }}>{value}</div>
    </div>
  );
}

// ── COLOR ────────────────────────────────────────────────────
function Swatch({ name, hex, note, ink }) {
  return (
    <div style={{ borderRadius: 'var(--vy-r-2)', overflow: 'hidden', boxShadow: 'var(--vy-neu-sm)' }}>
      <div style={{ height: 68, background: hex }} />
      <div style={{ padding: '10px 12px', background: 'var(--vy-canvas)' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--vy-ink)' }}>{name}</div>
        <div data-num style={{ fontSize: 11.5, color: 'var(--vy-ink-3)', textTransform: 'uppercase' }}>{hex}</div>
        {note && <div style={{ fontSize: 11.5, color: 'var(--vy-ink-3)', marginTop: 4, lineHeight: 1.4 }}>{note}</div>}
      </div>
    </div>
  );
}
function AccentCard({ hex, name, role, use, avoid }) {
  return (
    <VyCard hover={false} pad={0} style={{ borderRadius: 'var(--vy-r-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18 }}>
        <div style={{ width: 48, height: 48, borderRadius: 'var(--vy-r-2)', background: hex, boxShadow: `0 6px 18px ${hex}55`, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--vy-heading)' }}>{name}</div>
          <div data-num style={{ fontSize: 12, color: 'var(--vy-ink-3)', textTransform: 'uppercase' }}>{hex}</div>
        </div>
      </div>
      <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13.5, color: 'var(--vy-ink-2)', lineHeight: 1.5 }}>{role}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Tag ok>{use}</Tag>
        </div>
        {avoid && <div style={{ display: 'flex', gap: 8 }}><Tag>{avoid}</Tag></div>}
      </div>
    </VyCard>
  );
}
function Tag({ children, ok }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, lineHeight: 1.4,
      padding: '5px 10px', borderRadius: 8, fontWeight: 500,
      background: ok ? 'var(--vy-good-t)' : 'var(--vy-crit-t)', color: ok ? 'var(--vy-good)' : 'var(--vy-crit)',
    }}>
      <span style={{ fontWeight: 700 }}>{ok ? '✓' : '✕'}</span>{children}
    </span>
  );
}

// ── TYPE ─────────────────────────────────────────────────────
function TypeRow({ spec, px, weight, children, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, padding: '18px 0', borderBottom: '1px solid var(--vy-line)' }}>
      <div style={{ width: 130, flexShrink: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--vy-ink-2)' }}>{spec}</div>
        <div data-num style={{ fontSize: 11, color: 'var(--vy-ink-3)' }}>{px}px · {weight}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: px, fontWeight: weight, lineHeight: 1.15, color: 'var(--vy-ink)', letterSpacing: px > 30 ? '-0.02em' : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: mono ? 'var(--vy-mono)' : 'var(--vy-heading)' }}>{children}</div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────────
const NAV = [
  ['color', 'Color'], ['type', 'Typography'], ['space', 'Space & form'],
  ['elevation', 'Elevation'], ['buttons', 'Buttons'], ['inputs', 'Inputs'],
  ['cards', 'Cards'], ['charts', 'Data viz'], ['motion', 'Micro-interactions'],
];

function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "dark": true,
    "headFont": "Outfit"
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const dark = t.dark;
  const headFont = t.headFont;

  uE(() => {
    document.documentElement.setAttribute('data-vy-theme', dark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--vy-head', headFont === 'Inter Tight' ? "'Inter Tight'" : "'Outfit'");
  }, [dark, headFont]);

  const [active, setActive] = uS('color');
  uE(() => {
    const onScroll = () => {
      const y = window.scrollY + 120;
      let cur = NAV[0][0];
      for (const [id] of NAV) { const el = document.getElementById(id); if (el && el.offsetTop <= y) cur = id; }
      setActive(cur);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id) => { const el = document.getElementById(id); if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' }); };

  return (
    <div className="vy" data-vy-theme={dark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--vy-canvas)' }}>
      {/* top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--vy-glass)', backdropFilter: 'var(--vy-blur)', WebkitBackdropFilter: 'var(--vy-blur)', borderBottom: '1px solid var(--vy-line)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size={24} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="vy-cap" style={{ fontSize: 10 }}>v1.0 · Canonical</span>
            <ModeToggle dark={dark} onToggle={() => setTweak('dark', !dark)} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 40px', display: 'grid', gridTemplateColumns: '188px minmax(0,1fr)', gap: 'var(--vy-8)', alignItems: 'start' }}>
        {/* left nav */}
        <nav style={{ position: 'sticky', top: 78, paddingTop: 'var(--vy-8)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="vy-cap" style={{ marginBottom: 12, paddingLeft: 12 }}>Contents</div>
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => go(id)} style={{
              textAlign: 'left', border: 'none', background: active === id ? 'var(--vy-canvas)' : 'transparent',
              boxShadow: active === id ? 'var(--vy-neu-inset)' : 'none',
              color: active === id ? 'var(--vy-ink)' : 'var(--vy-ink-3)',
              padding: '9px 12px', borderRadius: 10, fontSize: 13.5, fontWeight: active === id ? 600 : 500,
              fontFamily: 'var(--vy-heading)', transition: 'color .2s, box-shadow .2s',
            }}>{label}</button>
          ))}
        </nav>

        {/* content */}
        <main style={{ paddingBottom: 'var(--vy-9)', minWidth: 0 }}>
          <Cover dark={dark} headFont={headFont} onToggle={() => setTweak('dark', !dark)} />

          {/* COLOR */}
          <Section id="color" kicker="Foundations · 01" title="Anchored by pip" desc="pip's coral leads every primary moment; a warm neutral base carries 70% of each surface. Loss is information, never failure — terracotta red is reserved for critical alerts alone.">
            <SubHead>Neutral base — warm</SubHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--vy-7)' }}>
              <Swatch name="Canvas" hex="#1C1714" note="Page + neu base" />
              <Swatch name="Elevated" hex="#262019" note="Flat lifted surface" />
              <Swatch name="Sunken" hex="#15110E" note="Wells, input troughs" />
              <Swatch name="Ink" hex="#F2EBE0" note="Primary text" />
            </div>
            <SubHead>Accent system — coral-led, semantic</SubHead>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <AccentCard hex="#E26D5C" name="Coral · pip" role="The brand. Primary actions, focus, the mascot's face." use="Actions & CTAs" />
              <AccentCard hex="#85A88A" name="Prosperity" role="Money moved, gains, goals progressed." use="Gains & positive" />
              <AccentCard hex="#E8A87C" name="Attention" role="Trending up, near-limit, opportunity worth a look." use="Warnings & momentum" />
              <AccentCard hex="#4A6FA5" name="Trust" role="Banking, the AI speaking clearly, information." use="Info & AI" />
              <AccentCard hex="#6E4555" name="Insight" role="Forecasts, predictions, future-state thinking." use="AI & what-ifs" />
              <AccentCard hex="#C44536" name="Alert" role="Critical only — a frozen card, a failed transfer." use="Critical alerts" avoid="Never for money lost" />
            </div>
          </Section>

          {/* TYPE */}
          <Section id="type" kicker="Foundations · 02" title="Hierarchy with personality" desc="Outfit leads the display voice — geometric and fintech-native — over Inter for body and JetBrains Mono for every exact figure. Generous line-height keeps data-dense screens breathable.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 'var(--vy-6)' }}>
              <FontChip family="var(--vy-heading)" name="Outfit / Inter Tight" role="Display · headings · labels" sample="Aa" />
              <FontChip family="var(--vy-sans)" name="Inter" role="Body · UI · reading" sample="Aa" />
              <FontChip family="var(--vy-mono)" name="JetBrains Mono" role="Figures · tickers · IDs" sample="$0" />
            </div>
            <Panel>
              <TypeRow spec="Hero" px={56} weight={700}>You're on track this week</TypeRow>
              <TypeRow spec="Primary title" px={32} weight={600}>Spending, understood</TypeRow>
              <TypeRow spec="Secondary" px={24} weight={600}>Goals within reach</TypeRow>
              <TypeRow spec="Subtitle" px={16} weight={500}>Your AI noticed something</TypeRow>
              <TypeRow spec="Body" px={14} weight={400}>Every screen should whisper, not shout.</TypeRow>
              <TypeRow spec="Figure" px={28} weight={600} mono>$148,250.00</TypeRow>
            </Panel>
          </Section>

          {/* SPACE */}
          <Section id="space" kicker="Foundations · 03" title="Breathing room" desc="An 8-point grid governs every measure; corners soften as surfaces grow. Space is the cheapest way to feel premium.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Panel>
                <SubHead>Spacing · 8pt grid</SubHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[['xs', 4], ['sm', 8], ['md', 16], ['lg', 24], ['xl', 32], ['2xl', 48]].map(([n, v]) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 40, fontSize: 12, color: 'var(--vy-ink-3)', fontWeight: 600 }}>{n}</div>
                      <div style={{ height: 14, width: v, borderRadius: 3, background: 'var(--vy-rail)' }} />
                      <div data-num style={{ fontSize: 12, color: 'var(--vy-ink-3)' }}>{v}px</div>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <SubHead>Radius</SubHead>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {[['r-1', 8], ['r-2', 12], ['r-3', 18], ['r-4', 26]].map(([n, v]) => (
                    <div key={n} style={{ textAlign: 'center' }}>
                      <div style={{ width: 72, height: 72, borderTopLeftRadius: v, borderTopRightRadius: v, background: 'var(--vy-canvas)', boxShadow: 'var(--vy-neu-sm)', marginBottom: 8 }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--vy-ink-2)' }}>{n}</div>
                      <div data-num style={{ fontSize: 11, color: 'var(--vy-ink-3)' }}>{v}px</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </Section>

          {/* ELEVATION */}
          <Section id="elevation" kicker="Foundations · 04" title="Two morphisms, one depth" desc="Neumorphism makes surfaces feel yours — clay under soft light. Glass layers sophistication over key moments: insights and celebrations. Used together, never everywhere.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <Panel style={{ padding: 'var(--vy-7)' }}>
                <SubHead>Neumorphic surfaces</SubHead>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                  <ElevTile shadow="var(--vy-neu)" label="Raised" />
                  <ElevTile shadow="var(--vy-neu-inset)" label="Inset" />
                  <ElevTile shadow="var(--vy-neu-lg)" label="Lifted" />
                </div>
              </Panel>
              <Panel style={{ padding: 'var(--vy-7)', background: 'var(--vy-canvas)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'var(--vy-ambient)' }} />
                <div style={{ position: 'relative' }}>
                  <SubHead>Glass overlay</SubHead>
                  <VyGlass pad={20} tint="var(--vy-blue-b)">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--vy-info-t)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><VyIcon name="spark" size={18} color="var(--vy-info)" /></div>
                      <div>
                        <div style={{ fontWeight: 600, fontFamily: 'var(--vy-heading)' }}>AI insight</div>
                        <div style={{ fontSize: 12.5, color: 'var(--vy-ink-2)' }}>Blur, thin light border, cast shadow.</div>
                      </div>
                    </div>
                  </VyGlass>
                </div>
              </Panel>
            </div>
          </Section>

          {/* BUTTONS */}
          <Section id="buttons" kicker="Components · 01" title="States as dialogue" desc="Buttons rest soft, lift on hover, press inward on tap. Primary actions flash success and settle — try the live one.">
            <Panel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 24, alignItems: 'start' }}>
                <StateCol title="Primary"><VyButton variant="primary">Move money</VyButton><VyButton variant="primary" forceState="hover">Hover</VyButton><VyButton variant="primary" forceState="active">Pressed</VyButton><VyButton variant="primary" disabled>Disabled</VyButton></StateCol>
                <StateCol title="Neu"><VyButton>Categorize</VyButton><VyButton forceState="hover">Hover</VyButton><VyButton forceState="active">Pressed</VyButton><VyButton disabled>Disabled</VyButton></StateCol>
                <StateCol title="Glass"><VyButton variant="glass" icon="spark">Ask AI</VyButton><VyButton variant="glass">Details</VyButton></StateCol>
                <StateCol title="Live"><VyButton variant="primary" async icon="check">Log expense</VyButton><span style={{ fontSize: 12, color: 'var(--vy-ink-3)', lineHeight: 1.5 }}>Click → loading → success flash → reset.</span></StateCol>
              </div>
            </Panel>
          </Section>

          {/* INPUTS */}
          <Section id="inputs" kicker="Components · 02" title="Inputs that whisper" desc="Borderless troughs that invite input rather than demand it. Focus glows, filled deepens, error shakes once and speaks.">
            <Panel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
                <VyInput label="Resting" placeholder="Search transactions" />
                <VyInput label="Focused" value="Whole Foods" forceState="focused" />
                <VyInput label="Amount" prefix="$" value="340.00" />
                <VyInput label="Error" value="12,,00" error="Enter a valid amount" />
              </div>
            </Panel>
          </Section>

          {/* CARDS */}
          <Section id="cards" kicker="Components · 03" title="Layered storytelling" desc="A transaction is a row with an accent spine, a soft icon, the figure, and — when the AI has something to say — a tap-to-reveal insight.">
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <VyTxn icon="cart" name="Whole Foods" meta="Groceries · Today" amount="86.40" accent="var(--vy-green-b)" insight="15% higher than your usual grocery run — check the receipt?" />
                <VyTxn icon="coffee" name="Blue Bottle" meta="Coffee · Yesterday" amount="6.25" accent="var(--vy-amber-b)" />
                <VyTxn icon="arrowUR" name="Paycheck" meta="Income · Jul 1" amount="4,200.00" positive accent="var(--vy-green-b)" />
                <VyTxn icon="cardico" name="Netflix" meta="Subscription · Jul 3" amount="15.49" accent="var(--vy-violet-b)" insight="One of 6 subscriptions. Together: $84/mo." />
              </div>
              <VyGlass pad={22} tint="var(--vy-violet-b)" style={{ borderRadius: 'var(--vy-r-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <VyIcon name="spark" size={16} color="var(--vy-fore)" />
                  <span className="vy-cap" style={{ color: 'var(--vy-fore)' }}>AI insight</span>
                </div>
                <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--vy-ink)', marginBottom: 16 }}>You're spending <b>12% more</b> on dining this month. Want me to set a soft cap of <b data-num>$400</b>?</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <VyButton variant="primary" style={{ height: 40, fontSize: 14 }}>Set cap</VyButton>
                  <VyButton variant="ghost" style={{ height: 40, fontSize: 14 }}>Not now</VyButton>
                </div>
              </VyGlass>
            </div>
          </Section>

          {/* CHARTS */}
          <Section id="charts" kicker="Components · 04" title="Engaging, not overwhelming" desc="Bars spring up from the baseline; lines draw themselves in. Never more than three colors, labels outside, detail on hover.">
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'stretch' }}>
              <Panel>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
                  <SubHead>Spending by week</SubHead>
                  <span style={{ fontSize: 12, color: 'var(--vy-ink-3)' }}>hover a bar</span>
                </div>
                <VyBars data={[
                  { label: 'W1', value: 280, note: 'on budget' }, { label: 'W2', value: 410, note: '12% over', color: 'var(--vy-amber-b)' },
                  { label: 'W3', value: 220 }, { label: 'W4', value: 340 }, { label: 'W5', value: 190 }, { label: 'W6', value: 300 },
                ]} />
              </Panel>
              <Panel style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <SubHead>Net worth trend</SubHead>
                  <VyLine points={[20, 22, 21, 25, 24, 28, 27, 31, 33]} height={90} color="var(--vy-good)" />
                </div>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <VyRing value={0.68} size={104} color="var(--vy-good)" label="of goal" />
                  <div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--vy-heading)', marginBottom: 4 }}>Emergency fund</div>
                    <div style={{ fontSize: 13, color: 'var(--vy-ink-2)', lineHeight: 1.5 }}><b data-num>$6,800</b> of <span data-num>$10,000</span></div>
                  </div>
                </div>
              </Panel>
            </div>
          </Section>

          {/* MOTION */}
          <Section id="motion" kicker="Components · 05" title="Delight is in the details" desc="Micro-interactions are the hook: numbers tally up, goals celebrate, streaks build habit. Smooth, not showy — and always respectful of reduced-motion.">
            <CelebrateDemo />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
              <Panel>
                <SubHead>Achievements — earned, not given</SubHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <VyBadge icon="spark" title="Budget Detective" sub="Caught 3 spending spikes" color="var(--vy-fore)" />
                  <VyBadge icon="bolt" title="Savings Guru" sub="6 months of consistent saving" color="var(--vy-good)" />
                  <VyBadge icon="check" title="Debt Slayer" sub="Locked · pay off one card" color="var(--vy-ink-3)" earned={false} />
                </div>
              </Panel>
              <Panel>
                <SubHead>Easing & duration</SubHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[['Micro', '140ms', 'standard', 'var(--vy-blue-b)'], ['Standard', '300ms', 'standard', 'var(--vy-good)'], ['Elaborate', '620ms', 'spring', 'var(--vy-fore)']].map(([n, d, e, c]) => (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0' }}>
                      <div style={{ width: 96, fontSize: 13, fontWeight: 600, color: 'var(--vy-ink-2)' }}>{n}</div>
                      <div data-num style={{ width: 60, fontSize: 12.5, color: 'var(--vy-ink-3)' }}>{d}</div>
                      <div style={{ fontFamily: 'var(--vy-mono)', fontSize: 11, color: c }}>{e === 'spring' ? 'spring' : 'ease'}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </Section>

          <footer style={{ borderTop: '1px solid var(--vy-line)', paddingTop: 'var(--vy-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <Logo size={22} />
            <span className="vy-cap">Vyact · Neumorphic Fluid · Canonical v1.0</span>
          </footer>
        </main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakToggle label="Dark mode" value={dark} onChange={(v) => setTweak('dark', v)} />
        <TweakRadio label="Headings" value={headFont} options={['Outfit', 'Inter Tight']} onChange={(v) => setTweak('headFont', v)} />
      </TweaksPanel>
    </div>
  );
}

function FontChip({ family, name, role, sample }) {
  return (
    <VyCard hover={false} style={{ borderRadius: 'var(--vy-r-3)' }}>
      <div style={{ fontFamily: family, fontSize: 54, fontWeight: 600, lineHeight: 1, marginBottom: 14, color: 'var(--vy-ink)' }}>{sample}</div>
      <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'var(--vy-heading)' }}>{name}</div>
      <div style={{ fontSize: 12, color: 'var(--vy-ink-3)' }}>{role}</div>
    </VyCard>
  );
}
function ElevTile({ shadow, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 96, height: 96, borderRadius: 'var(--vy-r-3)', background: 'var(--vy-canvas)', boxShadow: shadow, marginBottom: 10 }} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--vy-ink-2)' }}>{label}</div>
    </div>
  );
}
function StateCol({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="vy-cap" style={{ marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function CelebrateDemo() {
  const [fire, setFire] = uS(0);
  const [done, setDone] = uS(false);
  return (
    <Panel style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--vy-ambient)', opacity: done ? 1 : 0, transition: 'opacity .5s' }} />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 28, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <VyRing value={done ? 1 : 0.72} size={130} color={done ? 'var(--vy-good)' : 'var(--vy-fore)'} label="of goal" trigger={fire} />
          <VyConfetti fire={fire} />
        </div>
        <div>
          <SubHead>Number ticker + goal celebration</SubHead>
          <VyNumber value={done ? 10000 : 7200} size={38} trigger={fire} />
          <div style={{ fontSize: 13.5, color: 'var(--vy-ink-2)', marginTop: 6 }}>Vacation fund {done ? '· goal reached 🎉' : '· nearly there'}</div>
        </div>
        <VyButton variant="primary" icon="bolt" onClick={() => { setFire((x) => x + 1); setDone(true); setTimeout(() => setDone(false), 4200); }}>Celebrate</VyButton>
      </div>
    </Panel>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
