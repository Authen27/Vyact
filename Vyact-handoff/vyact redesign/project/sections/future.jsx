// FinFlow — 06 · Future Architecture
// Visualizes the platform-architecture deck as a design artifact:
// 9 layers, 4 horizons, skill taxonomy, tier matrix, conversational anatomy,
// MCP tool surface, NorthStar metric.

const Future = {};

/* ─── shared atoms ───────────────────────────────────────────────── */

const Rule = ({ tone = 'var(--ff-line-2)' }) => (
  <div style={{ height: 1, background: tone }} />
);

const TagDot = ({ color }) => (
  <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'inline-block' }} />
);

const layerData = [
  { n: '01', name: 'Engagement',     blurb: 'Stickiness · multi-user · streaks · family loops',                tone: 'var(--ff-plum)',     tint: 'var(--ff-plum-tint)',  horizon: 'H3' },
  { n: '02', name: 'Conversational', blurb: 'Natural-language assistant — the new primary interface',           tone: 'var(--ff-coral)',    tint: 'var(--ff-coral-tint)', horizon: 'H1' },
  { n: '03', name: 'Experiments',    blurb: 'A/B + multivariate — quant, qual & hybrid hypotheses',             tone: 'var(--ff-honey)',    tint: 'var(--ff-honey-tint)', horizon: 'H2' },
  { n: '04', name: 'Analytics',      blurb: 'Decision intel — for the user AND for the business',              tone: 'var(--ff-denim)',    tint: 'var(--ff-denim-tint)', horizon: 'H2' },
  { n: '05', name: 'Business',       blurb: 'Entitlements · subscriptions · metering · skill-gating',          tone: 'var(--ff-olive)',    tint: 'var(--ff-olive-tint)', horizon: 'H2' },
  { n: '06', name: 'AI / Skills',    blurb: 'Intent router · isolated skill modules · LLM proxy',              tone: 'var(--ff-coral-deep)', tint: 'var(--ff-coral-deep-tint)', horizon: 'H1' },
  { n: '07', name: 'Integration',    blurb: 'Open banking · EdTech · OCR — hub-and-spoke, swappable',          tone: 'var(--ff-sage)',     tint: 'var(--ff-sage-tint)',  horizon: 'H2' },
  { n: '08', name: 'Data',           blurb: 'PostgreSQL: ledger + JSONB + pgvector + RLS',                     tone: 'var(--ff-ink-2)',    tint: 'var(--ff-canvas-2)',   horizon: 'H1' },
  { n: '09', name: 'Security',       blurb: 'Encryption · DR · compliance — the container, not a feature',    tone: 'var(--ff-ink)',      tint: 'var(--ff-canvas-2)',   horizon: 'H1' },
];

const horizonData = [
  { id: 'H1', win: '0–4 mo',   name: 'Conversational MVP',  layers: ['02','06','08','09'], color: 'var(--ff-coral)',
    items: ['Cloud foundation (Postgres + RLS)', 'Conversational logging', 'Type A · Lookups (Text-to-SQL)', 'Type B · Diagnostics (anomaly + leak)'] },
  { id: 'H2', win: '4–9 mo',   name: 'Business Engine',     layers: ['03','04','05','07'], color: 'var(--ff-honey)',
    items: ['Tiered skills · entitlement gating', "Predictive 'what-if' simulation", 'A/B + analytics layer live', 'Open-banking spokes'] },
  { id: 'H3', win: '9–16 mo',  name: 'Engagement Flywheel', layers: ['01'],               color: 'var(--ff-plum)',
    items: ['Finflow Kids · youth profiles', 'Personalisation & habit loops', 'Multi-user household depth', 'EdTech channel opens'] },
  { id: 'H4', win: '16 mo +',  name: 'Open Platform',       layers: [],                   color: 'var(--ff-denim)',
    items: ['MCP tools — agent handshakes', 'SOC2 Type II posture', 'Cross-app financial capability', 'Proactive assistant'] },
];

