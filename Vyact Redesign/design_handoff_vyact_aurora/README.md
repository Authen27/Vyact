# Handoff: Vyact "Aurora" — Full App Redesign

> **Target:** Vyact React web app, production **v9.9.3** (`Authen27/Vyact` → `/react`).
> **Purpose:** Completely redesign the existing app's **look** (design tokens / visual language) and **navigation UX** (desktop + mobile) to the **"Aurora"** direction, and **every screen's UX** — journeys, messaging, and information display. This is a **visual + navigation + screen-level redesign** that **preserves all business logic, data models, routes, and features**.

> **Full screen coverage now exists.** Beyond the two interactive shells, the revamp specifies **all 17 production surfaces** across five review boards (A–E, 47 mobile+desktop frames). Start at **`reference/boards/Vyact Aurora · Prototype.html`** — the hub that links every board. See §14 for the board index and the two cross-cutting specs (forms doctrine, notifications).

---

## 1. Overview

Aurora is a variant of Vyact's **"Neumorphic Fluid"** design language:

- **Soft neumorphism** (dual-light extruded surfaces) for everyday chrome + cards.
- **Glassmorphism** (blur + translucency) reserved for key moments — the command palette, AI insight surfaces, popovers, modals.
- **Aurora palette** — a cool nocturne base (deep teal-slate) with a jade / cyan / indigo / violet accent spectrum.
- **Coral (pip)** is the **primary accent** — the brand action color — pulled from the pip mascot.
- **Type:** Outfit (display) · Inter (UI/body) · JetBrains Mono (all figures).

The redesign has two axes:
1. **Re-skin** every surface/component to the Aurora tokens below.
2. **Replace the navigation** — desktop moves from a left sidebar to a **top app bar + section tabs + contextual subnav + ⌘K command palette**; mobile uses a **bottom tab bar with full-bleed screens**.

---

## 2. About the design files

The files in `reference/` are **design references built in HTML/React-in-Babel** — prototypes that demonstrate the intended look and behavior. **They are not production code to copy directly.** The task is to **recreate these designs in the existing app's environment** — React + Vite + TypeScript + Tailwind + Supabase — using its established patterns (components in `src/components`, pages in `src/pages`, etc.).

Open `reference/Vyact App v2 · Aurora.html` (desktop) and `reference/Vyact Mobile · Aurora.html` (mobile) in a browser to see the target. Use the **Tweaks** panel (toolbar) to flip theme / accent / heading font.

**Fidelity: HIGH.** Colors, typography, spacing, radii, shadows, and interactions are final. Recreate pixel-faithfully using the codebase's libraries.

---

## 3. Target app context (what to keep)

Keep **all** of the following exactly as they are in v9.9.3:
- Routing / route list, page-level data fetching, Supabase calls, auth, households/splits logic.
- `src/constants.ts` category IDs, icons, and **category colors** (used in donut/rows — see §4.7).
- `src/types.ts` shapes, currency formatting in `src/lib`.
- The **Family Pulse Score™** computation and its 4 components (Budgets / Savings / Trend / Debt).

Only the **presentation layer** (Tailwind theme, component styling, and the nav shell) changes.

---

## 4. Design tokens

Ship these as **CSS custom properties** on `:root` / `[data-theme]`, and mirror the ones Tailwind needs in `tailwind.config`. The full, canonical source is bundled at **`reference/vyact-tokens-v2.css`** — treat it as the source of truth; the tables below are for review.

Themes are driven by a `data-theme="dark|light"` attribute on `<html>`. **Dark is primary.** Auto follows `prefers-color-scheme`.

### 4.1 Neutral base

