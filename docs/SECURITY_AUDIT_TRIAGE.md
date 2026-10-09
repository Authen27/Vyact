# Dependency advisory triage

Closes audit 2026-10-04 **GATE-05** (and the TD-38 register item) for runtime dependencies. CI
(`.github/workflows/ci.yml`, "Runtime dependency audit") runs
`npm audit --omit=dev --audit-level=high` for `react/` and `admin/`. Any **high or critical**
advisory in a runtime dependency fails the build. Moderate and lower are triaged here.

## Open moderate advisories (9 Oct 2026, v10.84.0)

| Package | Advisory | Where | Status |
|---|---|---|---|
| `react-router` / `react-router-dom` 6.30.6 (and `@remix-run/router` in admin) | GHSA-wrjc-x8rr-h8h6: open redirect via a backslash in `<Link>` / `useNavigate` | consumer + admin | **Mitigated.** The only navigation to a visitor-supplied path is the post-sign-in `next` parameter, and `react/src/lib/postAuth.ts` `safeNext` rejects backslashes and control characters, then resolves against a placeholder origin and requires the result to stay on it (W0, FE-PLT-01). The fix is React Router 7, a breaking major upgrade, which is in the backlog. |
| same | GHSA-337j-9hxr-rhxg: constructor injection in SSR hydration `deserializeErrors()` | consumer + admin | **Not applicable.** Both apps are client-rendered SPAs and never hydrate a React Router server payload. |

Bumped in this release: React Router 6.30.4 → **6.30.6**, the latest 6.x.

## Dev-only advisories

These are in build and test tooling (Vite plugins, Playwright, Puppeteer, Lighthouse) and never reach a user's browser. Review them when the tools are next upgraded. They are not gated.

## How to re-run

```bash
cd react && npm audit --omit=dev
```

```bash
cd admin && npm audit --omit=dev
```

When a new moderate advisory appears, add a row above with its status (mitigated, not applicable,
or a planned fix). A high or critical one fails CI until it is fixed or explicitly overridden.
