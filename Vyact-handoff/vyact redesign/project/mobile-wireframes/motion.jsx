// ─────────────────────────────────────────────────────────────
// FinFlow Motion Lab — replayable demos of every transition in the app.
// Each demo reads timing/easing from CSS custom properties on :root,
// which the Tweaks panel writes to. So tweaking "Master speed" reflows
// every animation across every screen, not just the lab.
// ─────────────────────────────────────────────────────────────

const MOTION = {};

// ── Spec card chrome (mono caption above each demo) ────────────
function Spec({ title, spec }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(42,37,34,0.10)' }}>
      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,37,34,0.55)' }}>
        {title}
      </div>
      <div style={{ marginTop: 3, fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-coral)' }}>{spec}</div>
    </div>
  );
}

// Replay key — caller bumps this on click; the demo's animations key off it
// so they restart cleanly. Returns [key, bump].
function useReplay() {
  const [k, setK] = React.useState(0);
  return [k, () => setK(x => x + 1)];
}

function ReplayBtn({ onClick, label = 'Replay' }) {
  return (
    <button onClick={onClick}
      style={{
        position: 'absolute', right: 14, bottom: 16, zIndex: 30,
        height: 32, padding: '0 14px',
        background: 'var(--ff-ink)', color: 'var(--ff-canvas)',
        border: 'none', borderRadius: 8,
        fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        cursor: 'pointer', boxShadow: '0 4px 12px rgba(42,37,34,0.18)',
      }}>
      ▷ {label}
    </button>
  );
}

// ── 01 · Pulse score reveal ────────────────────────────────────
MOTION.PulseReveal = function () {
  const [k, replay] = useReplay();
  const dur = 'calc(var(--motion-pulse-dur, 1400ms) * var(--motion-speed, 1))';
  const ease = 'var(--motion-ease, cubic-bezier(.2,.7,.2,1))';
  const target = 78;
  return (
    <WF.IPhone>
      <Spec title="Pulse score reveal" spec="0 → N · ring fills in sync · once per mount" />
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ff-coral)' }}>Family Pulse Score</div>
        {/* Ring */}
        <div key={k} style={{ position: 'relative', width: 160, height: 160 }}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(42,37,34,0.08)" strokeWidth="10"/>
            <circle cx="80" cy="80" r="72" fill="none" stroke="var(--ff-coral)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 72}
              strokeDashoffset={2 * Math.PI * 72}
              transform="rotate(-90 80 80)"
              style={{
                animation: `motion-ring-${k} ${dur} ${ease} forwards`,
              }}/>
          </svg>
          <style>{`
            @keyframes motion-ring-${k} {
              from { stroke-dashoffset: ${2 * Math.PI * 72}; }
              to   { stroke-dashoffset: ${2 * Math.PI * 72 * (1 - target / 100)}; }
            }
            @keyframes motion-num-${k} {
              from { --num: 0; }
              to   { --num: ${target}; }
            }
          `}</style>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <NumberTick to={target} k={k} size={44} />
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,37,34,0.55)' }}>Good</div>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.55)' }}>+4 vs last</div>
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

// ── Number ticker — increments via requestAnimationFrame ───────
function NumberTick({ to, k, size = 32, prefix = '' }) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const enabled = getComputedStyle(document.documentElement).getPropertyValue('--motion-ticker').trim();
    if (enabled === '0') { setN(to); return; }
    const speed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-speed')) || 1;
    const dur = 1400 * speed;
    let raf, start;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 2);
      setN(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [k, to]);
  return (
    <span style={{
      fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontWeight: 500,
      fontSize: size, color: 'var(--ff-ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
    }}>{prefix}{n.toLocaleString()}</span>
  );
}