| Token | Dark (Nocturne) | Light (Mist) | Use |
|---|---|---|---|
| `--canvas` | `#0F181B` | `#E7EDEC` | Page **and** raised neu surfaces (they share the base color) |
| `--elevated` | `#17242A` | `#FFFFFF` | Flat lifted surface / sheet base |
| `--sunken` | `#0A1215` | `#DAE3E1` | Wells, input troughs, progress tracks |
| `--hover` | `#1C2C33` | `#EFF4F3` | Row / control hover |
| `--ink` | `#E6EFEC` | `#16211F` | Primary text |
| `--ink-2` | `#A6BAB6` | `#4A5A57` | Secondary text |
| `--ink-3` | `#6E827E` | `#7A8A87` | Muted / captions |
| `--ink-4` | `#47585A` | `#A8B6B3` | Disabled / hairline icons |
| `--line` | `rgba(230,239,236,.08)` | `rgba(20,33,31,.08)` | Hairline dividers |
| `--line-2` | `rgba(230,239,236,.14)` | `rgba(20,33,31,.13)` | Stronger dividers |

### 4.2 Accent (semantic) — the "Accidental Wealth" rule

**Primary accent = Coral (pip).** Semantic colors are meaningful, never decorative.

| Token | Meaning | Dark | Dark tint (`-t`) | Light | Light tint |
|---|---|---|---|---|---|
| `--accent` | **Brand / primary action / focus** (pip coral) | `#EC8474` | — | `#E26D5C` | — |
| `--accent-ink` | text/icon on accent | `#2A1712` | — | `#2A1712` | — |
| `--good` | gains, money moved, positive | `#4FD9AE` | `rgba(79,217,174,.16)` | `#2E9E78` | `rgba(46,158,120,.13)` |
| `--warn` | attention, trending, near-limit | `#F2C978` | `rgba(242,201,120,.16)` | `#B98A38` | `rgba(185,138,56,.15)` |
| `--info` | trust, banking, AI info | `#63D6EA` | `rgba(99,214,234,.15)` | `#2C93A8` | `rgba(44,147,168,.12)` |
| `--fore` | insight, forecast, future | `#C4A6FF` | `rgba(196,166,255,.17)` | `#7C55C4` | `rgba(124,58,237,.12)` |
| `--crit` | **critical alerts only** | `#F58A8C` | `rgba(245,138,140,.16)` | `#D25656` | `rgba(210,86,86,.12)` |

**Rules (important):**
- ❌ **Never use red/`--crit` for "money spent" or negative balances.** Loss is *information*, not failure. Render expense amounts in **neutral `--ink`**; income in `--good`. Reserve `--crit` for genuine failures — a budget at ≥100%, a failed transfer, a frozen account, a low Pulse.
- `--good` = money in / progress. `--warn` = 80–99% of a limit / trending up. `--info` = neutral facts & Net Worth. `--fore` = AI/forecast surfaces.
- **Accent is swappable** (design supports Coral / Indigo `#8B99FA` / Jade `#4FD9AE`); **Coral is the shipping default.**

### 4.3 Raw aurora spectrum (for gradients / charts)
`indigo #6D7CF0` · `jade #38C89B` · `gold #E8B85C` · `cyan #45C6DD` · `violet #B08CF5` · `rose #F0787A` · `coral #E26D5C`.
**Brand rail gradient:** `linear-gradient(120deg,#38C89B 0%,#6D7CF0 52%,#B08CF5 100%)` (avatars, the 3px bar atop the app bar, focus flourishes).

### 4.4 Typography

- **Display / headings / labels:** `Outfit` (fallback `Inter Tight`), weights 500/600/700, tracking `+0.01em` (hero `-0.02em`).
- **Body / UI:** `Inter`, 400/500/600, line-height 1.6.
- **Figures / tickers / IDs:** `JetBrains Mono`, tabular-nums — use for **every** currency value, percentage, date, and account number.

| Role | Size / line-height / weight |
|---|---|
| Hero | 56 / 1.2 / 700 |
| Primary title | 32 / 1.3 / 700 |
| Secondary title | 24 / 1.3 / 600 |
| Section label ("overline") | 11–12, mono, `letter-spacing:.16em`, uppercase, `--ink-3` |
| Subtitle | 16 / 1.5 / 500 |
| Body | 14 / 1.6 / 400 |
| Meta | 12 / 1.5 / 500 |

Minimum body size on mobile: **14px** (16px for inputs to avoid iOS zoom).

