/* global React */

// ════════════════════════════════════════════════════════════════
//   TAB 3 — USER FLOWS
// ════════════════════════════════════════════════════════════════

const flowSteps = (steps) => (
  <div className="flow-rail">
    {steps.map((s, i) => (
      <React.Fragment key={i}>
        <span className={`flow-step ${i === 0 ? "start" : i === steps.length - 1 ? "end" : ""}`}>
          <span className="num">{i + 1}</span>
          {s}
        </span>
        {i < steps.length - 1 && <span className="flow-arrow">→</span>}
      </React.Fragment>
    ))}
  </div>
);

const PageFlows = () => (
  <div className="page-canvas" data-screen-label="03 User Flows">
    <div className="page-head">
      <div>
        <div className="eyebrow"><span className="dot"/>Tab 03 / 07 — User Flows</div>
        <h1>Every <i>path</i> through FinFlow.</h1>
        <p className="lede">Ten rails covering MVP plus the global &amp; debt scope: onboarding, daily logging, weekly review, budgets, goals, household members, the Phase-2 bank-link teaser, the Seed→Family upgrade, localization &amp; currency, and debt &amp; balance sheet. Each rail names its happy path, then forks into the alt branches we have to design for.</p>
      </div>
      <div className="meta-stack"><span><b>10</b> primary flows</span><span><b>33</b> branches</span></div>
    </div>

    <div className="page-body">
      {[
        { num: "03.1", title: "First-run onboarding", lede: "Sign up → household setup → first transaction. Goal: under 90 seconds.", happy: ["Open app", "Welcome + Pip intro", "Email + name", "Pick segment", "Add household", "Pick goal type", "First txn (smart-cat)", "Dashboard"], alts: [["No email yet?", "Use as guest · upgrade later"], ["Skip household?", "Solo mode · single member auto-created"], ["Skip goal?", "We default to Emergency Fund · prompt later"]] },
        { num: "03.2", title: "Daily — log a transaction", lede: "Most-touched path. Must be 3 taps from anywhere.", happy: ["Tap +", "Type or amount", "Smart-cat suggests", "Confirm", "Toast + list slot-in"], alts: [["Description ambiguous?", "Suggest top 3 categories chip row"], ["Recurring?", "Toggle weekly/monthly · saved as template"], ["Member assignment?", "Sticky — defaults to last used"]] },
        { num: "03.3", title: "Weekly — review Pulse Score", lede: "Sunday-evening ritual. 60-second skim.", happy: ["Open dashboard", "Pulse animates 0→N", "Insight chips load", "Tap chip → drill-in", "Adjust budget or log missed txn", "Score updates"], alts: [["Score dropped 10+?", "Coral banner: \"Let's look at why\""], ["First time score is good?", "Confetti micro-celebration"]] },
        { num: "03.4", title: "Set / edit budget", lede: "Per-category monthly limit. Suggested from past 3 months.", happy: ["Budgets tab", "+ Add Budget", "Category select", "Suggested limit prefilled", "Pick color", "Save"], alts: [["Already over the suggestion?", "Honey-tinted nudge: \"Try $X — your avg is $Y\""], ["No history yet?", "Show baseline ranges by segment"]] },
        { num: "03.5", title: "Create &amp; track a goal", lede: "Six goal types. Inline progress on every card.", happy: ["Goals tab", "+ Add Goal", "Type select", "Name + target + (optional) deadline", "Save", "Inline + Add to log progress", "Goal completes → confetti"], alts: [["Deadline passed?", "Card flips to \"overdue\" — coral border"], ["Hit 100%?", "Mascot \"wow\" + share-sheet card"]] },
        { num: "03.6", title: "Household members", lede: "Roles map to permissions: primary, partner, child, elder.", happy: ["Settings · Members", "+ Add", "Name + role", "Save", "Avatar appears in sidebar"], alts: [["Child role?", "Read-only on totals · can log own txns"], ["Elder role?", "Larger type · simplified \"big buttons\" UI"], ["Permission denied?", "Inline coral toast: \"Ask Alex to do this\""]] },
        { num: "03.7", title: "Bank link (Phase 2 preview)", lede: "Plaid/Open-Banking. Hidden behind a Family-tier toggle.", happy: ["Settings · Linked accounts", "+ Connect bank", "Provider sheet", "OAuth (external)", "Confirm accounts", "Initial sync"], alts: [["OAuth fail?", "\"Bank declined — try again or link manually\""], ["Sync paused?", "Banner: \"Reconnect needed · 4 days stale\""], ["Wrong account?", "Per-account toggle in settings"]] },
        { num: "03.8", title: "Upgrade · Seed → Family", lede: "Soft paywall on multi-member &amp; bank link.", happy: ["Hit feature gate", "Sheet: \"Family · $18/mo\"", "Compare table", "Pay (Stripe)", "Receipt + unlock"], alts: [["Already in trial?", "Show days remaining"], ["Card decline?", "Sheet stays open · suggest alt method"]] },
        { num: "03.9", title: "Localization &amp; currency", lede: "Global from day one. Locale, currency, FX, multi-currency rollup.", happy: ["First-run · detect locale", "Confirm or pick", "Pick base currency", "Optional: add 2nd currency", "App reformats everything", "FX shown live in settings"], alts: [["Travelling abroad?", "Tap toolbar globe → \"Spending today in €\" overlay · auto-converts back to base"], ["Multi-currency household?", "Each member has a base · totals roll up to family base · FX timestamp shown"], ["FX provider stale &gt; 24h?", "Banner: \"Rates last updated Mon — pull to refresh\""], ["Locale has no decimals (JPY)?", "Hide cents · adjust grid widths"], ["RTL locale (Arabic)?", "Mirror entire layout · numerals stay LTR"]] },
        { num: "03.10", title: "Debt &amp; balance sheet", lede: "Track debts, run payoff strategies, see net worth over time.", happy: ["Settings · Debts", "+ Add debt", "Type · principal · rate · min payment", "Pick payoff strategy (avalanche / snowball / custom)", "Schedule preview", "Save → appears on Net Worth tab", "Log payment → balance ticks down"], alts: [["Multiple debts?", "Strategy ranks them automatically · drag-reorder for custom"], ["Variable rate?", "Toggle on · prompts for next-reset date · tracker flags re-quote"], ["Payoff date slips?", "Coral banner on Net Worth · \"Pip suggests +$N/mo to stay on track\""], ["Debt-free milestone?", "Confetti · share card · auto-shifts payment into emergency fund (with consent)"], ["Negative net worth?", "No shaming UI · honest number · big-purchase calculator dimmed"]] },
      ].map(f => (
        <div className="section" key={f.num}>
          <div className="section-head">
            <span className="section-num">{f.num}</span>
            <h2>{f.title}</h2>
            <span className="note">Happy path + branches</span>
          </div>
          <p style={{ color: "var(--ink-mid)", fontSize: 14, lineHeight: 1.55, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: f.lede }} />
          <div className="flow-canvas">
            {flowSteps(f.happy)}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 8 }}>
              {f.alts.map(([q, a], i) => (
                <div key={i} style={{ borderLeft: "2px solid var(--coral)", paddingLeft: 12 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--coral)", marginBottom: 4 }}>If — {q}</div>
                  <div style={{ fontSize: 13, color: "var(--ink)" }} dangerouslySetInnerHTML={{ __html: a }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="canvas-foot"><span>FinFlow · Wireframe Exploration</span><span>03 / 07 — User Flows</span></div>
  </div>
);

window.PageFlows = PageFlows;