// ── 02 · Number ticker (balance) ───────────────────────────────
MOTION.Ticker = function () {
  const [k, replay] = useReplay();
  return (
    <WF.IPhone>
      <Spec title="Number ticker" spec="rAF · ease-out · 1.4s · tabular nums stable" />
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,37,34,0.55)' }}>Net worth · USD</div>
        <NumberTick to={24108} k={k} size={56} prefix="$" />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(133,168,138,0.18)', borderRadius: 999, fontSize: 11, color: '#5C7A60', fontFamily: 'var(--ff-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: '#85A88A' }} />+$420 · 30d
        </div>
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

// ── 03 · Tab switch (cross-fade or slide) ──────────────────────
MOTION.TabSwitch = function () {
  const [k, replay] = useReplay();
  const [tab, setTab] = React.useState(0);
  React.useEffect(() => { setTab(0); const t = setTimeout(() => setTab(1), 600); return () => clearTimeout(t); }, [k]);

  const TABS = [
    { name: 'Home', body: (
      <>
        <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 30, marginTop: 18 }}>Hi, Naomi</div>
        <div style={{ marginTop: 14, height: 80, borderRadius: 14, background: 'rgba(226,109,92,0.12)' }} />
        <div style={{ marginTop: 10, height: 56, borderRadius: 12, background: 'rgba(42,37,34,0.06)' }} />
        <div style={{ marginTop: 10, height: 56, borderRadius: 12, background: 'rgba(42,37,34,0.06)' }} />
      </>
    )},
    { name: 'Activity', body: (
      <>
        <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 30, marginTop: 18 }}>Activity</div>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(42,37,34,0.08)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, width: '60%', borderRadius: 4, background: 'rgba(42,37,34,0.12)' }} />
              <div style={{ marginTop: 4, height: 6, width: '40%', borderRadius: 4, background: 'rgba(42,37,34,0.06)' }} />
            </div>
            <div style={{ height: 10, width: 50, borderRadius: 4, background: 'rgba(42,37,34,0.10)' }} />
          </div>
        ))}
      </>
    )},
  ];

  return (
    <WF.IPhone>
      <Spec title="Tab switch" spec="cross-fade 180ms · indicator slides + scales 0.85→1" />
      <div style={{ flex: 1, padding: '0 14px 14px', position: 'relative', overflow: 'hidden' }}>
        {TABS.map((t, i) => (
          <div key={i} style={{
            position: 'absolute', inset: '0 14px 14px',
            opacity: tab === i ? 1 : 0,
            transform: `var(--motion-tab-style, none)`,
            transition: `opacity calc(var(--motion-tab-dur, 180ms) * var(--motion-speed, 1)) var(--motion-ease, cubic-bezier(.2,.7,.2,1)), transform calc(var(--motion-tab-dur, 180ms) * var(--motion-speed, 1)) var(--motion-ease, cubic-bezier(.2,.7,.2,1))`,
            pointerEvents: tab === i ? 'auto' : 'none',
          }}>{t.body}</div>
        ))}
      </div>
      {/* Tab bar */}
      <div style={{
        height: 68, padding: '6px 12px 20px',
        borderTop: '0.5px solid rgba(42,37,34,0.16)',
        background: 'rgba(251,247,238,0.86)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        position: 'relative',
      }}>
        {TABS.concat([{ name: 'Plan' }, { name: 'You' }]).map((t, i) => (
          <button key={i} onClick={() => { if (i < 2) setTab(i); }}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: tab === i ? 'var(--ff-coral)' : 'rgba(42,37,34,0.55)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              cursor: 'pointer',
            }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6,
              border: `1.5px solid ${tab === i ? 'var(--ff-coral)' : 'rgba(42,37,34,0.55)'}`,
              background: tab === i ? 'rgba(226,109,92,0.12)' : 'transparent',
              transition: `all calc(var(--motion-tab-dur, 180ms) * var(--motion-speed, 1)) var(--motion-ease)`,
            }} />
            {t.name}
          </button>
        ))}
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