### 4.5 Spacing, radii, motion

- **Spacing (8pt grid):** 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Radii:** `r-1 8` · `r-2 12` · `r-3 18` · `r-4 26` · `pill 999`. Corners soften as surfaces grow.
- **Motion:** standard ease `cubic-bezier(.4,0,.2,1)`; spring `cubic-bezier(.34,1.56,.64,1)` (chart/segment). Durations: micro **140ms**, standard **300ms**, elaborate **620ms**. Respect `prefers-reduced-motion`.

### 4.6 Elevation — the two morphisms

**Neumorphism** (default for cards, buttons, inputs, nav pills). Dual shadow computed from the shared `--canvas`:

```css
/* DARK: neu-dark #060D0F, neu-lite #1A2A30 */
--neu:       6px 6px 16px #060D0F, -5px -5px 14px #1A2A30;
--neu-sm:    3px 3px 8px  #060D0F, -3px -3px 7px  #1A2A30;
--neu-lg:    12px 12px 30px #060D0F, -9px -9px 24px #1A2A30;
--neu-inset: inset 4px 4px 10px #060D0F, inset -4px -4px 10px #1A2A30;
--neu-hover: 9px 9px 22px #060D0F, -7px -7px 18px #1A2A30;
/* LIGHT: neu-dark #C6D2CF, neu-lite #FFFFFF (same offsets) */
```
- **Raised** = `--neu`. **Hover** = `--neu-hover` + `translateY(-2px)`. **Pressed / active / selected / input trough** = `--neu-inset`.

**Glass** (command palette, popovers, AI-insight banners, modals only):
```css
background: var(--glass);            /* dark rgba(26,42,48,.55) · light rgba(255,255,255,.64) */
backdrop-filter: blur(18px) saturate(150%);
border: 1px solid var(--glass-line); /* dark rgba(220,240,255,.14) · light rgba(255,255,255,.9) */
box-shadow: var(--cast-3), inset 0 1px 0 var(--glass-hi);
/* --cast-3 dark: 0 20px 48px rgba(0,0,0,.58), 0 4px 12px rgba(0,0,0,.4) */
```

**Ambient:** apply the soft aurora radial glow (`--ambient`, see CSS file) behind the main content area only — subtle, non-distracting.

### 4.7 Category colors — keep from `constants.ts`
Do **not** recolor categories to the accent palette; the donut/rows rely on distinct hues. Current values (keep): Food&Dining `#E8A87C`, Groceries `#85A88A`, Transport `#4A6FA5`, Rent/Mortgage `#C44536`, Utilities `#F4D27A`, Shopping `#E26D5C`, Health `#85A88A`, Entertainment `#6E4555`, Education `#6B7C53`, Travel `#4A6FA5`, Insurance `#6B635C`, Loan/EMI `#C44536`, Other `#6B635C`, Salary `#85A88A`.

### 4.8 Tailwind config extension (drop-in)

```js
// tailwind.config — extend (colors read the CSS vars so theme-switch is free)
theme: { extend: {
  colors: {
    canvas:'var(--canvas)', elevated:'var(--elevated)', sunken:'var(--sunken)', hover:'var(--hover)',
    ink:{DEFAULT:'var(--ink)','2':'var(--ink-2)','3':'var(--ink-3)','4':'var(--ink-4)'},
    accent:{DEFAULT:'var(--accent)', ink:'var(--accent-ink)'},
    good:'var(--good)', warn:'var(--warn)', info:'var(--info)', fore:'var(--fore)', crit:'var(--crit)',
  },
  fontFamily:{ display:['Outfit','Inter Tight','sans-serif'], sans:['Inter','sans-serif'], mono:['"JetBrains Mono"','monospace'] },
  borderRadius:{ 'r1':'8px','r2':'12px','r3':'18px','r4':'26px' },
  boxShadow:{ neu:'6px 6px 16px var(--neu-dark),-5px -5px 14px var(--neu-lite)',
              'neu-sm':'3px 3px 8px var(--neu-dark),-3px -3px 7px var(--neu-lite)',
              'neu-inset':'inset 4px 4px 10px var(--neu-dark),inset -4px -4px 10px var(--neu-lite)',
              'neu-hover':'9px 9px 22px var(--neu-dark),-7px -7px 18px var(--neu-lite)' },
  transitionTimingFunction:{ spring:'cubic-bezier(.34,1.56,.64,1)' },
}}
```
Put the raw `--neu-dark` / `--neu-lite` (and all color vars) on `[data-theme]` blocks so both themes resolve automatically.

