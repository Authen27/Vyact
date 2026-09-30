// Vyact — use-case landing pages: /for/couples, /for/families (v10.51.0, marketing #7).
//
// The keyword research found "budget app for couples" and "family budget app (multiple users)" live
// in every market, with no single household brand owning the results — and the landing page alone
// can't rank for both. Each page answers the query first (a 40–60-word quick answer), teaches the
// thing people search for alongside it ("how to budget as a couple", "split bills by income"), shows
// what Vyact does for that household, and ends with one call to action. Server-rendered in the app's
// theme (api/_page.js). Every product claim here is one already verified for the landing page
// (src/content/landingCopy.ts) — keep it that way.

import { BASE, esc, page, signUpUrl } from './_page.js';
import { seoFor } from './_seo.js';

const LESSON = (slug, fallback) => ({ slug, title: (seoFor(slug) || {}).title || fallback });

export const AUDIENCES = {
  couples: {
    title: 'Budget App for Couples: One Shared Budget, Your Way',
    description: 'A budget app for couples: one shared budget, separate logins, bills before they’re due, fair splits by income and a debt payoff plan. Free to start.',
    h1: 'The budget app for couples',
    answer: 'A good budget app for couples gives each partner their own login to the same numbers: one shared budget by category, the bills coming up, what each of you spent, and your net worth. Vyact does that, lets you keep personal spending out of the shared totals, and is free to start.',
    sections: [
      ['Three ways couples split money', [
        '**Fully joint** — all income into one pot, all costs out of it. Simplest to track; works best when you agree on spending.',
        '**Proportional to income** — each pays the same share of their income toward joint costs (for example 60/40). Feels fairer when incomes differ.',
        '**Yours, mine and ours** — a joint pot for rent, groceries and goals, plus personal money each that nobody has to justify.',
      ]],
      ['How couples use Vyact', [
        '**One budget, two logins.** Invite your partner; you both log spending into the same household and see the same totals.',
        '**Bills before payday.** Rent, subscriptions and loan payments on one calendar, posted automatically or when you approve them.',
        '**Keep some things personal.** Mark a purchase private and it stays out of the shared totals.',
        '**A monthly money date.** Fifteen minutes: what’s coming up, how last month went, one goal. Vyact has the numbers ready.',
        '**Ask before you spend.** Pip, the built-in assistant, answers “can we afford the weekend away?” from your own budget and balances.',
      ]],
    ],
    faq: [
      ['What is the best way for couples to budget?', 'Agree the structure first — fully joint, proportional to income, or yours-mine-and-ours — then keep one shared budget you both can see and check it together once a month. The method matters less than both of you seeing the same numbers.'],
      ['Should couples split bills 50/50 or by income?', 'When incomes differ, splitting by income usually feels fairer: each partner pays the same percentage of their income toward joint costs. 50/50 works well when incomes are similar.'],
      ['Can we keep separate accounts and still budget together?', 'Yes. Add each account you spend from to the household; the shared budget and totals cover all of them, and personal purchases can be kept out of the shared totals.'],
      ['Is Vyact free for couples?', 'Yes — Vyact is free to start, and both partners can use it with their own login.'],
    ],
    lessons: [LESSON('ev-105-yours-mine-and-ours', 'Yours, mine, and ours'), LESSON('ev-106-the-monthly-money-date', 'The monthly money date'), LESSON('ev-003-the-50-30-20-starting-point', 'The 50-30-20 starting point'), LESSON('ev-021-how-big-is-enough', 'How big is “enough”?')],
    ref: 'for_couples',
  },
  families: {
    title: 'Family Budget App for Multiple Users | Vyact',
    description: 'A family budget app for the whole household: everyone logs in, one shared budget, bills on a calendar, split costs and plan big expenses ahead. Free to start.',
    h1: 'The family budget app everyone can use',
    answer: 'A family budget app should let everyone who shares the household’s money use it — each with their own login and the right access — and show one budget, the bills coming up and where the money went. Vyact does that for families of any size, in your own currency, and is free to start.',
    sections: [
      ['How to budget as a family', [
        '**Start with what’s already committed** — rent or mortgage, school fees, loan payments, subscriptions — before planning anything else.',
        '**Give every category a monthly limit** and check the categories, not just the total.',
        '**Plan the predictable big costs** — festivals, holidays, insurance, school terms — by setting aside a little each month.',
        '**Review together once a month.** A short family money check-in prevents most surprises.',
      ]],
      ['How families use Vyact', [
        '**Everyone in one household.** Invite your partner, older children or parents; choose who can edit and who can only view.',
        '**One budget by category**, with an alert when a category reaches 80%.',
        '**Every bill on a calendar** — rent, fees, subscriptions and salaries — posted automatically or when you approve.',
        '**Split with people outside the home** — grandparents, flatmates, friends on a trip — and settle up; your totals count only your share.',
        '**See the big picture**: this month’s cash flow and your family’s net worth across cash, bank, cards, loans and investments.',
      ]],
    ],
    faq: [
      ['What is the best budget app for families with multiple users?', 'Look for one where every family member can have their own login to the same household, with control over who can edit, one shared budget and a view of upcoming bills. Vyact is built around exactly that, and is free to start.'],
      ['How do I make a family budget?', 'List what’s already committed each month, give the remaining categories limits, set aside monthly for predictable big costs, and review it together once a month.'],
      ['Can children use the family budget app?', 'Yes — invite older children with view-only access so they can see how the household plans, without changing anything.'],
      ['Does it work in my currency?', 'Yes. Your household works in its own currency, and other currencies are converted at the rates you set.'],
    ],
    lessons: [LESSON('ev-103-the-household-is-the-real-unit', 'The household is the real unit'), LESSON('ev-011-sinking-funds-for-big-bills', 'Sinking funds for big bills'), LESSON('ev-053-festival-and-wedding-seasons', 'Festival and wedding seasons'), LESSON('ev-047-allocate-then-watch', 'Allocate, then watch')],
    ref: 'for_families',
  },
};

