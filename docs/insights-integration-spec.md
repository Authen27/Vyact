# Vyact — Insights Hub: Developer Integration Spec

```yaml
meta:
  doc_type: integration_direction
  audience: implementing developer (consumer + admin + DB)
  baseline: consumer v9.0.1 · admin v1.1.0 · Supabase (HybridAdapter)
  source_specs:
    - vyact-insights-hub-spec.md          # the PRD
    - vyact-content-strategy-onepage.md    # the strategy
    - vyact-evergreen-cards-library.json   # the 116-card payload to load
  scope: "immediate, buildable changes on BOTH apps + the shared DB, in dependency order"
  principle: "Extend what ships (v6.3 content module, v7.5 Planner, v8.1 Ask Vyact engine). Build no parallel systems. Every personal number is service-computed, on-device — never fabricated."
```

This is the build order and the contracts. §A is the shared DB. §B is the consumer app. §C is the admin app. §D is the **visual generation direction** for every written-format feed item (the part most likely to sprawl if undirected — it does not, because the visual set is closed). §E is sequencing + acceptance.

---

## §A — Database (shared, do first)

One forward-only, additive migration. Existing `content_items` rows (legacy `format='article'`) keep working untouched.

```yaml
migration: "supabase/migrations/<ts>_insights_hub.sql  (forward-only, additive)"

content_items_additive_columns:
  format:        "text NOT NULL DEFAULT 'article'   -- 'article' (legacy) | 'card' (evergreen) | 'external' (curated link-out)"
  visual_kind:   "text   -- 'icon' | 'stat' | 'diagram'  (NULL for external)"
  visual_ref:    "jsonb  -- the render spec (see §D); for icon = {\"icon\":\"PiggyBank\"}, stat = {\"big\":\"…\",\"sub\":\"…\"}, diagram = {\"primitive\":\"arc\",…}"
  body_md:       "text   -- ≤120-word markdown body"
  tags:          "text[] -- trigger/context tags for contextual surfacing + feed nudges"
  reading_seconds:"int   -- chip"
  tone:          "text   -- 'neutral' | 'positive' | 'constructive'  (drives the feed tone-mixer)"
  india_relevant:"bool DEFAULT false"
  # external-only (format='external'):
  source_name:   "text   -- allowlist: RBI | SEBI | IncomeTax | PFRDA_NPS | GovScheme"
  source_url:    "text   -- canonical link; we link OUT, never copy body"
  why_it_matters:"text   -- ≤1 line, admin-written"
  published_at:  "timestamptz  -- source date; drives reverse-chron ordering of 'What's New'"
constraints:
  - "CK_content_format: format IN ('article','card','external')"
  - "CK_card_has_visual: format='card'  => visual_kind IS NOT NULL AND visual_ref IS NOT NULL AND body_md IS NOT NULL"
  - "CK_external_has_source: format='external' => source_name IS NOT NULL AND source_url IS NOT NULL AND published_at IS NOT NULL"
  - "CK_source_allowlist: source_name IS NULL OR source_name IN ('RBI','SEBI','IncomeTax','PFRDA_NPS','GovScheme')"
rls: "Inherit existing content_items policies — admins write, consumers read published. Do NOT author new policy logic."
indexes:
  - "idx_content_format_published ON content_items(format, published_at DESC)  -- What's New ordering"
  - "GIN index on tags  -- contextual surfacing lookups"
seed:
  - "Bulk-load vyact-evergreen-cards-library.json (116 rows) as format='card'. Map JSON field→column 1:1 (id, category, title, visual_kind, visual_ref, body_md→body_md, tags, reading_seconds, tone, india_relevant, published)."
  - "Load via the admin path (§C) OR a one-shot seed script. Idempotent on id (upsert)."
admin_kpis_touch:
  - "admin_dashboard_kpis() already counts publishedArticles/contentFavorites — extend to count cards + external items separately (so the founder sees library size + curation cadence). Additive only."
```

---

## §B — Consumer app (`react/`)

### B1 — Insights becomes the hub (extend `pages/Insights.tsx`)

```yaml
change: "Expand the existing /insights page into a 4-tab hub. Do NOT create a new route."
tabs:
  for_you:   "Stream 1 personal feed (B2). DEFAULT tab."
  learn:     "the 116 evergreen cards (B3) — search + favorite already exist; render format='card'."
  whats_new: "format='external' items, reverse-chron by published_at (B4)."
  plan:      "the Planner, moved in from FloatingTools (B5)."
nav: "Insights stays primary nav. Tab state in the URL (?tab=) so deep-links + the feed's 'learn more' can target a tab."
```