---

## 5. Component mapping (existing → Aurora)

Recreate each existing component with these specs. States in **bold** are required.

- **Card / Panel** (`components/ui/Card.tsx`): `background:--canvas; border-radius:r3; box-shadow:--neu`. **Hover** (if interactive): `--neu-hover` + `translateY(-2px)`, 240ms. Optional 3px accent **spine** (left, inset 14px) or **base bar** to categorize. Panel header = mono overline (`--ink`) + right-aligned "View all →" link in `--accent`, divided by `--line`.
- **Button** (`components/ui/Button.tsx`): height 44–46, `radius:r2`, display font 600.
  - **Primary:** `bg:--accent; color:--accent-ink; shadow:--neu`. **Hover:** `--neu-hover` + soft accent glow. **Active:** `--neu-inset` + `translateY(1px)`.
  - **Neu (secondary):** `bg:--canvas; color:--ink; shadow:--neu` → hover `--neu-hover` → active `--neu-inset`.
  - **Glass** (on rich surfaces): glass recipe. **Ghost:** transparent → hover `--neu-sm`.
  - **Disabled:** opacity .42, no shadow. **Loading:** inline spinner + "Working…". **Success:** brief `--good` ring + check.
- **Input** (`components/ui/Input.tsx`): borderless trough. **Resting/Filled:** `bg:--sunken/--canvas; shadow:--neu-inset`. **Focus:** `--neu-inset, 0 0 0 2px var(--accent)` + accent dot. **Error:** inset 3px `--crit` left bar + helper text + one-shot shake (140ms). Prefix (e.g. `$`) in mono `--ink-3`.
- **TxnRow** (`components/transactions/TxnRow.tsx`): 34px rounded category tile (`catColor @ 15%` bg + `--neu-sm`), optional payment-method chip (22px, brand color), name in Inter 600 `--ink`, `category · date` in **mono** `--ink-3`, amount **mono** 600 — `+` income `--good`, `−` expense `--ink` (neutral). Row **hover** = `--hover`. Divider `--line`.
- **BudgetRow:** label + `spent/limit` (mono), 6px track (`--sunken`, `--neu-inset`) with fill: `--accent` (<80%), `--warn` (80–99%), `--crit` (≥100%); `%` overline below. Fill transitions 600ms.
- **Metric card:** mono overline label, 26px mono value, 3px base bar in a semantic color; value color per meaning (income `--good`, savings-rate `--good`/`--warn` at 20% threshold).
- **Hero cards (Cash Flow / Net Worth):** big 32px mono value; Cash Flow `--good` (≥0) else `--warn`; Net Worth neutral `--ink`; left accent spine (`--good` / `--info`); two sub-stats (In/Out, Assets/Debts).
- **PulseGauge** (`components/charts/PulseGauge.tsx`): neu-inset circular well → `conic-gradient(statusColor deg, --sunken)` ring → inset center disc with 40px mono score. Status: ≥75 `--good`, 50–74 `--warn`, <50 `--crit`. Below: 4 component mini-bars (Budgets/Savings/Trend/Debt) same thresholds. Animate sweep 900ms.
- **Category donut** (`components/charts/DonutCharts.tsx`): `conic-gradient` from category colors in a neu-inset ring; inset center shows total (mono). Legend rows: dot · label · amount · %. Never more than the real categories; sort desc.
- **Insight chip:** left 3px tone bar (good/warn/alert→`--crit`/info), emoji, text `--ink`, detail `--ink-3`, chevron in `--accent` when it links. Hover raises if actionable.
- **AI insight surface / celebrations:** use the **glass** recipe + `--fore` tint; number tick-up + subtle confetti (3–5 particles) on goal/milestone.

