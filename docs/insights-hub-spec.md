# Vyact — Insights Hub: PRD & Architecture Spec

```yaml
meta:
  doc_type: prd + architecture
  audience: product + engineering
  baseline: consumer v9.0.1 (has /insights page + content module v6.3; Planner v7.5 as a FloatingTool)
  companion: vyact-content-strategy-onepage.md · vyact-evergreen-cards-library.json
  decision_source: product (5 directives)
```

This consolidates five product directives into **one Insights hub**: the personal-insight feed (Stream 1), the evergreen library (Stream 2), curated external content (Stream 3), and the **absorbed Planner**. It also covers the tone rules and the Ask Vyact icon swap.

---

## §1 — What changes, at a glance

```yaml
directives_mapped:
  D1_tone: "All insight copy is neutral→positive; gradual absorption, never shock. §5."
  D2_insights_is_the_hub: "Insights becomes a real value section: evergreen library + personal feed + the Planner module moves INTO Insights. §2, §3, §6."
  D3_visual_library: "100+ unique visual+text evergreen cards, one-time authored, admin/DB-uploadable. §4 + the library JSON."
  D4_external_sources: "Free, reverse-chronological curated sources, managed via admin config. §7."
  D5_icon_and_planner: "Ask Vyact icon ← Planner's icon; Planner section integrated into Insights. §6 + §8."
```

---

## §2 — Information architecture: the Insights hub

```yaml
insights_hub:
  route: "/insights  (exists since v6.3 — expand it, don't fork)"
  tabs_or_sections:
    - For You:    "the personal-insight feed (Stream 1) — the default landing surface"
    - Learn:      "the evergreen card library (Stream 2) — searchable, favoritable"
    - What's New: "curated external content (Stream 3) — reverse-chronological"
    - Plan:       "the absorbed Planner (was a FloatingTool) — emergency fund, debt strategy, etc."
  default_tab: "For You"
  nav: "Insights stays a primary nav item. The Planner FloatingTool is REMOVED from FloatingTools and re-homed here (§6)."
  finitude: "For You shows 3–5 fresh cards per session and ENDS (anti-doomscroll, strategy brief). No infinite scroll."
```

---

## §3 — Stream 1: the personal-insight feed ("For You")

```yaml
engine:
  principle: "Push, not pull. This is the Ask Vyact Interpret bucket flipped from on-demand to a generated feed. The LLM-free 'services compute, never fabricate' rule holds — every number comes from the existing aggregation engine (aiSummary, spendByCategory, monthlyData, Pulse, Planner helpers)."
  generation: "Deterministic templates + the user's data. A card = a template id + resolved values + a trigger that fired."
card_taxonomy:
  - mirror:      "neutral reflection — 'Your weekends cost ₹2,100 more than weekdays this month.'"
  - win:         "positive reinforcement — 'Groceries down 18% vs your 3-month average.'"
  - streak:      "milestones — '3 weeks logging in a row.'"
  - anomaly:     "gentle flag — 'A ₹1,499 charge you don't usually have — recognise it?'"
  - trend:       "over time — 'Your highest-saving June in the app.'"
  - forecast:    "Planner output as a card — 'At this pace, ₹47,000 this month.'"
  - pulse:       "'Your Pulse moved +6 this week — debt health drove it.'"
  - nudge_to_learn: "contextual evergreen surfacing — runway dropped → show the emergency-fund card (§4 link)."
card_shape:
  - "One insight per card. Big number + one line. 5-second read. Tap to expand into the page/Interpret answer."
ranking:
  rule: "Rules-based, same philosophy as the Planner. Each template has trigger conditions (category, threshold, segment, recency) + a materiality score. Engine picks the top 3–5, dedupes, and enforces the tone mix (§5)."
  freshness: "Never repeat the same card within N days; always lead with the freshest data."
data_layer:
  - "New lib/insightsFeed.ts: pure functions that take the existing aggregates and emit candidate cards with {type, materiality, triggerMet}."
  - "Reuse aiSummary / spendByCategory / monthlyData / plannerRules — NO new financial math."
privacy: "All generation on-device (same as Ask Vyact). No raw data leaves the client."
```

---

## §4 — Stream 2: the evergreen library ("Learn")

```yaml
storage: "Reuse the existing content module (content_items + content_favorites, v6.3). These cards ARE content_items with a new shape (§4.1)."
surfacing:
  - "Browsable + searchable in the Learn tab (search already exists)."
  - "Favoritable (content_favorites already exists)."
  - "CONTEXTUAL: the For You feed's nudge_to_learn cards deep-link to the relevant evergreen card by tag (e.g. low-runway → emergency-fund card)."
authoring: "100+ cards authored ONCE (see vyact-evergreen-cards-library.json), uploadable via admin (admin_publish_content_item RPC) or direct-to-DB insert."
visual_balance: "Every card is visual + text (D3). See §4.2 for the visual approach that needs no designer."
```

