// v10.49.0 — the public, server-rendered pages (marketing #0, #3/#4, #10, #11, #12, #14, #20, #25).
//
// Pinned: the functions find the public key without any Vercel env (the committed
// .env.production), and send it as `apikey` only; the lesson page carries Article +
// Breadcrumb (+ VideoObject for a video card), 3–5 related lessons, a try-it link into
// the matching feature with ?ref= and ?next=; hubs exist per topic; the sitemap lists
// home, library, hubs and lessons; llms.txt lists the live hubs; GA is gated to vyact.app;
// CMS text can never become markup.
import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { lessonPage, topicPage, indexPage, renderBody, relatedLessons, firstSentence } from '../../../api/learn.js';
import { sitemapXml } from '../../../api/sitemap.js';
import { llmsTxt, DESCRIPTION } from '../../../api/llms.js';
import { analyticsSnippet, topicSlug, youtubeId, featureFor, signUpUrl } from '../../../api/_page.js';
import { publicConfig, readContent, _resetConfig } from '../../../api/_supabase.js';

const card = (over: Record<string, unknown> = {}) => ({
  slug: 'ev-001-the-500-a-day-idea', title: 'The ₹500-a-day idea', category: 'Saving',
  body_md: 'Small daily amounts add up. ₹500 a day is ₹15,000 a month.\n\n- Start small\n- Automate it\n\nKeep going.',
  tags: ['saving', 'habits'], reading_seconds: 75, video_url: null, updated_at: '2026-07-06T10:00:00Z', published_at: '2026-07-01T10:00:00Z',
  ...over,
});
const ALL = [
  card(),
  card({ slug: 'ev-002-pay-yourself-first', title: 'Pay yourself first', tags: ['saving', 'automation'] }),
  card({ slug: 'ev-010-emergency-fund', title: 'The emergency fund', tags: ['habits', 'safety'] }),
  card({ slug: 'ev-020-emi-basics', title: 'What an EMI really costs', category: 'Debt', tags: ['debt', 'emi'] }),
  card({ slug: 'ev-030-net-worth', title: 'Your net worth, simply', category: 'Net Worth', tags: ['net worth', 'habits'] }),
];
const jsonLdOf = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); _resetConfig(); });

describe('#0 — the public key, without any Vercel env', () => {
  it('CON-UNIT-PUB-001 · reads the committed .env.production and sends the key as apikey ONLY (a publishable key as Bearer is a 401)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    _resetConfig();
    const cfg = publicConfig();
    expect(cfg.url).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
    expect(cfg.key.length).toBeGreaterThan(20);
    const fetchImpl = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    await readContent('select=slug', fetchImpl);
    const [, init] = fetchImpl.mock.calls[0];
    expect(Object.keys(init.headers)).toEqual(['apikey']);
    // The runtime env still wins when set.
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'from-env');
    _resetConfig();
    expect(publicConfig().key).toBe('from-env');
  });

  it('CON-UNIT-PUB-002 · a failed read is a 503 page (retry later), never a bare 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 401 })));
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn(), setHeader: vi.fn() };
    await handler({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '300');
    expect(res.send.mock.calls[0][0]).toContain('noindex');
  });
});