---

## 6. Navigation UX — DESKTOP (replaces `Sidebar.tsx`)

Remove the left sidebar. Build a **top-anchored** shell:

### 6.1 Top app bar (sticky, glass, z 50)
- 3px `--rail` gradient strip along the very top edge.
- **Left:** pip mark + "Vy·act" wordmark (the `act` in `--accent`). Clicking → Dashboard.
- **Center:** **Section tabs** — a neumorphic sliding-pill segmented control with **Track · Plan · Analyze**. The pill slides (spring, 260ms); active label in `--accent`.
- **Right:** a **"Jump to… ⌘K"** search button (neu-inset pill) that opens the command palette; a notification bell (neu circle, `--warn` dot); an **account menu**.
- Container `max-width:1320px`, centered.

### 6.2 Contextual subnav (sticky under the bar, z 40)
A horizontal **pill row** of the routes inside the active section (neu pills; active = `--neu-inset` + `--accent`). Prefixed by the section name (mono overline). Horizontally scrollable if narrow.

### 6.3 Section ↔ route map (complete — no route lost)
| Section | Routes (subnav order) |
|---|---|
| **Track** | Dashboard · Transactions · Splits · Recurring |
| **Plan** | Budgets · Debts · Net Worth · Accounts |
| **Analyze** | Reports · Insights |
| **Account menu** (avatar dropdown, not a tab) | Households · Settings · Help & Guide |

Selecting any route sets `route` and syncs the active section. Selecting a section jumps to its **first** route.

### 6.4 ⌘K Command palette (glass modal, z 100)
- Opens on **⌘K / Ctrl-K** or the search button. Autofocus input.
- Live fuzzy filter over: **Quick actions** (Add transaction, New budget, Ask Vyact) + **every route**, grouped by section + Account.
- Keyboard: **↑/↓** move, **↵** open, **Esc** close. Selected row = `--neu-inset`, its icon tile flips to `--accent`.
- Footer hints: "↑↓ navigate · ↵ open · N results". This is the guarantee that **all functionality stays reachable**.

### 6.5 Account menu
Avatar pill ("Family" + initials on `--rail`) → glass dropdown: household identity, the 3 Account routes, and a **theme segmented control** (Light / Dark / Auto).

### 6.6 Main content
Centered `max-width:1320px`, generous padding, ambient glow behind. The Dashboard composition is fully specified in `reference/vy-screens-v2.jsx` (heroes → Pulse+metrics+insights → budgets+recent → donut → debt overview).

---

## 7. Navigation UX — MOBILE (bottom tabs + full-bleed screens)

Below **640px**, drop the desktop shell and render a **native-feeling mobile app**:

- **Full-bleed screen:** `100vw × 100dvh`, flex column — status bar (optional) → scrolling content → **bottom tab bar** → home-indicator safe-area pad. No device bezel in production (the HTML reference shows a bezel only for presentation; ship it edge-to-edge).
- **Bottom tab bar:** 5 tabs, each an icon + label; active tab icon/label in `--accent`, sitting on an `--accent @ 16%` rounded pill. Hit targets ≥ 44px.
- **Recommended production tab set (section-based, keeps every route):**

| Tab | Opens | Secondary routes reached from here |
|---|---|---|
| **Home** | Dashboard | — |
| **Track** | Transactions | Splits, Recurring (top segmented control / filter) |
| **Plan** | Budgets | Debts, Net Worth, Accounts (in-screen section switch) |
| **Analyze** | Insights | Reports (tab within screen) |
| **Profile** | Account | Households, Settings, Help |

> The HTML mobile reference (`Vyact Mobile · Aurora.html`) demonstrates the **visual language, full-bleed layout, and interactions** using placeholder consumer tabs (Home/Activity/Insights/Goals/Me). For the **real app**, use the section-based tab set above so the mobile IA mirrors desktop and no v9.9.3 route is dropped. On narrow screens, a section's routes become a **top segmented control / horizontal pill scroller** inside the tab (mirroring the desktop subnav).

