// Vyact — the public landing page at "/", server-rendered (marketing #9, #12, #19; v10.49.0).
//
// The SPA's Landing.tsx needs JavaScript to show anything, so crawlers and AI tools saw an
// empty shell at vyact.app. This renders the same promise as plain HTML: one H1, the answer
// above the fold, a trust line, what Vyact does, a visible FAQ (FAQPage JSON-LD), 12 lessons
// from the library, and SoftwareApplication JSON-LD. One call to action throughout, with
// `?ref=` so sign-ups can be attributed; a slim sticky CTA on mobile; no pop-ups.
//
// Claims here must stay TRUE: free, no credit card, no bank linking, no SMS reading, a
// household shares one ledger, private entries stay private. WhatsApp logging is not
// advertised until number linking is open to everyone (Meta business verification).
//
// A visitor already signed in on this browser (a Supabase session in localStorage) is
// offered "Open your dashboard" instead of "Get started".

import { BASE, OG_IMAGE, esc, page, signUpUrl, topicSlug } from './_page.js';
import { readContent } from './_supabase.js';
import { DESCRIPTION } from './llms.js';

export const FAQ = [
  ['What is Vyact?', DESCRIPTION],
  ['Is Vyact free?', 'Yes. Vyact is free to use and needs no credit card. The money lessons are free to read without an account.'],
  ['Do I have to link my bank account?', 'No. Vyact never asks for your bank login and does not read your SMS. You add entries yourself in a few seconds, so you choose exactly what is recorded.'],
  ['Can my partner and family use it together?', 'Yes. Invite family members to your household and everyone works from the same budgets, splits and totals. Any entry can be marked private.'],
  ['Does it work on Android and iPhone?', 'Vyact runs in any modern browser and can be added to your home screen on Android and iPhone, where it opens like an app.'],
  ['Is my financial data safe?', 'Your data is protected so that only members of your household can read it, and it is never sold or used for advertising. The privacy policy explains exactly what is stored and why.'],
  ['What can I ask Pip?', 'Pip is the assistant built into Vyact. Ask things like "how much did we spend on groceries this month?" or "can I afford a 2,000 dinner?" and Pip answers from your own numbers.'],
];

const FEATURES = [
  ['Log in seconds', 'Add an expense, income or transfer from your phone in a few taps. Recurring bills post themselves or wait for your approval.'],
  ['Budget together', 'One monthly budget for the whole household, split by category, with an alert when a category reaches 80%.'],
  ['Split fairly', 'Share a bill with your partner or friends, see who owes what, and settle up without spreadsheets.'],
  ['See the whole picture', 'Cash flow for the month and your net worth across bank, cash, cards, loans and investments, in one place.'],
  ['Ask Pip', 'Ask questions about your money in plain English and get answers from your own figures, never guesses.'],
  ['Learn as you go', 'Short, free lessons on saving, EMIs, SIPs and budgeting, written for Indian households.'],
];

/** 12 featured lessons: two from each of the six largest topics, video lessons first. Deterministic. */
export function featuredLessons(cards, n = 12) {
  const byCat = {};
  for (const c of cards) (byCat[c.category] ||= []).push(c);
  const cats = Object.keys(byCat).sort((a, b) => byCat[b].length - byCat[a].length || a.localeCompare(b)).slice(0, 6);
  const out = [];
  for (let round = 0; out.length < n && round < 10; round++) {
    for (const cat of cats) {
      const list = byCat[cat].slice().sort((a, b) => (b.video_url ? 1 : 0) - (a.video_url ? 1 : 0) || a.title.localeCompare(b.title));
      if (list[round] && out.length < n) out.push(list[round]);
    }
  }
  return out;
}

export function homePage(cards) {
  const featured = featuredLessons(cards);
  const hero = signUpUrl('landing_hero', '/dashboard');
  const description = 'Vyact is a free family money app for India: log spending in seconds, budget and split bills with your household, and see cash flow and net worth together. No bank linking, no SMS reading.';
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication',
      name: 'Vyact', url: `${BASE}/`, image: OG_IMAGE, description: DESCRIPTION,
      applicationCategory: 'FinanceApplication', operatingSystem: 'Web, Android, iOS',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      publisher: { '@type': 'Organization', name: 'Vyact', url: BASE },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'Vyact', url: BASE, logo: OG_IMAGE, description: DESCRIPTION },
  ];
  const body = `<main>
<h1>Your family's money, in one place</h1>
<p class="lede">Vyact is a free family finance app for India. Log spending in seconds, budget and split bills with your household, and see your cash flow and net worth together, without linking a bank.</p>
<p><a class="cta" href="${esc(hero)}" data-cta="hero" id="hero-cta">Get started free</a><a class="ghost" href="${BASE}/learn">Browse free money lessons</a></p>
<p class="trust">No bank linking · No SMS reading · No credit card · Your data is never sold</p>

<h2>What Vyact does</h2>
<div class="grid two">${FEATURES.map(([t, d]) => `<div class="item"><h3>${esc(t)}</h3><div class="d">${esc(d)}</div></div>`).join('')}</div>

${featured.length ? `<h2>Free money lessons</h2>
<p class="lede" style="font-size:1rem">Short, plain-English lessons for Indian households. No sign-up needed to read.</p>
<div class="grid two">${featured.map(c => `<a class="item" href="${BASE}/learn/${esc(c.slug)}"><div class="d" style="font:600 .62rem/1.4 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase">${esc(c.category)}</div><div class="t">${esc(c.title)}</div></a>`).join('')}</div>
<p><a href="${BASE}/learn">All ${cards.length} lessons →</a> · ${[...new Set(featured.map(c => c.category))].map(t => `<a href="${BASE}/learn/topic/${topicSlug(t)}">${esc(t)}</a>`).join(' · ')}</p>` : ''}

<h2>Questions</h2>
${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}

<div class="try"><p>Set up your household in two minutes.</p><a class="cta" href="${esc(signUpUrl('landing_footer', '/dashboard'))}" data-cta="footer">Get started free</a></div>
</main>`;
  // Already signed in on this browser: send them to their dashboard, not to sign-up.
  const script = `try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){var a=document.getElementById('hero-cta');if(a){a.textContent='Open your dashboard';a.href='/dashboard';a.setAttribute('data-cta','hero_signed_in');}break;}}}catch(e){}`;
  return page({
    title: 'Vyact: family budget and expense tracker for India',
    description, canonical: `${BASE}/`, jsonld, body, script,
    sticky: { text: 'Free for families. No bank linking.', label: 'Get started', href: signUpUrl('landing_sticky', '/dashboard') },
  });
}

export default async function handler(req, res) {
  let cards = [];
  try {
    cards = await readContent('select=slug,title,category,video_url&format=eq.card&status=eq.published&order=category.asc,title.asc&limit=1000');
  } catch (e) {
    console.error('[home]', e && e.message);   // the page still renders, without the lessons
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cards.length ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' : 'no-store');
  res.status(200).send(homePage(cards));
}
