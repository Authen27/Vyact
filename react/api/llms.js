// Vyact — /llms.txt (#25, v10.49.0). A plain-text guide for AI crawlers and assistants
// (llmstxt.org): what Vyact is, in the one standard description (#22), and where the
// public Learn library and its topic hubs are. Generated from the live library so it
// never lists a hub that does not exist. Remove the rewrite in vercel.json to retire it.
import { BASE, topicSlug } from './_page.js';
import { readContent } from './_supabase.js';

// The ONE standard description (#22 — site, Play Store, LinkedIn, directories). A copy of
// STANDARD_DESCRIPTION in src/content/landingCopy.ts (this Node function cannot import the
// app's TypeScript); CON-UNIT-PUB-013 fails if the two drift. Keep it true: WhatsApp logging
// joins it when number linking is open to everyone.
export const DESCRIPTION = 'Vyact is the money app a household runs together. Everyone logs spending in seconds, shares budgets and bills, splits costs and plans debt payoff, and sees the same cash flow and net worth. Pip, the built-in assistant, answers questions like “can we afford it?” from the household’s own numbers. Free to start, in your own currency, with a free library of plain-English money lessons.';

export function llmsTxt(cards) {
  const counts = {};
  for (const c of cards) counts[c.category] = (counts[c.category] || 0) + 1;
  const topics = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return [
    '# Vyact',
    '',
    `> ${DESCRIPTION}`,
    '',
    '## Learn (free, no sign-up)',
    '',
    `- [All lessons](${BASE}/learn): ${cards.length} short, plain-English money lessons`,
    ...topics.map(t => `- [${t}](${BASE}/learn/topic/${topicSlug(t)}): ${counts[t]} lessons`),
    '',
    '## Product',
    '',
    `- [Home](${BASE}/): what Vyact does and who it is for`,
    `- [Privacy](${BASE}/privacy): how data is handled`,
    '',
  ].join('\n');
}

export default async function handler(req, res) {
  let cards = [];
  try { cards = await readContent('select=category&format=eq.card&status=eq.published&limit=2000'); }
  catch (e) { console.error('[llms]', e && e.message); }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', cards.length ? 'public, max-age=3600, s-maxage=86400' : 'no-store');
  res.status(200).send(llmsTxt(cards));
}