### B2 — `lib/insightsFeed.ts` (NEW) — the personal feed engine

```yaml
purpose: "Deterministic, on-device generation of personal cards from EXISTING aggregates. No new financial math."
inputs_reused: [aiSummary, spendByCategory, monthlyData, plannerRules helpers, pulse components]
contract:
  candidate: "{ id, type, tone, materiality:number, triggerMet:boolean, payload:{ big, sub, line, deepLink } }"
  types: [mirror, win, streak, anomaly, trend, forecast, pulse, nudge_to_learn]
  generator: "pure functions: each takes aggregates → emits 0..1 candidates with a materiality score + tone"
ranking_and_tone_mixer:
  - "Filter triggerMet; sort by materiality; take top 3–5."
  - "TONE RULE (enforced here): at most ONE 'constructive' card per session; the rest neutral/positive. New/low-engagement households skew further to neutral/positive."
  - "Freshness: never repeat the same card id within N days (store last-shown ids in a small local map; same pattern as numberSystemPref/education LRU)."
finitude: "Return a finite list; the For You surface ENDS (no infinite scroll)."
privacy: "All on-device. No raw txn data leaves the client (mirrors Ask Vyact)."
nudge_to_learn: "When a trigger matches an evergreen tag (e.g. runway<1mo → tag 'emergency_fund'), emit a nudge_to_learn card that deep-links to that Learn card by tag."
```

### B3 — Render `format='card'` in Learn (+ the visual renderer, §D)

```yaml
components_new:
  - "components/insights/InsightCard.tsx — the card shell (visual block on top, title, body_md, reading chip, favorite)."
  - "components/insights/visuals/ — the closed-set visual renderer (see §D). This is the ONLY place visuals are produced."
data: "Learn lists content_items WHERE format='card', searchable/favoritable via the existing content module client."
```

### B4 — What's New (`format='external'`)

```yaml
render: "List external items reverse-chron by published_at. Each shows source_name badge, title, why_it_matters line, and a link-OUT to source_url (open externally). Never render a source body — we link, we don't copy."
contextual: "Optionally filter/boost by tags matching the household (e.g. 'home_loan')."
```

### B5 — Absorb the Planner; trim goal-ETA

```yaml
move: "Relocate the Planner component into Insights → Plan tab. Keep plannerRules engine intact."
remove: "Delete the Planner bubble from FloatingTools."
objectives_update:
  keep: [emergency_fund, debt_strategy]
  add:  [cashflow_outlook, savings_rate_path, bill_readiness, budget_fit]   # elaborated per PRD §6
  remove: [goal_eta]   # Goals were removed in v8.8.0 — do NOT reintroduce goal UI
forecast_bridge: "Planner forecast outputs also feed B2 as 'forecast' feed cards (one engine, two surfaces)."
```

### B6 — Ask Vyact icon swap

```yaml
change: "In FloatingTools, Ask Vyact adopts the icon the Planner bubble used to use (freed by B5). Remove the old Ask Vyact icon reference. No behaviour change to the assistant itself."
```

---

## §C — Admin app (`admin/`)

The admin is where the team manages content without a content pipeline. Extend the existing content module (v6.3).

```yaml
C1_card_authoring:
  surface: "Content module → 'Cards' — author/edit format='card' items."
  fields: "title, category, body_md (≤120w, live word-count), tone (neutral/positive/constructive), tags (chips), reading_seconds, india_relevant, AND the visual picker (C3)."
  publish: "via existing admin_publish_content_item RPC (extend its payload for the new columns)."
  bulk_load: "a 'Import library' action that ingests vyact-evergreen-cards-library.json (116 cards) in one shot — idempotent upsert on id. This is how the one-time library lands."

C2_external_curation:
  surface: "Content module → 'What's New' — curate format='external' items."
  fields: "source_name (allowlist dropdown), source_url, published_at (date), why_it_matters (≤1 line), tags."
  governance: "source_name constrained to the allowlist; UI blocks free-text sources. Link-out only — no body field (we never store source text)."
  effort: "~30 min/week workflow: paste URL + date, write one why-line, tag, publish."

C3_visual_picker:
  purpose: "Let an author attach a code-rendered visual WITHOUT a designer or image upload."
  ui: >
    A small picker that writes visual_kind + visual_ref jsonb:
      • icon    → choose from the 57-icon allowlist (search) → {\"icon\":\"PiggyBank\"}
      • stat    → two inputs (big, sub) → {\"big\":\"₹500/day\",\"sub\":\"≈ ₹15,000 a month\"}
      • diagram → choose primitive (arc/arrow/bar2/compare2/stack) + its params → {\"primitive\":\"arc\",\"pct\":30,\"label\":\"1 of 3 months\"}
    Live preview renders the SAME component the consumer uses (shared package, §D) so what the author sees is what ships.
  guardrail: "icon picker is constrained to the allowlist (so a card can't reference an icon the consumer bundle lacks)."

C4_kpis:
  - "Surface library size (card count), curation cadence (external items / week), and favorite counts on the admin dashboard (from the extended admin_dashboard_kpis())."
```

