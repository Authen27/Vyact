/* global React, Phone, Btn, Mascot */
const { useState: useStateProto } = React;
const F = (usd, locale, currency, opts = {}) => window.fmt(usd, { locale, currency, ...opts });

// ════════════════════════════════════════════════════════════════
//   TAB 5 — CLICKABLE PROTOTYPE (mobile)
//   Six screens · locale + currency aware · debt & net worth wired
// ════════════════════════════════════════════════════════════════

const seg = (segment) => segment === "couple"
  ? { initials: "AM", name: "Alex", insight: "Date-night fund hit 60%. Nice." }
  : segment === "growing"
  ? { initials: "JM", name: "Jamie", insight: "Childcare's at 78% — paystub due Fri." }
  : { initials: "RP", name: "Rohan", insight: "Medical is 38% of spend — within plan." };

// ── Dashboard ─────────────────────────────────────────────────────
const ProtoDashboard = ({ go, segment, locale, currency }) => {
  const s = seg(segment);
  return (
    <div className="scr">
      <div className="scr-head">
        <span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--coral)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>{s.initials}</span>
        <div style={{ textAlign: "center" }}>
          <div className="scr-eyebrow">APR 2026 · {currency}</div>
          <div className="scr-title">Hi, {s.name}</div>
        </div>
        <span style={{ width: 22, height: 22, border: "1.5px solid var(--ink)", borderRadius: 6 }}/>
      </div>

      <div className="scr-card" style={{ textAlign: "center" }}>
        <div className="scr-eyebrow" style={{ color: "var(--coral)" }}>FAMILY PULSE SCORE</div>
        <div className="pulse-mini pulse-anim" style={{ "--p": 78, margin: "10px auto 6px" }}>
          <span className="pulse-num">78</span>
          <span className="pulse-lbl">Good</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-mid)" }}>Up 4 vs last month</div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <div className="scr-card" style={{ flex: 1, cursor: "pointer" }} onClick={() => go("networth")}>
          <div className="scr-eyebrow">NET WORTH</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1.1 }}>{F(28400, locale, currency, { abbrev: true })}</div>
          <div style={{ fontSize: 11, color: "var(--olive)" }}>↑ {F(840, locale, currency, { abbrev: true })}</div>
        </div>
        <div className="scr-card" style={{ flex: 1, cursor: "pointer" }} onClick={() => go("debt")}>
          <div className="scr-eyebrow">DEBT</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1.1 }}>{F(12350, locale, currency, { abbrev: true })}</div>
          <div style={{ fontSize: 11, color: "var(--coral)" }}>3 active · 2.4 yr</div>
        </div>
      </div>

      <div className="scr-card" style={{ borderLeft: "3px solid var(--coral)", background: "var(--coral-tint)" }}>
        <div style={{ fontSize: 12.5 }}>{s.insight}</div>
      </div>

      <div className="scr-card" onClick={() => go("budgets")} style={{ cursor: "pointer" }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Budgets</span>
          <span className="scr-eyebrow">3 ACTIVE →</span>
        </div>
        {[["Food", 84, "var(--honey)"], ["Transport", 42, "var(--coral)"], ["Shopping", 68, "var(--coral)"]].map(([n, p, c]) => (
          <div key={n} style={{ marginTop: 6 }}>
            <div className="row between" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}><span>{n}</span><span>{p}%</span></div>
            <div style={{ height: 4, background: "var(--paper-3)", borderRadius: 2, marginTop: 3 }}><div style={{ width: `${p}%`, height: "100%", background: c, borderRadius: 2 }}/></div>
          </div>
        ))}
      </div>

      <div className="scr-card" onClick={() => go("txnlist")} style={{ cursor: "pointer" }}>
        <div className="row between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Recent</span>
          <span className="scr-eyebrow">VIEW ALL →</span>
        </div>
        {[["🍔", "Whole Foods", "Apr 27", -84.20], ["💼", "Salary", "Apr 25", 3200], ["🎬", "Netflix", "Apr 24", -15.99]].map((r, i) => (
          <div key={i} className="txn-row">
            <div className="txn-ico">{r[0]}</div>
            <div className="txn-meta"><span className="t">{r[1]}</span><span className="s">{r[2]}</span></div>
            <div className={`txn-amt ${r[3] > 0 ? "in" : "out"}`}>{F(r[3], locale, currency, { sign: true })}</div>
          </div>
        ))}
      </div>

      <button onClick={() => go("addtxn")} style={{ position: "absolute", right: 14, bottom: 70, width: 48, height: 48, borderRadius: 999, background: "var(--coral)", color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(226,109,92,0.45)", fontSize: 22, fontWeight: 300, cursor: "pointer" }}>+</button>
    </div>
  );
};