- Same Aurora tokens, same components, larger touch spacing. Cards go full-width, grids collapse to one column.

---

## 8. Responsive rules

- **≥ 1024px:** full desktop shell, multi-column dashboard (2-up heroes, 3-up metrics, 2-up budgets/recent, 170px+list donut).
- **640–1023px (tablet):** desktop shell but section tabs wrap to their own centered row; dashboard grids collapse (heroes 1-col, metrics 2-col, budgets/recent 1-col); subnav scrolls; search button becomes icon-only.
- **< 640px:** switch to the **mobile** experience (§7).
- Use a single source of truth for the breakpoint (e.g. a `useMediaQuery` hook or Tailwind `sm/lg`).

---

## 9. Accessibility

- Contrast **WCAG AA** minimum on all text (AAA on primary figures). Never rely on color alone — pair with icon/label (e.g. Pulse status also shows a word).
- Full keyboard support: command palette, section tabs, subnav, menus. Visible focus = `2px solid var(--accent)` offset 2px.
- `prefers-reduced-motion`: disable the tick-ups, confetti, sweeps, and slides (show end-state).
- Semantic HTML + `aria-label`s on icon-only controls; charts get text alternatives.

---

## 10. pip (logo)

Keep **pip** as the mark everywhere (coral face, cheeks, smile, sage sprout). SVG source is in `reference/vy-screens-v2.jsx` (`Pip` component) and `vy-app-v2.jsx`. Wordmark: "Vy" in `--ink` + "act" in `--accent`. Do not restyle pip per theme — it sits on any background.

---

## 11. File-by-file checklist (maps to `/react/src`)

- `index.css` / new `theme.css` → add all CSS vars on `:root`+`[data-theme="dark|light"]`; import Outfit/Inter/JetBrains Mono.
- `tailwind.config.*` → apply §4.8 extension.
- `components/layout/Sidebar.tsx` → **replace** with `TopBar.tsx` + `SectionTabs.tsx` + `SubNav.tsx` + `CommandPalette.tsx` + `AccountMenu.tsx` (+ `MobileTabBar.tsx`). Add a `useCommandPalette` (⌘K) hook and a `useMediaQuery` hook.
- `App.tsx` → render the new shell around the router outlet; wire section↔route sync; mount `<CommandPalette>` globally; branch to mobile shell below 640px.
- `components/ui/{Card,Button,Input}.tsx` → restyle per §5.
- `components/charts/{PulseGauge,DonutCharts}.tsx` → restyle per §5 (logic unchanged).
- `components/transactions/TxnRow.tsx` + budget/metric/insight components → restyle per §5.
- `pages/*` → no structural change; they inherit the new tokens/components. Verify each page under the new shell.
- Theme state (dark/light/auto) → persist to localStorage; default **dark**; accent default **Coral**.

## 12. Suggested migration order
1. Tokens (CSS vars + Tailwind) + fonts. 2. `ui/` primitives (Card/Button/Input). 3. Charts (Pulse/Donut) + rows. 4. **Desktop nav shell** (TopBar/Tabs/SubNav/CommandPalette/AccountMenu) replacing Sidebar. 5. **Mobile shell** (tab bar + full-bleed + responsive switch). 6. Page-by-page QA in both themes. 7. A11y + reduced-motion pass.

---