---

## §D — Visual Generation Direction (the closed-set renderer)

> The brief: "plan a visual generation direction for all feeds that are written format." The key architectural decision — and the thing that keeps this from sprawling — is that **visuals are generated from a CLOSED SET of code primitives, never from hosted images, never from free-form generation.** The card library already uses exactly: 5 visual kinds, 6 diagram primitives, 57 icons. That finite surface IS the renderer's full spec.

### D1 — Principles

```yaml
principles:
  - "Code, not images. No image hosting, no CDN, no designer. Visuals are React components fed by visual_ref jsonb."
  - "Closed set. A visual is one of {icon, stat, diagram(primitive)}. No free-form/LLM image generation — finance visuals must be exact and trustworthy."
  - "Shared package. The renderer lives in ONE place imported by BOTH the consumer (to display) and admin (to preview). Author-preview == shipped-pixel."
  - "Themeable. Everything uses CSS HSL theme vars (Paper Warm / Dark) + the canonical .num typography for any number. No hard-coded colours."
  - "Deterministic. Same visual_ref → same pixels, every time. No randomness."
```

### D2 — The renderer module (build once, share)

```yaml
location: "react/src/components/insights/visuals/  (consumer)  + re-exported for admin preview"
entry: "renderVisual(visual_kind, visual_ref) → JSX"
files:
  - "Visual.tsx            — switch on visual_kind → Icon | Stat | Diagram"
  - "IconVisual.tsx        — large Lucide icon (visual_ref.icon) on a themed accent disc. 57-icon allowlist exported as ICON_ALLOWLIST."
  - "StatVisual.tsx        — big-number hero: visual_ref.big in .num, visual_ref.sub below. The workhorse for numeric ideas."
  - "DiagramVisual.tsx     — switch on visual_ref.primitive → one of the 6 SVG primitives (D3)."
shared_for_admin: "Export the same components; admin C3 preview imports them. Single source of truth for how a visual looks."
```

### D3 — The six diagram primitives (the entire diagram surface)

```yaml
primitives:   # these six cover 100% of the library's diagram/arc/arrow/compare cards
  arc:
    ref: "{ primitive:'arc', pct:0..100, label:string }"
    render: "a single progress arc (semi-circle), pct filled in accent, label centered. ~120×80 inline SVG."
  arrow:
    ref: "{ primitive:'arrow', dir:'up'|'down', label:string }"
    render: "a trend arrow (up=sage/positive, down=denim/neutral — never alarm-red for ordinary cards), label beside."
  bar2:
    ref: "{ primitive:'bar2', a:[label,val], b:[label,val] }"
    render: "two labelled bars compared side by side, heights from val (0..100)."
  compare2:
    ref: "{ primitive:'compare2', a:string, b:string }"
    render: "two circles / chips side by side with a divider — an 'A vs B' contrast."
  stack:
    ref: "{ primitive:'stack', parts:[[label,pct],…] }"
    render: "a single horizontal 100% stacked bar, segments sized by pct, labelled."
  # 'stat' and 'icon' are visual_kinds, not diagram primitives, but listed for completeness:
construction: "All are tiny, hand-built inline SVG (≤~150×100 viewBox), colours from theme vars, numbers in .num. No chart library needed — these are simpler than Recharts and must render at card size."
extensibility: "Adding a 7th primitive later is a contained PR: add the renderer + add it to the admin picker + document the visual_ref shape. The closed set is a feature, not a limit."
```

### D4 — How a WRITTEN feed item gets its visual (the generation flow)

