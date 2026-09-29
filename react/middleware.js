// Vyact — Vercel Routing Middleware (v10.49.0, marketing #9).
//
// "/" is served by the server-rendered landing page (api/home.js) so crawlers, social
// scrapers and AI tools get real content instead of the SPA's empty shell. A vercel.json
// rewrite cannot do this: "/" already matches the static index.html, and static files win
// over rewrites. Middleware runs before the filesystem, and matches "/" ONLY — every other
// path (the app, /learn, assets) is untouched.
//
// The installed app is unaffected: its service worker answers "/" from the app shell.

export const config = { matcher: '/' };

export default function middleware(request) {
  const url = new URL(request.url);
  // Keep ?ref= and other query parameters for the landing page's own links.
  const target = new URL(`/api/home${url.search}`, url.origin);
  return new Response(null, { headers: { 'x-middleware-rewrite': target.toString() } });
}
