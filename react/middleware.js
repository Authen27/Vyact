// Vyact — Vercel Routing Middleware (v10.49.0; v10.50.0 serves the restored landing).
//
// "/" is served from dist/landing.html: the app's own landing page (the Aurora brand page),
// pre-rendered at build time by scripts/prerender-landing.mjs, so crawlers, social scrapers
// and AI tools get the full page as HTML and visitors see it before the app script loads.
// A vercel.json rewrite cannot do this: "/" already matches the static index.html, and
// static files win over rewrites. Middleware runs before the filesystem, and matches "/"
// ONLY — every other path (the app, /learn, assets) is untouched.
//
// The installed app is unaffected: its service worker answers "/" from the app shell.

export const config = { matcher: '/' };

export default function middleware(request) {
  const url = new URL(request.url);
  // Keep ?ref= and other query parameters: the page's script reads them like any app route.
  const target = new URL(`/landing.html${url.search}`, url.origin);
  return new Response(null, { headers: { 'x-middleware-rewrite': target.toString() } });
}
