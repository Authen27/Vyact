// Vyact — shared kit for the server-rendered public pages (/, /learn, /learn/topic/*,
// /learn/<slug>). v10.49.0.
//
// Crawlers, social scrapers and AI tools don't run the SPA's JavaScript, so the public
// surface is rendered here as plain HTML with its own small stylesheet. Pages must stay
// light (mobile load under 2.5 s, #19): no framework, no web fonts, one inline style
// block, analytics loaded async and ONLY on vyact.app (#3/#4).
// Underscore file: Vercel does not expose it as an endpoint.

export const BASE = 'https://vyact.app';
export const OG_IMAGE = `${BASE}/og-vyact.png`;
export const GA_ID = 'G-E3XKWZP850';

export const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Audit S4 — HTML-safe JSON for <script type="application/ld+json">: `</script>` inside a
// JSON string would otherwise close the tag. `<` as < keeps JSON.parse identical.
export const safeJsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c');

/** "Net Worth" → "net-worth" (topic hub URLs). */
export const topicSlug = cat => String(cat || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * #20 — each lesson points at the part of the app that puts it into practice.
 * `next` is where sign-up lands the new user (SignUp honours ?next=).
 */
export const FEATURE_BY_CATEGORY = {
  Budgeting: { next: '/budgets', label: 'Set a monthly budget in Vyact' },
  Debt: { next: '/debts', label: 'Plan your debt payoff in Vyact' },
  Saving: { next: '/reports', label: 'See your savings rate in Vyact' },
  Investing: { next: '/networth', label: 'Track your investments in Vyact' },
  'Net Worth': { next: '/networth', label: 'See your net worth in Vyact' },
  Household: { next: '/households', label: 'Share money with your household in Vyact' },
  India: { next: '/dashboard', label: 'Track your money in ₹ with Vyact' },
  Mindset: { next: '/insights', label: 'Get your first money insights in Vyact' },
  'Using Vyact': { next: '/dashboard', label: 'Open Vyact' },
};
export const featureFor = cat => FEATURE_BY_CATEGORY[cat] || { next: '/dashboard', label: 'Start tracking with Vyact' };

/** Sign-up link carrying where the visitor came from (#19 `?ref=`) and where to land. */
export const signUpUrl = (ref, next) =>
  `/auth/sign-up?ref=${encodeURIComponent(ref)}${next ? `&next=${encodeURIComponent(next)}` : ''}`;

/** YouTube id from a watch / shorts / youtu.be URL, or null. */
export function youtubeId(url) {
  const m = /(?:youtube\.com\/(?:shorts\/|watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(String(url || ''));
  return m ? m[1] : null;
}

/**
 * #3/#4 — GA only on the real site. localhost, CI, Vercel previews, stage/dev and the
 * admin app are never counted. `vyTrack(name, params)` queues events either way (a no-op
 * off vyact.app) so page scripts don't need to know. `platform` is on every event (#5).
 */
export function analyticsSnippet() {
  return `<script>
(function(){var h=location.hostname;var on=h==='vyact.app'||h==='www.vyact.app';
window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
var plat=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)?'pwa':'web';
window.vyTrack=function(n,p){if(on){var o=p||{};o.platform=plat;window.gtag('event',n,o);}};
if(!on)return;window.gtag('js',new Date());window.gtag('config','${GA_ID}');
var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);})();
</script>`;
}

const CSS = `
:root{--coral:#E26D5C;--coral-d:#C4523F;--ink:#2A2522;--mid:#5E554D;--dim:#8A8078;--cream:#F5EFE6;--bone:#FBF7EE;--line:#E7DFD2;--sage:#6E9277}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Inter,sans-serif;color:var(--ink);background:var(--cream);line-height:1.6}
a{color:var(--coral-d)}img{max-width:100%;height:auto}
.bar{height:5px;background:var(--coral)}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0}
.brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--ink);font-family:Georgia,serif;font-style:italic;font-weight:600;font-size:1.45rem}
.brand svg{width:30px;height:30px}
nav a{margin-left:16px;text-decoration:none;color:var(--mid);font-weight:500;font-size:.95rem}nav a:hover{color:var(--ink)}
nav .go{color:#fff;background:var(--coral);padding:7px 13px;border-radius:9px}
.kicker{font:600 .66rem/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.kicker a{color:var(--dim);text-decoration:none}
h1{font-family:Georgia,serif;font-size:2.1rem;line-height:1.18;margin:.45rem 0 .5rem;letter-spacing:-.01em}
h2{font-family:Georgia,serif;font-size:1.4rem;line-height:1.25;margin:2rem 0 .6rem}
h3{font-size:1.02rem;margin:0 0 .3rem}
.lede{font-size:1.1rem;color:var(--mid);margin:0 0 1rem}
.meta{color:var(--dim);font-size:.85rem;margin-bottom:1.1rem}
.card{background:var(--bone);border:1px solid var(--line);border-radius:16px;padding:22px 24px}
.card p{font-size:1.02rem;margin:0 0 1rem}.card p:last-child{margin-bottom:0}
.tags{margin:1rem 0 0;display:flex;flex-wrap:wrap;gap:6px}
.tag{font:.72rem ui-monospace,Menlo,monospace;color:var(--mid);background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px 9px}
.cta{display:inline-block;background:var(--coral);color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:11px}
.cta:hover{background:var(--coral-d)}.ghost{display:inline-block;margin-left:12px;font-weight:600;text-decoration:none}
.grid{display:grid;gap:10px;margin:10px 0 24px}
@media(min-width:640px){.grid.two{grid-template-columns:1fr 1fr}}
.item{display:block;background:var(--bone);border:1px solid var(--line);border-radius:12px;padding:13px 15px;text-decoration:none;color:var(--ink)}
.item:hover{border-color:var(--coral)}.item .t{font-weight:600}.item .d{color:var(--mid);font-size:.9rem;margin-top:2px}
.pill{display:inline-block;margin:0 6px 8px 0;padding:6px 12px;border-radius:999px;background:#fff;border:1px solid var(--line);color:var(--ink);text-decoration:none;font-weight:500;font-size:.92rem}
.pill:hover{border-color:var(--coral)}
.try{margin:22px 0;padding:18px 20px;border-radius:14px;background:#fff;border:1px solid var(--line)}
.try p{margin:0 0 10px;color:var(--mid)}
.source{font-size:.85rem;color:var(--dim);margin-top:12px}
.video{position:relative;display:block;max-width:320px;aspect-ratio:9/16;margin:0 0 18px;border-radius:14px;overflow:hidden;background:#000;border:1px solid var(--line)}
.video img{width:100%;height:100%;object-fit:cover;opacity:.85}
.video span{position:absolute;inset:auto 0 0 0;padding:12px;color:#fff;font-weight:600;background:linear-gradient(transparent,rgba(0,0,0,.7))}
.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
details{background:var(--bone);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:0 0 8px}
summary{font-weight:600;cursor:pointer}details p{margin:.6rem 0 0;color:var(--mid)}
.trust{font-size:.92rem;color:var(--mid);margin:.7rem 0 0}
footer{color:var(--dim);font-size:.84rem;padding:34px 0 90px;border-top:1px solid var(--line);margin-top:40px}
footer a{color:var(--mid);margin-right:14px;text-decoration:none}
.sticky{display:none}
@media(max-width:640px){h1{font-size:1.7rem}.sticky{display:flex;position:fixed;left:12px;right:12px;bottom:12px;z-index:5;align-items:center;justify-content:space-between;gap:10px;background:var(--ink);color:#fff;border-radius:14px;padding:10px 12px 10px 16px;box-shadow:0 6px 24px rgba(0,0,0,.18);font-size:.92rem}
.sticky a{background:var(--coral);color:#fff;text-decoration:none;font-weight:600;padding:9px 14px;border-radius:10px;white-space:nowrap}nav a:not(.go){display:none}}
`;

const LOGO = `<svg viewBox="0 0 36 36" aria-hidden="true"><defs><radialGradient id="pip" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#F4B6A8"/><stop offset="100%" stop-color="#E26D5C"/></radialGradient></defs><circle cx="18" cy="18" r="15" fill="url(#pip)" stroke="#2A2522" stroke-width="1.2"/><ellipse cx="13" cy="16" rx="1.4" ry="1.8" fill="#2A2522"/><ellipse cx="23" cy="16" rx="1.4" ry="1.8" fill="#2A2522"/><path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`;

/**
 * One page. `sticky` is the slim mobile call to action (#19): { text, href, label }.
 * `extraHead` for page-specific tags; `script` runs after the body (event wiring).
 */
export function page({ title, description, canonical, jsonld, body, ogType = 'website', sticky, script = '', robots }) {
  const ld = (Array.isArray(jsonld) ? jsonld : [jsonld]).filter(o => o && Object.keys(o).length)
    .map(o => `<script type="application/ld+json">${safeJsonLd(o)}</script>`).join('\n');
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="theme-color" content="#E26D5C">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Vyact">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${OG_IMAGE}">
${ld}
${analyticsSnippet()}
<style>${CSS}</style></head>
<body><div class="bar"></div>
<div class="wrap">
<header class="top"><a class="brand" href="${BASE}/">${LOGO}Vyact</a>
<nav aria-label="Main"><a href="${BASE}/learn">Learn</a><a href="/auth/sign-in">Sign in</a><a class="go" href="${esc(sticky ? sticky.href : signUpUrl('nav'))}" data-cta="nav">Get started</a></nav></header>
${body}
<footer>
<p><a href="${BASE}/">Home</a><a href="${BASE}/learn">Learn</a><a href="/auth/sign-up?ref=footer">Get started</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></p>
<p>© Vyact — family finance, made legible. Lessons are educational, not individual financial advice.</p>
</footer>
</div>
${sticky ? `<div class="sticky" role="complementary"><span>${esc(sticky.text)}</span><a href="${esc(sticky.href)}" data-cta="sticky">${esc(sticky.label)}</a></div>` : ''}
<script>
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-cta]');if(a&&window.vyTrack)vyTrack(location.pathname.indexOf('/learn')===0?'learn_cta_click':'landing_cta_click',{placement:a.getAttribute('data-cta'),page:location.pathname});});
${script}
</script>
</body></html>`;
}