describe('lesson pages (#11, #12, #20)', () => {
  it('CON-UNIT-PUB-003 · Article + Breadcrumb through the topic hub; related lessons by shared tags and topic; try-it link to the feature with ref + next', () => {
    const html = lessonPage(ALL[0], ALL);
    const ld = jsonLdOf(html);
    expect(ld[0]['@type']).toEqual(['Article', 'LearningResource']);
    expect(ld[0].headline).toBe('The ₹500-a-day idea');
    expect(ld[1].itemListElement[1].item).toBe('https://vyact.app/learn/topic/saving');
    expect(ld).toHaveLength(2);                                // no video → no VideoObject
    const related = relatedLessons(ALL[0], ALL);
    expect(related.map(c => c.slug)).toEqual(['ev-002-pay-yourself-first', 'ev-010-emergency-fund', 'ev-030-net-worth']);
    for (const r of related) expect(html).toContain(`/learn/${r.slug}`);
    expect(html).toContain('href="/auth/sign-up?ref=learn_ev-001-the-500-a-day-idea&amp;next=%2Freports"');
    expect(html).toContain('See your savings rate in Vyact');
    expect(html).toContain('<link rel="canonical" href="https://vyact.app/learn/ev-001-the-500-a-day-idea">');
    expect(html).toContain('class="sticky"');                  // slim mobile CTA (#19)
    expect(html).toContain("vyTrack('learn_card_view'");
  });

  it('CON-UNIT-PUB-004 · a YouTube Shorts card gets VideoObject (thumbnail, embed, upload date) and a click-to-play facade, not an iframe on load', () => {
    const html = lessonPage(card({ video_url: 'https://youtube.com/shorts/08k9NNVWsKw', video_updated_at: '2026-07-06T00:00:00Z' }), ALL);
    const video = jsonLdOf(html).find(o => o['@type'] === 'VideoObject');
    expect(video).toMatchObject({
      thumbnailUrl: ['https://i.ytimg.com/vi/08k9NNVWsKw/hqdefault.jpg'],
      embedUrl: 'https://www.youtube.com/embed/08k9NNVWsKw', uploadDate: '2026-07-06T00:00:00Z',
    });
    expect(html).toContain('data-yt="08k9NNVWsKw"');
    expect(html.replace(/<script>[\s\S]*?<\/script>/g, '')).not.toMatch(/<iframe/);   // only the click handler builds one
    expect(youtubeId('https://www.youtube.com/watch?v=abc123XYZ')).toBe('abc123XYZ');
    expect(youtubeId('https://example.com/x')).toBeNull();
  });

  it('CON-UNIT-PUB-005 · CMS text never becomes markup: body, title and tags are escaped; lists and bold render', () => {
    expect(renderBody('Hi <script>alert(1)</script>\n\n- **one**\n- two')).toBe('<p>Hi &lt;script&gt;alert(1)&lt;/script&gt;</p><ul><li><strong>one</strong></li><li>two</li></ul>');
    const html = lessonPage(card({ title: 'X </title><script>bad()</script>', tags: ['<b>t</b>'] }), []);
    expect(html).not.toContain('<script>bad()');
    expect(html).not.toContain('<b>t</b>');
    expect(firstSentence('Small daily amounts add up. More text here.')).toBe('Small daily amounts add up.');
  });
});

describe('library, hubs, sitemap, llms.txt (#10, #25)', () => {
  it('CON-UNIT-PUB-006 · the library links every topic hub; a hub lists its lessons with CollectionPage + ItemList', () => {
    const idx = indexPage(ALL);
    for (const t of ['saving', 'debt', 'net-worth']) expect(idx).toContain(`https://vyact.app/learn/topic/${t}`);
    expect(topicSlug('Using Vyact')).toBe('using-vyact');
    const hub = topicPage('Saving', ALL.filter(c => c.category === 'Saving'), ['Debt', 'Net Worth', 'Saving']);
    const ld = jsonLdOf(hub);
    expect(ld[0]['@type']).toBe('CollectionPage');
    expect(ld[0].mainEntity.numberOfItems).toBe(3);
    expect(hub).toContain('<h1>Saving: free money lessons</h1>');
    expect(hub.match(/<h1>/g)).toHaveLength(1);
  });

  it('CON-UNIT-PUB-007 · the sitemap lists home, library, one hub per topic and every lesson', () => {
    const xml = sitemapXml(ALL, '2026-09-29');
    for (const loc of ['https://vyact.app/', 'https://vyact.app/learn', 'https://vyact.app/learn/topic/saving', 'https://vyact.app/learn/topic/net-worth', 'https://vyact.app/learn/ev-020-emi-basics']) {
      expect(xml).toContain(`<loc>${loc}</loc>`);
    }
    expect(xml.match(/<url>/g)).toHaveLength(2 + 3 + ALL.length);
    // With no lessons readable, the static pages are still listed.
    expect(sitemapXml([], '2026-09-29').match(/<url>/g)).toHaveLength(2);
  });

  it('CON-UNIT-PUB-008 · llms.txt: the one standard description and the live hubs', () => {
    const txt = llmsTxt(ALL);
    expect(txt.startsWith('# Vyact\n\n> ' + DESCRIPTION)).toBe(true);
    expect(txt).toContain('(https://vyact.app/learn/topic/saving): 3 lessons');
    expect(txt).toContain(`${ALL.length} short, plain-English money lessons`);
  });
});