### §4.1 — content_items shape (extend, additively)

```yaml
content_item_fields_add:
  format:       "text — 'card' (the new short visual format) vs legacy 'article'"
  visual_kind:  "text — 'icon' | 'stat' | 'diagram' | 'illustration' (drives the visual block, §4.2)"
  visual_ref:   "text — an icon/illustration key OR a stat-spec the client renders (NO image hosting needed for icon/stat kinds)"
  body_md:      "text — short markdown (≤120 words), one idea"
  tags:         "text[] — trigger/context tags (e.g. ['emergency_fund','runway','beginner']) for contextual surfacing"
  reading_seconds: "int — ~20–40s, shown as a chip"
  category:     "text — Saving / Debt / Investing-basics / Budgeting / Mindset / India-specific / Household"
note: "All additive columns on content_items; existing articles keep working (format='article')."
```

### §4.2 — Visual without a designer (D3)

```yaml
visual_strategy:
  problem: "App is text-heavy; cards must be visual+text. But there's no design team and no image pipeline."
  solution: "Render visuals from CODE, not hosted images — three zero-asset techniques:"
  - icon:    "a large themed Lucide icon + accent background (the app already ships Lucide). visual_ref = icon name."
  - stat:    "a big-number 'stat hero' rendered with the canonical .num typography (e.g. '₹500/day = ₹15k/month'). visual_ref = a small spec the client formats. Most cards use this — it's on-brand and free."
  - diagram: "a tiny inline SVG built from a fixed set of primitives (bar, arc, arrow, two-circle compare). visual_ref = a primitive id + values. ~6 reusable SVG primitives cover most explainers."
  - illustration: "OPTIONAL later — only if you add a small set of SVG illustrations. Not required for v1; icon+stat+diagram carry 100+ cards."
  result: "100+ visually distinct cards, zero hosted images, zero designer, fully themeable (Paper Warm / Dark)."
```

---

## §5 — Tone system (D1) — neutral→positive, gradual

```yaml
tone_rules:
  ladder: "Every insight sits on a ladder: NEUTRAL (reflect) → POSITIVE (reinforce) → CONSTRUCTIVE (gentle next step). Problems are only ever surfaced as CONSTRUCTIVE, never as a verdict."
  feed_mix: "In any session's 3–5 cards, at most ONE may be constructive/problem-flagging; the rest neutral or positive. Enforced by the ranking mixer (§3)."
  language:
    - "Lead with the fact, not the judgement. 'Dining is ₹420 this month' not 'You overspent on dining.'"
    - "Frame problems as choices with a next step. 'Want to see where dining crept up?' not 'You blew your budget.'"
    - "Celebrate genuinely but quietly. No hype, no confetti spam."
    - "Never shame, never alarm. No red-alert framing for ordinary variance."
  gradual_absorption: "Cap problem-flag frequency per user per week; positive/neutral has no cap. New or struggling users see proportionally MORE positive/neutral until engagement stabilises."
  reuse: "These mirror the Ask Vyact response-tone principles (warm, answer-first, never a dead end) — share the lib/askVyactResponses.ts tone conventions where possible."
```

---

## §6 — Absorbing the Planner into Insights (D2, D5)

```yaml
current: "Planner is a rules-based, no-LLM tool (v7.5) living as a FloatingTool bubble; objectives: emergency fund, debt strategy, (goal ETA — now defunct since Goals were removed)."
change:
  - "Move the Planner UI into the Insights hub as the 'Plan' tab. Remove the Planner FloatingTool bubble."
  - "Keep the rules engine (plannerRules) intact — only the HOME changes."
  - "Forecast-type personal cards (§3) are Planner outputs surfaced in 'For You' — so Planner both has its own tab AND feeds the feed."
elaborated_planner_objectives:    # the feedback asked to elaborate; and goal-ETA is defunct
  keep:
    - emergency_fund: "months of runway; how much to set aside to reach target."
    - debt_strategy:  "avalanche vs snowball; payoff timeline; extra-payment impact."
  add_or_reframe:
    - cashflow_outlook: "Planner projects month-end spend/income (already the forecast engine) — formalise as a Plan objective + a feed card."
    - savings_rate_path: "given current pace, projected savings this month/year + one lever to improve it."
    - bill_readiness:    "upcoming recurring/known bills vs available balance — 'can you cover the next 30 days?' (ties to the recurring RRULE work)."
    - budget_fit:        "does the plan fit the month/annual budget? (ties to the budget redesign) — read-only, A8."
  removed:
    - goal_eta: "Goals are gone (v8.8.0). Remove goal-ETA from the Planner; do not reintroduce goal UI without a product decision."
  principle: "Planner stays rules-based and honest — it computes from real data, recommends no securities/products, and every number is service-computed (the v8.1 LLM seam remains available for a future upgrade)."
```