// ── Add txn ───────────────────────────────────────────────────────
const ProtoAddTxn = ({ go, locale, currency }) => {
  const [amt, setAmt] = useStateProto("");
  const [desc, setDesc] = useStateProto("");
  const cat = /whole foods|grocery|trader/i.test(desc) ? { ico: "🍔", label: "Food" } : /uber|lyft|gas/i.test(desc) ? { ico: "🚗", label: "Transport" } : /netflix|spotify/i.test(desc) ? { ico: "🎬", label: "Entertainment" } : null;
  const sym = (window.CURRENCIES[currency] || window.CURRENCIES.USD).symbol;
  return (
    <div className="scr">
      <div className="scr-head">
        <span className="scr-back" onClick={() => go("dashboard")}>‹</span>
        <div className="scr-title">Add transaction</div>
        <span style={{ width: 22 }}/>
      </div>
      <div className="row" style={{ background: "var(--paper-2)", borderRadius: 8, padding: 3 }}>
        <div style={{ flex: 1, padding: "8px", textAlign: "center", background: "var(--coral-tint)", color: "var(--terracotta)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }}>EXPENSE</div>
        <div style={{ flex: 1, padding: "8px", textAlign: "center", color: "var(--ink-mid)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em" }}>INCOME</div>
      </div>
      <div className="scr-card">
        <div className="scr-eyebrow">AMOUNT · {currency}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-mid)" }}>{sym}</span>
          <input value={amt} onChange={e => setAmt(e.target.value)} placeholder="0" style={{ flex: 1, border: "none", outline: "none", fontFamily: "var(--font-display)", fontSize: 32, background: "transparent", color: "var(--ink)", minWidth: 0 }}/>
        </div>
      </div>
      <div className="scr-card">
        <div className="scr-eyebrow">DESCRIPTION</div>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was this for?" style={{ width: "100%", border: "none", outline: "none", fontFamily: "var(--font-ui)", fontSize: 16, background: "transparent", color: "var(--ink)", padding: "4px 0" }}/>
      </div>
      {cat && (
        <div className="scr-card" style={{ background: "var(--coral-tint)", borderColor: "var(--coral-soft)" }}>
          <div className="scr-eyebrow" style={{ color: "var(--terracotta)" }}>PIP SUGGESTS</div>
          <div className="row" style={{ marginTop: 6 }}>
            <div className="txn-ico" style={{ background: "#fff" }}>{cat.ico}</div>
            <span style={{ fontSize: 13 }}>Category: <b>{cat.label}</b></span>
          </div>
        </div>
      )}
      <div onClick={() => go("toast")} style={{ marginTop: "auto" }}><Btn>Save transaction</Btn></div>
    </div>
  );
};

const ProtoToast = ({ go }) => {
  React.useEffect(() => { const t = setTimeout(() => go("dashboard"), 1400); return () => clearTimeout(t); }, []);
  return (
    <div className="scr" style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <Mascot size={64} mood="happy"/>
        <div className="toast-demo" style={{ marginTop: 14 }}><span className="dot"/>Saved · pulse +2</div>
      </div>
    </div>
  );
};

// ── Budgets ──────────────────────────────────────────────────────
const ProtoBudgets = ({ go, locale, currency }) => (
  <div className="scr">
    <div className="scr-head"><span className="scr-back" onClick={() => go("dashboard")}>‹</span><div className="scr-title">Budgets</div><span style={{ width: 22 }}/></div>
    {[["🍔", "Food", 420, 500, "var(--honey)"], ["🚗", "Transport", 84, 200, "var(--coral)"], ["🛍️", "Shopping", 204, 300, "var(--coral)"], ["⚡", "Utilities", 118, 200, "var(--olive)"]].map(([i, n, s, l, c]) => (
      <div key={n} className="scr-card">
        <div className="row between"><span style={{ fontSize: 13, fontWeight: 600 }}>{i} {n}</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{F(s, locale, currency)} / {F(l, locale, currency)}</span></div>
        <div style={{ height: 5, background: "var(--paper-3)", borderRadius: 3, marginTop: 8 }}><div style={{ width: `${(s/l)*100}%`, height: "100%", background: c, borderRadius: 3 }}/></div>
      </div>
    ))}
    <Btn>+ Add budget</Btn>
  </div>
);

// ── Txn list ─────────────────────────────────────────────────────
const ProtoTxnList = ({ go, locale, currency }) => (
  <div className="scr">
    <div className="scr-head"><span className="scr-back" onClick={() => go("dashboard")}>‹</span><div className="scr-title">Transactions</div><span style={{ width: 22 }}/></div>
    <div className="scr-card">
      {[["🍔", "Whole Foods", "Food · Apr 27", -84.20], ["💼", "Salary", "Income · Apr 25", 3200], ["🎬", "Netflix", "Entertainment · Apr 24", -15.99], ["🚗", "Uber", "Transport · Apr 23", -12.40], ["🍔", "Trader Joe's", "Food · Apr 22", -62.10], ["⚡", "ConEd", "Utilities · Apr 21", -94]].map((r, i) => (
        <div key={i} className="txn-row">
          <div className="txn-ico">{r[0]}</div>
          <div className="txn-meta"><span className="t">{r[1]}</span><span className="s">{r[2]}</span></div>
          <div className={`txn-amt ${r[3] > 0 ? "in" : "out"}`}>{F(r[3], locale, currency, { sign: true })}</div>
        </div>
      ))}
    </div>
  </div>
);

// ── Net Worth (balance sheet) ─────────────────────────────────────
const ProtoNetWorth = ({ go, locale, currency }) => {
  // amounts in USD base — fmt converts.
  const assets = [
    ["🏦", "Checking", 4820],
    ["💰", "Savings · HYSA", 12600],
    ["📈", "Brokerage", 18400],
    ["🪙", "Roth IRA", 4800],
    ["🏠", "Home equity", 0], // illustrative
  ];
  const liabilities = [
    ["💳", "Credit card", -3850],
    ["🎓", "Student loan", -6500],
    ["🚗", "Auto loan", -2000],
  ];
  const totalA = assets.reduce((a, [, , v]) => a + v, 0);
  const totalL = liabilities.reduce((a, [, , v]) => a + v, 0);
  const net = totalA + totalL;
  const ratio = Math.round((Math.abs(totalL) / totalA) * 100);

  return (
    <div className="scr">
      <div className="scr-head">
        <span className="scr-back" onClick={() => go("dashboard")}>‹</span>
        <div className="scr-title">Net worth</div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)" }}>{currency}</span>
      </div>

      <div className="scr-card" style={{ textAlign: "center" }}>
        <div className="scr-eyebrow">AS OF APR 28, 2026</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, marginTop: 6 }}>{F(net, locale, currency)}</div>
        <div style={{ fontSize: 11, color: "var(--olive)" }}>↑ {F(840, locale, currency)} this month</div>
        {/* sparkline stand-in */}
        <svg viewBox="0 0 200 36" style={{ width: "100%", height: 36, marginTop: 10 }}>
          <polyline points="0,28 20,24 40,26 60,20 80,22 100,16 120,18 140,12 160,14 180,9 200,6" fill="none" stroke="var(--coral)" strokeWidth="1.6"/>
          <polyline points="0,28 20,24 40,26 60,20 80,22 100,16 120,18 140,12 160,14 180,9 200,6 200,36 0,36" fill="var(--coral-tint)" stroke="none"/>
        </svg>
      </div>

      {/* Asset / liability stacked bar */}
      <div className="scr-card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Assets vs liabilities</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)" }}>D/A {ratio}%</span>
        </div>
        <div style={{ display: "flex", height: 10, borderRadius: 4, overflow: "hidden", background: "var(--paper-3)" }}>
          <div style={{ width: `${(totalA / (totalA + Math.abs(totalL))) * 100}%`, background: "var(--olive)" }}/>
          <div style={{ width: `${(Math.abs(totalL) / (totalA + Math.abs(totalL))) * 100}%`, background: "var(--coral)" }}/>
        </div>
        <div className="row between" style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)" }}>
          <span style={{ color: "var(--olive)" }}>● Assets {F(totalA, locale, currency, { abbrev: true })}</span>
          <span style={{ color: "var(--coral)" }}>● Liabilities {F(Math.abs(totalL), locale, currency, { abbrev: true })}</span>
        </div>
      </div>

      <div className="scr-card">
        <div className="scr-eyebrow" style={{ color: "var(--olive)" }}>ASSETS — {F(totalA, locale, currency)}</div>
        {assets.filter(a => a[2] > 0).map(([i, n, v]) => (
          <div key={n} className="txn-row">
            <div className="txn-ico">{i}</div>
            <div className="txn-meta"><span className="t">{n}</span></div>
            <div className="txn-amt in">{F(v, locale, currency)}</div>
          </div>
        ))}
      </div>

      <div className="scr-card">
        <div className="scr-eyebrow" style={{ color: "var(--coral)" }}>LIABILITIES — {F(Math.abs(totalL), locale, currency)}</div>
        {liabilities.map(([i, n, v]) => (
          <div key={n} className="txn-row" onClick={() => go("debt")} style={{ cursor: "pointer" }}>
            <div className="txn-ico">{i}</div>
            <div className="txn-meta"><span className="t">{n}</span><span className="s">tap to manage →</span></div>
            <div className="txn-amt out">{F(Math.abs(v), locale, currency)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Debt management ──────────────────────────────────────────────
const ProtoDebt = ({ go, locale, currency }) => {
  const [strategy, setStrategy] = useStateProto("avalanche");
  const debts = [
    { ico: "💳", name: "Credit card", balance: 3850, apr: 21.9, min: 95, paid: 1150, total: 5000 },
    { ico: "🎓", name: "Student loan", balance: 6500, apr: 5.8, min: 120, paid: 3500, total: 10000 },
    { ico: "🚗", name: "Auto loan", balance: 2000, apr: 7.2, min: 280, paid: 4000, total: 6000 },
  ];
  // sort for display based on strategy
  const sorted = strategy === "avalanche"
    ? [...debts].sort((a, b) => b.apr - a.apr)
    : strategy === "snowball"
    ? [...debts].sort((a, b) => a.balance - b.balance)
    : debts;

  const totalDebt = debts.reduce((a, d) => a + d.balance, 0);
  const totalMin = debts.reduce((a, d) => a + d.min, 0);
  const monthsToFree = strategy === "avalanche" ? 28 : strategy === "snowball" ? 30 : 32;

  return (
    <div className="scr">
      <div className="scr-head">
        <span className="scr-back" onClick={() => go("dashboard")}>‹</span>
        <div className="scr-title">Debt</div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)" }}>{currency}</span>
      </div>

      <div className="scr-card" style={{ textAlign: "center", background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }}>
        <div className="scr-eyebrow" style={{ color: "var(--coral-soft)" }}>TOTAL DEBT</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 4 }}>{F(totalDebt, locale, currency)}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--shell-dim)", letterSpacing: "0.08em" }}>
          <span>MIN/MO {F(totalMin, locale, currency, { abbrev: true })}</span>
          <span>·</span>
          <span>FREE IN {monthsToFree} MO</span>
        </div>
      </div>

      <div className="scr-card">
        <div className="scr-eyebrow" style={{ marginBottom: 8 }}>PAYOFF STRATEGY</div>
        <div className="row" style={{ background: "var(--paper-2)", borderRadius: 8, padding: 3, gap: 0 }}>
          {[["avalanche", "Avalanche"], ["snowball", "Snowball"], ["custom", "Custom"]].map(([k, l]) => (
            <div key={k} onClick={() => setStrategy(k)} style={{ flex: 1, padding: "8px", textAlign: "center", borderRadius: 6, cursor: "pointer", background: strategy === k ? "var(--coral-tint)" : "transparent", color: strategy === k ? "var(--terracotta)" : "var(--ink-mid)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: strategy === k ? 600 : 400 }}>{l}</div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--ink-mid)", marginTop: 8, lineHeight: 1.5 }}>
          {strategy === "avalanche" && <>Highest APR first — minimum interest paid. <b style={{ color: "var(--ink)" }}>Mathematically optimal.</b></>}
          {strategy === "snowball" && <>Smallest balance first — fastest wins. <b style={{ color: "var(--ink)" }}>Best for momentum.</b></>}
          {strategy === "custom" && <>Drag to reorder. Pip won't second-guess your priorities.</>}
        </p>
      </div>

      {sorted.map((d, i) => {
        const pct = Math.round((d.paid / d.total) * 100);
        return (
          <div key={d.name} className="scr-card" style={{ borderLeft: i === 0 ? "3px solid var(--coral)" : "1px solid var(--line-soft)" }}>
            <div className="row between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{d.ico} {d.name}{i === 0 && <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--coral)", letterSpacing: "0.1em" }}>NEXT TARGET</span>}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-mid)" }}>{d.apr}% APR</span>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{F(d.balance, locale, currency)}</div>
            <div style={{ height: 5, background: "var(--paper-3)", borderRadius: 3, marginTop: 6 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--olive)", borderRadius: 3 }}/>
            </div>
            <div className="row between" style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-mid)" }}>
              <span>Paid {F(d.paid, locale, currency, { abbrev: true })} of {F(d.total, locale, currency, { abbrev: true })}</span>
              <span>Min {F(d.min, locale, currency)}/mo</span>
            </div>
          </div>
        );
      })}

      <Btn>+ Log payment</Btn>
    </div>
  );
};