describe('analytics gating and deep links (#3, #4, #20)', () => {
  it('CON-UNIT-PUB-009 · GA loads only on vyact.app / www.vyact.app; elsewhere events go nowhere', () => {
    const run = (host: string) => {
      const appended: string[] = [];
      const win: Record<string, unknown> = { matchMedia: () => ({ matches: false }) };
      const doc = { createElement: () => ({}), head: { appendChild: (s: { src: string }) => appended.push(s.src) } };
      const code = analyticsSnippet().replace(/<\/?script>/g, '');
      new Function('window', 'location', 'document', code)(win, { hostname: host }, doc);
      (win.vyTrack as (n: string) => void)('learn_card_view');
      return { appended, layer: (win.dataLayer as unknown[]).length };
    };
    expect(run('vyact.app').appended[0]).toContain('googletagmanager.com/gtag/js?id=G-E3XKWZP850');
    expect(run('www.vyact.app').appended).toHaveLength(1);
    for (const h of ['localhost', 'vyact-git-main-authen27.vercel.app', 'stage.vyact.app', 'admin.vyact.app']) {
      const r = run(h);
      expect(r.appended, h).toHaveLength(0);
      expect(r.layer, h).toBe(0);
    }
  });

  it('CON-UNIT-PUB-010 · every Learn topic maps to a real app route; sign-up links carry ref and next', () => {
    const APP_ROUTES = ['/dashboard', '/budgets', '/debts', '/reports', '/networth', '/households', '/insights'];
    for (const t of ['Budgeting', 'Debt', 'Saving', 'Investing', 'Net Worth', 'Household', 'India', 'Mindset', 'Using Vyact', 'Unknown']) {
      expect(APP_ROUTES, t).toContain(featureFor(t).next);
    }
    expect(signUpUrl('learn_x', '/budgets')).toBe('/auth/sign-up?ref=learn_x&next=%2Fbudgets');
  });
});

// v10.50.0 — "/" is the app's own landing page again (the Aurora brand page, owner decision),
// pre-rendered at build time into dist/landing.html (scripts/prerender-landing.mjs).
const INDEX_FIXTURE = `<!DOCTYPE html><html lang="en"><head>
<meta name="description" content="x" />
<meta property="og:title" content="x" />
<meta property="og:description" content="x" />
<meta name="twitter:title" content="x" />
<meta name="twitter:description" content="x" />
<script type="application/ld+json">{"@type":"Organization"}</script>
<title>Vyact — Family Finance OS</title>
<link rel="stylesheet" crossorigin href="/assets/index-AbC123.css">
</head><body><div id="root"></div><script type="module" src="/assets/index-XyZ.js"></script></body></html>`;

async function renderedLanding(cloudMode = true) {
  const React = await import('react');
  const { renderToString } = await import('react-dom/server');
  const { MemoryRouter } = await import('react-router-dom');
  const { default: LandingView } = await import('../../pages/LandingView');
  return renderToString(React.createElement(MemoryRouter, null, React.createElement(LandingView, { cloudMode, signedIn: false })));
}

