// Vyact Admin v8 — Help / User Manual
// Per-tier guidance so Super, Roles, and Content admins know what they can do
// and how to do it. Searchable accordion.

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useAdminStore } from '../store';
import type { AdminRole } from '../types';

interface Section {
  q: string;
  a: string;
  audience: AdminRole[];   // who this section is most relevant to
}

const SECTIONS: Section[] = [
  // ─── Onboarding ──────────────────────────────────────────────
  { q: 'How do I get admin access?', audience: ['super','roles','content'],
    a: 'Admin access is granted server-side via the public.admin_roles table. A Super Admin must add your user id with the appropriate role (super / roles / content). Sign in with the same email/password as the consumer app — your role is loaded automatically on sign-in.' },
  { q: 'What are the three role tiers?', audience: ['super','roles','content'],
    a: 'Super Admin sees everything and changes staff roles. Roles Admin opens the Dashboard, Users, Households and the household Audit Log. Content Admin opens Content and AI Intelligence and lands on Content. Each page is offered only to the tiers whose data it can read; opening another one returns 403.' },
  { q: 'Why is the role switcher disabled for me?', audience: ['roles','content'],
    a: 'Only Super Admins can preview lower tiers from the sidebar role switcher. For Roles and Content admins, the role is locked to whatever the server says. This prevents privilege escalation via localStorage tampering.' },

  // ─── Super admin ─────────────────────────────────────────────
  { q: 'How do I grant another user admin access?', audience: ['super'],
    a: 'On Users, use the Staff role control on their row and confirm. Removing a role works the same way. Vyact always keeps one super admin: grant another before removing the last. Every change is recorded in Audit Log → Staff actions. Their next sign-in picks up the new role.' },
  { q: 'How do I monitor product health?', audience: ['super'],
    a: 'The Dashboard shows live counts from the production database (people, households, activity, content) and the weekly trend. Revenue (MRR) is shown per currency, never added across currencies. Metrics that need event tracking show as not wired yet.' },
  { q: 'How do I read the Audit Log?', audience: ['super','roles'],
    a: 'Household activity is newest first: who acted (a user id), when, what they did (created, updated, deleted, invited…) and the kind of record. It never shows amounts, names or descriptions. An entry Vyact wrote on a schedule shows "Vyact (automatic)"; one sent from WhatsApp names its sender. Search by action, record type or actor id, or export the list as CSV. Super admins also see Staff actions: what Vyact staff changed.' },

  // ─── Roles admin ─────────────────────────────────────────────
  { q: 'How do I help a user who can\'t sign in?', audience: ['super','roles'],
    a: 'Search them in Users. Check status (active/invited/suspended/churned). Confirm email is verified — Settings shows a "Verification pending" pill if not. For password issues, direct them to /auth/reset on the consumer app; never collect or set their password yourself.' },
  { q: 'Can I impersonate a user to debug their account?', audience: ['super','roles'],
    a: 'No, and this is intentional. The admin app does not store or transmit user passwords, and impersonation is disabled. Use their household composition and the household Audit Log to reproduce issues.' },
  { q: 'How do I suspend a problematic account?', audience: ['super','roles'],
    a: 'The console has no suspend. A person can delete their own account in the app (Settings), which removes their data. For abuse, escalate to engineering with the user id; do not change data by hand.' },

  // ─── Content admin ───────────────────────────────────────────
  { q: 'How do I create a new article?', audience: ['super','content'],
    a: 'Content → New Article. Fields: title (auto-generates slug), summary (1-line preview shown on the consumer Insights cards), body (full text), topic (one of debt/tax/investment/budgeting/savings/retirement), read-minutes estimate, cover emoji. Save as Draft to keep it private; set status to Published to surface it on the consumer app.' },
  { q: 'What happens when I publish an article?', audience: ['super','content'],
    a: 'Setting status=published writes published_at=now() and the row immediately becomes readable to every authenticated consumer user via RLS policy "anyone reads published". The new article appears at the top of /insights in the consumer app within seconds.' },
  { q: 'How do I unpublish or retire content?', audience: ['super','content'],
    a: 'Change status to "archived" — the row is preserved (so users\' favorite references don\'t break) but it disappears from the public list. Use "draft" to take it offline temporarily for edits. Use "review" to flag a revision for editorial sign-off before re-publishing.' },
  { q: 'Where is content visible to consumers?', audience: ['super','content'],
    a: 'In the consumer app at /insights — a search-and-favorite list of all published articles, ordered newest first. Users can favorite (♡) any article to a personal reading list (favorites are user-scoped, not household-scoped, so they follow the user across multiple households).' },
  { q: 'How do I write good summaries?', audience: ['super','content'],
    a: 'The summary is the only text on the consumer card. Aim for one sentence under 100 chars that names the question or concrete outcome. "Avalanche vs Snowball: which debt strategy wins?" beats "Debt strategies explained." Lead with the user\'s question, not the topic.' },

  // ─── Operational ─────────────────────────────────────────────
  { q: 'Where is the production deployment?', audience: ['super','roles','content'],
    a: 'Consumer at https://vyact.app · Admin at https://admin.vyact.app. Both apps read their public URL from a committed VITE_APP_URL in react/.env.production / admin/.env.production, not a GitHub Actions secret. Both deploy on push to main via .github/workflows/deploy.yml.' },
  { q: 'How do I check what an admin did?', audience: ['super'],
    a: 'Audit Log → Staff actions (super admins): every staff role granted or removed, every Learn content change (which fields, never the text), every needs/wants change and every AI model setting change, with who and when. It cannot be edited or deleted. A change made in the Supabase dashboard shows as "Dashboard or migration".' },
  { q: 'What if I see an error or unexpected behavior?', audience: ['super','roles','content'],
    a: 'Open the browser console (F12) and capture the error. For data anomalies, check Supabase logs (api/auth/postgres). Report to engineering with the deployment ID from the footer and a screenshot.' },
];

