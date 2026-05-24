# Auto-Linking Roadmap — Socialization Pack

> Drop the Slack post below into `#finflow-product` and `#finflow-eng-leads`.
> The FAQ section is for the follow-on thread / Notion sync.

---

## Slack post (copy-paste ready)

📌 **FinFlow Auto-Linking — proposed roadmap, feedback by Fri 2026-06-05**

We're closing the biggest paper cut our households tell us about: FinFlow makes them re-do reconciliation in their head. Record an expense → asset balance doesn't move. Hit a savings milestone → goal progress doesn't update. Pay down debt → net worth still wrong until you manually edit the asset. The data model is flat; the user does the graph work.

The proposed fix is in [`docs/ROADMAP_AUTO_LINKING.md`](./ROADMAP_AUTO_LINKING.md) — 6 phases across 4 release cycles:

• **Phase A — Asset Reflection** (v6.5) · transactions move asset balances automatically
• **Phase B — Goal Linking** (v6.6) · deposits to linked assets credit goals
• **Phase C — Budget Surplus Routing** (v6.7) · period-end surplus sweeps into a chosen goal
• **Phase D — Split Auto-Settlement** (v6.8) · "mark paid" creates the settlement transaction
• **Phase E — Recurring Projection Engine** (v7.0) · forward forecasts on goals + dashboard
• **Phase F — Two-Way Edit & Reconciliation** (v7.0) · edit a derived value, choose how to commit it

**Effort:** ~12 weeks engineering + ~4 weeks QA across the 4 cycles. Each phase ships feature-flagged and dark; default-on one release after the migration ships.

**Bonus:** this resolves 4 of the 5 open clarifications blocking our test automation suite (Clarifications #1, #2, #3, #5 in `react/e2e/TEST_CASE_INVENTORY.md`). Once Phase D ships, the 🟠-blocked counter in the test inventory drops to 1.

**What I need from you by EOD Fri 2026-06-05:**

1. ✅ / ❌ on the phase order and release-cycle mapping
2. Answers (or "needs discussion") on the **4 open product questions** at the bottom of the roadmap doc — payment-method cardinality, closed-account semantics, goal "lock at peak", cross-profile surplus routing
3. Any phase you'd reorder, kill, or fast-track

Silence by the deadline = lazy consensus, I'll start staffing Phase A.

— Uday

---

## FAQ (post in thread or sync to Notion)

- **Q:** Why now? We've shipped a lot of v6 work already.
  **A:** Because the test inventory we just finalised (163 scenarios) made the manual-reconciliation tax visible. ~25 designed tests bake in workarounds for it; ~8 are outright blocked on it. Continuing to ship without addressing it locks the workarounds into our test corpus and makes the eventual cleanup multiplicatively harder.

- **Q:** Won't auto-linking surprise existing households whose stored balances don't match their transaction history?
  **A:** Yes — which is why every phase ships behind a feature flag, default-off, with a one-time reconciliation prompt the user opts into. We never silently rewrite an existing balance. The roadmap doc spells out the banner + back-fill flow per phase.

- **Q:** Why feature-flag everything? Six flags is a lot to manage.
  **A:** Each flag is on for one release cycle then default-on. We're never carrying more than 2–3 flags simultaneously. The alternative — big-bang at v7.0 — would land all six behaviours and all six migration paths at the same time, which is the bug-density scenario we're avoiding.

- **Q:** Does this conflict with the TD-03 optimistic-concurrency work that just landed in v6.4.19?
  **A:** No — it builds on it. Every auto-propagation respects the same per-row `updated_at` precondition, so conflicting writes surface a banner rather than silently winning. Phase F explicitly extends the conflict UX to derived values (`openingBalance` on assets).

- **Q:** What does this mean for the QA automation hand-off?
  **A:** The scaffolding PR (commit `e881371`) is already in. The junior implementer proceeds against today's manual defaults; as each roadmap phase ships, ~25 test IDs get their Expected Results updated in-place (test IDs never change — only behaviour). Net new test cases per phase: ~3–5 each. We absorb that in the existing QA budget.

- **Q:** What's the rollback story if a phase has a bad migration?
  **A:** Each phase ships its localStorage migration in `lib/migration.ts` with an inverse path; cloud uses forward-only Supabase migrations but adds derived columns rather than rewriting existing ones, so a rollback is a flag flip, not a data restore.

- **Q:** Where do the 4 open product questions live?
  **A:** Bottom of the roadmap doc — `docs/ROADMAP_AUTO_LINKING.md`. Reply in this thread or comment inline; both work.

---

## Distribution checklist

- [ ] Slack `#finflow-product`
- [ ] Slack `#finflow-eng-leads`
- [ ] Notion → *Roadmaps* → *Auto-Linking* (sync the FAQ section)
- [ ] Calendar: 30-min review block on Mon 2026-06-08 to walk through any objections that landed in the thread
- [ ] Engineering planning: tentatively reserve Phase A capacity (3–4 weeks) starting v6.5 cycle pending sign-off
