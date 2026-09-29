// Vyact — assembles dist/landing.html from the built index.html (v10.50.0).
//
// Pure string transform, unit-tested (publicPages.test.ts). Takes the app shell Vite built
// (same CSS, same JS, same GA gating) and gives it the landing page's own head — title,
// description, canonical, social tags, SoftwareApplication + FAQPage + Organization JSON-LD —
// and the pre-rendered markup inside #root. Every anchor it edits must exist: a changed
// index.html fails the build here instead of shipping a page without its SEO head.

export const BASE = 'https://vyact.app';

const safeJsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c');
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function landingJsonLd(copy) {
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Vyact', url: BASE, logo: `${BASE}/og-vyact.png`, description: copy.STANDARD_DESCRIPTION };
  return [
    {
      '@context': 'https://schema.org', '@type': 'SoftwareApplication',
      name: 'Vyact', url: `${BASE}/`, image: `${BASE}/og-vyact.png`, description: copy.STANDARD_DESCRIPTION,
      applicationCategory: 'FinanceApplication', operatingSystem: 'Web, Android, iOS',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: 'Vyact', url: BASE },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: copy.FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
    org,
  ];
}

// Apply a returning visitor's saved theme before first paint (the app's own key), so a
// Mist user does not see Nocturne flash. Mirrors syncSlice.applyTheme.
const THEME_BOOT = `<script>(function(){try{var t=localStorage.getItem('vt_theme')||localStorage.getItem('ff_theme');if(!t)return;t=t.replace(/"/g,'');var r=document.documentElement;if(t==='system'){var d=matchMedia('(prefers-color-scheme: dark)').matches;r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'warm';}else{r.classList.toggle('dark',t==='dark');r.dataset.theme=t;}}catch(e){}})();</script>`;

function must(html, re, what) {
  if (!re.test(html)) throw new Error(`landing.html: index.html is missing ${what}`);
  return html;
}

export function landingHtml(indexHtml, markup, copy) {
  let h = indexHtml;
  const sub = (re, what, to) => { must(h, re, what); h = h.replace(re, to); };
  sub(/<title>[\s\S]*?<\/title>/, '<title>', `<title>${text(copy.SITE_TITLE)}</title>`);
  sub(/<meta name="description" content="[^"]*" \/>/, 'meta description', `<meta name="description" content="${attr(copy.SITE_DESCRIPTION)}" />`);
  sub(/<meta property="og:title" content="[^"]*" \/>/, 'og:title', `<meta property="og:title" content="${attr(copy.SITE_TITLE)}" />\n    <meta property="og:url" content="${BASE}/" />\n    <meta property="og:type" content="website" />`);
  sub(/<meta property="og:description" content="[^"]*" \/>/, 'og:description', `<meta property="og:description" content="${attr(copy.SITE_DESCRIPTION)}" />`);
  sub(/<meta name="twitter:title" content="[^"]*" \/>/, 'twitter:title', `<meta name="twitter:title" content="${attr(copy.SITE_TITLE)}" />`);
  sub(/<meta name="twitter:description" content="[^"]*" \/>/, 'twitter:description', `<meta name="twitter:description" content="${attr(copy.SITE_DESCRIPTION)}" />`);
  sub(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, 'the JSON-LD block',
    landingJsonLd(copy).map(o => `<script type="application/ld+json">${safeJsonLd(o)}</script>`).join('\n    ')
    + `\n    <link rel="canonical" href="${BASE}/" />`);
  sub(/<head>/, '<head>', `<head>\n    ${THEME_BOOT}`);
  sub(/<div id="root"><\/div>/, 'an empty #root', `<div id="root">${markup}</div>`);
  return h;
}

/** The built stylesheet's path in index.html (copied to /site.css for the Learn pages). */
export function builtCssHref(indexHtml) {
  const m = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"/.exec(indexHtml);
  if (!m) throw new Error('landing.html: no built stylesheet link in index.html');
  return m[1];
}
