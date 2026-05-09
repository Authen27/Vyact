# FinFlow Admin · v8.0

> Separate React app for product administration. **Native Claude theme** — warm
> off-white paper, terracotta primary, Source Serif 4 + Inter typography.

## What this is

The admin backend specified in v7 PRD §07 and shipped in v8.

- **Three role tiers**:
  - 🔴 **Super Admin** — full access to all sections
  - 🟦 **Roles Admin** — user management + audit only
  - 🟧 **Content Admin** — article CMS only
- **Sections**: Dashboard (NorthStar + 12 KPIs) · Users · Households · Subscriptions · Content · Audit Log · Settings
- **NorthStar metric**: Active Households per Week (AHpW) — defined in PRD §08
- **Mock data layer** today; wires to Supabase + Stripe + PostHog + Intercom in v8.1

## Why a separate app

Per PRD §07 — different bundle, auth flow, deploy cadence, and security posture from the consumer app:

- Different bundle — admin doesn't ship to consumer users
- Different auth flow (Google Workspace SSO planned, vs email/password for consumer)
- Different deploy cadence — admin can ship daily without consumer release coordination
- Different security posture — admin behind VPN/IP allowlist
- Different visual language — Claude native theme, not the FinFlow paper-warm of the consumer app

## Tech stack

Same as consumer (`react/`):
- Vite 5 · React 18 · TypeScript 5 · Tailwind 3 · Recharts · Zustand · React Router 6 · Lucide React

## Run

```bash
cd admin
npm install
npm run dev          # → http://localhost:5174
```

The consumer app runs at `:5173`, this admin at `:5174` — both can run simultaneously.

## File structure

```
admin/
├── package.json
├── vite.config.ts · tsconfig.json · tailwind.config.ts · postcss.config.js
├── index.html · README.md
└── src/
    ├── main.tsx                    — entry
    ├── App.tsx                     — routes + role-based gating
    ├── index.css                   — Claude theme HSL vars + Recharts overrides
    ├── types.ts                    — User, Household, Subscription, Article, AuditEntry, KpiSnapshot
    ├── store.ts                    — Zustand: role, dark-mode, query
    ├── lib/
    │   └── mockData.ts             — 220 users, 80 audit entries, 12 weeks of KPI history
    ├── components/
    │   └── Layout.tsx              — sidebar + topbar + role switcher
    └── pages/
        ├── Dashboard.tsx           — NorthStar (AHpW) + 12 KPI cards + 3 trend charts
        ├── Users.tsx               — searchable list with status / tier filters
        ├── Households.tsx          — card grid by household type
        ├── Subscriptions.tsx       — MRR + tier mix donut + active subs list
        ├── Content.tsx             — article CMS with status filters
        ├── Audit.tsx               — immutable activity log
        └── Settings.tsx            — appearance + integrations + security
```

## NorthStar Dashboard

Per PRD §08, the dashboard centers on **Active Households per Week (AHpW)** —
the heartbeat of the product. A household where 2+ members logged in or recorded
a transaction in the past 7 days. Single-user accounts count as 0.5.

The 12 KPIs from the PRD all render with target thresholds and good/warn states:

| KPI | Target |
|---|---|
| Time to first transaction | < 90s |
| Template completion rate | > 90% |
| D7 retention | > 60% |
| Avg sessions per user per week | > 4 |
| Multi-member households | > 40% |
| D90 retention | > 50% |
| Pulse Score improving 30d | > 70% |
| Reminder confirmed | > 80% |
| AI Planner recs followed | > 25% |
| AI Chatbot satisfaction | > 4.2 / 5 |
| Free → Paid conversion | > 8% |
| NPS | > 50 |

## Role gating

The role switcher at the bottom of the sidebar lets you preview the experience for
each tier. Routes are gated client-side today; server-side enforcement (Postgres
RLS + JWT role claim) lands in v8.1.

```ts
// App.tsx
const can = (page: string): boolean => {
  if (role === 'super')   return true;
  if (role === 'roles')   return ['dashboard','users','households','audit'].includes(page);
  if (role === 'content') return ['dashboard','content'].includes(page);
  return false;
};
```

## Theme

**Claude native** — designed to feel like claude.ai's interface:
- Background: `#FAF9F5` (cream paper)
- Surface: `#FFFFFF` (cards)
- Primary: `#D97757` (Anthropic terracotta)
- Text: `#251F1A` (warm dark)
- Display: **Source Serif 4** (open-source equivalent of Tiempos)
- UI: **Inter**
- Mono: **JetBrains Mono**

Dark mode uses warm dark browns instead of pure black.

## Roadmap

- **v8.1** — Real Supabase auth + RLS · Real Stripe webhooks · Real PostHog/Intercom integrations · Article publish workflow with editorial review · Audit log SIEM export
- **v8.2** — Embedded Looker Studio for advanced analytics · Customer Success conversation linking
- **v9.0** — Multi-tenant scoping (admin sees per-org metrics for enterprise customers)