/* ─── 01 · LAYER STACK ──────────────────────────────────────────── */

Future.Layers = () => (
  <div className="ff" style={{ padding: 40, background: 'var(--ff-canvas)', height: '100%', overflow: 'hidden' }}>
    <FF.PageHead
      section="06 · Future Architecture"
      title="Nine layers, one platform."
      lede="Read top to bottom: what the user touches, down to what keeps it alive. Each layer has a clear contract with its neighbours — change one without breaking the rest. Built across four horizons, never at once."
      meta={<>Source · v7+ Architecture<br/>Status · target state</>}
    />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {layerData.map((l, i) => (
          <div key={l.n} style={{
            display: 'grid', gridTemplateColumns: '48px 1fr 80px 56px', gap: 18, alignItems: 'center',
            background: 'var(--ff-surface)', border: '1px solid var(--ff-line)',
            borderLeft: `4px solid ${l.tone}`,
            borderRadius: 'var(--ff-r-3)',
            padding: '14px 18px',
          }}>
            <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)', letterSpacing: '0.12em' }}>{l.n}</FF.Mono>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{l.name} Layer</div>
              <div style={{ fontSize: 12, color: 'var(--ff-ink-2)', marginTop: 2 }}>{l.blurb}</div>
            </div>
            <FF.Badge tone={l.horizon === 'H1' ? 'coral' : l.horizon === 'H2' ? 'honey' : l.horizon === 'H3' ? 'plum' : 'denim'}>{l.horizon}</FF.Badge>
            <div style={{ height: 6, background: l.tint, borderRadius: 3, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${100 - i*8}%`, background: l.tone, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FF.Card style={{ background: 'var(--ff-shell)', borderColor: 'transparent', color: 'var(--ff-ink-on-shell)' }}>
          <FF.Caption style={{ color: 'rgba(232,222,207,0.55)', marginBottom: 10 }}>Principle 02</FF.Caption>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 22, lineHeight: 1.3, fontStyle: 'italic', color: 'var(--ff-canvas)' }}>
            The LLM phrases.<br/>Services compute.
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: 'rgba(232,222,207,0.65)', lineHeight: 1.5 }}>
            Deterministic microservices own every number. The model never invents a balance.
          </p>
        </FF.Card>
        <FF.Card>
          <FF.Caption style={{ marginBottom: 10 }}>One request · traced</FF.Caption>
          <div style={{ fontSize: 12, fontFamily: 'var(--ff-serif)', fontStyle: 'italic', color: 'var(--ff-ink)', lineHeight: 1.4 }}>
            "Can I afford a £1,200 flight next week?"
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['02', 'parse intent'],
              ['05', 'check entitlement'],
              ['06', 'route to Simulation skill'],
              ['08', 'fetch ground truth'],
              ['06', 'compute deterministically'],
              ['04', 'log & learn'],
            ].map(([n, step], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
                <FF.Mono style={{ color: 'var(--ff-coral)', fontSize: 10 }}>{n}</FF.Mono>
                <span style={{ flex: 1, color: 'var(--ff-ink-2)' }}>{step}</span>
                <FF.Icon name="arrowR" size={12} stroke={1.5} style={{ color: 'var(--ff-ink-4)' }} />
              </div>
            ))}
          </div>
        </FF.Card>
      </div>
    </div>
  </div>
);

/* ─── 02 · HORIZON ROADMAP ──────────────────────────────────────── */

Future.Horizons = () => (
  <div className="ff" style={{ padding: 40, background: 'var(--ff-canvas)', height: '100%' }}>
    <FF.PageHead
      section="06 · Future Architecture"
      title="Four horizons. Layers in order."
      lede="Each horizon adds depth before width. Never start the next until the prior one has shipped and shown signal. Every horizon is shippable and valuable on its own."
      meta="Span · 24 months +"
    />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {horizonData.map((h, i) => (
        <div key={h.id} style={{
          background: 'var(--ff-surface)',
          border: '1px solid var(--ff-line)',
          borderRadius: 'var(--ff-r-3)',
          padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: h.color }} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <FF.Serif style={{ fontSize: 40, color: h.color, lineHeight: 1 }}>{h.id}</FF.Serif>
            <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-3)', letterSpacing: '0.12em' }}>{h.win}</FF.Mono>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{h.name}</div>
          <Rule />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {h.items.map((t, j) => (
              <div key={j} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--ff-ink-2)', lineHeight: 1.4 }}>
                <span style={{ color: h.color, fontFamily: 'var(--ff-mono)', fontSize: 10 }}>—</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          {h.layers.length > 0 && (
            <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--ff-line)' }}>
              <FF.Caption style={{ marginBottom: 8, fontSize: 9 }}>Builds layers</FF.Caption>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {h.layers.map(n => (
                  <span key={n} style={{
                    width: 26, height: 22, borderRadius: 4,
                    background: 'var(--ff-canvas-2)',
                    fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--ff-ink-2)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>

    <div style={{ marginTop: 28, padding: 24, background: 'var(--ff-surface)', border: '1px solid var(--ff-line)', borderRadius: 'var(--ff-r-3)' }}>
      <FF.Caption style={{ marginBottom: 14 }}>The arc · short to long term</FF.Caption>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {[
          ['6 mo',  'A finance app you talk to',     'Conversational MVP live. SMB beta. The chore is measurably dying.'],
          ['12 mo', 'A business with a model',       'Tiered skills, predictive CFO. Paying users, clean unit economics.'],
          ['18 mo', 'A platform with a flywheel',    'Finflow Kids brings the household in. EdTech channel opens.'],
          ['24 mo', 'An open financial capability',  'MCP surface live. Other agents call FinFlow. Infrastructure.'],
        ].map(([t, h, b]) => (
          <div key={t}>
            <FF.Mono style={{ fontSize: 10, color: 'var(--ff-coral)', letterSpacing: '0.12em' }}>{t}</FF.Mono>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, fontFamily: 'var(--ff-serif)', fontStyle: 'italic' }}>{h}</div>
            <p style={{ marginTop: 6, fontSize: 11, color: 'var(--ff-ink-2)', lineHeight: 1.5 }}>{b}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─── 03 · SKILL TAXONOMY ───────────────────────────────────────── */

const skillTypes = [
  { type: 'A', name: 'Descriptive', q: '"How much on Uber last week?"',          engine: 'Text-to-SQL',                        cost: '~$0',     tier: 'Freemium',  tone: 'var(--ff-sage)' },
  { type: 'B', name: 'Diagnostic',  q: '"Why am I low on cash? I haven\'t shopped."', engine: 'Time-series + anomaly engine',        cost: '$',       tier: 'Premium',   tone: 'var(--ff-honey)' },
  { type: 'C', name: 'Predictive',  q: '"Can I afford this flight?"',            engine: 'Deterministic simulation service',   cost: '$$',      tier: 'Pro',       tone: 'var(--ff-denim)' },
  { type: 'D', name: 'Prescriptive', q: '"I need to save £500 — where do I cut?"', engine: 'Agentic reasoning + LLM',           cost: '$$$',     tier: 'Business',  tone: 'var(--ff-coral)' },
];

Future.Skills = () => (
  <div className="ff" style={{ padding: 40, background: 'var(--ff-canvas)', height: '100%' }}>
    <FF.PageHead
      section="06 · Future Architecture"
      title="Four kinds of question. One router."
      lede="People don't want to maintain ledgers — they want answers about their life. The assistant is the interface; the grid becomes the fallback. Skills are isolated, plug-and-play, and toggle on by subscription tier."
      meta="Layer 06 · AI / Skills"
    />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {skillTypes.map(s => (
        <div key={s.type} style={{
          background: 'var(--ff-surface)', border: '1px solid var(--ff-line)',
          borderRadius: 'var(--ff-r-3)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 320,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <FF.Serif style={{ fontSize: 56, color: s.tone, lineHeight: 0.9 }}>{s.type}</FF.Serif>
            <FF.Badge tone="neutral">Type {s.type}</FF.Badge>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{s.name}</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--ff-serif)', fontStyle: 'italic', color: 'var(--ff-ink-2)', lineHeight: 1.4 }}>
              {s.q}
            </div>
          </div>
          <Rule />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <FF.Caption style={{ fontSize: 9, marginBottom: 4 }}>Engine</FF.Caption>
              <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink)' }}>{s.engine}</FF.Mono>
            </div>
            <div style={{ display: 'flex', gap: 18 }}>
              <div>
                <FF.Caption style={{ fontSize: 9, marginBottom: 4 }}>Cost</FF.Caption>
                <FF.Mono style={{ fontSize: 12, color: s.tone, fontWeight: 600 }}>{s.cost}</FF.Mono>
              </div>
              <div>
                <FF.Caption style={{ fontSize: 9, marginBottom: 4 }}>Tier</FF.Caption>
                <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink)' }}>{s.tier}</FF.Mono>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* router diagram */}
    <div style={{ marginTop: 28, padding: 24, background: 'var(--ff-surface)', border: '1px solid var(--ff-line)', borderRadius: 'var(--ff-r-3)' }}>
      <FF.Caption style={{ marginBottom: 16 }}>Intent router + entitlement check</FF.Caption>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'center' }}>
        <div style={{
          background: 'var(--ff-canvas-2)', borderRadius: 'var(--ff-r-3)',
          padding: 18, textAlign: 'center', border: '1px dashed var(--ff-line-2)',
        }}>
          <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-3)', letterSpacing: '0.12em' }}>USER QUERY</FF.Mono>
          <div style={{ marginTop: 8, fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 13, lineHeight: 1.4 }}>
            "Spent 45 on fuel at Shell."
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['semantic router', 'cheap prompts skip the expensive LLM entirely', 'var(--ff-coral)'],
            ['entitlement check', 'is this skill in the user\'s tier?', 'var(--ff-olive)'],
            ['skill dispatch', 'isolated module — a bug in Forecasting can\'t crash Logging', 'var(--ff-denim)'],
            ['LiteLLM proxy', 'swap models via config, no rewrite', 'var(--ff-plum)'],
          ].map(([n, b, c]) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '12px 160px 1fr', gap: 12, alignItems: 'center' }}>
              <TagDot color={c} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>{n}</div>
              <div style={{ fontSize: 11, color: 'var(--ff-ink-2)' }}>{b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ─── 04 · TIER × SKILL MATRIX ──────────────────────────────────── */

const tiers = [
  { id: 'Freemium', price: '£0',      who: 'Casual trackers',     skills: ['A'],            trigger: '30-query/mo cap',         tone: 'var(--ff-canvas-2)', fg: 'var(--ff-ink)' },
  { id: 'Premium',  price: '£6–9',    who: 'Active budgeters',    skills: ['A','B'],        trigger: 'wants to know WHY',       tone: 'var(--ff-honey-tint)', fg: 'var(--ff-ink)' },
  { id: 'Pro',      price: '£12–15',  who: 'Families & couples',  skills: ['A','B','C'],    trigger: '2nd household member',    tone: 'var(--ff-coral-tint)', fg: 'var(--ff-coral-deep)' },
  { id: 'Business', price: '£25–40',  who: 'Founders, freelancers', skills: ['A','B','C','D'], trigger: 'needs a what-if',       tone: 'var(--ff-ink)', fg: '#fff' },
];

Future.Tiers = () => (
  <div className="ff" style={{ padding: 40, background: 'var(--ff-canvas)', height: '100%' }}>
    <FF.PageHead
      section="06 · Future Architecture"
      title="Skills map to price."
      lede="A user upgrades not because we ask, but because they hit a wall the next tier removes. High-compute skills never sit in free — token cost would sink the model. Price follows compute."
      meta="Layer 05 · Business"
    />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {tiers.map(t => (
        <div key={t.id} style={{
          background: t.tone, color: t.fg,
          border: '1px solid var(--ff-line)',
          borderRadius: 'var(--ff-r-3)', padding: 22,
          display: 'flex', flexDirection: 'column', gap: 14, minHeight: 380,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>{t.id}</div>
            <FF.Serif style={{ fontSize: 38, lineHeight: 1, marginTop: 6 }}>{t.price}</FF.Serif>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{t.who}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['A','B','C','D'].map(k => {
              const on = t.skills.includes(k);
              return (
                <div key={k} style={{
                  width: 36, height: 44, borderRadius: 6,
                  background: on ? (t.id === 'Business' ? 'rgba(232,222,207,0.18)' : 'rgba(42,37,34,0.08)') : 'transparent',
                  border: `1px ${on ? 'solid' : 'dashed'} ${on ? (t.id === 'Business' ? 'rgba(232,222,207,0.3)' : 'rgba(42,37,34,0.18)') : 'rgba(42,37,34,0.18)'}`,
                  display: 'grid', placeItems: 'center',
                  opacity: on ? 1 : 0.35,
                }}>
                  <FF.Mono style={{ fontSize: 14, fontWeight: 600 }}>{k}</FF.Mono>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${t.id === 'Business' ? 'rgba(232,222,207,0.15)' : 'rgba(42,37,34,0.1)'}` }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 6 }}>Upgrade trigger</div>
            <div style={{ fontFamily: 'var(--ff-serif)', fontStyle: 'italic', fontSize: 14, lineHeight: 1.35 }}>{t.trigger}</div>
          </div>
        </div>
      ))}
    </div>

    <div style={{ marginTop: 24, padding: 18, background: 'var(--ff-surface)', borderRadius: 'var(--ff-r-3)', border: '1px solid var(--ff-line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {[
          ['Query caps',    'Logging is free; lookups metered'],
          ['Data velocity', 'Batch feeds free; real-time webhooks paid'],
          ['Receipt OCR',   'Vision-LLM cost gated to Pro / Business'],
        ].map(([t, b]) => (
          <div key={t}>
            <FF.Caption style={{ marginBottom: 6 }}>{t}</FF.Caption>
            <div style={{ fontSize: 12, color: 'var(--ff-ink-2)', lineHeight: 1.5 }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─── 05 · CONVERSATIONAL ANATOMY ──────────────────────────────── */

Future.Conversational = () => (
  <div className="ff" style={{ padding: 40, background: 'var(--ff-canvas)', height: '100%' }}>
    <FF.PageHead
      section="06 · Future Architecture"
      title="Chat-first, not chat-only."
      lede="Conversation earns its place where it removes friction — asking 'can I afford this?' beats clicking five screens. The ledger stays visible because trust in finance is visual. Hybrid is the design principle."
      meta="Layer 02 · Conversational"
    />

    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 24 }}>
      {/* anatomy mock */}
      <div style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-line)', borderRadius: 'var(--ff-r-3)', padding: 22, minHeight: 480, position: 'relative' }}>
        <FF.Caption style={{ marginBottom: 12 }}>Surface anatomy · ask-bar</FF.Caption>
        <div style={{ background: 'var(--ff-canvas)', border: '1px solid var(--ff-line)', borderRadius: 'var(--ff-r-4)', padding: 18 }}>
          {/* user bubble */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <div style={{
              background: 'var(--ff-ink)', color: 'var(--ff-canvas)',
              padding: '10px 14px', borderRadius: '14px 14px 4px 14px',
              fontSize: 13, maxWidth: '70%', lineHeight: 1.4,
            }}>Spent 45 on fuel at Shell on my business card.</div>
          </div>
          {/* parsed chips */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <FF.Badge tone="coral" dot>Amount · £45.00</FF.Badge>
            <FF.Badge tone="sage" dot>Shell · Oil & Gas</FF.Badge>
            <FF.Badge tone="denim" dot>Business Card</FF.Badge>
            <FF.Badge tone="honey" dot>Tax-deductible</FF.Badge>
          </div>
          {/* pip response */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <FF.Pip size={28} mood="happy" />
            <div style={{
              background: 'var(--ff-coral-tint)', padding: '10px 14px',
              borderRadius: '4px 14px 14px 14px',
              fontSize: 13, lineHeight: 1.5, color: 'var(--ff-ink)', maxWidth: '85%',
              fontFamily: 'var(--ff-serif)', fontStyle: 'italic',
            }}>
              Logged. That's your 4th fuel charge this month — running 18% over the usual £140.
              <div style={{ marginTop: 8, display: 'flex', gap: 6, fontStyle: 'normal', fontFamily: 'var(--ff-sans)' }}>
                <span style={{ fontSize: 11, color: 'var(--ff-coral-deep)', textDecoration: 'underline' }}>see breakdown</span>
                <span style={{ fontSize: 11, color: 'var(--ff-ink-3)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--ff-coral-deep)', textDecoration: 'underline' }}>set a limit</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--ff-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FF.Icon name="sparkle" size={14} stroke={1.5} style={{ color: 'var(--ff-coral)' }} />
            <FF.Mono style={{ fontSize: 11, color: 'var(--ff-ink-3)', flex: 1 }}>ask anything · or tap a chip above</FF.Mono>
            <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-4)' }}>⌘K</FF.Mono>
          </div>
        </div>

        {/* annotations */}
        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            ['Entity chips', 'parsed deterministically, editable before commit'],
            ['Pip voice',    'serif italic for assistant; mono for system'],
            ['Inline actions', 'links to traditional UI, not deeper chat'],
            ['Ground truth', 'numbers come from services — never the LLM'],
          ].map(([t, b]) => (
            <div key={t} style={{ borderLeft: '2px solid var(--ff-coral)', paddingLeft: 10 }}>
              <FF.Mono style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--ff-ink-3)', textTransform: 'uppercase' }}>{t}</FF.Mono>
              <div style={{ fontSize: 12, color: 'var(--ff-ink-2)', marginTop: 3, lineHeight: 1.45 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* model comparison */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FF.Caption>Three models · we chose the middle one</FF.Caption>
        {[
          { name: 'Chat-Only',  tag: 'NOT NOW',   note: 'Bold. Users distrust no visible ledger.', tone: 'var(--ff-ink-3)' },
          { name: 'Hybrid',     tag: 'RECOMMENDED', note: 'Conversational where it delights; ledger where it reassures.', tone: 'var(--ff-coral)' },
          { name: 'Assist-Only', tag: 'TOO TIMID', note: 'A chatbot bolt-on. Doesn\'t kill the chore.', tone: 'var(--ff-ink-3)' },
        ].map(m => (
          <div key={m.name} style={{
            background: m.tag === 'RECOMMENDED' ? 'var(--ff-coral-tint)' : 'var(--ff-surface)',
            border: `1px solid ${m.tag === 'RECOMMENDED' ? 'var(--ff-coral-soft)' : 'var(--ff-line)'}`,
            borderRadius: 'var(--ff-r-3)', padding: 16,
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{m.name}</div>
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--ff-ink-2)', lineHeight: 1.45 }}>{m.note}</p>
            </div>
            <FF.Badge tone={m.tag === 'RECOMMENDED' ? 'coral' : 'neutral'} soft={m.tag !== 'RECOMMENDED'}>{m.tag}</FF.Badge>
          </div>
        ))}

        <FF.Card style={{ background: 'var(--ff-shell)', borderColor: 'transparent', color: 'var(--ff-canvas)', marginTop: 6 }}>
          <FF.Caption style={{ color: 'rgba(232,222,207,0.55)', marginBottom: 10 }}>The principle</FF.Caption>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 18, fontStyle: 'italic', lineHeight: 1.4 }}>
            Conversation earns its place where it removes friction. The ledger stays — because trust in finance is visual.
          </div>
        </FF.Card>
      </div>
    </div>
  </div>
);

/* ─── 06 · MCP TOOL SURFACE ─────────────────────────────────────── */

const mcpTools = [
  { name: 'get_financial_summary',    sig: '(profile_id) → JSON',                   blurb: 'Read-only aggregate snapshot' },
  { name: 'run_affordability_check',  sig: '(amount, timeframe) → decision',        blurb: '"Can I afford X" as a callable tool' },
  { name: 'log_transaction',          sig: '(nl_string | structured) → txn_id',     blurb: 'Conversational entry from any agent' },
  { name: 'get_cash_runway',          sig: '(profile_id) → months · projection',    blurb: 'Deterministic runway projection' },
  { name: 'query_spend_by_category',  sig: '(category, range) → totals',            blurb: 'Scoped, entitlement-checked lookup' },
];

Future.MCP = () => (
  <div className="ff" style={{ padding: 40, background: 'var(--ff-canvas)', height: '100%' }}>
    <FF.PageHead
      section="06 · Future Architecture"
      title="An open surface for agents."
      lede="At Horizon 4, FinFlow exposes itself over the Model Context Protocol — turning the platform into a tool that external AI agents can safely invoke, with entitlements intact. Design the tool contracts now; expose them when security is hardened."
      meta="Horizon 4 · v9 +"
    />

    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FF.Caption style={{ marginBottom: 4 }}>Tool contracts · exposed as MCP</FF.Caption>
        {mcpTools.map(t => (
          <div key={t.name} style={{
            background: 'var(--ff-surface)', border: '1px solid var(--ff-line)',
            borderRadius: 'var(--ff-r-3)', padding: '14px 18px',
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center',
          }}>
            <div>
              <FF.Mono style={{ fontSize: 13, color: 'var(--ff-ink)', fontWeight: 600 }}>{t.name}</FF.Mono>
              <div style={{ fontSize: 11, color: 'var(--ff-ink-2)', marginTop: 4 }}>{t.blurb}</div>
            </div>
            <FF.Mono style={{ fontSize: 10, color: 'var(--ff-ink-3)' }}>{t.sig}</FF.Mono>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FF.Caption>Agent handshake · use cases</FF.Caption>
        {[
          ['Travel agent', 'checks affordability before it offers a trip', 'globe'],
          ['General assistant', 'logs an expense the user mentioned in passing', 'sparkle'],
          ['Tax-prep app', 'pulls a categorised, consented year-end summary', 'shield'],
          ['EdTech app', "reads goal progress to tailor a child's lesson", 'flag'],
        ].map(([n, b, ic]) => (
          <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--ff-r-2)', background: 'var(--ff-surface)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--ff-coral-tint)', display: 'grid', placeItems: 'center', color: 'var(--ff-coral-deep)' }}>
              <FF.Icon name={ic} size={16} stroke={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{n}</div>
              <div style={{ fontSize: 11, color: 'var(--ff-ink-2)' }}>{b}</div>
            </div>
            <FF.Icon name="arrowR" size={14} stroke={1.5} style={{ color: 'var(--ff-ink-4)' }} />
          </div>
        ))}

        <div style={{ background: 'var(--ff-canvas-2)', borderRadius: 'var(--ff-r-3)', padding: 16, marginTop: 6, border: '1px dashed var(--ff-line-2)' }}>
          <FF.Caption style={{ marginBottom: 6 }}>Honest caveat</FF.Caption>
          <div style={{ fontSize: 12, fontStyle: 'italic', fontFamily: 'var(--ff-serif)', lineHeight: 1.4, color: 'var(--ff-ink-2)' }}>
            MCP is the right long-term surface but a v9+ bet, not a v7 deliverable. It only becomes safe once entitlements, auth, and PII-stripping are hardened.
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── 07 · NORTHSTAR DASHBOARD ──────────────────────────────────── */

Future.NorthStar = () => (
  <div className="ff" style={{ padding: 40, background: 'var(--ff-canvas)', height: '100%' }}>
    <FF.PageHead
      section="06 · Future Architecture"
      title="Active Households per Week."
      lede="Every horizon is shippable on its own — but they all push the same metric. A household with 2+ members active in 7 days. The compounding insight: a single-user account has one reason to churn; a 4-member household has four reasons to stay."
      meta="NorthStar · AHpW"
    />

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
      {/* metric hero */}
      <div style={{
        background: 'var(--ff-shell)', color: 'var(--ff-canvas)',
        borderRadius: 'var(--ff-r-4)', padding: 32,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 420,
      }}>
        <div>
          <FF.Caption style={{ color: 'rgba(232,222,207,0.55)' }}>NorthStar metric</FF.Caption>
          <div style={{ marginTop: 18, fontFamily: 'var(--ff-serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ff-ink-on-shell-2)' }}>
            A household with
          </div>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 88, lineHeight: 0.95, fontWeight: 400, color: 'var(--ff-coral)' }}>
            2+
          </div>
          <div style={{ fontFamily: 'var(--ff-serif)', fontSize: 26, lineHeight: 1.2, fontStyle: 'italic', color: 'var(--ff-canvas)', maxWidth: '14ch' }}>
            members active in 7 days.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 28 }}>
          {[
            ['6 mo',  '~600',  'beta'],
            ['12 mo', '~8k',   'paid'],
            ['18 mo', '~40k',  'kids'],
            ['24 mo', '~120k', 'mcp'],
          ].map(([t, v, b]) => (
            <div key={t}>
              <FF.Mono style={{ fontSize: 9, color: 'rgba(232,222,207,0.55)', letterSpacing: '0.1em' }}>{t}</FF.Mono>
              <div style={{ marginTop: 4, fontFamily: 'var(--ff-serif)', fontSize: 22, color: 'var(--ff-canvas)' }}>{v}</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--ff-coral-soft)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* outcomes + feedback loops */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FF.Caption>Three outcomes that prove we're winning</FF.Caption>
        {[
          { t: 'The chore is dead',          b: 'Users log and query by talking. Manual grid entry drops below 30%.', i: 'sparkle' },
          { t: 'The household is in',        b: 'Average account has 2+ active members. A child profile makes it multi-generational.', i: 'heart' },
          { t: 'Value is metered',           b: 'Free users hit a real "aha", then upgrade. Skill usage maps cleanly to tier revenue.', i: 'card' },
        ].map(o => (
          <div key={o.t} style={{
            background: 'var(--ff-surface)', border: '1px solid var(--ff-line)',
            borderRadius: 'var(--ff-r-3)', padding: 18,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--ff-coral-tint)', display: 'grid', placeItems: 'center', color: 'var(--ff-coral-deep)', flexShrink: 0 }}>
              <FF.Icon name={o.i} size={20} stroke={1.5} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{o.t}</div>
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--ff-ink-2)', lineHeight: 1.5 }}>{o.b}</p>
            </div>
          </div>
        ))}

        <div style={{ background: 'var(--ff-surface)', border: '1px solid var(--ff-line)', borderRadius: 'var(--ff-r-3)', padding: 18 }}>
          <FF.Caption style={{ marginBottom: 12 }}>Feedback loops · three modes, one event stream</FF.Caption>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              ['Quantitative', 'A/B tests, funnels, retention curves',     'var(--ff-denim)'],
              ['Qualitative',  'micro-surveys, transcript review',          'var(--ff-plum)'],
              ['Hybrid',       'quant flag triggers a qual probe',          'var(--ff-coral)'],
            ].map(([n, b, c]) => (
              <div key={n} style={{ borderTop: `2px solid ${c}`, paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--ff-ink-2)', lineHeight: 1.4, marginTop: 4 }}>{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { Future });