const TIER_LABEL: Record<AdminRole, { label: string; desc: string; emoji: string }> = {
  super:   { label: 'Super Admin',   desc: 'Full access — user mgmt, content, settings, billing', emoji: '👑' },
  roles:   { label: 'Roles Admin',   desc: 'User + household management, audit log',                emoji: '👥' },
  content: { label: 'Content Admin', desc: 'Article library — create / edit / publish',             emoji: '✍️' },
};

export default function Help() {
  const role = useAdminStore(s => s.role);
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [filterTier, setFilterTier] = useState<AdminRole | 'mine' | 'all'>('mine');

  const filtered = useMemo(() => {
    return SECTIONS
      .map((s, originalIdx) => ({ ...s, originalIdx }))
      .filter(s => {
        if (filterTier === 'all')  return true;
        if (filterTier === 'mine') return s.audience.includes(role);
        return s.audience.includes(filterTier);
      })
      .filter(s => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return s.q.toLowerCase().includes(q) || s.a.toLowerCase().includes(q);
      });
  }, [query, filterTier, role]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="display-serif text-3xl text-ink mb-1">Help &amp; User Manual</h1>
        <p className="text-ink-mid text-[0.92rem]">
          Guides and references for each admin tier. {SECTIONS.length} topics · searchable
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {(Object.keys(TIER_LABEL) as AdminRole[]).map(r => (
          <div key={r}
            className={`panel p-4 ${role === r ? 'border-claude' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{TIER_LABEL[r].emoji}</span>
              <span className="display-serif text-lg text-ink">{TIER_LABEL[r].label}</span>
              {role === r && <span className="ml-auto font-mono text-[0.55rem] tracking-widest uppercase text-claude">You</span>}
            </div>
            <p className="text-[0.78rem] text-ink-mid leading-snug">{TIER_LABEL[r].desc}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpenIdx(null); }}
            placeholder="Search topics…"
            className="w-full bg-elev border border-line rounded-md pl-8 pr-3 py-2 text-[0.84rem] outline-none focus:border-claude"
          />
        </div>
        <div className="flex gap-1.5">
          {(['mine','super','roles','content','all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterTier(t)}
              className={`font-mono text-[0.58rem] tracking-[0.12em] uppercase px-2.5 py-1.5 rounded-md border transition ${
                filterTier === t ? 'bg-claude text-white border-claude' : 'bg-surface border-line text-ink-mid hover:border-line2 hover:text-ink'
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Accordion */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-ink-mid text-sm">No topics match "{query}"</div>
        )}
        {filtered.map(s => {
          const isOpen = openIdx === s.originalIdx;
          return (
            <div key={s.originalIdx} className="panel overflow-hidden">
              <button
                onClick={() => setOpenIdx(isOpen ? null : s.originalIdx)}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 hover:bg-elev transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-[0.88rem] mb-1">{s.q}</div>
                  <div className="flex gap-1">
                    {s.audience.map(a => (
                      <span key={a}
                        className="font-mono text-[0.52rem] tracking-widest uppercase px-1.5 py-0.5 rounded bg-claude/10 text-claude">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-ink-dim flex-shrink-0 transition-transform"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </button>
              {isOpen && (
                <div className="border-t border-line px-4 py-3 text-[0.84rem] text-ink-mid leading-relaxed">
                  {s.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