---

## §7 — Stream 3: curated external content config (D4)

```yaml
admin_config_surface:
  home: "Admin app content module (extends the existing v6.3 content authoring)."
  model: "An admin curates — selects a free-source item, attaches a one-line 'why this matters', sets trigger tags. NEVER republishes wholesale; links out to the source."
  external_item_fields:   # a curated external item is a content_item with source metadata
    source_name:   "RBI | SEBI | Income-Tax Dept | PFRDA/NPS | govt-scheme | (allowlist)"
    source_url:    "canonical link to the original (we link out, not copy)"
    published_at:  "the source's date — drives reverse-chronological ordering (D4)"
    why_it_matters: "≤1 line, admin-written, optionally personalised by tag at render ('…for your home loan EMI')"
    trigger_tags:  "who should see it (e.g. ['home_loan','rate_change'])"
  ordering: "What's New tab = reverse-chronological by published_at (newest first)."
  governance: "source_name is an allowlist of free, authoritative sources (strategy brief). No open-web scraping; no paywalled or engagement-bait sources."
free_source_allowlist:
  - "RBI — press releases, circulars, policy/rate decisions"
  - "SEBI — investor education"
  - "Income-Tax Dept — slab / rule changes"
  - "PFRDA / NPS, PPF rate notifications"
  - "Government scheme bulletins (India)"
  refresh_effort: "~30 min/week — select + tag, not write."
copyright: "Link out + a short original 'why it matters' line. Do NOT reproduce source text wholesale."
```

---

## §8 — The Ask Vyact icon swap (D5)

```yaml
change:
  - "Ask Vyact's launcher icon ← the icon currently used for the Planner."
  - "Since the Planner section moves INTO Insights and loses its FloatingTool bubble, its icon is freed up for Ask Vyact."
  - "Ask Vyact remains its own surface (the assistant); only its icon changes."
files:
  - "FloatingTools: remove the Planner bubble; Ask Vyact bubble adopts the Planner icon."
  - "Confirm no dangling references to the old Ask Vyact icon."
acceptance:
  - "Ask Vyact shows the (former Planner) icon."
  - "No standalone Planner FloatingTool remains; Planner lives in Insights → Plan."
```

---

## §9 — Files & acceptance

```yaml
files:
  consumer:
    - "pages/Insights.tsx — expand to the hub (For You / Learn / What's New / Plan tabs)."
    - "lib/insightsFeed.ts — NEW: deterministic card generation from existing aggregates."
    - "components/insights/* — InsightCard, StatHero, MiniDiagram (the §4.2 SVG primitives), FeedList."
    - "Planner: move its component under Insights; delete the FloatingTool bubble; trim goal-ETA objective."
    - "content module client: render format='card' (visual+text) alongside legacy 'article'."
    - "FloatingTools: Ask Vyact icon ← Planner icon; remove Planner bubble (§8)."
  db:
    - "Additive columns on content_items (§4.1) + external-source fields (§7). Forward-only migration; existing articles unaffected (format defaults 'article')."
  admin:
    - "Content module: card authoring (format='card', visual_kind/ref, tags) + external-item curation (source allowlist, why-it-matters, reverse-chron)."
acceptance:
  - "Insights is the hub; For You shows 3–5 fresh, finite, on-device personal cards per session."
  - "Tone mix enforced: ≤1 constructive card per session; rest neutral/positive."
  - "Learn shows the 100+ evergreen cards (visual+text), searchable + favoritable, contextually surfaced from the feed."
  - "What's New shows curated free-source items reverse-chronological, link-out, with a 'why it matters' line."
  - "Planner lives in Insights → Plan with the elaborated objectives; no goal-ETA; no FloatingTool Planner bubble."
  - "Ask Vyact wears the former Planner icon."
  - "No new financial math; every number service-computed; all personal generation on-device."
```

---

*End of spec. The hub turns Insights from a content page into the app's stickiness engine — the user's own money as a finite, neutral-to-positive feed, with a one-time evergreen library and a 30-min/week curated edge. No content team required.*