const ProtoGoals = ({ go, locale, currency }) => (
  <div className="scr">
    <div className="scr-head"><span className="scr-back" onClick={() => go("dashboard")}>‹</span><div className="scr-title">Goals</div><span style={{ width: 22 }}/></div>
    {[["🛡️", "Emergency Fund", 4200, 6000], ["💰", "Vacation 2026", 1850, 4000], ["📈", "Roth IRA", 4800, 7000]].map(([i, n, c, t]) => (
      <div key={n} className="scr-card">
        <div className="row between" style={{ marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{i} {n}</span><span className="scr-eyebrow">{Math.round((c/t)*100)}%</span></div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{F(c, locale, currency)} <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-mid)" }}>/ {F(t, locale, currency)}</span></div>
        <div style={{ height: 5, background: "var(--paper-3)", borderRadius: 3, marginTop: 8 }}><div style={{ width: `${(c/t)*100}%`, height: "100%", background: "var(--coral)", borderRadius: 3 }}/></div>
      </div>
    ))}
    <Btn>+ Set a goal</Btn>
  </div>
);

const Prototype = ({ segment, locale, currency }) => {
  const [scr, setScr] = useStateProto("dashboard");
  const props = { go: setScr, segment, locale, currency };
  const screens = {
    dashboard: <ProtoDashboard {...props}/>,
    addtxn:    <ProtoAddTxn {...props}/>,
    toast:     <ProtoToast {...props}/>,
    budgets:   <ProtoBudgets {...props}/>,
    txnlist:   <ProtoTxnList {...props}/>,
    goals:     <ProtoGoals {...props}/>,
    networth:  <ProtoNetWorth {...props}/>,
    debt:      <ProtoDebt {...props}/>,
  };
  const tabActive = scr === "dashboard" ? "home"
    : scr === "txnlist" || scr === "addtxn" ? "txn"
    : scr === "budgets" ? "budget"
    : scr === "goals" ? "goals"
    : scr === "networth" || scr === "debt" ? "wealth"
    : "home";
  const sublabel = `${currency} · ${locale} · ${segment}`;
  return (
    <Phone label="Live prototype" sublabel={sublabel}>
      {screens[scr]}
      <div className="tabnav">
        {[["home", "Home", "dashboard"], ["txn", "Txns", "txnlist"], ["budget", "Budget", "budgets"], ["goals", "Goals", "goals"], ["wealth", "Wealth", "networth"]].map(([k, l, target]) => (
          <div key={k} onClick={() => setScr(target)} className={`tabnav-item ${tabActive === k ? "active" : ""}`} style={{ cursor: "pointer" }}>
            <span className="icon"/>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </Phone>
  );
};

const PagePrototype = ({ segment, locale, currency }) => (
  <div className="page-canvas" data-screen-label="05 Prototype">
    <div className="page-head">
      <div>
        <div className="eyebrow"><span className="dot"/>Tab 05 / 07 — Clickable prototype</div>
        <h1>Tap around. <i>It works.</i></h1>
        <p className="lede">Three live phones — one per segment lens. Tap the <b>+</b> to log a transaction (Pip auto-categorizes "Whole Foods", "Uber", "Netflix"). Tap any card to drill in. The new <b>Wealth</b> tab opens Net Worth (balance sheet) and Debt (with Avalanche / Snowball / Custom payoff strategies). Switch <b>currency</b> and <b>locale</b> in Tweaks — every number reformats.</p>
      </div>
      <div className="meta-stack"><span><b>8</b> screens wired</span><span><b>3</b> segments × <b>7</b> currencies</span></div>
    </div>
    <div className="page-body">
      <div className="grid-3" style={{ alignItems: "start" }}>
        <Prototype segment="couple" locale={locale} currency={currency}/>
        <Prototype segment="growing" locale={locale} currency={currency}/>
        <Prototype segment="multigen" locale={locale} currency={currency}/>
      </div>
      <div style={{ marginTop: 30 }} className="note-box">
        Try this: open <b>Tweaks</b> (toolbar), switch currency to <b>INR</b> or <b>JPY</b> — every amount reformats live, including FX-converted balance-sheet rollups. Then open <b>Wealth → Debt</b> and toggle Avalanche vs. Snowball — the "next target" highlight shifts.
      </div>
    </div>
    <div className="canvas-foot"><span>FinFlow · Wireframe Exploration</span><span>05 / 07 — Prototype</span></div>
  </div>
);

window.PagePrototype = PagePrototype;
