# Measurement Plan — Vyact Consumer Web

**Status:** Active · **Owner:** Product + Eng
**GA4 property:** `G-E3XKWZP850`
**Runtime code:** [react/src/lib/analytics.ts](../react/src/lib/analytics.ts)
**Event catalog:** [docs/measurement/events.yaml](measurement/events.yaml)
**Last reviewed:** 2026-06-02

---

## Why this exists

GA4 is wired site-wide via `gtag.js` in
[react/index.html](../react/index.html) and auto-tracks pageviews. Until v7.1
no custom events fired (per `react/CHANGELOG.md` v6.3 note: "Custom event
tagging lands in v6.4" — still open). This plan defines the canonical event
catalog so engineering, GA4 Admin, and product/analytics review use a single
vocabulary.

## Privacy guardrails (non-negotiable)

1. **No PII** — never send name, email, household id, transaction
   description, raw amounts, account numbers, or member identifiers.
2. **Money is bucketed** via `bucketAmount()` before send.
3. **Categories** send only the catalog `id` (e.g. `food`), never the user's
   free-text note.
4. **User properties** are aggregate-only (household-size band, currency,
   theme, cloud-enabled flag) — no household id, no email hash.
5. **Local-only mode** still emits events (same web property), but
   cloud-derived properties are absent.
6. **Google Signals** stays OFF — see GA4 admin checklist §4.

## Event catalog

The authoritative event list is YAML at
[docs/measurement/events.yaml](measurement/events.yaml). This file describes
how to use it; the YAML is the source of truth for engineering review.

### Naming rules

- `snake_case`, present tense, ≤ 32 chars (GA4 limit is 40).
- Verb-noun: `txn_saved`, `filter_applied`, `report_period_changed`.
- A new event name requires a YAML entry **in the same PR** as the `track()`
  call. CI lint candidate `MSR-001` enforces this once landed.

## User properties (set once per session)

| Property | Type | Values | Source |
|---|---|---|---|
| `cloud_enabled` | bool | true/false | `!!VITE_SUPABASE_URL` |
| `base_currency` | string | ISO 4217 | `profile.baseCurrency` |
| `household_size` | int | 1, 2, 3, 4, 5+ | `members.length` (capped) |
| `theme` | enum | warm / dark / system | `profile.theme` |
| `app_version` | string | semver | `package.json` |

## North-star metrics by initiative

| Initiative | Primary metric (GA4 source) | Target |
|---|---|---|
| Track-specific modal (Item #1) | `txn_saved` median `duration_ms` per `track` | Spend < 12 s, Income < 10 s |
| Type-specific categories (Item #9) | % `txn_edited` events with `category` in `fields_changed` | drop ≥ 30 % |
| Calculator in amount (Item #6) | `calc_expression_used` ÷ `txn_saved` | ≥ 8 % of saves |
| Account linking (Item #5) | % `txn_saved` with `account_type` set | > 95 % @ 30 days |
| Findability (Item #4) | sessions with ≥ 1 `filter_applied` ÷ DAU | ≥ 35 % |
| Report interpretability (Item #8) | `report_drilldown_clicked` per Reports session | ≥ 1 |
| Onboarding (Item #7) | `onboarding_step_completed` funnel completion | ≥ 60 % |

## Activation funnel (GA4 Explorations)

```
session_start
  └─ first_visit
      └─ txn_modal_opened
          └─ txn_track_chosen
              └─ txn_saved          [step 5 = activated]
```

Drop-off > 35 % between any two steps is a release blocker.

## GA4 admin checklist (one-time, owned by Product Analytics)

Each item below corresponds to clicks in **GA4 → Admin** for property
`G-E3XKWZP850`. Tick the box and PR a snapshot of the Admin screen as
proof when complete.

### 1. Mark events as conversions
**Admin → Events → Mark as conversion**
- [ ] `txn_saved`
- [ ] `onboarding_step_completed` (filter `step = 'final'`)
- [ ] `saved_view_created`

### 2. Register custom dimensions
**Admin → Custom definitions → Custom dimensions → Create**

| Dimension name | Scope | Event parameter |
|---|---|---|
| Track | Event | `track` |
| Amount bucket | Event | `amount_bucket` |
| Category id | Event | `category_id` |
| Surface | Event | `surface` |
| Reason | Event | `reason` |
| Insight kind | Event | `insight_kind` |
| Feature flag | Event | `flag` |
| Variant | Event | `variant` |
| Cloud enabled | User | `cloud_enabled` |
| Base currency | User | `base_currency` |
| Household size | User | `household_size` |
| Theme | User | `theme` |
| App version | User | `app_version` |

### 3. Register custom metric
| Metric name | Scope | Unit | Parameter |
|---|---|---|---|
| Modal duration (ms) | Event | Milliseconds | `duration_ms` |

### 4. Data-stream config
- [ ] **Enhanced measurement** — keep ON (pageviews, scrolls, outbound).
- [ ] **Cross-domain** — add `vyact-twentyx.vercel.app` and
      `vyact-admin.vercel.app` to the allowed domains list.
- [ ] **Google Signals** — leave OFF (privacy guardrail).
- [ ] **IP anonymization** — already default in GA4; confirm visible.

### 5. Audiences
**Admin → Audiences → New audience**
- [ ] *Activated* — `txn_saved` ≥ 1
- [ ] *Power users* — `txn_saved` ≥ 10 in last 7 days
- [ ] *At-risk* — `session_start` ≥ 1 in last 14 days, no `txn_saved`
- [ ] *Multi-currency* — `txn_saved` with ≥ 2 distinct `currency`

### 6. Pinned reports
**Library → Library → Create collection "Vyact Activation"**
- [ ] Activation funnel (Exploration, 5 steps above)
- [ ] Track distribution — bar of `txn_saved` by `track`
- [ ] Modal duration — distribution of `duration_ms` by `track` (p50/p90)
- [ ] Filter usage — `filter_applied` per session by `page`
- [ ] Insight engagement — `insight_actioned` ÷ (`insight_actioned` +
      `insight_dismissed`)

### 7. DebugView validation (every release shipping new events)
1. Append `?debug_mode=1` to the staging URL.
2. Open **GA4 → Admin → DebugView**.
3. Run the relevant flow; assert each event from `events.yaml` appears
   with the expected parameter set.
4. Attach the DebugView screenshot to the release PR.

### 8. Retention
- [ ] **Admin → Data settings → Data retention** — set to **14 months**
      (max for free tier).
- [ ] Confirm **Reset on new activity** is ON.

## Engineering review gates

A PR that adds, removes, or changes a `track()` call MUST:

1. Update [docs/measurement/events.yaml](measurement/events.yaml) in the
   same commit.
2. Cite the event name(s) in the PR description.
3. Pass DebugView validation (screenshot attached) for any new event.

## Test inventory deltas

New rows for `react/e2e/TEST_CASE_INVENTORY.md`:

- **CON-E2E-012** — `gtag` snippet present and `dataLayer` initialised
  on every primary route (S-tier, ~3 h).
- **CON-E2E-013** — `feature_flag_exposure` fires exactly once per session
  for `vt_feature_track_picker` (M-tier, ~6 h).
- **§28 NEW · Telemetry (TLM-FC)** — proposed new section once event
  coverage exceeds 5 callsites:
  - **TLM-FC-001** — `txn_saved` payload contains all required params,
    no PII fields present (M-tier, ~6 h).
  - **TLM-FC-002** — Analytics is no-op when `__vt_store` is present
    (S-tier, ~3 h).
  - **TLM-FC-003** — `bucketAmount()` boundaries (unit test, S-tier).

## Owners

| Area | Owner |
|---|---|
| Event catalog (YAML + this file) | Product |
| `analytics.ts` runtime | Eng — Frontend |
| GA4 admin (dimensions / metrics / conversions / audiences) | Product Analytics |
| DebugView sign-off per release | Release manager |