// ── 04 · Push (drill-in) ───────────────────────────────────────
MOTION.DrillIn = function () {
  const [k, replay] = useReplay();
  const [page, setPage] = React.useState(0);
  React.useEffect(() => { setPage(0); const t = setTimeout(() => setPage(1), 500); return () => clearTimeout(t); }, [k]);

  const Page = ({ title, kind }) => (
    <div style={{
      position: 'absolute', inset: 0, background: '#F2EDE2',
      padding: '14px 16px',
      transform: `translateX(${kind === 'detail' ? (page === 1 ? '0' : '100%') : (page === 1 ? '-30%' : '0')})`,
      opacity: kind === 'list' ? (page === 1 ? 0.4 : 1) : 1,
      transition: `transform calc(var(--motion-drill-dur, 240ms) * var(--motion-speed, 1)) var(--motion-ease, cubic-bezier(.2,.7,.2,1)), opacity calc(var(--motion-drill-dur, 240ms) * var(--motion-speed, 1)) var(--motion-ease)`,
      boxShadow: kind === 'detail' ? '-12px 0 24px rgba(42,37,34,0.10)' : 'none',
    }}>
      <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {kind === 'detail' ? (
          <span style={{ color: 'var(--ff-coral)', fontSize: 17 }}>‹ Back</span>
        ) : (
          <span style={{ width: 22 }} />
        )}
        <span style={{ width: 22 }} />
      </div>
      <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 28, fontWeight: 500, marginTop: 4 }}>{title}</div>

      {kind === 'list' ? (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Whole Foods · $127.40', 'Salary · +$4,200', 'Equinox · $185.00', 'Vanguard · $500.00'].map((r, i) => (
            <div key={i} style={{
              padding: '10px 12px', borderRadius: 12, background: 'rgba(251,247,238,0.95)',
              border: '0.5px solid rgba(42,37,34,0.10)',
              transform: page === 1 && i === 0 ? 'scale(0.97)' : 'scale(1)',
              background: page === 1 && i === 0 ? 'rgba(226,109,92,0.12)' : 'rgba(251,247,238,0.95)',
              transition: 'all 160ms ease-out',
              fontSize: 13, fontWeight: 500,
            }}>{r}</div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: 16, borderRadius: 14, background: 'rgba(251,247,238,0.95)', border: '0.5px solid rgba(42,37,34,0.10)' }}>
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,37,34,0.55)' }}>Apr 14 · Groceries</div>
            <div style={{ marginTop: 8, fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 34, fontWeight: 500 }}>−$127.40</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(42,37,34,0.7)' }}>Chase ··4291</div>
          </div>
          <div style={{ height: 56, borderRadius: 12, background: 'rgba(42,37,34,0.06)' }} />
          <div style={{ height: 56, borderRadius: 12, background: 'rgba(42,37,34,0.06)' }} />
        </div>
      )}
    </div>
  );

  return (
    <WF.IPhone>
      <Spec title="Push · drill-in" spec="slide-from-right · 240ms · spring · back fades to 40%" />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Page title="Activity" kind="list" />
        <Page title="Whole Foods" kind="detail" />
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

// ── 05 · Bottom sheet ──────────────────────────────────────────
MOTION.Sheet = function () {
  const [k, replay] = useReplay();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { setOpen(false); const t = setTimeout(() => setOpen(true), 400); return () => clearTimeout(t); }, [k]);

  return (
    <WF.IPhone>
      <Spec title="Bottom sheet" spec="slide-up + scrim fade · 220ms · drag-handle dismiss" />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '14px 14px 0' }}>
        <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 26, fontWeight: 500 }}>Activity</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0,1,2,3,4].map(i => <div key={i} style={{ height: 44, borderRadius: 10, background: 'rgba(42,37,34,0.06)' }} />)}
        </div>

        {/* Scrim */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(20,16,12,0.45)',
          opacity: open ? 1 : 0,
          transition: `opacity calc(var(--motion-sheet-dur, 220ms) * var(--motion-speed, 1)) var(--motion-ease)`,
        }} />

        {/* Sheet */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: '#FBF7EE',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: '10px 18px 24px',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform calc(var(--motion-sheet-dur, 220ms) * var(--motion-speed, 1)) var(--motion-ease, cubic-bezier(.2,.7,.2,1))`,
          boxShadow: '0 -8px 32px rgba(42,37,34,0.22)',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(42,37,34,0.18)', margin: '0 auto 14px' }} />
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,37,34,0.55)' }}>Filter transactions</div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Expense','Income','Transfer','Chase','Venmo','Recurring'].map((t, i) => (
              <span key={t} style={{
                padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                background: i === 0 ? 'rgba(226,109,92,0.18)' : 'rgba(42,37,34,0.06)',
                color: i === 0 ? '#C44536' : '#2A2522',
                border: `0.5px solid ${i === 0 ? 'rgba(196,69,54,0.3)' : 'rgba(42,37,34,0.12)'}`,
              }}>{t}</span>
            ))}
          </div>
          <button style={{
            marginTop: 14, width: '100%', height: 46, borderRadius: 12,
            background: 'var(--ff-coral)', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Apply (24)</button>
        </div>
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

// ── 06 · Toast drop-in ─────────────────────────────────────────
MOTION.Toast = function () {
  const [k, replay] = useReplay();
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    setShown(false);
    const t1 = setTimeout(() => setShown(true), 400);
    const t2 = setTimeout(() => setShown(false), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [k]);

  return (
    <WF.IPhone>
      <Spec title="Toast · save confirmation" spec="drop from top · 180ms · spring · auto-dismiss 3.2s" />
      <div style={{ flex: 1, position: 'relative', padding: '14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 26, fontWeight: 500 }}>Add transaction</div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 56, borderRadius: 12, background: 'rgba(42,37,34,0.06)' }} />
          <div style={{ height: 44, borderRadius: 12, background: 'rgba(42,37,34,0.06)' }} />
          <div style={{ height: 44, borderRadius: 12, background: 'rgba(42,37,34,0.06)' }} />
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          height: 46, borderRadius: 12, background: 'var(--ff-coral)', color: '#fff',
          border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Save transaction</button>

        {/* Toast */}
        <div style={{
          position: 'absolute',
          left: 14, right: 14,
          top: 'var(--motion-toast-top, 14px)',
          bottom: 'var(--motion-toast-bottom, auto)',
          padding: '12px 14px',
          background: 'var(--ff-ink)', color: '#F2EDE2',
          borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 13,
          boxShadow: '0 8px 24px rgba(42,37,34,0.22)',
          opacity: shown ? 1 : 0,
          transform: shown ? 'translateY(0)' : 'var(--motion-toast-hide, translateY(-16px))',
          transition: `opacity calc(var(--motion-toast-dur, 180ms) * var(--motion-speed, 1)) var(--motion-ease), transform calc(var(--motion-toast-dur, 180ms) * var(--motion-speed, 1)) var(--motion-spring, cubic-bezier(.5,1.4,.5,1))`,
          pointerEvents: shown ? 'auto' : 'none',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: '#85A88A' }} />
          <span style={{ flex: 1 }}>Saved · pulse +2</span>
          <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, opacity: 0.6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Undo</span>
        </div>
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

// ── 07 · Goal complete (bar fill + confetti) ───────────────────
MOTION.GoalComplete = function () {
  const [k, replay] = useReplay();
  const [phase, setPhase] = React.useState(0); // 0 idle, 1 filling, 2 burst
  React.useEffect(() => {
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [k]);

  return (
    <WF.IPhone>
      <Spec title="Goal complete" spec="bar fills · confetti burst · Pip mood→wow · 1.8s · one-shot" />
      <div style={{ flex: 1, padding: 14, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,37,34,0.55)' }}>Goal · Emergency fund</div>
        <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 32, fontWeight: 500 }}>$6,000 / $6,000</div>
        <div style={{ width: 240, height: 10, borderRadius: 5, background: 'rgba(42,37,34,0.10)', overflow: 'hidden' }}>
          <div style={{
            width: phase >= 1 ? '100%' : '62%',
            height: '100%',
            background: phase >= 2 ? '#6B7C53' : 'var(--ff-coral)',
            borderRadius: 5,
            transition: `width calc(900ms * var(--motion-speed, 1)) cubic-bezier(.2,.7,.2,1), background 300ms ease-out`,
          }} />
        </div>

        {/* Pip */}
        <div style={{
          marginTop: 6,
          transition: `transform 240ms var(--motion-ease)`,
          transform: phase >= 2 ? 'scale(1.18)' : 'scale(1)',
        }}>
          <WF.Pip size={64} mood={phase >= 2 ? 'wow' : 'happy'} />
        </div>
        <div style={{
          fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 18, color: '#6B7C53',
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 300ms cubic-bezier(.5,1.4,.5,1)',
        }}>You did it.</div>

        {/* Confetti */}
        {phase >= 2 && getComputedStyle(document.documentElement).getPropertyValue('--motion-confetti').trim() !== '0' &&
          [...Array(22)].map((_, i) => {
            const ang = (i / 22) * Math.PI * 2;
            const dist = 90 + (i % 3) * 30;
            const dx = Math.cos(ang) * dist;
            const dy = Math.sin(ang) * dist;
            const colors = ['#E26D5C','#85A88A','#F4D27A','#4A6FA5','#E8A87C'];
            return (
              <span key={`${k}-${i}`} style={{
                position: 'absolute',
                left: '50%', top: '52%',
                width: 6, height: 8, borderRadius: 1,
                background: colors[i % colors.length],
                transform: `translate(${dx}px, ${dy}px) rotate(${i * 40}deg)`,
                opacity: 0,
                animation: `motion-confetti-${k}-${i} calc(1100ms * var(--motion-speed, 1)) cubic-bezier(.2,.7,.2,1) forwards`,
              }} />
            );
          })
        }
        <style>{`
          ${[...Array(22)].map((_, i) => {
            const ang = (i / 22) * Math.PI * 2;
            const dist = 90 + (i % 3) * 30;
            const dx = Math.cos(ang) * dist;
            const dy = Math.sin(ang) * dist;
            return `
              @keyframes motion-confetti-${k}-${i} {
                0%   { transform: translate(0,0) rotate(0deg) scale(0.8); opacity: 0; }
                15%  { opacity: 1; }
                100% { transform: translate(${dx}px, ${dy + 50}px) rotate(${i * 80}deg) scale(1); opacity: 0; }
              }
            `;
          }).join('')}
        `}</style>
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

// ── 08 · Button press (scale + brighten) ───────────────────────
MOTION.ButtonPress = function () {
  const [k, replay] = useReplay();
  const [pressed, setPressed] = React.useState(false);
  React.useEffect(() => {
    setPressed(false);
    const t1 = setTimeout(() => setPressed(true), 500);
    const t2 = setTimeout(() => setPressed(false), 700);
    const t3 = setTimeout(() => setPressed(true), 1300);
    const t4 = setTimeout(() => setPressed(false), 1500);
    return () => [t1,t2,t3,t4].forEach(clearTimeout);
  }, [k]);

  return (
    <WF.IPhone>
      <Spec title="Button press" spec="scale(--press-scale) · 80ms in · 120ms out · coral brightens 4%" />
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 26 }}>
        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(42,37,34,0.55)' }}>Primary action</div>
        <button style={{
          width: 220, height: 50, borderRadius: 12,
          background: pressed ? '#C95C4D' : 'var(--ff-coral)',
          color: '#fff', border: 'none',
          fontSize: 14, fontWeight: 600,
          letterSpacing: '0.01em',
          transform: `scale(${pressed ? 'var(--motion-press-scale, 0.96)' : '1'})`,
          transition: `transform ${pressed ? '80ms' : '120ms'} cubic-bezier(.2,.7,.2,1), background ${pressed ? '80ms' : '120ms'} ease-out`,
          boxShadow: pressed ? '0 1px 3px rgba(0,0,0,0.15)' : '0 4px 14px rgba(226,109,92,0.32)',
          cursor: 'pointer',
        }}>+ Add transaction</button>

        <button style={{
          width: 220, height: 44, borderRadius: 12,
          background: 'transparent', color: '#2A2522',
          border: '1px solid rgba(42,37,34,0.18)',
          fontSize: 14, fontWeight: 500,
          transform: `scale(${pressed ? 'var(--motion-press-scale, 0.96)' : '1'})`,
          transition: `transform ${pressed ? '80ms' : '120ms'} cubic-bezier(.2,.7,.2,1)`,
          cursor: 'pointer',
        }}>Cancel</button>

        <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'rgba(42,37,34,0.45)', marginTop: 12 }}>Coral primary also brightens 4% on press</div>
      </div>
      <ReplayBtn onClick={replay} />
    </WF.IPhone>
  );
};

Object.assign(window, { MOTION });