const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

export function audiencePage(key) {
  const a = AUDIENCES[key];
  const url = `${BASE}/for/${key}`;
  const cta = signUpUrl(a.ref, '/dashboard');
  const other = key === 'couples' ? ['families', 'For families'] : ['couples', 'For couples'];
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: a.faq.map(([q, ans]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: ans } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Vyact', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: a.h1, item: url },
      ],
    },
  ];
  const body = `<main>
<div class="kicker"><a href="${BASE}/">Vyact</a> · For ${esc(key)}</div>
<h1>${esc(a.h1)}</h1>
<section class="answer" aria-label="Quick answer"><div class="kicker">Quick answer</div><p>${esc(a.answer)}</p></section>
<p><a class="cta" href="${esc(cta)}" data-cta="hero">Set up your household — free →</a></p>
${a.sections.map(([h, items]) => `<h2>${esc(h)}</h2><div class="grid two">${items.map(i => `<div class="item"><div class="d" style="font-size:.95rem;color:hsl(var(--ink-mid))">${inline(i)}</div></div>`).join('')}</div>`).join('\n')}
<h2>Questions</h2>
${a.faq.map(([q, ans]) => `<details class="item" style="margin-bottom:10px"><summary class="t" style="cursor:pointer">${esc(q)}</summary><p class="d">${esc(ans)}</p></details>`).join('')}
<h2>Read next</h2>
<div class="grid two">${a.lessons.map(l => `<a class="item" href="${BASE}/learn/${esc(l.slug)}"><div class="t">${esc(l.title)}</div></a>`).join('')}</div>
<div class="try"><p>Set up your household in two minutes — free to start.</p><a class="cta" href="${esc(cta)}" data-cta="try">Open Vyact →</a></div>
<p><a href="${BASE}/for/${other[0]}">${other[1]}</a> · <a href="${BASE}/learn">Free money lessons</a> · <a href="${BASE}/">Home</a></p>
</main>`;
  return page({
    title: a.title, description: a.description, canonical: url, jsonld, body,
    sticky: { text: 'One budget for the whole household', label: 'Get started', href: signUpUrl(`${a.ref}_sticky`, '/dashboard') },
  });
}

export default function handler(req, res) {
  const key = String((req.query || {}).audience || '').toLowerCase();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!AUDIENCES[key]) {
    res.status(404).send(page({
      title: 'Page not found · Vyact', description: 'This page could not be found.', canonical: `${BASE}/`, jsonld: [], robots: 'noindex',
      body: `<main><h1>Page not found</h1><p><a href="${BASE}/">Go to Vyact →</a></p></main>`,
    }));
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(audiencePage(key));
}