## 13. Files in this bundle (`reference/`)
- `boards/Vyact Aurora · Prototype.html` — **hub** linking all five screen boards (open this first for the full redesign).
- `boards/batch-a…e/` — the five design-canvas boards (A Shell+Home · B Track · C Plan · D Analyze · E Profile), each with its `batch-*.css`.
- `boards/Vyact Revamp · Inventory & Plan.html` — the production audit + build plan (Step 1).
- `notifications-spec.md` — the 13-type notification requirements &amp; acceptance criteria (§14.2).
- `Vyact App v2 · Aurora.html` — **desktop** target shell (interactive).
- `Vyact Mobile · Aurora.html` — **mobile** target (full-bleed < 640px).
- `vyact-tokens-v2.css` — **canonical token source** (dark + light).
- `vy-app-v2.jsx` — desktop nav shell (TopBar, SectionTabs, SubNav, CommandPalette, AccountMenu, responsive root).
- `vy-screens-v2.jsx` — Dashboard + all card/row/chart components + nav model (sections, route map).
- `vy-mobile.jsx` — mobile screens + bottom tab bar + full-bleed responsive root.
- `vy-components.jsx` — shared primitives (buttons/inputs/charts/ring/ticker/confetti).
- `tweaks-panel.jsx` — support only (in-prototype controls); **not** for production.

*These are design references — recreate them in the React/Tailwind app; do not ship the HTML.*

---

## 14. Screen boards (the full redesign)

The five boards under `reference/boards/` are **design-canvas layouts** (pan/zoom; each shows mobile 390px + desktop 1440px frames side by side, with a caption under each explaining intent). Open **`boards/Vyact Aurora · Prototype.html`** first — it links all five. These define the **screen-level UX** the token/nav specs above are applied within.

| Board | Surfaces covered |
|---|---|
| **A · Shell + Home** | App shell (top bar, footer tabs, ⌘K), **notification pull-down**, **household switch pull-down**, account menu, Dashboard, **Add-Transaction half-sheet**, system states (toast/skeleton/empty/error) |
| **B · Track** | Transactions (chip-rail filters, saved views, month accordions, calendar layer), Splits (who-owes-who, settle, track-as-debt), Recurring (**sentence-builder** form, upcoming strip) |
| **C · Plan** | Budgets (in-hero pace chart vs limit), Debts (payoff journey, strategy toggle), Net Worth (**waterfall** equation, liabilities beyond debts), Accounts (wallet + per-kind ledger, cycle utilization, balance check) |
| **D · Analyze** | Reports (period lens, area chart, donut, needs/wants, tables→cards), Insights hub (**For You reel**, **Learn** library, **Plan** rules-not-AI), Ask Vyact (intents, streaming chat, voice) |
| **E · Profile + first-run** | Settings (grouped list, theme thumbnails, quarantined danger zone), Households (switcher, roles, invite sheet, activity), Help (FAQ), **Onboarding** (6-step, pip-guided, celebratory reveal), **Auth** (SSO + whisper inputs, split-hero) |

### 14.1 Forms doctrine (applies to every add/edit flow)
The production forms (long stacked inputs + dropdowns) are replaced by one pattern: a **bottom half-sheet** (mobile) / compact glass dialog (desktop), **amount-first**, tappable **chips instead of dropdowns**, smart defaults pre-filled, the 90% case committing in ≤ 3 taps, an in-sheet numeric keypad (Add Transaction) so chips stay visible, and "Save &amp; add another" for batch entry. Recurring becomes a **sentence builder** ("repeat *monthly* on the *3rd* · *auto-approve*") with full RRULE parity. See boards A (Add txn), B (Recurring), C (Add budget/debt/account), E (Invite).

### 14.2 Notifications — see `reference/notifications-spec.md`
The bell opens a **full-screen top pull-down** (both platforms), grouped Today/Earlier, with **inline decisions per type**. The spec enumerates **13 notification types** (triggers, copy patterns, per-type actions, deep links, dedupe rules, settings scope, acceptance criteria). Household switching uses the same pull-down gesture.

### 14.3 Messaging voice
**Warm companion**, not neutral SaaS: “You're on track this week — $220 under budget,” “June ended +$1,240 ahead,” “71% needs — solid.” Concrete numbers, plain language, never jargon. pip appears at guiding moments (onboarding, empty states, Ask Vyact).

### 14.4 Motion
Every list staggers in; numbers tick up; charts draw in; rings/bars fill; sheets slide with a scrim; the For-You reel animates its progress + number + bars. All gated on `prefers-reduced-motion` (end-state shown when reduced).