describe('the landing page (#9, #12, #19)', () => {
  it('CON-UNIT-PUB-011 · the restored landing: one H1, the SEO sections at the bottom, a FAQPage that matches the visible FAQ, and the landing head', async () => {
    const copy = await import('../../content/landingCopy');
    const { landingHtml } = await import('../../../scripts/landingHtml.mjs');
    const markup = await renderedLanding();
    const html = landingHtml(INDEX_FIXTURE, markup, copy);

    expect(markup.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(markup).toContain('Your household deserves to understand its money.');
    // The v10.49 content sits BELOW the brand sections, in the same theme.
    const at = (s: string) => markup.indexOf(s);
    expect(at('Sound familiar?')).toBeLessThan(at('Made for the way households actually run.'));
    for (const s of ['Everything in one place.', 'Learn money in minutes.', 'Questions, answered.']) expect(at(s)).toBeGreaterThan(at('Your money, explained back to you.'));
    for (const l of copy.LESSONS) expect(markup).toContain(`href="/learn/${l.slug}"`);
    expect(markup).toContain('href="/auth/sign-up?ref=landing_hero"');

    const ld = jsonLdOf(html);
    expect(ld.find(o => o['@type'] === 'SoftwareApplication')).toMatchObject({ applicationCategory: 'FinanceApplication', offers: { price: '0' } });
    const faq = ld.find(o => o['@type'] === 'FAQPage');
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(copy.FAQ.map(([q]) => q));
    for (const [q] of copy.FAQ) expect(markup).toContain(`<summary class="text-[0.95rem] font-semibold text-ink cursor-pointer">${q.replace(/'/g, '&#x27;')}</summary>`);
    expect(html).toContain(`<title>${copy.SITE_TITLE}</title>`);
    expect(html).toContain('<link rel="canonical" href="https://vyact.app/" />');
    expect(html).toContain(`<div id="root">${markup}</div>`);
    expect(html).toContain("localStorage.getItem('vt_theme')");      // saved theme before first paint

    // Positioning (owner, 2026-09-29): lead with what Vyact does, for any household — not
    // with what it is not, and not India-only. WhatsApp is not advertised yet.
    const words = (markup + JSON.stringify(ld)).toLowerCase();
    for (const banned of ['sms', 'bank link', 'no bank', 'indian household', 'for india', 'whatsapp']) expect(words, banned).not.toContain(banned);
  });

  it('CON-UNIT-PUB-012 · middleware serves "/" (only) from the pre-rendered landing, keeping the query', async () => {
    const mw = await import('../../../middleware.js');
    expect(mw.config).toEqual({ matcher: '/' });
    const res = mw.default(new Request('https://vyact.app/?ref=ig'));
    expect(res.headers.get('x-middleware-rewrite')).toBe('https://vyact.app/landing.html?ref=ig');
  });

  it('CON-UNIT-PUB-013 · one standard description everywhere; the build fails loudly on a changed index.html; Learn wears the app stylesheet', async () => {
    const copy = await import('../../content/landingCopy');
    const { landingHtml, builtCssHref } = await import('../../../scripts/landingHtml.mjs');
    expect(DESCRIPTION).toBe(copy.STANDARD_DESCRIPTION);
    expect(builtCssHref(INDEX_FIXTURE)).toBe('/assets/index-AbC123.css');
    expect(() => landingHtml(INDEX_FIXTURE.replace('<div id="root"></div>', '<div id="root">x</div>'), '', copy)).toThrow(/empty #root/);
    expect(() => landingHtml(INDEX_FIXTURE.replace(/<meta name="description"[^>]*>/, ''), '', copy)).toThrow(/meta description/);
    const lesson = lessonPage(ALL[0], ALL);
    expect(lesson).toContain('<link rel="stylesheet" href="/site.css">');
    expect(lesson).toContain('class="btn-primary');                 // the landing header, class for class
    expect(lesson.toLowerCase()).not.toContain('indian households');
  });
});
