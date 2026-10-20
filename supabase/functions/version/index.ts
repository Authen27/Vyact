// version — which commit the Edge Functions were deployed from (v10.128.0, Q1; audit INT-PAR-08).
//
// The Deploy workflow sets the Edge secret BUILD_SHA to the commit it is deploying, after checking that the
// bundled engine (_shared/agent/engine.generated.js) matches the app code at that commit. Then it calls this
// function and fails the run unless the answer is that commit. So the server running the app's money and
// recurrence rules is the one the release was checked against. Public (deployed --no-verify-jwt): it says only a
// commit id, never anything about anyone.
const ALLOWED = new Set(['GET', 'HEAD']);

Deno.serve((req: Request) => {
  if (!ALLOWED.has(req.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const sha = (Deno.env.get('BUILD_SHA') ?? '').trim();
  return new Response(JSON.stringify({ sha: /^[0-9a-f]{40}$/.test(sha) ? sha : null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