```yaml
two_paths:
  evergreen_cards:
    flow: "Authored once. visual_kind + visual_ref are set at authoring time (admin C3 picker or the library JSON). The consumer just renders them. NO runtime generation — the visual is data."
  personal_feed_cards (B2):
    flow: >
      Generated at runtime, but STILL from the closed set. insightsFeed.ts assigns
      each card type a visual_kind + builds visual_ref from the computed values:
        • mirror/trend/forecast  → stat   (the number IS the visual)
        • win/streak/pulse        → stat or arc (progress)
        • anomaly                 → icon (AlertTriangle, used sparingly + neutral tone)
        • nudge_to_learn          → icon (the target card's category icon)
    rule: "The feed NEVER invents a visual outside the closed set. It maps (card type + values) → (visual_kind + visual_ref) deterministically, then hands off to the SAME renderVisual()."
mapping_table_personal_feed:
  mirror:    "stat { big: <delta>, sub: <comparison> }"
  win:       "stat { big: <improvement>, sub: 'vs your average' }"
  streak:    "arc  { pct: <progress>, label: '<n> weeks' }"
  trend:     "arrow{ dir: up|down, label: <metric> }   # dir from data; colour stays neutral/positive"
  forecast:  "stat { big: <projection>, sub: 'at this pace' }"
  pulse:     "arc  { pct: <score>, label: 'Pulse <±n>' }"
  anomaly:   "icon { icon: 'AlertTriangle' }   # the ONLY mild-alarm icon; tone='constructive', rate-limited"
  nudge_to_learn: "icon { icon: <category icon of the target Learn card> }"
guardrail: "Tone colour discipline: ordinary variance never renders in alarm-red. Red is reserved for genuine over-limit/over-due states, consistent with the neutral→positive mandate."
```

### D5 — What we explicitly do NOT do

```yaml
not:
  - "No LLM/diffusion image generation for cards — finance visuals must be exact; a hallucinated chart is a trust break."
  - "No hosted images / CDN / upload pipeline for the card or feed visuals (illustration kind is deferred; icon+stat+diagram carry everything)."
  - "No per-card bespoke SVG — everything routes through the 6 primitives + icon + stat. If a card 'needs' something outside the set, simplify the card, don't widen the set casually."
  - "No charting library for card visuals — Recharts stays for full report pages, not 120px cards."
```

---

## §E — Sequencing & acceptance

```yaml
build_order:
  1: "§A migration (additive columns + constraints + indexes) — dry-run on clone, forward-only."
  2: "§D visual renderer (shared package) — build + unit-render all 6 primitives + icon + stat against the 57-icon allowlist."
  3: "§B3 Learn tab + §A seed (load the 116 cards) — proves the renderer on real data."
  4: "§C3 admin visual picker + §C1 card authoring + Import-library action."
  5: "§B2 insightsFeed.ts personal feed + tone mixer + §B1 For You tab (default)."
  6: "§B5 Planner absorption + objective trim + §B6 icon swap."
  7: "§C2 external curation + §B4 What's New."
gate_dependencies:
  - "Renderer (step 2) before any card UI — it's the shared dependency."
  - "Personal feed (step 5) reuses existing aggregates only; if any aggregate is missing, STOP — do not add new financial math (use Ask Vyact's resolve services)."

acceptance:
  db:
    - "Existing 'article' content untouched; new format/visual columns populate; constraints reject malformed cards (card without visual, external without source)."
    - "116 cards seeded; idempotent re-import is a no-op."
  renderer:
    - "renderVisual covers all 5 kinds + 6 primitives; 57-icon allowlist resolves; numbers use .num; both themes render; identical output in consumer + admin preview."
  consumer:
    - "Insights hub has 4 tabs; For You is default, finite (3–5 cards), on-device, ≤1 constructive card/session."
    - "Learn lists 116 cards (visual+text), searchable + favoritable; feed nudge_to_learn deep-links by tag."
    - "What's New is reverse-chron, link-out only."
    - "Planner lives in Plan tab with elaborated objectives, no goal-ETA; no Planner FloatingTool; Ask Vyact wears the former Planner icon."
    - "No new financial math; every personal number traces to an existing service."
  admin:
    - "Cards authorable with the visual picker (constrained to the closed set); Import-library works; external curation constrained to the source allowlist; KPIs show library size + cadence."
  quality_gate: "Reuse the established gate — tsc + vitest + build + dev-boot; extend CON-UNIT-* (feed generation + tone mixer + each visual primitive) and ADM-UNIT-* (visual picker writes valid visual_ref)."
```

---

*End. The whole visual direction reduces to one rule: every written feed gets a visual from a closed set of code primitives (icon · stat · 6 diagrams), rendered by one shared module used identically in consumer and admin. No images, no designer, no generation guesswork — the visual is data, and the data is bounded.*
