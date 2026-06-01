# Junior Implementation Brief — Deprecate & Remove the v5 Vanilla Shell

> **Who:** junior engineer / agent.
> **What:** remove the legacy v5 vanilla shell from the working tree.
> **Why:** `vercel.json` already ignores it (builds only from `react/`). All 10
> pages are ported to React (v6+). No file in `react/src/` imports anything from
> it. It is ~275KB of untested, undeployed, FinFlow-branded dead weight. Git
> history preserves every line forever — this is not a destructive action.
> **Repo:** `Authen27/Vyact`, branch `chore/remove-vanilla-shell`.
> **Do not push, do not merge.** Hand back branch + lint/build output for review.

---

## 0. Rules before you start

- Work **only** at the repo root and in `docs/`. Do not touch `react/`, `admin/`,
  `supabase/`, `.github/`, or `vercel.json`.
- No logic changes. This is purely a deletion + documentation update.
- Branch: `git switch -c chore/remove-vanilla-shell` from `main`.
- If any file listed below does not exist exactly as described, **stop and leave a
  note** in your handover rather than guessing.
- Definition of done (paste output when handing back):
  ```bash
  cd react && npm run lint    # 0 errors
  cd react && npm run build   # success
  node scripts/db-migrations-check.mjs   # green
  ```

---

## 1. What gets deleted

Delete these files and folders from the repo root:

```
index.html          (54 KB — v5 vanilla entry point, title still "FinFlow")
app.js              (190 KB — 3,500+ line vanilla JS application)
style.css           (79 KB — vanilla CSS)
src/                (folder — contains only src/dataAdapter.js, the v4.1 JS adapter)
setup.sh            (Supabase setup script for the vanilla app, now irrelevant)
vercel-setup.sh     (Vercel setup script for the vanilla app, now irrelevant)
QUICKFIX.md         (troubleshooting guide for the vanilla Vercel deploy — superseded
                     by DEPLOY.md which covers the React app)
DEPLOYMENT.md       (duplicate Vercel deploy guide for the vanilla app — superseded)
```

Git command to delete them all at once:
```bash
git rm index.html app.js style.css setup.sh vercel-setup.sh QUICKFIX.md DEPLOYMENT.md
git rm -r src/
```

---

## 2. What to update (3 files)

### 2.1  `CLAUDE.md`

Find and replace the vanilla shell line in the "Project Overview" section.

**Find (exact text):**
```
- **Consumer (vanilla shell, legacy)** at the root — plain HTML+CSS+JS, no build step. Opens `index.html` directly. All v5.0 features fully working. **Frozen** as of consumer v6.0; superseded by the React port in `react/`.
```

**Replace with:**
```
- **Consumer (vanilla shell, legacy)** — archived. The v1.0–v5.0 vanilla HTML/CSS/JS
  app was removed from the working tree in v7.0.1 (2026-06-01). It is preserved in
  git history at any commit before that tag. The React app at `react/` (v6.0+) is
  the only active consumer product.
```

### 2.2  `VERSIONS.md`

Find the table row for the vanilla shell (line ~12):
```
| **Vanilla shell (legacy consumer)** | `/` (root) | **v5.0** *(frozen)* | n/a — opens `index.html` directly | [§ Vanilla shell history](#vanilla-shell-history-v10--v50) below |
```

Replace with:
```
| **Vanilla shell (archived)** | removed in v7.0.1 | **v5.0** *(final)* | archived — see git history | [§ Vanilla shell history](#vanilla-shell-history-v10--v50) below |
```

Then find this line (near the bottom of VERSIONS.md):
```
The vanilla HTML+CSS+JS app at the repo root. All v5.0 features remain working — just open `index.html`. **No further releases planned**; the React app at `react/` (v6.0+) is the active consumer product.
```

Replace with:
```
The vanilla HTML+CSS+JS app that ran from 2025 to 2026. Removed from the working
tree in v7.0.1 after all 10 pages were ported to the React app (`react/`). Full
source preserved in git history. **Final version: v5.0.**
```

### 2.3  `README.md`

Find the section that references `index.html` for running the vanilla app. It will look something like:
```
# Or the v5 vanilla shell
open index.html
```
or
```
| `./` | **v5 vanilla shell** | HTML + CSS + JS, no build | open `index.html` |
```

Remove or replace any reference to opening `index.html` directly. Replace the
entire vanilla row in any table with:
```
| Vanilla shell | archived in v7.0.1 | see git history |
```
If the README has a "Quick start" section with `python -m http.server 8000` or
similar, delete that block.

---

## 3. Add a VERSIONS.md entry

Add a new row at the very top of the cross-app release timeline table (after the
`| Date | App | Version | Headline |` header). Insert:

```
| 2026-06-01 | Consumer (infra) | **v7.0.1** | **Archive vanilla shell.** Removed `index.html`, `app.js`, `style.css`, `src/dataAdapter.js`, `setup.sh`, `vercel-setup.sh`, `QUICKFIX.md`, `DEPLOYMENT.md` from the working tree. All pages ported to React (v6+); `vercel.json` already built from `react/` only. Source preserved in git history. |
```

Also update the Consumer version in the top table of VERSIONS.md:
```
| **Consumer (React)** | `react/` | **v7.0.0** | ...
```
→ leave the React version at v7.0.0 unchanged. This infra change does NOT bump
the React consumer version — it's a repo-level cleanup only.

---

## 4. Bump the admin package.json description only (optional — skip if unsure)

`admin/package.json` may have a description referencing the vanilla shell. If it
does, update it. If it doesn't mention it, skip this step entirely.

---

## 5. Verify nothing in the live app breaks

The removal is safe because:
- `vercel.json` builds from `react/` — the vanilla files were never served.
- `react/src/` has zero imports from `app.js`, `style.css`, or `src/dataAdapter.js`
  (already verified before this brief was written).
- Supabase schema (`supabase/migrations/`) is unaffected.
- CI jobs (`ci.yml`, `deploy.yml`) only build `react/` and `admin/` — unaffected.

Run the gate:
```bash
cd react && npm run lint && npm run build
node scripts/db-migrations-check.mjs
```

All three must pass. If any fails, **stop and report** — do not try to fix it
yourself; something unexpected was found.

---

## 6. Commit and hand back

```bash
git status    # confirm ONLY the deleted files + updated docs are staged
git commit -m "chore: archive v5 vanilla shell — remove from working tree

All 10 pages ported to React (v6+). vercel.json builds from react/ only.
Zero cross-references from react/src/. ~275KB of dead code removed.
Source preserved in git history at any commit before this one.

Deleted: index.html, app.js, style.css, src/, setup.sh,
         vercel-setup.sh, QUICKFIX.md, DEPLOYMENT.md
Updated: CLAUDE.md, VERSIONS.md, README.md

Refs: docs/handoff-plans/BRIEF_deprecate_vanilla.md
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Hand back: (a) branch name, (b) `git diff --stat HEAD` output,
(c) lint + build + schema gate output.
**Do not push. Do not merge.**
