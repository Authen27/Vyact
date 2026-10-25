# Vyact — Independent Architecture & Engineering Audit

**Dates:** 2026-10-04 → 2026-10-05 · **Consumer:** v10.60.0 · **Admin:** v1.4.2 · **Commit:** 13a5ac6 (branch fix/email-vyact-domain) · **Mode:** read-only; no code was changed

**Method.** 22 specialist audit slices (frontend, admin, backend, database, integration, platform/ops, cross-cutting) read the source in depth. Every medium-or-worse finding was handed to an independent adversarial verifier that tried to refute it: re-open the code, trace reachability from a production entry point, look for defenses in other layers (constraints, RLS, RPC checks, Edge auth, tests). Low/info findings are reported as raised. The project's own gates (typecheck, unit tests, lint, dependency audit, repo checks, production build) were executed locally. Two further agents re-checked the 2026-09-07 audit and the TECH_DEBT register against current code.

**Numbers.** 297 findings raised · 0 refuted by verification · 85 merged as duplicates · **212 reported** — 3 critical · 29 high · 100 medium · 75 low · 5 info.

**Remediation status (updated 25 Oct 2026):** 193 of 218 resolved, including all 3 critical and 27 of 31 high. See **§0**; the per-finding status is in §11, and the remaining work in Appendix C.

| Area | Critical | High | Medium | Low | Info |
|---|---:|---:|---:|---:|---:|
| Frontend | 0 | 10 | 37 | 34 | 0 |
| Admin | 0 | 2 | 5 | 7 | 0 |
| Backend | 0 | 3 | 11 | 8 | 1 |
| Database | 2 | 2 | 11 | 5 | 1 |
| Integration | 0 | 9 | 16 | 10 | 1 |
| Platform & Ops | 0 | 2 | 6 | 5 | 2 |
| Cross-cutting | 1 | 1 | 14 | 6 | 0 |

## 0. Remediation status — 12 Oct 2026

> **Read this first.** This section gives the status of every finding on `main` at **5dc208a**: consumer v10.84.0, admin v1.4.4, the last remediation PR.
>
> - **Since then:** three Aurora 4.0 design PRs merged (#190–#192; consumer v10.87.0 is live). Each says "no figure, calculation or schema change". Where they touch a finding (FE-UIS-07/08/09/12, invite revoke), that is noted.
> - **Per finding:** the status is in **§11** (new *Status* and *PRs* columns). What is left on each unresolved finding is in **Appendix C**.

> **Updated 13 Oct 2026 (v10.88.0 to v10.90.0):**
> - R1 is fixed;
> - the erase now covers every household table (XC-PRV-08 except the data export; DB-SEC-08 closed);
> - a WhatsApp correction to an EMI now pays the loan (v10.89.0: BE-WA-08 and INT-TXN-07 closed; the correction half of INT-TXN-12 fixed);
> - Pip's guard gaps are closed (v10.90.0: FE-PIP-07, FE-PIP-11 and FE-PIP-06);
> - INT-TXN-01 is corrected to Closed (the delete paths already removed the shared split, so the review's "partly" was wrong);
> - your 13 Oct decisions are recorded in §0.6, step 3.
>
> **Updated 20 Oct 2026 (v10.91.0 to v10.128.0; Track Q decided):**
> - every open finding was re-checked against `main` @ f8d8dd6, and the owner answered the developer questions
>   D4, D8, D9 and D10 and every remaining product question on 20 Oct;
> - each unresolved finding now names its Track Q stage in Appendix C (Q1 release safety, Q2 migration replay and
>   authz matrix, Q3 database and admin, Q4 observability, Q5 app correctness, Q6 splits, Q7 Pip, Q8 hygiene);
> - six findings were added from that check (Q-AUTH-01..04, Q-WA-01, Q-DOC-01). Q-AUTH-03/04, FE-UIS-09,
>   XC-ARC-12 and XC-ARC-14 are closed by decision;
> - §0.6 below is the 13 Oct plan, kept as history. Track Q replaces it.
>
> All counts below are regenerated from the per-finding data.

**How the status was checked.** Each finding was matched against:
- the 25 remediation PRs (#165–#189) and both changelogs;
- the owner's remediation plan, with decisions D0a–D30;
- the second developer's W8 plan (8 Oct).

Its current state was then read in the code, at file:line:
- **101 findings** were checked by review agents: money/UI, public site/admin, backend/WhatsApp, integration and privacy.
- **111 findings** were checked by direct reading, with targeted code checks wherever a PR's claim was ambiguous. Three statuses changed this way: INT-TXN-01, INT-TXN-07 and FE-UIS-03 moved from "closed" to "partly".

A planned second, adversarial pass over all 212 could not finish (usage limits), so each status rests on one code reading plus those targeted re-checks. The live read-only checks are in §0.7.

Two developers did the work:
- **Developer 1:** PRs #165–#182 (W0–W5), following the owner's plan.
- **Developer 2, an agent:** PRs #183–#189 (W6, W7a/b, W8a–d), following the W8 plan.

### 0.1 Summary

| Severity | Total | Closed | Closed by decision | Partly | Open | Owner decision | On hold (dev question) | Backlog |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Critical | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 0 |
| High | 31 | 22 | 5 | 4 | 0 | 0 | 0 | 0 |
| Medium | 102 | 85 | 6 | 8 | 3 | 0 | 0 | 0 |
| Low | 77 | 63 | 4 | 4 | 6 | 0 | 0 | 0 |
| Info | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **218** | **177** | **16** | **16** | **9** | **0** | **0** | **0** |

**193 of 218 are resolved (89%): all 3 critical and 27 of 31 high.** The other 25 fall into four groups:

| What the 25 need | Count |
|---|---:|
| Work planned in a Track Q stage (any owner step is named in Appendix C) | 17 |
| An owner action or decision (0 waiting only on a decision; 8 partly done, with the rest waiting on an owner action) | 8 |
| An answer to the developer questions D4/D5, D8, D9, D10 (answered 20 Oct) | 0 |
| Backlog: owner said "not now" (plan backlog, batch E, W8e) | 0 |

**Status words.**
- **Closed:** fixed in code on main, checked at file:line.
- **Closed (decision):** settled by an owner decision instead of the audit's fix (a feature was removed, or the risk accepted), or made moot by another change.
- **Partly:** part is fixed and checked; Appendix C says what is left.
- **Open:** not fixed, and nothing blocks it.
- **Owner decision:** needs a product decision that has not been made.
- **On hold (dev question):** waits on `docs/DEVELOPER_INPUTS.md`.
- **Backlog:** the owner explicitly said "not now".

### 0.2 What each PR delivered

| PR | Version | Wave | Closed | Partly |
|---|---|---|---|---|
| #165 | v10.61.0 (admin v1.4.3) | W0 containment | XC-PRV-01, FE-PUB-01, FE-UIS-02, ADM-01, ADM-02, BE-FN-07, DB-INT-05, FE-PLT-01, OPS-04, XC-PRV-02, XC-PRV-08, FE-PUB-03 | XC-PRV-03, XC-PRV-11, BE-FN-11 |
| #166 | v10.62.0 | W1a authorization | DB-SEC-01, DB-SEC-02, FE-PUB-01, BE-WA-01, ADM-03, INT-HH-12, INT-CON-04, INT-HH-06 | XC-PRV-11 |
| #167 | v10.63.0 | W1b data lifecycle | BE-FN-02, INT-HH-03, BE-FN-04, DB-SEC-08, XC-PRV-04, XC-PRV-07, XC-PRV-08 | XC-PRV-11 |
| #168 | v10.64.0 | W1c abuse limits | FE-PIP-09, BE-FN-06, BE-FN-09, BE-PIP-02, BE-PIP-03, FE-PIP-18 | OPS-11 |
| #169 | v10.65.0 | W3a local "today" | INT-TZC-03, FE-PIP-10, INT-PAR-04, INT-TZC-04, INT-TZC-05, INT-PAR-11 | — |
| #170 | v10.66.0 | W3b one currency | INT-PAR-01, INT-TZC-02, INT-PAR-06, INT-TZC-07, FE-MNY-16, FE-PIP-14, INT-TZC-08, INT-PAR-11 | FE-UIS-03 |
| #171 | v10.67.0 | W3c lost edits | FE-SYN-01, FE-SYN-03, INT-TXN-08 | — |
| #172 | v10.68.0 | W3d recurrence schema | FE-MNY-01, INT-TXN-05 | — |
| #173 | v10.69.0 | W3e recurrence engine | FE-MNY-01, INT-TXN-04, INT-TXN-05, FE-UIC-13, INT-PAR-02, XC-ARC-06, INT-PAR-11 | — |
| #174 | v10.70.0 | W4a server posts bills | INT-TXN-06 | — |
| #175 | v10.71.0 | W4b app stops posting | INT-TXN-06 | — |
| #176 | v10.72.0 | W4c split edit | FE-PIP-03, INT-TXN-01, FE-UIC-09 | — |
| #177 | v10.73.0 | W4d bell + signs | FE-UIS-04, FE-UIC-04 | — |
| #178 | v10.74.0 | W4e loan schema | FE-MNY-04, INT-TXN-07, FE-UIC-06, OPS-08 | FE-UIC-12 |
| #179 | v10.75.0 | W4f loan app | FE-MNY-04, INT-TXN-07, FE-UIC-06, FE-UIC-09 | FE-UIC-12 |
| #180 | v10.76.0 | W4g loan automation | INT-TXN-07, FE-UIC-09 | — |
| #181 | v10.77.0 | W4h budget suggest | FE-MNY-16 | — |
| #182 | v10.78.0 | W5 Pip correctness | FE-PIP-01, FE-PIP-03, FE-PIP-04, FE-PIP-02, FE-PIP-05, FE-PIP-06, FE-PIP-08, FE-PIP-12 | — |
| #183 | v10.79.0 | W6 frontend quick fixes (dev 2) | FE-PUB-04, FE-UIC-06, FE-UIC-07, FE-UIC-13, FE-UIS-06, FE-UIS-08, FE-UIS-10, FE-UIS-11, FE-UIS-12, FE-UIS-13, FE-MNY-11, FE-PUB-11 | INT-HH-08 |
| #184 | v10.80.0 | W7a app small fixes (dev 2) | FE-UIS-06, FE-UIS-08, FE-UIS-13, XC-PRV-08, FE-MNY-14, FE-MNY-15, FE-PIP-17, FE-PIP-18, FE-PLT-08, FE-UIC-14, FE-UIC-16, FE-UIC-17, FE-UIS-14, FE-UIS-15, FE-UIS-16, INT-CON-05 | INT-HH-13 |
| #185 | v10.81.0 | W7b public/build (dev 2) | FE-PLT-11, FE-PUB-03, FE-PUB-07, FE-PUB-10, GATE-03, OPS-13 | — |
| #186 | v10.82.0 | W8a app fixes (dev 2) | FE-MNY-06, FE-UIC-05, FE-UIC-09, INT-HH-09, INT-PAR-05, XC-PRV-09, FE-MNY-16, FE-PIP-13, FE-PIP-15, FE-PIP-16, FE-PLT-07, FE-SYN-10, FE-SYN-11, FE-SYN-12, FE-UIC-15, FE-UIS-15 | FE-UIC-10 |
| #187 | v10.83.0 | W8b Edge robustness (dev 2) | BE-WA-03, BE-WA-04, BE-WA-06, BE-WA-09, BE-PIP-05, BE-PIP-07, BE-WA-11, BE-WA-12, BE-WA-13, INT-PAR-10 | BE-PIP-04 |
| #188 | admin v1.4.4 | W8c admin (dev 2) | ADM-10, ADM-11, ADM-12, ADM-13, ADM-14, INT-CON-06, INT-HH-14, GATE-03 | FE-PLT-04 |
| #189 | v10.84.0 | W8d site/platform/docs (dev 2) | DB-OPS-12, FE-PUB-05, FE-PUB-06, FE-PUB-07, FE-PUB-10, ADM-13, DB-OPS-14, OPS-09, OPS-13, XC-PRV-14, GATE-05, GATE-06 | XC-PRV-03, FE-PLT-04, OPS-05, OPS-07 |
| #190 | v10.85.0 | Aurora 4.0 A1 (design; after baseline) | FE-UIS-09, FE-UIS-12 | — |
| #194 | v10.88.0 | Erase all data works and is complete (13 Oct) | DB-SEC-08, XC-PRV-08 | — |
| #195 | v10.89.0 | WhatsApp EMI correction pays the loan (13 Oct) | INT-TXN-07, BE-WA-08, INT-TXN-12 | — |
| #196 | v10.90.0 | Pip guard: real categories, scaled figures, names as data (13 Oct) | FE-PIP-06, FE-PIP-07, FE-PIP-11 | — |
| #197 | v10.91.0 | Budget forecast counts real dates; single-key shortcuts removed (13 Oct) | FE-UIS-10, FE-MNY-16 | — |
| #198 | v10.92.0 | Admin activity feed without values, step 1 of 2 (13 Oct) | FE-PUB-01, ADM-03 | — |
| #199 | v10.93.0 (admin v1.4.5) | Admin audit without values, step 2 of 2; Privacy sentence (13 Oct) | FE-PUB-01, ADM-03 | — |
| #200 | v10.94.0 | Invitations addressed to a person: inbox functions and the invite email, step 1 of 2 (#9; R7 fixed) | — | — |
| #201 | v10.95.0 | Invitations in the bell: Join / Decline / Revoke, invite by email, step 2 of 2 (#9; R4 fixed) | — | — |
| #202 | v10.96.0 | Track E · E2: WhatsApp reads the app's spending; money port deleted (14 Oct) | XC-ARC-06 | — |
| #203 | v10.97.0 | Track E · E3: a loan payment counts in full as Loan / EMI spending (owner, 14 Oct) | — | — |
| #204 | v10.98.0 | Track E · E4: one spending baseline; two labelled cover figures (owner, 14 Oct) | FE-MNY-10 | — |
| #205 | v10.99.0 | Track E · E5: one budget-progress basis; not-planned spending (owner, 14 Oct) | FE-MNY-06, FE-UIC-08 | — |
| #206 | v10.100.0 | Track E · E6a: loan EMIs in Recurring; old EMI schedules hidden; EMIs in the budget forecast (owner, 13–14 Oct) | — | — |
| #207 | v10.101.0 | Track E · E6b: the leftover EMI schedules soft-deleted (migration; owner E-3, E-11) | — | — |
| #208 | v10.102.0 | Track E · E7: orphan loan accounts cleared; a local loan payment is one event (INV-7) | FE-MNY-04, OPS-08 | — |
| #221 | v10.110.0 | Track F1a: sign-out clears the device; writes retry until they land; honest "Synced" (owner, 18 Oct) | FE-SYN-04, FE-SYN-05, FE-SYN-08 | — |
| #222 | v10.111.0 | Track F1b: row-level merge; queued writes survive pulls; 2-minute overlap, every page (owner, 18 Oct) | FE-SYN-06, FE-SYN-07, DB-OPS-10, INT-TXN-10 | — |
| #223 | v10.112.0 | Track F1c: a split's sharing queued behind its transaction, repeat-safe (owner, 18 Oct) | INT-TXN-11 | — |
| #225 | v10.114.0 | Track T2a: joining only by invitation, once; one membership each; names for known emails (owner, 18 Oct) | BE-WA-06, DB-INT-11, INT-HH-07, INT-HH-09, XC-PRV-12, INT-CON-07, INT-HH-06 | — |
| #226 | v10.115.0 | Track T2b-1: a viewer's device no longer writes the household's alerts (app first) | DB-SEC-06 | — |
| #227 | v10.116.0 | Track T2b-2: only the server's alerts are pushed; exact push hosts, 10 devices, fitted payloads, paging (owner, 18 Oct) | BE-FN-07, DB-SEC-06 | — |
| #228 | v10.117.0 | Track T2c: no entry on a deleted account; Cash in Hand stays; every link inside its household (owner, 18 Oct) | DB-INT-09, DB-SEC-09 | — |
| #229 | v10.118.0 | Track T2d: WhatsApp templates are the server's alone; every inbox write checked; the sweep runs every 5 minutes (owner, 18–19 Oct) | BE-WA-07, BE-WA-09, BE-WA-12 | — |
| #231 | v10.120.0 | Track T5a: the Edge code and the unit tests are type-checked; Deno check, lint and smoke; date suites in 5 zones (owner, 19 Oct) | XC-ARC-09, GATE-04, INT-PAR-11 | — |
| #232 | v10.121.0 | Track T5b: no silent catches (gate); post-await writes land in their own household; Money Map flag retired; split mark-paid queued; settled/closed email notices (owner, 19 Oct) | BE-FN-09, XC-ARC-08, XC-ARC-11, XC-ARC-10 | — |
| #233 | v10.122.0 | Track T5c: WhatsApp budget alert and stale nudge on the app rules; Pip usage counted once (owner, 19 Oct) | FE-PIP-09, INT-PAR-05, XC-ARC-06 | — |
| #234 | v10.123.0 | Track T5d: each project's scheduled jobs call that project, from Vault project_url written by its deploy (owner, 19 Oct) | DB-OPS-07 | BE-FN-11 |
| #235 | v10.124.0 | Track T4a: consent recorded by the server at sign-up; splits match confirmed emails only (owner, 19 Oct) | XC-PRV-09, DB-INT-15 | — |
| #236 | v10.125.0 | Track T4b: GA4 asks first; re-consent on change; 18+; processors and DPDP named; OpenRouter keeps no data; download scope; CSP reports (owner, 19 Oct) | XC-PRV-08, XC-PRV-09, XC-PRV-10, XC-PRV-14 | XC-PRV-03, FE-PLT-04, XC-PRV-11 |
| #237 | v10.126.0 | Track T4c: lock-screen details off per phone; the Android app says where push works; auth settings recorded and drift-checked (owner, 19 Oct) | BE-FN-12 | BE-FN-11 |
| #238 | v10.127.0 | Track T4d: lock-screen push for the Android app through FCM, server side (owner, 19 Oct) | — | — |
| #239 | v10.128.0 | Track Q1: the app goes live last (promote after migrations + Edge); migrations in order; deployed engine checked; auth settings recorded (owner D8, 20 Oct) | INT-PAR-08, OPS-03, Q-DOC-01 | OPS-01, BE-FN-11, Q-AUTH-01, Q-AUTH-02 |
| #240 | v10.129.0 | Track Q2: every migration replayed on an empty database on each PR; a role × household authz matrix over every table and API function (owner D10, 20 Oct) | ADM-07, DB-SEC-10, OPS-02, OPS-08, XC-ARC-13 | — |
| #242 | v10.130.0 | Track Q3a: budgets stay in their household; production-only objects codified; staff audit trail and tiers; paged admin lists; public content columns; WhatsApp account choice and log actor; money checks; indexes (owner D4 + Q3 answers, 20 Oct) | DB-SEC-03, ADM-04, ADM-06, DB-INT-13, DB-OPS-03, INT-TXN-12, FE-PUB-08, ADM-05, ADM-08, ADM-10, ADM-11, ADM-14, DB-INT-14, DB-OPS-09, INT-HH-14, INT-TXN-14, DB-OPS-16 | INT-HH-08 |
| #243 | v10.131.0 / admin v1.5.0 | Track Q3b: admin pages on the server tiers; paged lists and server counts; staff roles and Staff actions; MRR per currency; infographic checks; previews never reach production (owner, 20 Oct) | ADM-04, ADM-07, ADM-09, ADM-08, ADM-14, INT-HH-14 | OPS-05 |
| #244 | v10.132.0 / admin v1.6.0 | Track Q4: job runs recorded, job_health and the hourly owner email, admin Health; Sentry (EU, scrubbed, no SDK); Privacy names Sentry; the weekly WhatsApp summary under insights; Userback off on localhost and the demo (owner, 20 Oct; D9) | OPS-06, FE-UIS-12, DB-OPS-08, Q-WA-01 | XC-PRV-03 |

### 0.3 New issues found during this review (not in the audit)

| # | Severity | What | Caused by | Status |
|---|---|---|---|---|
| **R1** | **High** | **"Erase all data" fails for any household with an unpaid loan.** `erase_household_data` deletes debts (`20261010120000_w1b_account_purge.sql:27`) before accounts (`:29`). W4e's guard `debts_refuse_unpaid_delete` (`20261016120000_w4e_loan_model.sql:612-625`) still sees the loan account, finds money owed and raises `debt_not_paid_off`, so the whole erase rolls back. It is DB-INT-05 again, by a new route. | #178 (W4e) against #167 (W1b) | **Fixed in v10.88.0** (13 Oct): the erase removes the loan accounts and zeroes the cached balance before deleting debts; PGlite test against the real guard. |
| **R2** | Medium | **A WhatsApp correction can relabel a plain expense as Loan / EMI**, so the loan never moves. Developer 1's PRs cited BE-WA-08 for the "paid … EMI" path. The defect the finding actually describes, in the correction path, was never touched. | Gap in #178–#180 | **Fixed in v10.89.0** (13 Oct): the correction turns the entry into a loan payment (owner decision); a plain correction refuses Loan / EMI. |
| **R3** | Medium | **Two calculators for one schedule on the budget form.** Suggest reads the RRULE (D27, #181). The recurring forecast still steps by frequency (#186), against D13's rule that every calculator goes through `ruleOf`. The two give different monthly figures. | #181 against #186 | **Fixed in v10.91.0** (13 Oct): the forecast counts each bill's real dates through `ruleOf`, as the bill calendar does (owner decision). Suggest still proposes a monthly average, by design. |
| **R4** | Low | **A revoked invitation can stay live.** Aurora A3 holds a revoke for 8 s so it can be undone. If the tab closes or the phone kills the app inside that window, the revoke may never be sent, although the screen already said "revoked". `lib/undoable.ts` and `DeferredFlush.tsx` flush on `pagehide` only, with no `keepalive` and no `visibilitychange`. | #192 | **Fixed in v10.95.0** (13 Oct, owner): Revoke asks, then revokes at once, on Households and in the bell. |
| R5 | — | #185's `ignoreCommand` exited 128, which Vercel treats as an error, so every admin production deploy failed on 8–9 Oct. W8c went live only with #189. | #185 | Fixed by #189. Live-verified: admin v1.4.4. |
| R6 | Low | Database advisor warnings after #178: `search_path` on 7 `loan_*` functions, and EXECUTE on 2 trigger functions (W8 plan, W8e). | #178 | Open. The owner deferred W8e on 8 Oct. |
| R7 | Low | **A link invitation with no relationship label could not be accepted.** `accept_invitation_link` fell back to `household_role = 'member'`, which the memberships check refuses. The app always sends a label (default Partner), so nobody hit it. Found while building #9. | 20260601153000 | **Fixed in v10.94.0** (13 Oct, owner): a missing label is stored as empty. PGlite test. |

### 0.4 Conflicting approaches, and how each was resolved

**(a) The audit's recommendation was replaced by an owner decision.** These are resolved; do not "fix" them back.

| Finding(s) | Audit recommended | Owner decided, and built |
|---|---|---|
| XC-PRV-01, XC-PRV-14 | Rewrite git history; prove it with gitleaks over full history | D1: key revoked, no history rewrite; a tip-only secret scan in CI (#165, #189) |
| FE-UIS-02, ADM-02 | Real MFA (AAL2) | D23: no 2FA for consumer or admin; 2FA UI and the Google Charts QR removed (#165) |
| BE-FN-02 | A daily purge job for scheduled deletion | D25: immediate deletion (#167) |
| INT-PAR-01, INT-TZC-02, INT-TZC-07, FE-PIP-14, INT-PAR-06, INT-TZC-08 | Merge or store FX rates | D14: one currency per household, nothing converted (#170) |
| INT-HH-12 | Relabel Child honestly, or scope its reads | D7: Child retired, children become Member (#166) |
| XC-PRV-07 | Null payloads at 30 days, delete at 12 months | D26: delete whole rows at 90 days (#167) |
| FE-PIP-01 | Measure an annual budget over its own window | D29 P1: no monthly verdict on an annual line; point to Budgets (#182) |
| FE-UIS-15, ADM-11 | Translate the app; name authors | Owner, 8 Oct: label non-English "Preview: navigation only"; byline "Vyact" (#186, #188) |

**(b) The decision and what was built differ.** Each needs a look.
- **XC-PRV-04 (D25):** the plan said a single-use emailed-code nonce, checked on the server. What was built accepts any sign-in within 10 minutes (the JWT `amr`). The Privacy page says every Danger Zone action needs the emailed code, which is true only of the UI flow. *Choose:* accept the `amr` rule and reword Privacy, or add the nonce.
- **ADM-02 + D24:** 2FA was dropped on the grounds that D24 would stop admins reading ledgers. D24 (#166) covered the ledger tables only. A roles-tier admin still reads `activity_log` row images (ADM-03), and ADM-04, the place to narrow it, is in the backlog. So the mitigation is narrower than the decision assumed, and the public claim (FE-PUB-01) is still not true. *Recommended:* finish ADM-03 now. **Done in v10.92.0 + v10.93.0 (admin v1.4.5):** admins see who, when and what only, and Privacy says so.
- **FE-MNY-04 (D19):** the plan said "changing outstanding = reconcile". What was built makes the outstanding read-only, with no reconcile action on the Debts page.
- **BE-FN-02 (D25):** the plan said remove `deletion_scheduled_for` and `reactivate_my_account`. Both are still there.
- **INT-CON-07 (D3):** the W1a migration header claims it, but `leave_household` was not changed. It now sits in W8e (deferred).
- **BE-WA-01 (D6):** the trigger fires on delete only, not on role change. This is harmless, because a demoted member is still a member.

**(c) Developer 1 and developer 2 touched the same rule.**
- **FE-MNY-16:** see R3 (fixed in v10.91.0).
- **FE-MNY-06 vs FE-UIC-08:** the Dashboard chip (developer 2) now leaves annual lines out. The Budget progress panel and the pace banner beside it do not. One screen can give two answers until the budget-basis decision is made.
- **FE-UIC-06:** each developer fixed half. Developer 1's Debts total is loans plus card dues; developer 2's Net Worth list is read from the projection. They agree for live loans and differ only for loan accounts orphaned before W4e (FE-MNY-04).
- **FE-MNY-13 vs FE-UIC-14:** developer 2 made a negative card figure mean "owed". That rules out a signed value for an "in credit" card; only an explicit toggle remains.
- **INT-PAR-05:** one `staleAccounts()` now serves push and Reply UPDATE. The WhatsApp nudge, the third surface, still counts its own way.
- **ADM-14 vs ADM-08:** MRR is re-summed in the browser over an unpaginated list (the audit wanted SQL), so it inherits ADM-08's row cap.
- **FE-UIC-07:** debt-to-income is now on this month's income on both screens, rather than the audit's completed-months basis. The screens agree, but read "—" early in the month.
- **BE-WA-03:** a pending turn is closed and then reopened on a retry, instead of being resolved only after the action succeeds. A small window remains if the worker dies.

**(d) The two plans disagree about the status of the same item.**
- **FE-MNY-08, FE-MNY-10, FE-UIC-08:** the owner put these in W6 batch C (to fix). The W8 plan parked them in §4 as "needs a decision" but left them off the §3 list put to the owner, so no decision was ever asked for. They are now in §0.6, step 3.
- **XC-PRV-10, XC-PRV-11:** owner-approved in batch G, then moved to "pending owner" by the W8 plan. XC-PRV-10's code change (`data_collection: deny` on OpenRouter calls) needs no decision.
- **ADM-09 / the admin half of OPS-05:** three documents give three states: backlog batch E; W8 §3 "owner decision"; DEVELOPER_INPUTS D8. Note that admin production reads the committed `admin/.env.production` plus a production fallback in `supabase.ts`, so scoping env vars in Vercel would not be enough on its own.
- **BE-FN-09:** in backlog batch E, but its main half was fixed in #168.
- **INT-PAR-08:** TECH_DEBT TD-33 still says "resolved".

### 0.5 Open items by severity and impact

**High (4). Each one is a money, privacy or release-safety risk.**

| ID | Status | What is left | Next step |
|---|---|---|---|
| OPS-01 | Partly | v10.128.0 (Track Q1; owner decision D8, 20 Oct 2026: "Actions deploys the app last"): Deploy runs migrations → Edge Functions → promote-apps; scripts/promote-app.mjs promotes Vercel's staged production build of this commit for vyact and vyact-admin, so an app never goes live before its schema, and a failed migration keeps the previous app live. Left: the owner adds VERCEL_PROM… | Owner: VERCEL_PROMOTE_TOKEN + auto-assign off |
| XC-PRV-03 | Partly | v10.125.0 asked first for GA4; v10.132.0 / admin v1.6.0 (Track Q4; owner decision D9, 20 Oct 2026): Userback never loads on localhost, a .test host or the demo (on in the Android app). Left for the owner: confirm in Userback that session replay, console capture and auto-screenshot are off. | Owner: confirm the Userback settings (replay, console capture, auto-screenshot off) |
| Q-AUTH-01 | Partly | v10.128.0 records the target (site_url https://vyact.app; allow-list vyact.app/**, www.vyact.app/**, vyact://auth-callback) in supabase/auth-config.json; each Deploy warns until it is live. Left: the owner changes it in the Supabase dashboard, then the check goes --strict. | Owner: Supabase Auth URL configuration |
| Q-AUTH-02 | Partly | Recorded target: a real SMTP sender (MailerSend or Resend, as split email uses) at 30 an hour. Left: the owner sets custom SMTP in the dashboard; smtp_host is recorded once chosen. | Owner: custom SMTP |

Plus **R1** (high, new): see §0.3.

**Medium (11)**
- *Ready to do (no decision):* FE-MNY-08, FE-PLT-04, FE-UIC-10, FE-UIC-12, FE-UIS-03, FE-UIS-07, INT-HH-08, OPS-11, XC-ARC-05.
- *Owner decision:* OPS-05, XC-PRV-11.

**Low and info (10)**
- *Ready to do (no decision):* FE-MNY-12, FE-MNY-13, FE-SYN-13, BE-PIP-04, BE-PIP-06, INT-HH-13, XC-ARC-07, XC-ARC-15.
- *Owner decision:* BE-FN-11, OPS-07.

### 0.6 Action plan

**Step 1. Now: no decision needed, small, highest value.** One PR per group, with the usual gates.
1. ~~**R1, the erase regression**~~ **Done in v10.88.0**, together with the erase scope (XC-PRV-08 except the export, DB-SEC-08).
2. **Pip leftovers** (Pip is the current priority):
   - ~~FE-PIP-07: validate capture category ids;~~ done in v10.90.0 (Pip asks when it cannot place one);
   - ~~FE-PIP-11: the guard must not wave through "12 lakh" or "Rs 9";~~ done in v10.90.0;
   - ~~FE-PIP-06: a "data, never instructions" line plus an egress sentinel test;~~ done in v10.90.0, with name cleaning;
   - FE-PIP-09: stop writing client turn rows;
   - ~~BE-WA-08 / INT-TXN-07~~ **done in v10.89.0**: the WhatsApp correction to an EMI becomes a loan payment (owner decision), and a category correction is checked against the entry it changes.
   All XS, with an engine rebuild.
3. **Money correctness:**
   - ~~INT-TXN-01: deleting a split closes the shared split;~~ already closed (both delete paths call `deleteSharedSplitForTxn`; status corrected in v10.88.0);
   - ~~FE-MNY-16 / R3: the forecast goes through `ruleOf`;~~ done in v10.91.0 (real dates);
   - FE-UIS-03: an onboarding re-run is idempotent;
   - FE-UIC-10: dot-grouped decimals;
   - FE-MNY-04: a reconcile action on Debts.
   Each S.
4. **Privacy and security:**
   - ~~ADM-03 rest (+ FE-PUB-01): roles-tier admins stop reading `activity_log.changes`;~~ done: the server feed in v10.92.0, then the Audit page switch, the members-only policy and the Privacy sentence in v10.93.0 (admin v1.4.5);
   - ~~XC-PRV-08 / DB-SEC-08: erase covers every household table;~~ done in v10.88.0 (the export half of XC-PRV-08 remains);
   - BE-WA-06 / BE-WA-09 rest;
   - ~~R4: send the invite revoke on `visibilitychange` with `keepalive`, or revoke first and re-create on Undo;~~ done in v10.95.0: confirm, then revoke at once (owner);
   - XC-PRV-10: `data_collection: deny`.
5. **Accessibility:** FE-UIS-07 (put the four hand-rolled dialogs on `AccessibleDialog`, M) and ~~FE-UIS-10 (a shortcuts off switch, XS)~~, done in v10.91.0 by removing the single-key shortcuts (owner decision).

**Step 2. Production checks, for the owner (read-only, about 30 minutes).** See §0.7. The JWT `amr` check comes first: without `amr` timestamps, every erase and delete is refused.

**Step 3. Decisions.** Each unlocks XS–M work.
- *Developer questions (blank since 6 Oct; 12 findings):*
  - D8, the release gate (OPS-01, INT-PAR-08);
  - D10, a migration dry run plus an RLS test matrix (OPS-02/03/08, DB-SEC-10, XC-ARC-13);
  - D4/D5, the production-only `upsert_budget` (DB-SEC-03 high, DB-OPS-03);
  - D9, error reporting (OPS-06 high, DB-OPS-08, FE-UIS-12).
  *Recommended order:* D8 and D10 first. They decide whether any release can be stopped before it hurts.
- *Owner (22 findings):*
  - split money model (FE-MNY-08, L);
  - one essential-spend baseline (FE-MNY-10);
  - one budget-progress basis (FE-UIC-08, FE-MNY-06 rest);
  - asset types vs accounts and "free to spend" (FE-UIC-12, FE-MNY-12);
  - "in credit" cards (FE-MNY-13);
  - WhatsApp alias with two accounts (DB-INT-13, INT-TXN-12);
  - local data on sign-in (FE-SYN-13);
  - email confirmation (DB-INT-15);
  - GA4 consent (XC-PRV-03 rest);
  - Privacy: legal entity and grievance officer (XC-PRV-11);
  - darker secondary text (FE-UIS-09);
  - enforce the CSP (FE-PLT-04);
  - Vercel env scoping (OPS-05) and a separate vyact-test token (OPS-07);
  - lock-screen amounts (BE-FN-12);
  - docs restructure (XC-ARC-05), the dormant SMS pipeline (XC-ARC-07), binaries out of the repo (XC-ARC-15);
  - XC-PRV-04: `amr` vs the emailed-code nonce (§0.4b).
- *Decided 13 Oct:* #181 keeps the full EMI on the Loan / EMI budget line; the Pip relay (BE-PIP-06) stays for now (backlog); "Erase all data" deletes the household's shared splits; admins see who/when/what only (ADM-03). Also decided: the full EMI will count as spending everywhere (a reporting rule, reversing part of D19) and each loan's EMI will be mirrored in Recurring, as their own track after the current batch.

**Step 4. Larger scheduled work.**
- **Batch B, sync robustness: done** (Track F1; v10.110.0–v10.112.0, #221–#223; owner decisions 18 Oct): FE-SYN-04..08, INT-TXN-10/11 and DB-OPS-10 are closed.
- **Engineering hygiene:** XC-ARC-06/08/09/11, GATE-04, XC-ARC-10.
- **Admin:** ADM-05/08/10/11/14.
- **Database hygiene (W8e):** R6, INT-CON-07, INT-HH-06/DB-INT-11, FE-PUB-08. The owner deferred these on 8 Oct; ask again, because R6 is advisor-flagged.

**Step 5. Backlog (17).** Confirm it is still "not now". One exception: ADM-04 carries the rest of D24 (see §0.4b) and should move to Step 1 with ADM-03.

### 0.7 Post-merge checks and open questions raised in PRs

**Verified live on 12 Oct.** Read-only requests to the public sites:
- vyact.app serves v10.87.0 and sends `Content-Security-Policy-Report-Only`;
- no `.map` is served for the app or the admin entry chunk (GATE-03, ADM-13);
- `https://vyact.app/learn/a/b` returns **404** (FE-PUB-06);
- `https://demo.vyact.app/learn` returns **307** to vyact.app (FE-PUB-05);
- admin.vyact.app serves **v1.4.4** with an enforced CSP (W8c is live).

**Needs the owner's accounts** (not confirmed by anyone yet):

| Check | From |
|---|---|
| The old `sb_secret_` key returns 401 | XC-PRV-01, #165 |
| `rpc('replace_memberships')` returns "function not found" | DB-SEC-01, #166 |
| Production JWTs carry `amr` timestamps (otherwise erase and delete are refused) | #167, XC-PRV-04, INT-HH-03 |
| The `whatsapp-retention` cron runs | XC-PRV-07, #167 |
| Count the rows whose currency label differs from the household's (they now count at face value) | #170, INT-TZC-02/07 |
| The `whatsapp-dispatch` cron reads `0,30 * * * *` | #169, INT-TZC-04 |
| Weekly or yearly schedules created before 7 Oct may fire on the wrong day until re-saved | FE-MNY-01 |
| Loan accounts orphaned before W4e still count as debt | FE-MNY-04, FE-UIC-06 |
| Deletion requests scheduled before v10.63.0 | BE-FN-02 |
| The WhatsApp smoke test: "50 tea", then ANSWERS OFF, then "1" | #187 |
| Sign in to admin; open Content and Settings; check the console for CSP violations | #188 |

**Declined or deferred, as recorded:**
- the XC-PRV-14 history purge (declined, D1);
- switching the CSP to enforced (after clean reports);
- a separate vyact-test token (OPS-07).

## 1. Verdict

Not yet fit to hold real family money in a shared household. The money model, the outbox and the Pip guard design are sound. But today any member of a household, a child or viewer included, can take it over or wipe it through a bulk RPC (DB-SEC-01). A production secret key may still be valid in git history (XC-PRV-01). And the recurring engine posts expenses on the wrong dates and skips months (INT-TXN-04, FE-MNY-01). Rotate the key, close the database authorization holes and stop the recurring engine inventing or dropping money before any further Pip work; most of this is a few days of focused effort.

## 2. Executive summary

## The shape of the system

Vyact is a well-built system with a few serious, concentrated defects. The core money model holds up under scrutiny: one canonical net-worth projection, reconciliation as an offset rather than a transaction, integer-minor-unit aggregation, database-enforced Cash and budget identity, and atomic, idempotent server commands for EMIs and WhatsApp approvals. The IndexedDB outbox is sound. Pip's architecture is right: services compute every figure, the model only phrases them, and the figure guard fails closed. Every local gate passed: typecheck, lint, 1,370 Vitest cases, the engine-bundle freshness check, schema snapshot and version drift.

The serious problems sit in three places:
- **Authorization inside the database.**
- **The recurring engine.**
- **The lifecycle of a member or an account:** removal, deletion and erasure.

A release pipeline that treats production as the first place anything runs makes all three worse.

## Top issues and why they matter

1. **Any member can take over or wipe a household.** `replace_memberships` and the other `replace_*` RPCs are SECURITY DEFINER functions that check only `is_member`. A teenager with a viewer or child role can make themselves sole owner, remove both parents, or replace the ledger with one call (DB-SEC-01). `transfer_ownership` has a `NULL <> 'owner'` guard that a non-member passes (DB-SEC-02). `upsert_budget` can overwrite another household's budget by id (DB-SEC-03). The lead architect re-verified all three in the migration source.
2. **A production `sb_secret_` key sat in `setup.sh` for three weeks and is still in git history** (XC-PRV-01). Treat it as compromised until it has been rotated. It bypasses RLS entirely.
3. **The recurring engine posts the wrong money.** It ignores the RRULE the user built. An annual premium for 15 March posts today, Mon/Wed/Fri posts on Sundays, and "ends after 6" never ends (FE-MNY-01). A bill on the 29th to 31st skips up to five months a year in both the client and the server copy, and a parity test pins the bug (INT-TXN-04). Daily schedules are rejected by a DB CHECK and post device-only spend (INT-TXN-05). The engine also runs on a stale cache, so it re-posts paused bills and reverts edits (INT-TXN-06). A recurring or WhatsApp EMI is booked as a full expense with no principal transfer (INT-TXN-07). Auto-approve is the default, so these become ledger rows without anyone looking.
4. **Editing a split from the list erases the split**, so the whole bill becomes your spend. Pip's split capture does the same (INT-TXN-01, FE-PIP-03).
5. **Leaving a household does not end access.** A removed partner keeps Pip answers and alerts about the ex-household's ledger on WhatsApp (BE-WA-01).
6. **Deletion and erasure do not work as promised.** Account deletion half-completes on NO ACTION foreign keys (INT-HH-03). The 30-day scheduled deletion never runs (BE-FN-02). "Erase household data" always rolls back (DB-INT-05). An owner's deletion destroys co-members' shared ledgers (BE-FN-04). Re-authentication is enforced only in the client (XC-PRV-04). WhatsApp text and phone numbers are kept forever (XC-PRV-07). Several of these are legal obligations under DPDP and GDPR, not features.
7. **Privacy claims outrun the implementation.** Contentsquare session replay and Userback run on signed-in finance screens without consent (XC-PRV-03). Invite tokens and recipient emails reach GA4 in page URLs (XC-PRV-02). Public copy says a "Private" entry is hidden from a partner, but it is not (FE-PUB-01). Two-factor authentication can be enrolled but is never challenged (FE-UIS-02). The admin console has no MFA (ADM-02) and gives support-tier admins raw reads of every ledger (ADM-03). An admin-reachable stored XSS runs on vyact.app (ADM-01).
8. **Pip states some wrong figures that pass the guard.** It compares annual budgets with one month's spend (FE-PIP-01), drops the minus sign from net worth (FE-PIP-04), and silently answers "last month" with this month (FE-PIP-05). These belong to the current priority anyway.

## Systemic causes

- **No authorization test suite.** Authorization is written as hand guards inside definer functions, and nothing tests the role and tenant matrix against the real migration chain (DB-SEC-10, OPS-08).
- **One rule, several implementations.** There are four recurrence calculators and several budget-left bases (XC-ARC-01, FE-UIC-08).
- **Generic writers bypass the money commands.** Forms and engines rebuild rows and call a plain upsert (INT-TXN-07, FE-UIC-09).
- **Time, sign and currency unit are untyped primitives** (INT-TZC-03, FE-UIC-04, INT-TZC-02).
- **Lifecycle work is unfinished.** Removal, deletion and retention were each left half-done (BE-WA-01, INT-HH-03, XC-PRV-07).
- **The release pipeline uses production as its first test.** Vercel ships the app ungated (OPS-01), migrations first run on production (OPS-02), the repo no longer reproduces production (DB-OPS-03), and there is no remote observability (OPS-06).
- **Pace outruns stabilisation.** There were 40 minor releases in 27 days, and items marked resolved have regressed: TD-24, TD-33 and TD-21 (XC-ARC-14).

## The plan

**Now (two weeks).** These items pre-empt Pip work.
- Rotate the key.
- Drop the `replace_*` RPCs and fix the `transfer_ownership` guard.
- Scope the budget upsert to the caller's household.
- Revoke WhatsApp access when a membership is deleted.
- Clamp month-end dates, and hide the recurrence options the engine cannot honour.
- Refuse EMIs in recurring and WhatsApp.
- Send split rows to the split form.
- Take session replay off signed-in routes.
- Fix the redirect, XSS, privacy-copy and erase defects.

Most of these are XS–S.

**Next (2–6 weeks).** Make it provable.
- A CI job that applies every migration and runs an RLS and RPC role matrix.
- Gate the production release on CI and the backend deploy.
- Add privacy-scrubbed telemetry.
- Make the RRULE the single source of schedule dates.
- Run account deletion as one SQL purge with a scheduled job.
- Enforce MFA for real, for consumers and admins.
- Fix the Pip figures, which advances the owner's priority directly.

**Later (this quarter).**
- Encode the money model in the types.
- Retire the hand ports.
- Type-check the Deno code.
- Add the INV-7 atomicity test.
- Add a CSP.
- Reset the docs.

Do not rewrite. The foundations are worth keeping.

## 3. Scorecard

| Area | Grade | Rationale |
|---|:---:|---|
| Frontend (consumer) | **C** | Good shell: accessible dialog primitives, routed forms that snapshot the entity once, a clean Aurora token rule. Several high money defects come from screens and forms, though: split edits erase the split (INT-TXN-01), recurrence choices are discarded (FE-MNY-01), and stale bell actions skip the wrong occurrence (FE-UIS-04). UTC 'today' (INT-TZC-03) and sign-dropping fmt (FE-UIC-04) misstate figures across the app. |
| Admin | **C** | Server-side gating is right: admin_roles cannot be self-granted, every RPC checks is_admin, and AuthGate fails closed. But god-mode access has no MFA or AAL2 (ADM-02), support-tier admins can read every household's ledger (ADM-03), and a content admin can plant stored XSS on vyact.app (ADM-01). |
| Backend (Edge Functions) | **C+** | Strong primitives: HMAC-verified webhook, durable inbox, claim-first idempotent RPCs, a careful Web Push implementation, and verified-JWT gateways. Undermined by WhatsApp reads that skip membership checks (BE-WA-01), a delete-account flow that half-completes (INT-HH-03), an open email relay (BE-FN-06), and one bad push endpoint stalling every dispatch (BE-FN-07). |
| Database | **D+** | Many invariants are correctly DB-enforced (ck_txn_accounts_by_type, cash and budget identity, member limits), and the data migrations are exemplary. Against that, SECURITY DEFINER RPCs allow household takeover and wipe (DB-SEC-01), ownership promotion by non-members (DB-SEC-02) and cross-household budget overwrite (DB-SEC-03). Erase always rolls back (DB-INT-05), and the repo no longer reproduces production (DB-OPS-03). |
| Integration | **C-** | The bundled server engine is the right parity strategy. But the month-end skip exists in both copies and a parity test pins it (INT-TXN-04). Daily schedules violate the DB CHECKs (INT-TXN-05), the server engine replaces rather than merges FX rates (INT-PAR-01), and the recurring engine writes last-write-wins from a stale cache (INT-TXN-06). |
| Platform & Ops | **D+** | Workflow hygiene is good: timeouts, a pinned CLI, a hard-failing migration job, and a loud Lane B. But the app ships to production regardless of CI or migrations (OPS-01), migrations first execute on production (OPS-02), two functions are never deployed (OPS-04), and there is no remote observability at all (OPS-06). |
| Security & Privacy | **D** | Two critical authorization holes (DB-SEC-01, DB-SEC-02) and a possibly live leaked secret key (XC-PRV-01). Session replay runs on finance screens without consent (XC-PRV-03), MFA is decorative (FE-UIS-02), and deletion, erasure and retention do not meet stated policy (BE-FN-02, XC-PRV-07). Real strengths: only the publishable key ships, the SW refuses to cache authorised responses, OTPs are hashed, and analytics are disciplined. |
| Money correctness | **C-** | The canonical projections, reconciliation-as-offset, Dinero aggregation and atomic EMI command are sound and gated by tests. The writers around them are not: the recurring engine posts on wrong dates and skips months (FE-MNY-01, INT-TXN-04), EMIs bypass the system split (INT-TXN-07), deleting a debt leaves its liability (FE-MNY-04), and a base-currency change relabels without converting (INT-TZC-02). |
| AI assistant (Pip) | **C+** | The architecture is right and mostly honoured: stage 4 owns the figures, the guard fails closed, there is no silent canned fallback, and needs_rate and needs_period return no figures. Wrong figures still get through: annual budgets compared with one month (FE-PIP-01), lost signs (FE-PIP-04), substituted periods (FE-PIP-05), unverified model-chosen amounts (FE-PIP-02), and split captures booked as full spend (FE-PIP-03). The gateway accepts client-authored system prompts (BE-PIP-02). |
| Architecture & Maintainability | **B-** | Clean dependency direction, a thin store composition root, very few type escapes, and a deterministic self-checking engine bundle. Weakened by duplicated rule implementations (XC-ARC-01, XC-ARC-06), an unenforced no-silent-catch rule (XC-ARC-11), self-contradicting binding docs (XC-ARC-05), Edge code that is never type-checked (XC-ARC-09), and a release pace that regresses resolved items (XC-ARC-14). |

## 4. Top risks (ranked)

1. **Any household member, even a child or viewer, can seize or wipe the household through replace_* RPCs** (DB-SEC-01, DB-INT-01, DB-OPS-01, INT-CON-02, INT-CON-04)  
   *Why it matters:* One POST to /rest/v1/rpc/replace_memberships deletes every membership, the real owner included, and makes the caller sole owner. The sibling RPCs replace the ledger, budgets, debts, assets and accounts. Any invited person can do this; the audit trigger only records it afterwards.  
   *Fix direction:* In a new migration, drop or revoke EXECUTE from authenticated on every replace_* function; no cloud path needs them, and the seed path is local-only. Any future bulk restore should be a service-role operation with role checks.
2. **Production Supabase secret key recoverable from git history** (XC-PRV-01)  
   *Why it matters:* A service-level key bypasses RLS and gives read/write access to every household's ledger and to auth.users. It was in setup.sh from 10 May to 1 Jun 2026 and is still reachable in history. Rotation cannot be confirmed from the repo.  
   *Fix direction:* Revoke that sb_secret_ key in the Supabase dashboard today, issue a new one, and update Edge and CI secrets. Review API logs for use since May. Consider rewriting history only after rotation.
3. **transfer_ownership NULL guard lets a non-member promote any member to owner** (DB-SEC-02, INT-CON-01, INT-HH-01, DB-INT-02, INT-CON-07, INT-HH-06)  
   *Why it matters:* A viewer creates a throwaway second account, which passes the `NULL <> 'owner'` check, and promotes their own membership to owner. From there they can remove the parents or delete the household. leave_household uses the same idiom, and owner continuity is not enforced.  
   *Fix direction:* Use `if role_in(h_id) is distinct from 'owner' then raise`, require the target to be an existing member with row-count checks, and enforce at least one owner per household. This is a one-migration fix.
4. **Recurring engine posts expenses on dates the user never chose and skips whole months** (FE-MNY-01, FE-UIC-02, INT-TXN-03, XC-ARC-01, INT-TXN-04, FE-MNY-02, BE-WA-02, DB-INT-07, INT-TZC-01, GATE-01, INT-PAR-03, INT-PAR-02)  
   *Why it matters:* Auto-approve is the default, so the results become ledger rows unseen. An annual premium posts ₹24,000 today instead of in March. Mon/Wed/Fri posts on Sundays. 'Ends after 6' never ends. Rent on the 31st posts 7 times a year, leaving up to ₹1.5 lakh of rent missing from cash flow, budgets and Pip. The bill calendar shows a different schedule from the one the engine posts.  
   *Fix direction:* Immediately, clamp month-end dates in both copies (fix the parity test that pins the skip) and hide the weekday, nth-weekday, yearly-date and COUNT options. Then make the RRULE (expandRRule) the single source of occurrence dates for the client, server and calendar.
5. **Recurring engine runs on a stale cache, and Daily schedules never reach the database** (INT-TXN-06, FE-SYN-02, INT-TXN-05, INT-CON-03, DB-INT-08)  
   *Why it matters:* A device that opens with last week's cache re-posts a bill the partner paused, un-pauses it in the cloud, and overwrites edited occurrences. A Daily schedule is rejected by the CHECK and posts device-only spend every day that the partner never sees.  
   *Fix direction:* Gate runRecurringEngine on a cloud-confirmed read, as positionIsCloudFresh does for snapshots. Either add 'daily' to both CHECKs, with the schema shipping first, or remove the Daily tab.
6. **Cross-household budget overwrite, and a production-only guard the repo cannot rebuild** (DB-SEC-03, DB-INT-03, DB-OPS-02, DB-OPS-03, DB-SEC-04, DB-INT-04)  
   *Why it matters:* A removed partner with cached budget ids can overwrite, and read back, another household's budget through ON CONFLICT (id) DO UPDATE. The owner/admin guard on upsert_budget exists only in production, so any rebuild, the test project or Lane B runs weaker authorization than production.  
   *Fix direction:* Scope every DO UPDATE with `where budgets.household_id = h` and raise on 0 rows. Commit production's pg_get_functiondef as a migration so the repo matches production again.
7. **Removed members keep WhatsApp read access to the household's finances** (BE-WA-01, BE-PIP-01, INT-HH-02)  
   *Why it matters:* After a separation, the removed partner can still ask Pip on WhatsApp for net worth, spend and account names, and keeps receiving alerts. The app's RLS blocks them, but the WhatsApp path does not check membership on reads or proactive sends.  
   *Fix direction:* Add an AFTER DELETE trigger on memberships that removes the matching whatsapp_identities row, and fail closed on a membership lookup in processInbound and dispatch. web-push already does this.
8. **Loan EMIs booked as full expenses, and deleted debts leave their liability in net worth** (INT-TXN-07, FE-MNY-03, XC-ARC-02, BE-WA-08, FE-MNY-04)  
   *Why it matters:* A ₹25,000 EMI from a recurring schedule or WhatsApp overstates spend by the principal (about ₹7,000 a month) and never amortises the loan. Deleting a debt leaves its loan account at −₹4.95 lakh in net worth and Pip, with no UI to correct it.  
   *Fix direction:* Treat loan_emi as command-only: exclude it from Recurring and the WhatsApp parse/correct paths, or require a debt link and route through record_loan_payment. Make debt and loan account one unit that removeDebt archives or refuses.
9. **Editing a split erases it; Pip split capture books the full bill** (INT-TXN-01, FE-UIC-01, FE-PIP-03)  
   *Why it matters:* Fixing a typo on a ₹3,000 split dinner from the Transactions list silently turns your ₹1,000 share into ₹3,000 of spend on every device. 'Split dinner 3600 4 ways' in Pip opens a plain expense form.  
   *Fix direction:* Redirect split rows to formPath.splitEdit, and save edits as patches over the initial row. Route split seeds to the Split form.
10. **Account deletion, erasure and retention do not do what users are told** (INT-HH-03, BE-FN-01, DB-INT-06, DB-OPS-05, XC-PRV-06, BE-FN-02, XC-PRV-05, INT-HH-04, DB-INT-05, DB-OPS-04, BE-FN-04, XC-PRV-04, BE-FN-03, FE-PLT-06, XC-PRV-07, DB-OPS-06, BE-WA-10, BE-FN-05)  
   *Why it matters:* Deletion fails halfway on NO ACTION foreign keys, leaving a login with no profile. Scheduled deletion never runs, and signing in late silently cancels it. 'Erase all data' always rolls back. An owner's deletion destroys co-members' ledgers. Re-authentication is client-only. WhatsApp text and phone numbers persist forever. These are DPDP/GDPR obligations and published promises.  
   *Fix direction:* Fix the erase CHECK now. Next, move deletion into one SECURITY DEFINER SQL purge, with FKs set to ON DELETE SET NULL, a daily pg_cron sweep, a transfer-required rule for shared households, server-side re-auth nonces, and per-table retention jobs.
11. **Session replay and analytics capture financial screens and bearer tokens without consent; privacy copy is untrue** (XC-PRV-03, FE-UIS-05, FE-PLT-03, XC-PRV-02, INT-HH-05, FE-PUB-01)  
   *Why it matters:* Unless Contentsquare masks text (unverifiable from the repo), it records balances, account names and transaction descriptions. GA4 receives invite tokens and recipient emails in page URLs. Public copy tells a partner that a 'Private' entry is hidden from the other partner, and it is not.  
   *Fix direction:* Load replay and Userback only on public pages, or behind explicit consent with full masking. Redact page_location for /invite and query emails. Rewrite the Private copy to describe what actually happens, or build row-level privacy.
12. **Authentication is weaker than advertised: decorative MFA, no admin MFA, broad admin reads, open redirect, stored XSS** (FE-UIS-02, FE-PLT-02, ADM-02, ADM-03, FE-PLT-01, FE-UIS-01, GATE-02, ADM-01, FE-PUB-02, FE-PLT-04)  
   *Why it matters:* A user who enabled 2FA after a breach is still signed in with just the password, and the TOTP secret is sent to Google Charts. One phished admin password reads every family's ledger. A crafted ?next= lands victims on a lookalike page after a real sign-in. A content admin can run script on vyact.app, where tokens sit in localStorage with no CSP.  
   *Fix direction:* Add an AAL2 challenge after sign-in, add aal2 to is_admin(), drop the 'roles' tier's SELECT on domain tables, use postAuthPath everywhere with a hardened safeNext, HTML-safe-encode inline-script values, and add a CSP.
13. **Pip states wrong figures that pass the figure guard** (FE-PIP-01, FE-PIP-04, FE-PIP-05, FE-PIP-02, FE-UIC-04, INT-TZC-06)  
   *Why it matters:* 'Can I afford a ₹20,000 flight' says yes against an annual travel budget that is already almost spent. A negative net worth is stated as positive. 'Last month' is answered with this month's partial data. A price the model invented is treated as the user's. The guard checks tokens, not meaning, so all of these pass.  
   *Fix direction:* Use a period-aware budget projection, signedMoney for every fact that can cross zero, honour the resolved period or return needs_period, and validate model entities against parseAmount on the utterance. All of this is inside the current Pip priority.
14. **Time zone, currency-unit and FX-merge errors move money between months and units** (INT-TZC-03, FE-MNY-05, FE-UIC-03, INT-TZC-02, FE-MNY-09, DB-INT-12, FE-UIS-03, INT-PAR-01, INT-TZC-04, INT-TZC-05)  
   *Why it matters:* In India, anything entered between 00:00 and 05:30 on the 1st lands in the previous month's budget. Switching base currency turns ₹1,50,000 of opening balance into $1,50,000. The server engine converts foreign rows at 1 when a household has saved any custom rate. Due-day pushes fall into quiet hours and are dropped.  
   *Fix direction:* Add localToday/localMonthKey, or a stored household zone. Replace the currency-relabel trigger with a change_base_currency RPC that refuses or converts. Merge DEFAULT_RATES with saved rates in serverEngine, which is a one-line fix.
15. **Release pipeline ships unverified code to production and nobody hears when it breaks** (OPS-01, OPS-02, XC-ARC-03, DB-OPS-11, OPS-04, XC-ARC-04, DB-OPS-13, OPS-05, OPS-06, FE-PLT-09, BE-FN-07, FE-SYN-01, INT-TXN-02, FE-SYN-03)  
   *Why it matters:* Vercel publishes the app whether or not migrations or Edge deploys succeed, and this already failed for four straight releases. Migrations first execute on production. The v10.59/v10.60 function fixes were never deployed. Faults go only to console.error. Offline writes made after token expiry are never flushed, and edits made right after a sync are dead-lettered as false conflicts, with no remote signal.  
   *Fix direction:* Promote production from a deploy.yml job that needs CI, migrations and Edge. Add a PR job that runs supabase db reset over all migrations. Add the missing functions to the manifest. Add a privacy-scrubbed fault transport and cron result checks. Make the server revision the only updated_at the store holds.

## 5. Systemic themes

### Authorization lives in hand-written SECURITY DEFINER guards that nothing tests

Definer functions bypass RLS, so each one has to restate who may do what. Several restate it wrongly or not at all: member-only checks on destructive RPCs, a NULL comparison, ON CONFLICT without a tenant predicate, triggers that predate newer columns. There is no RLS/RPC role-and-tenant matrix test against the real migration chain, so none of these could fail a build.

Findings: DB-SEC-01, DB-SEC-02, DB-SEC-03, INT-CON-07, DB-SEC-06, DB-SEC-09, DB-INT-10, ADM-03, INT-HH-12, DB-SEC-10, ADM-07, OPS-08

### One rule, several implementations

The same business rule has been written more than once and the copies disagree. There are four recurrence date calculators (RRULE, nextDueAfterSave, computeNextDueDate, and the server port). Budget left/over is computed on three bases, essential spend has two definitions, FX rates are merged in the app but replaced on the server, and hand ports survived the bundled engine. Parity tests prove only that two copies agree, and one pins the shared bug.

Findings: XC-ARC-01, FE-MNY-01, INT-TXN-04, INT-PAR-03, INT-PAR-02, INT-PAR-01, FE-UIC-08, FE-MNY-10, FE-MNY-06, FE-UIC-06, XC-ARC-06, INT-PAR-07, INT-PAR-11

### Generic writers bypass the money commands

The money model is enforced at a few command boundaries (record_loan_payment, whatsapp_approve_recurring, delete_account). Other writers, including the recurring engine, the WhatsApp log and correct paths, edit forms and Pip capture, rebuild rows from form fields and call a generic upsert. That drops splits, EMI splits, loan tenure and account links. The TypeScript Transaction type does not encode the invariants, so only DB CHECKs catch some of it.

Findings: INT-TXN-07, XC-ARC-02, INT-TXN-01, FE-PIP-03, FE-UIC-09, FE-UIC-05, FE-MNY-04, BE-WA-08, XC-ARC-12, FE-UIC-12

### Time, sign and currency unit are untyped primitives

There are three clocks (UTC today(), host-local getters, IST localDay). fmt() takes Math.abs. Account balances carry no unit and are relabelled when the base currency changes, and the FX table is undated. Each caller has to remember the right variant, and many do not, so figures move to the wrong month, the wrong sign or the wrong unit.

Findings: INT-TZC-03, FE-MNY-05, FE-UIC-03, INT-PAR-04, FE-PIP-10, INT-TZC-04, INT-TZC-05, FE-UIC-04, FE-PIP-04, INT-TZC-06, INT-TZC-02, FE-MNY-09, INT-TZC-07

### The ends of the lifecycle were never finished

Joining, logging and linking are well built. Leaving, deletion, erasure and retention are partial: membership removal does not revoke WhatsApp, deletion is multi-request and fails on foreign keys, the scheduled purge does not exist, erase rolls back, operational PII tables have no retention, and sign-out misses several caches. These are the paths users rely on to trust the product with family money.

Findings: BE-WA-01, INT-HH-03, BE-FN-02, DB-INT-05, BE-FN-04, XC-PRV-04, XC-PRV-07, XC-PRV-08, FE-SYN-04, FE-PLT-08, DB-SEC-08

### Production is the first environment anything runs in

Vercel ships the app ungated, and migrations, Edge functions and the bundled engine deploy separately. Migrations are never applied in CI. The repo has drifted from production, two functions are missing from the manifest, previews can reach production, Deno code is never type-checked, and there is no remote telemetry. Failures are found by users, if at all.

Findings: OPS-01, OPS-02, XC-ARC-03, DB-OPS-11, DB-OPS-03, OPS-04, OPS-05, INT-PAR-08, OPS-03, OPS-06, XC-ARC-09, GATE-04, DB-OPS-07

### The offline cache is treated as authoritative for writes

The design says the cache is a cache and the cloud is the truth, but writers act on cache state. The recurring engine materialises from cache-served reads, the store keeps client-stamped updated_at after an ack, refresh snapshots overwrite fresh saves, and the delta cursor assumes commit order. The result is false conflicts, reverted edits and missed rows.

Findings: INT-TXN-06, FE-SYN-02, FE-SYN-01, INT-TXN-02, FE-SYN-03, FE-SYN-06, FE-SYN-07, DB-OPS-10, INT-TXN-10, FE-SYN-08, XC-ARC-10

### Promises and copy run ahead of the implementation

Users are told about safeguards that are not there. 2FA is enrolled but never challenged. Privacy copy promises 'Private' entries and deletion schedules that do not exist. Session replay runs undisclosed. Rules in CLAUDE.md (no silent catches) and TECH_DEBT items marked resolved (TD-24, TD-33) have regressed at a pace of 40 releases in 27 days, and the binding docs contradict themselves.

Findings: FE-UIS-02, FE-PUB-01, XC-PRV-03, XC-PRV-09, XC-PRV-11, BE-FN-02, XC-ARC-11, XC-ARC-05, XC-ARC-14, FE-UIS-11

## 6. Remediation roadmap

### Now (0-2 weeks): stop the bleeding

**Goal:** Close every hole that lets a person take, wipe or read a household they should not, and stop the app writing money that did not move. These items pre-empt Ask Vyact/Pip work; most are XS-S and together are under two weeks for one engineer.

| # | Action | Findings | Effort |
|---:|---|---|:---:|
| 1 | Revoke and reissue the leaked sb_secret_ key, update Edge and CI secrets, and review Supabase API logs since May 2026. | XC-PRV-01 | XS |
| 2 | Drop, or revoke EXECUTE from authenticated on, replace_memberships and every other replace_* RPC; keep the local-only seed path off the cloud. | DB-SEC-01, DB-INT-01, DB-OPS-01, INT-CON-02, INT-CON-04 | S |
| 3 | Rewrite transfer_ownership and leave_household with `is distinct from 'owner'`, require the target to be an existing member with a row-count check, and enforce at least one owner. | DB-SEC-02, INT-CON-01, INT-HH-01, DB-INT-02, INT-CON-07, INT-HH-06 | S |
| 4 | Scope upsert_budget/replace_budgets DO UPDATE to the caller's household and raise on 0 rows; commit production's upsert_budget definition, with its owner/admin guard, as a migration. | DB-SEC-03, DB-INT-03, DB-OPS-02, DB-OPS-03, DB-SEC-04, DB-INT-04 | S |
| 5 | Add an AFTER DELETE trigger on memberships that removes the WhatsApp identity, and fail closed on a membership check in processInbound and dispatch. | BE-WA-01, BE-PIP-01, INT-HH-02 | S |
| 6 | Stop the recurring engine inventing or dropping money: clamp month-end in both lib/recurring.ts and _shared/recurring.ts, and correct the parity test that pins the skip. Hide the weekday, nth-weekday, yearly-date and 'ends after N' options until the RRULE engine lands. Add 'daily' to both CHECKs, schema first, or remove the Daily tab. | INT-TXN-04, FE-MNY-02, BE-WA-02, DB-INT-07, INT-TZC-01, GATE-01, INT-PAR-03, INT-TXN-05, INT-CON-03, DB-INT-08, FE-MNY-01, FE-UIC-02, INT-TXN-03, XC-ARC-01 | M |
| 7 | Make loan_emi command-only: remove it from the Recurring picker and the WhatsApp log/correct paths, or require a debt link and route through record_loan_payment. | INT-TXN-07, FE-MNY-03, XC-ARC-02, BE-WA-08 | S |
| 8 | Route split rows, from Transactions, the Dashboard and Pip seeds, to the Split form, and save edits as patches over the initial row. | INT-TXN-01, FE-UIC-01, FE-PIP-03 | S |
| 9 | Merge DEFAULT_RATES with saved rates in serverEngine.shapesFromRows, as the app does. | INT-PAR-01 | XS |
| 10 | Make bell notification actions check that the occurrence is still the due pointer; otherwise mark them read and say 'Already handled'. | FE-UIS-04, INT-TXN-13 | XS |
| 11 | Take Contentsquare and Userback off authenticated routes, or put them behind consent with full masking. Redact /invite tokens and email query keys from analytics page_location. Correct the public 'Private' copy. | XC-PRV-03, FE-UIS-05, FE-PLT-03, XC-PRV-02, INT-HH-05, FE-PUB-01 | S |
| 12 | Use postAuthPath everywhere and harden safeNext (control characters, backslash, origin check). HTML-safe-encode every value in the Learn inline script and href sinks. | FE-PLT-01, FE-UIS-01, GATE-02, ADM-01, FE-PUB-02 | S |
| 13 | Fix erase_household_data's activity_log action value so the erase commits. | DB-INT-05, DB-OPS-04 | XS |

### Next (2-6 weeks): make it provable

**Goal:** Make every fix above, and every future change, fail a build before it can reach production; finish the lifecycle paths; and fix Pip's wrong figures as part of the owner's priority.

| # | Action | Findings | Effort |
|---:|---|---|:---:|
| 1 | Add a PR job that runs supabase db reset over all migrations, then an RLS/RPC role-by-tenant matrix (owner, admin, member, viewer, child, non-member) for every definer function and domain table, including the Now fixes as regression tests. | DB-SEC-10, OPS-02, XC-ARC-03, DB-OPS-11, ADM-07, OPS-08 | M |
| 2 | Gate the production release: disable Vercel auto-production for main and promote from deploy.yml after CI, migrations and the Edge deploy. Add delete-account and send-split-email to the manifest. Fail the preview guard closed. | OPS-01, OPS-04, XC-ARC-04, DB-OPS-13, INT-PAR-08, OPS-05 | M |
| 3 | Add a privacy-scrubbed fault transport and an ErrorBoundary report, check pg_cron/pg_net results with alerting, and isolate per-endpoint failures in web-push dispatch. | OPS-06, FE-PLT-09, DB-OPS-08, BE-FN-07 | M |
| 4 | Make the RRULE the single source of occurrence dates in client, server and calendar, using UTC date-only arithmetic. Persist rrule and ownerMemberId. Gate runRecurringEngine on a cloud-confirmed read. | FE-MNY-01, FE-UIC-02, INT-TXN-03, XC-ARC-01, INT-PAR-02, INT-TXN-06, FE-SYN-02 | L |
| 5 | Rebuild account deletion as one SECURITY DEFINER purge: FKs to ON DELETE SET NULL, transfer-required for shared households, a daily pg_cron sweep of deletion_scheduled_for, server-side re-auth nonces for delete/erase, and per-table retention for WhatsApp and push data. | INT-HH-03, BE-FN-01, DB-INT-06, DB-OPS-05, XC-PRV-06, BE-FN-02, XC-PRV-05, INT-HH-04, BE-FN-04, XC-PRV-04, BE-FN-03, FE-PLT-06, XC-PRV-07, DB-OPS-06, BE-WA-10, BE-FN-05 | L |
| 6 | Enforce MFA for real: an AAL2 challenge after sign-in, the TOTP QR rendered locally, aal2 required inside is_admin(), and SELECT on household domain tables removed from the 'roles' admin tier. | FE-UIS-02, FE-PLT-02, ADM-02, ADM-03 | M |
| 7 | Make the server revision the only updated_at the store holds after an ack, stamp outbox ops with a durable local identity, and treat terminal rejections as failures rather than retries. | FE-SYN-01, INT-TXN-02, FE-SYN-03, INT-TXN-08 | M |
| 8 | Pip correctness, inside the current priority: a period-aware budget projection, signedMoney/fmtSigned for any figure that can cross zero, resolved periods honoured or needs_period returned, and model entities validated against the utterance. | FE-PIP-01, FE-PIP-04, FE-PIP-05, FE-PIP-02, FE-UIC-04, INT-TZC-06 | M |
| 9 | Make debt and loan account one unit: removeDebt archives and zeroes, or refuses, while a loan account or payment events exist. | FE-MNY-04 | M |
| 10 | Introduce localToday/localMonthKey (or a stored household time zone) on the client, the WhatsApp path and dispatch, and schedule due-day pushes outside quiet hours. | INT-TZC-03, FE-MNY-05, FE-UIC-03, INT-TZC-04, INT-TZC-05, BE-FN-08 | M |
| 11 | Replace the base-currency relabel trigger with a change_base_currency RPC that refuses or converts, and stop onboarding re-runs from rewriting currency or duplicating schedules. | INT-TZC-02, FE-MNY-09, DB-INT-12, FE-UIS-03 | M |
| 12 | Close abuse paths: rate-limit and escape send-split-email, compose prompts server-side in ask-vyact, make the call cap fail closed with a global ceiling, and make ai_usage server-written. | BE-FN-06, INT-HH-11, XC-PRV-13, BE-PIP-02, OPS-11, BE-PIP-03 | M |

### Later (this quarter): structural

**Goal:** Remove the root causes so the same defect classes stop recurring: encode the money model in the types, keep one implementation per rule, and fix the release discipline.

| # | Action | Findings | Effort |
|---:|---|---|:---:|
| 1 | Route every transaction create and edit through store commands that patch over the existing row; introduce a discriminated Transaction union and generated DB types; use functional state updates after awaits. | XC-ARC-12, FE-UIC-09, FE-UIC-05, XC-ARC-10 | L |
| 2 | Retire the hand-ported server money, recurring and alert code in favour of the bundled engine, and delete the dormant agent pipeline paths. | XC-ARC-06, INT-PAR-07, XC-ARC-07 | M |
| 3 | Type-check and test the Deno Edge code in CI, and type-check unit tests (TD-30). | XC-ARC-09, INT-PAR-09, GATE-04 | M |
| 4 | Add the INV-7 atomicity test (force-fail a leg of an EMI or transfer and assert zero state change), and make app reconcile atomic. | OPS-08 | M |
| 5 | Add a Content-Security-Policy to consumer, public and admin; stop publishing source maps. | FE-PLT-04, OPS-10, ADM-13, GATE-03 | S |
| 6 | Reset the docs so CLAUDE.md and the agent architecture doc agree with the code; add a lint rule that fails empty catches on write paths. | XC-ARC-05, XC-ARC-11, FE-SYN-09 | S |
| 7 | Adopt a stabilisation cadence: a hardening release after each feature train, and re-verify TECH_DEBT 'resolved' items on each release. | XC-ARC-14, XC-ARC-13 | S |
| 8 | Bring the privacy notice and consent record up to DPDP/GDPR basics, and enforce a provider data policy on OpenRouter-routed Pip calls. | XC-PRV-09, XC-PRV-11, XC-PRV-10 | M |

## 7. Keep doing

- **Enforce money invariants in the database.** `ck_txn_accounts_by_type`, `uq_account_cash_per_household`, the budget identity indexes and the member-limit triggers are the reason most money errors found are in writers, not in stored state.
- **Model money operations as atomic, idempotent server commands.** `record_loan_payment`, `whatsapp_approve_recurring`, `delete_account` and `move_account_and_delete` lock rows, claim first and validate the tenant. Extend this pattern; do not invent new ones.
- **Keep one canonical projection** (`computeNetWorth`, `SafeSummary`) feeding the Dashboard, Net Worth and Pip, and keep reconciliation as an offset plus a dated log.
- **Keep Pip's architecture.** Stage 4 computes and the model phrases; the guard fails closed; there is no silent canned fallback; `needs_rate` and `needs_period` return no figures. The fixes needed are inside this design.
- **Generate the server engine from the app's own code** (`build-agent-engine.mjs` with `--check`) rather than hand-porting.
- **Keep the sound sync core:** the IndexedDB outbox with claim/ack by opId, cache-generation guards, and `WriteNotAppliedError` row-count checks.
- **Keep the careful edge security:** the HMAC-verified webhook, hashed OTPs, Vault-held VAPID and cron secrets, the push endpoint allowlist enforced twice, and analytics that never carry amounts or raw ids.
- **Keep writing migrations archive-first and self-verifying,** as the r1 and travel-merge migrations do.
- **Keep the local gates green.** Typecheck, lint, inventory-verified tests, version drift and the schema snapshot all pass.

## 8. Stop doing / do not do

- **Stop calling the database "the source of truth" while production holds objects the migrations do not** (DB-OPS-03). Any change made in the dashboard must land in a migration the same day.
- **Stop letting Vercel publish production independently of CI, migrations and the Edge deploy** (OPS-01). Stop treating `supabase db push` on production as the first execution of a migration (OPS-02).
- **Stop writing authorization as one-off guards in SECURITY DEFINER functions without a test.** Every definer function needs a role-matrix test before it merges (DB-SEC-10).
- **Stop adding a second implementation of an existing rule** (recurrence dates, budget left, essential spend, FX merge). Extend the one that exists and delete the copy (XC-ARC-01, XC-ARC-06).
- **Stop rebuilding entity rows from form fields on edit.** Patch over the existing row (FE-UIC-09, INT-TXN-01).
- **Stop marking TECH_DEBT items resolved without a test that would catch a regression.** TD-24, TD-33 and TD-21 regressed (XC-ARC-11).
- **Stop shipping user-facing promises ahead of the implementation:** 2FA, Private entries, scheduled deletion (FE-UIS-02, FE-PUB-01, BE-FN-02).
- **Stop releasing at ~1.5 minor versions a day without hardening windows** while lifecycle and authorization paths are incomplete (XC-ARC-14).
- **Do not rewrite** the store, the sync layer or the money engine. The foundations are sound, and every top risk has a targeted fix.
- **Do not move to a different backend or framework,** and do not replace the bundled-engine approach with a separate server codebase.
- **Do not widen Pip's data egress or add new Pip surfaces before the Now items land.** The authorization holes affect the same households Pip reads.

## 9. Gate results (executed locally)

| Check | Command | Result | Summary |
|---|---|:---:|---|
| git status before | `git status --porcelain` | pass | Baseline: automation-runs/INDEX.md modified (user's), 6 untracked user files. Nothing else dirty. |
| Consumer typecheck | `cd react && npm run typecheck (tsc --noEmit)` | pass | 0 errors, ~40s. |
| Consumer e2e typecheck | `cd react && npm run typecheck:e2e (tsc -p tsconfig.e2e.json; noEmit:true confirmed)` | pass | 0 errors, ~7s. |
| Consumer unit-test typecheck (extra, scratch tsconfig) | `tsc -p <scratch>/tsconfig.tests.json (extends react/tsconfig.json, includes src incl. *.test.ts, noEmit)` | fail | 90 errors total; ~43 in react/src test files (rest are Deno-only Edge Function imports pulled in by tests, expected without Deno types). Not a project gate (TD-30), run to measure TD-30. |
| Consumer ESLint | `cd react && npx eslint . -f json` | pass | 338 files, 0 errors, 26 warnings. |
| Consumer Vitest | `cd react && npx vitest run --reporter=json` | pass | 95 files, 1370 tests passed, 0 failed, 0 skipped/todo, ~67s. |
| Admin typecheck | `cd admin && npx tsc --noEmit` | pass | 0 errors, ~34s. |
| Admin Vitest | `cd admin && npx vitest run` | pass | 3 files, 20 tests passed. |
| Admin ESLint | `cd admin && npx eslint . -f json` | pass | 34 files, 0 errors, 4 warnings. |
| Version drift | `node scripts/version-drift-check.mjs` | pass | consumer v10.60.0, admin v1.4.2 consistent. |
| Agent engine bundle freshness | `node scripts/build-agent-engine.mjs --check` | pass | Bundle in sync (33 modules). Read script first: writes only without --check. |
| Schema snapshot | `node scripts/db-migrations-check.mjs` | pass | db/schema.sql in sync with 87 migrations. Writes only with --fix (not used). |
| New-migration validator | `node scripts/validate-new-migrations.mjs` | pass | 68 checks passed. |
| Inventory self-test | `node --test scripts/__tests__/test-inventory.test.mjs` | pass | 3/3 pass. |
| Test inventory (check mode) | `node scripts/test-inventory.mjs` | pass | Verified inventory: 1390 passed cases in 98 files, zero skipped. It writes JSON reports to test-results/ which is gitignored (.gitignore:70) - no tracked file touched. |
| npm audit react | `cd react && npm audit --json` | fail | 22 advisories: 0 critical, 17 high, 4 moderate, 1 low. All highs are dev/build-only (tailwindcss->chokidar/fast-glob/micromatch/braces; puppeteer-core 23.11.1 devDep for scripts/capture-help.mjs -> @puppeteer/browsers/extract-zip/proxy-agent/basic-ftp/ip-address/ws 8.20.1; brace-expansion, js-yaml, fast-uri in tooling). Runtime-reachable: react-router-dom/react-router 6.30.4 (moderate, open redirect classes). |
| npm audit admin | `cd admin && npm audit --json` | fail | 11 advisories: 0 critical, 6 high (all build-chain: tailwindcss/chokidar/braces/micromatch/fast-glob/browserslist), 4 moderate (react-router-dom/@remix-run/router runtime, baseline-browser-mapping), 1 low. |
| Production bundle build to scratch | `cd react && npx vite build --outDir <scratch>/audit-dist --emptyOutDir` | pass | Built in ~79s. JS 2.11 MB raw (non-map), CSS 70 KB; PWA precache 110 entries / 2.85 MB. Largest: index 615 KB (180 KB gz, over 500 KB warning), generateCategoricalChart (recharts) 346 KB, Insights 264 KB, react-dom 133 KB, Chat 89 KB. 87 .map files (8.3 MB) emitted and referenced via sourceMappingURL (build.sourcemap: true). |
| Secret scan of built output | `grep -rlE for service_role, sb_secret_, sk-, PRIVATE KEY, JWT, AIza, VAPID in <scratch>/audit-dist (non-map)` | pass | No secrets. 'sb_secret_' hit is supabase-js library prefix check (startsWith) in index chunk; 'sk-' hit is a lesson id slug in Insights chunk (false positive); publishable key + project URL inlined in index chunk (documented, expected); GA measurement id in index.html (public). No service_role, no private keys, no JWTs. |
| Deno tests | `deno test (supabase/functions)` | skipped | Deno not installed; Edge Function tests not run. |
| git status after | `git status --porcelain` | pass | Identical to baseline; no tracked file modified, nothing restored. |

*Notes:* I am the empirical auditor and I resumed after the usage-limit interruption. The earlier part of the session had already produced the ESLint, Vitest, audit, inventory and build outputs in the scratchpad. I re-summarised those outputs and re-ran the typechecks and root gates myself. git status --porcelain was the same before and after: only the user's automation-runs/INDEX.md is modified, plus their 6 untracked files. No tracked file changed and nothing was restored. test-inventory.mjs writes test-results/*.json, which is gitignored (.gitignore:70). Before running build-agent-engine.mjs and db-migrations-check.mjs I read both: they write only without --check, or with --fix.

Gate results: react typecheck, typecheck:e2e, eslint (0 errors, 26 warnings), vitest (1370/1370), admin tsc/vitest (20/20)/eslint (0 errors, 4 warnings), version-drift, engine --check, db-migrations-check (87), validate-new-migrations (68), inventory self-test (3/3) and inventory check (1390 cases / 98 files) all pass. Deno is not installed, so the Edge Function Deno tests were skipped.

New defects:
- A month-end overflow in computeNextDueDate, shared by client and server, so the parity test cannot catch it. I proved the arithmetic with a scratch probe of the identical algorithm: day 31 posts only 7 of 12 months.
- An open redirect in safeNext through control characters, combined with the router's location.assign fallback.

Strengths to keep:
- Every project gate is green and fast.
- The inventory gate verifies real passing cases with zero skips.
- The engine bundle and schema snapshot are drift-guarded.
- The e2e type-check gate works.
- The production bundle contains no service_role, private keys or JWTs. The only Supabase credential is the publishable key, which is documented.
- Edge-only secrets (VAPID, provider keys) stay out of the client.
- The recurring port has deterministic ids and parity tests.
- PWA precache excludes maps.

Coverage: about 25 files opened (package.json scripts, tsconfig.e2e.json, the 5 root scripts, vite.config.ts, middleware.js, recurring.ts client and server, Recurring.tsx, postAuth.ts and its test, SignUp.tsx, VerifiedAuth.tsx, @remix-run/router history code, the failing test files, TECH_DEBT TD-30/TD-38) plus all gate outputs.

Not done: Deno tests, Playwright e2e (not in scope or needs a browser), a full TZ-variant run of the client recurring maths (Git Bash on Windows did not apply TZ), and any SQL/RLS review. That belongs to the other auditors.

*Working tree clean after gate run:* yes

## 10. Status of the previous audit (2026-09-07) and the TECH_DEBT register

### Previous audit (2026-09-07)

I re-checked all 41 numbered findings from VYACT_ENGINEERING_AUDIT_2026-09-07.md (F1-F8, S1-S6, A1-A4, 6.1-6.6, 7.1-7.5, 8.1-8.5, 9.2, 9.7, 10.1-10.5) against the code and latest migrations at 13a5ac6 (v10.60.0). Result: 7 fixed, 23 partially fixed, 10 open, 1 regressed.

Fixed: F1 (account rename no longer erases balance or reconciliation history), F6 (the durable outbox replaces the lossy queue), S1 (WhatsApp identity is server-owned and membership is re-checked), S5 (cache, transcript and service-worker isolation), 6.4, 6.6 and 7.3.

Most important remaining or new gaps:
1. F7: after a sync completes, the store keeps a client-made timestamp. Editing the same row within about 90 seconds gets the edit parked as a conflict instead of saved.
2. F4: changing base currency in Settings relabels account opening balances and offsets without converting them, and a missing FX rate still converts at 1.
3. F3/F5: the Dashboard insight chips still use the old static assets/debts and container budgets. The net-worth chip can contradict the Net Worth card, and the "budgets exceeded" chip never fires for v9.1 budgets.
4. F8: lastSyncedAt is still set after a cache-only read, despite a comment saying otherwise.
5. F2: EMI creation is now atomic, but there is no reversal, so EMI entries cannot be corrected or deleted at all.
6. S6: account deletion is still non-transactional with no scheduled purge. It destroys every household the user owns, including other members' data, and household erase skips newer content tables.
7. 10.1: delete-account and send-split-email are not in deploy.yml, so the v10.60.0 split-email fix in this very commit is not deployed by any workflow.
8. Other database gaps: transactions.asset_id has no tenant check (S3). There is no owner continuity, and admins can rewrite a membership's user_id (S2). Split rules are still client-only (8.5).
9. AI and admin: A3 is open (the browser still authors the system prompt). Admin MFA is still absent (7.1).
10. 10.4 regressed: the in-app fault banner was removed and no remote telemetry was added.
11. 10.5: vyact-agent-architecture.md still says Ask Vyact is rules-based, and CLAUDE.md tells agents to rely on that document.

Strengths to keep: the atomic, idempotent record_loan_payment RPC with server-side interest; the single computeNetWorth projection; the IndexedDB outbox with Web Locks and owner stamping; cache-generation guards; the fail-closed AI quota reservation; HTML-safe JSON-LD; the Radix-based dialogs; the PGlite SQL test.

Coverage: roughly 45 files opened (stores, adapters, sync, netWorth/calculations, key pages, 15 migrations, 6 Edge functions, admin app, workflows). Not verified: live production grants, the invitation/accept RPCs, the full WhatsApp W2-W6 function bodies, and cross-browser runtime behaviour.

| Ref | Title | Status | Current evidence / note |
|---|---|:---:|---|
| 2026-09 F1 | Editing account metadata can erase balance and reconciliation data | fixed | A rename/archive can no longer zero the opening balance or wipe the reconciliation log in either adapter, and kind reclassification is blocked on edit. The fix lives at the store layer rather than as a separate metadata-patch command, so it depends on the store holding the hydrated row (it does whenever the editor can… — react/src/store/slices/crudSlice.ts:244-262 (upsertAccount merges only DEFINED patch keys over the stored account before the adapter write); react/src/lib/supabaseAdapter.ts:436-438 (accountToRow writes opening_balance/… |
| 2026-09 F2 | Transaction form bypasses the EMI system-split branch | partially-fixed | Creation is now one atomic, idempotent server command and the FK misuse is gone. There is still no reversal/correction command (spec INV-7 is unasserted), so a mistyped EMI can never be undone from the app; the offline/local path remains a sequence of independent writes. — react/src/store/slices/dataSlice.ts:586-599 (create-vs-edit now keyed on store membership, new loan_emi routes to recordLoanPayment); :743-813 + supabase/migrations/20260909140000_correct_loan_payment_contract.sql:5-176… |
| 2026-09 F3 | Dashboard, Net Worth and Ask Vyact do not share one net-worth calculation | partially-fixed | The main figures now agree. A residual divergent seam remains on the Dashboard itself: a household whose money is in bank accounts (no assets rows) with one debt sees the Net Worth card positive while the insight chip says 'Your debts currently outweigh your assets'. — react/src/lib/netWorth.ts:115-170 (one computeNetWorth projection, liability accounts on both sides); react/src/lib/selectors.ts:80-87 (selectNetWorth), pages/NetWorth.tsx:51, pages/Reports.tsx:75, lib/aiSummary.ts:191 … |
| 2026-09 F4 | Multi-currency calculations inconsistent outside the central calculation layer | partially-fixed | Transaction totals and the AI FX inversion are fixed. Account units are now explicit (household base) but changing the base currency in Settings relabels opening balances and reconciliation offsets without converting them (INR 50,000 opening becomes USD 50,000), and unknown rates still silently convert at 1 instead of… — react/src/pages/Transactions.tsx:228-233 and :302-312 (per-row effectiveAmount conversion); react/src/lib/aiSummary.ts:218-255 (convert() replaces inverted ratio); supabase/migrations/20260910120000_r1_accounts_one_cash… |
| 2026-09 F5 | Budget allocations not consistently used by Pulse and Ask Vyact | partially-fixed | Pulse, AI summary and notifications (TD-39) now read allocation lines. The Dashboard '{n} budgets exceeded' chip still reads category-less container budgets, so it can never fire for v9.1 budgets (and counts legacy category budgets from any period against this month). — react/src/lib/calculations.ts:417-443 (computePulseScore uses budgetLinesForMonth; <=100% scores full); react/src/lib/selectors.ts:51-54 passes allocations; aiSummary.ts:218-222 uses allocation lines; BUT calculations.t… |
| 2026-09 F6 | Sync queue can lose operations enqueued during a flush | fixed | The snapshot-overwrite race is gone and multi-tab is serialised. Residual: the entity cache (DB 'vyact') and the outbox (DB 'vyact_outbox') are written in two separate transactions (hybridAdapter.ts:243-252), so a crash between them can leave a cached row with no queued op; this is documented as deliberate. — react/src/lib/sync/outbox.ts:88-152 (one IndexedDB row per op, insert-only enqueue, claim/ack by opId, stale-claim lease, owner-stamped); react/src/lib/sync/outboxStore.ts:24-46 (readwrite IDB transaction per mutation);… |
| 2026-09 F7 | Optimistic concurrency bypassed or undermined by callers | partially-fixed | After a write is acked, the store still holds the client-stamped updated_at until the next refresh (90 s poll / focus). Editing the same row in that window sends a precondition the server never had, so the guarded UPDATE matches 0 rows (supabaseAdapter.ts:1093-1106) and the user's edit is dead-lettered as a conflict i… — react/src/components/transactions/TransactionFormModal.tsx:427 (updated_at now preserved); react/src/lib/supabaseAdapter.ts:794-808 (profile/household updates check error and affected rows); react/src/lib/sync/outbox.ts… |
| 2026-09 F8 | Delta sync and refresh do not guarantee complete, current data | partially-fixed | Pagination and the cursor stall are fixed. 'Last synced' is still stamped after a cache-first read, contradicting its own comment; background results reach the store only on the next refresh; applyCloudList (hybridAdapter.ts:144-158) still replaces the cache wholesale without overlaying pending outbox ops on the no-cu… — react/src/lib/supabaseAdapter.ts:975-993 (full list drained by (updated_at,id) keyset, but a silent 200-page guard) and :1031-1067 (composite delta cursor); react/src/lib/hybridAdapter.ts:119-133 (warm read returns cach… |
| 2026-09 S1 | WhatsApp verification state not isolated from ordinary profile updates | fixed | Identity is server-owned and every checked WhatsApp writer revalidates membership and write role per message. Soft-deleted accounts are excluded from alias resolution. — supabase/migrations/20260908120000_audit_s1_whatsapp_identities.sql:33-88 (server-owned whatsapp_identities with RLS deny-all; trigger freezes legacy profile columns for non-service-role); supabase/functions/whatsapp-we… |
| 2026-09 S2 | Household role creation broader than the documented permission model | partially-fixed | Owner escalation by admins is closed. Still open: no role-management RPCs, no owner continuity (the last owner can leave and orphan the household), and the UPDATE policy's WITH CHECK only checks role, so an admin can rewrite a member row's user_id to a different account. — supabase/migrations/20260908120100_audit_s2_membership_role_grants.sql:23-38 (admins can no longer insert or promote to 'owner'); same file :17-18 ('Owner-continuity ... is NOT enforced here'); supabase/migrations/20260… |
| 2026-09 S3 | Foreign keys establish existence but not tenant consistency | partially-fixed | The listed relations are enforced. The v10.26 transactions.asset_id column was added after the S3 migration and is not covered, nor are accounts.asset_id/debt_id. The privacy-model questions (platform admins reading household finances) were not resolved. The trigger comment says 'definer context' but the functions are… — supabase/migrations/20260909120000_audit_s3_tenant_consistency.sql:24-115 (triggers for transactions account_id/to_account_id/member_id/debt_id, allocations, shared_splits); supabase/migrations/20260911120000_r4_investm… |
| 2026-09 S4 | Public Learn rendering has an unsafe JSON-LD embedding boundary | partially-fixed | Script-context breakout is closed on every server-rendered JSON-LD sink. No CSP exists anywhere (vercel.json, middleware.js, api/*), so the defence-in-depth half of the recommendation is still open on an origin shared with the authenticated app. — react/api/_page.js:21-23 (safeJsonLd escapes '<' as <) and :158; react/api/learn.js:14,21; react/scripts/landingHtml.mjs:71; react/vercel.json:93-110 (HSTS, nosniff, XFO, Referrer, Permissions-Policy, no Content-Securit… |
| 2026-09 S5 | Local data isolation and logout behaviour lack a security contract | fixed | Contract is now explicit and implemented. Minor remainder: sign-out leaves profile, rates and netWorthSnapshots in memory (cloudAuthSlice.ts:84-89); the SW cache plugin also never caches public reads, because supabase-js always sends Authorization. — react/src/pages/Chat.tsx:76-89,143 (household-scoped chat key, legacy global key removed); react/src/lib/cacheInvalidation.ts:51-62,87-175 (purges IndexedDB + localStorage including chat_history_*, on user change, epoch… |
| 2026-09 S6 | Data-erasure and permanent-deletion workflows incomplete | partially-fixed | The NOT NULL onboarding defect is fixed. Deletion is still multi-request, has no scheduled purge, has no ownership-transfer rule (a Couple or Family owner deleting their account erases the partner's ledger), and misses content tables added since v9.8. — supabase/migrations/20260911150000_v1030_net_worth_snapshots.sql:119-157 (latest erase_household_data sets onboarding '{}' and deletes snapshots, but not notifications, whatsapp_pending_turns, agent_conversations, ai_fe… |
| 2026-09 A1 | Number guard does not enforce the guarantee stated in comments and UI | partially-fixed | Structured, service-computed facts now feed the model and the overclaiming copy was withdrawn. Amounts are still rendered inside model-authored prose rather than by the UI, so sign, unit and framing errors still pass the guard. — react/src/lib/askVyactLlm.ts:196 (HARMLESS exemptions) and :275-295 (token match only); askVyactLlm.ts:466 (allowlist built from structured facts); CLAUDE.md binding text now states the guard is not proof |
| 2026-09 A2 | AI cost controls not atomic or fail-closed | partially-fixed | Quota is now reserved atomically and fails closed. Household attribution is still missing because the consumer never sends householdId, and metering finalise failures are only console-logged. — supabase/functions/ask-vyact/index.ts:413-440 (reserve_ai_usage atomic reservation before the provider; count failure returns 503 quota_check_failed) and :481-508 (finalise; errors only logged); react/src/lib/askVyactMo… |
| 2026-09 A3 | Client/server AI contract has drifted | open | Unchanged. The server still accepts browser-authored system prompts and ignores the client's token and format hints, which CLAUDE.md now documents. Any signed-in user can drive the paid gateway with arbitrary prompts up to the daily cap. — react/src/lib/askVyactModelCall.ts:46-55 (browser sends the system prompt plus responseFormat/maxOutputTokens); supabase/functions/ask-vyact/index.ts:475-479 (chatCompletion called with config/timeout/signal only; maxOu… |
| 2026-09 A4 | WhatsApp implemented behaviour narrower than its specification | partially-fixed | Batch handling, an ack-first durable inbox and backdating are done. Replay only runs opportunistically on the next inbound delivery, because no scheduler calls the sweep, and there is still no retryable outbound confirmation. — supabase/functions/whatsapp-webhook/index.ts:159-216 (iterates all entries, changes and messages; records rows, acks, processes in EdgeRuntime.waitUntil); :664-665 (p_date now passed); :221-311 (failed rows plus sweep w… |
| 2026-09 6.1 | Dialog accessibility incomplete | partially-fixed | The shared primitives are fixed. The Ask/Pip drawer, which is the current priority surface, still lacks dialog semantics, focus management and an adequate touch target. — react/src/components/ui/HalfSheet.tsx:5-7 and ui/Modal.tsx:2-3 (now on Radix AccessibleDialog: focus trap, restore, inert background, >=44px close); react/src/components/layout/FloatingTools.tsx:67-118 (Pip drawer: plai… |
| 2026-09 6.2 | Responsive behaviour needs workflow testing | partially-fixed | Stale tests were updated, but the 320 px, zoom, large-text and keyboard-open matrix is not exercised by default. — react/e2e/tests/responsive-mobile.spec.ts:7 (retired sidebar and FAB assertions removed); react/playwright.config.ts:50,55 (mobile and webkit projects still skipped unless E2E_FULL_MATRIX) |
| 2026-09 6.3 | Transaction-list pagination is not virtualization | open | Unchanged. — react/src/pages/Transactions.tsx:242-252 (MONTHS_PER_PAGE paging, all rows of visible months rendered); react/package.json:30 (@tanstack/react-virtual present but unused in Transactions.tsx) |
| 2026-09 6.4 | Form hydration can overwrite an active draft | fixed | Background profile or member refreshes no longer reset an in-progress draft. — react/src/components/transactions/TransactionFormModal.tsx:246-311 (hydration effect depends on [open, initial?.id, seedProp] only; base currency and member captured at open) |
| 2026-09 6.5 | Simulated chat streaming introduces race conditions | partially-fixed | The last-item race is fixed. The full transcript is still written to storage on every word of the stream. — react/src/pages/Chat.tsx:102-125,204-225,311-340 (per-turn turnId, cancel handles, send refused while a stream is active); Chat.tsx:141-147 (whole transcript persisted on every history change, i.e. every streamed word) |
| 2026-09 6.6 | Voice input conflicts with deployment policy | fixed | Policy now permits same-origin microphone use, matching the feature. Cross-browser behaviour was not verifiable from code. — react/vercel.json:110 ('camera=(), microphone=(self), geolocation=()'); SpeechRecognition used in react/src/pages/Chat.tsx |
| 2026-09 7.1 | Privileged admin security depends on consumer-grade login alone | open | No MFA/AAL2, step-up or short session exists. The deadline the UI cites has already passed. — admin/src/pages/Settings.tsx:57 ('Admin MFA ... Not yet enforced — tracked for v1.4.0' while admin is v1.4.2); no aal/mfa check anywhere in admin/src (grep) |
| 2026-09 7.2 | Admin data loading will become incomplete or expensive | partially-fixed | Aggregates moved server-side, but the Households and Subscriptions pages remain unbounded. Past the PostgREST row cap the memberships read truncates silently and member counts go wrong. — admin/src/lib/adminApi.ts:25-121 (KPIs, trends, users, AI usage via RPCs); :137-159 (fetchAllHouseholds still downloads all households and all memberships, counting in the browser); :174-182 (subscriptions unpaginated) |
| 2026-09 7.3 | Admin lacks route-level resilience | fixed | Both recommendations implemented. — admin/src/App.tsx:8-19 (every page React.lazy plus Suspense); admin/src/main.tsx:5,12-16 (root ErrorBoundary) |
| 2026-09 7.4 | Admin operational settings are assertions, not verified state | partially-fixed | The environment label and security targets are now honest. 'Connected' is still a constant, not a live check, and the version footer is stale. — admin/src/components/Layout.tsx:197-198 (environment from VITE_ADMIN_ENV); admin/src/pages/Settings.tsx:57-63 (security rows labelled 'planned'); Settings.tsx:28 (status hardcoded to 'connected'); Settings.tsx:68 ('Admi… |
| 2026-09 7.5 | Admin tests do not cover the dangerous parts | partially-fixed | There is client-side gating coverage, but nothing exercises real RLS, revoked admins, session expiry or destructive RPCs. — admin/src/lib/__tests__/roleGating.test.ts:6-30 (pure route-gating unit tests); contentWorkflow.test.ts:18-50 (mocked content service) |
| 2026-09 8.1 | Separate simple CRUD from financial commands | partially-fixed | Loan payments, budgets, account deletion and cash identity are commands. Reconciliation, transfers and splits still go through generic upsert. — record_loan_payment (20260909140000:5), upsert_budget_with_allocations, delete_account/move_account_and_delete and ensure_cash_account (react/src/lib/supabaseAdapter.ts:916-952); react/src/store/slices/reconcileSlice.ts… |
| 2026-09 8.2 | Replace polymorphic Account.assetId linkage | partially-fixed | An explicit debt link exists, but the legacy assetId-as-debt fallback is still honoured in ledger key encoding. — react/src/lib/accountBalance.ts:25-31 (explicit debtId preferred, with fallback to assetId for card/loan); dataSlice.ts:829-835 (loan accounts use debtId) |
| 2026-09 8.3 | Strengthen the TypeScript Transaction model | open | No discriminated union. Invalid combinations are still only caught by DB CHECKs. — react/src/types.ts:117-167 (single interface, all account and link fields optional, legacy paymentMethod and linked* fields on current type) |
| 2026-09 8.4 | Generate database types and validate runtime boundaries | open | Unchanged. — No generated Database types in react/src (grep for Database['public'] / database.types returns nothing); react/src/lib/supabaseAdapter.ts:140-160 hand-written row interfaces with casts at :997-1006 |
| 2026-09 8.5 | Split-sharing rules need database enforcement | open | Unchanged at the DB. A failed share insert leaves an orphan split, a blocked unpaid-only edit 'succeeds' with zero rows, and the v10.59 own-email and duplicate-participant rules are client-only. — react/src/lib/sharedSplits.ts:97-121 (parent and shares in two separate inserts), :195-215 (update/remove of shares with .eq('paid', false) and no affected-row check); supabase/migrations/20260724130000_shared_splits.sq… |
| 2026-09 9.2 | Use functional state updates after asynchronous work | open | A refresh that lands during the await is overwritten by the stale snapshot. — react/src/store/slices/dataSlice.ts:507 captures transactions before awaits and :623-624 writes set({ transactions: transactions.map(...) }); same pattern in removeTransaction at :631-647 and crudSlice.ts:226,268-283 |
| 2026-09 9.7 | Ratchet lint rules on money/auth/sync boundaries | open | Unchanged. — react/eslint.config.js:49 ('react-hooks/exhaustive-deps': 'warn'), :54 ('@typescript-eslint/no-explicit-any': 'warn') |
| 2026-09 10.1 | CI and production deployment are independent | partially-fixed | Backend deploys are no longer best-effort. The app still ships independently of CI and migrations, and delete-account and send-split-email are still absent from the manifest, so the v10.60.0 send-split-email fix in the current commit is not deployed by any workflow. — .github/workflows/deploy.yml:43-60 (migrations no longer continue-on-error; Edge deploy needs db-migrations; comment admits Vercel publishes the app in parallel regardless); deploy.yml:140-159 (deploys whatsapp-*, web-p… |
| 2026-09 10.2 | Largest missing test layer is integration | partially-fixed | Several of the listed scenarios now have unit or IDB tests. There are still no RLS or tenant tests against the real migration chain. — react/src/lib/__tests__/loanPaymentSql.test.ts:1-40 (PGlite with a hand-built schema stub, not the migrations); accountPatchSafety.test.ts, outbox.test.ts, outboxIndexedDb.test.ts, gatewayWorkflow.test.ts exist |
| 2026-09 10.3 | Mobile/browser coverage must be a release gate | open | Unchanged. — react/playwright.config.ts:50,55 (mobile and webkit ignored unless E2E_FULL_MATRIX); .github/workflows/ci.yml:133 (installs chromium only) |
| 2026-09 10.4 | Observability is primarily local | regressed | No remote telemetry was added, and the in-app fault banner the audit described was removed. Unexpected faults and droppedWrite now go only to console.error; only dead-letter counts surface (SyncConflictBanner). — react/src/lib/faults.ts:56-58,85-89 (setFaultTransport exists but no production caller; grep finds registrations only in faults.test.ts); commit e559084 'remove the sync-health banner' |
| 2026-09 10.5 | Documentation needs a truth reset | open | Still false, and now load-bearing: CLAUDE.md tells agents to read vyact-agent-architecture.md 'and stop there', so agents are pointed at a document that contradicts the model-backed implementation. — vyact-agent-architecture.md:11-13 ('The agent is NOT live. Ask Vyact today is 100% rules-based and on-device'); ARCHITECTURE.md:3 ('Updated ... 2026-06-01'); no docs/adr directory |

### TECH_DEBT.md register

I checked all 29 items against the current code and migrations at commit 13a5ac6 (about 70 files opened, including CI and deploy workflows, store slices, the sync/outbox code, the Edge gateway and relay, the RLS and definer migrations, and the test configs). Of the 18 open items, 4 are fixed only in part (TD-02, TD-19, TD-29, TD-32), 4 have some progress (TD-35 inbox done; TD-37 atomic on WhatsApp only; TD-42 anon locked out; TD-29 green but can't be a required check), and the rest are still open. Nothing on the open list is fully fixed.

**Worse than the register says:**
- **TD-15:** MFA can be enrolled, but sign-in (SignIn.tsx:35-37, auth.ts:28) never asks for the second factor, and no RLS policy checks for it. An enrolled TOTP adds no protection, while Settings tells the user two-factor is enabled.
- **TD-16:** the 'Full backup' leaves out accounts, budget allocations and recurring schedules, so balances can't be rebuilt from it.

**Regressions among the items marked resolved:**
- **TD-33:** the consumer deploy job was removed on 1 Oct, so the app deploy races the Edge Functions deploy again. CI also never deploys send-split-email or delete-account, so the v10.59/v10.60 send-split-email changes reach production only by hand.
- **TD-24:** new silent `catch {}` on write paths:
  - sharedSplitsSlice.ts:111: a failed cross-household split delete disappears for the owner only.
  - recurringSlice.ts:133,162: schedule-advance writes are swallowed.
  - dataSlice.ts:264-266: the legacy recurring migration swallows failures, then deletes the source.
- **TD-21:** the saved_views RLS policies use bare `auth.uid()` (minor; hidden feature).

**Partly holding (spot-checks):**
- **TD-01:** new account-balance and net-worth folds add in floating point and round at the end, without Dinero.
- **TD-06:** the delta-sync cursor is the time a database write started, not when it committed. A row from a longer write that commits late can be missed on another device until the user taps Refresh.

TD-03, TD-05, TD-09, TD-10, TD-14 and TD-39 hold.

**What I couldn't verify:** the dashboard-only settings (leaked-password protection, production advisors), the npm audit count (offline), and Lane A/B pass rates (I didn't run any tests).

| Ref | Title | Status | Current evidence / note |
|---|---|:---:|---|
| TD-02 | Automated-test breadth: integration layer | partially-fixed | Tests now cover the store, adapter and IndexedDB cache together in local mode, and there are PGlite SQL tests. Nothing tests HybridAdapter -> SupabaseAdapter -> outbox flush with a cloud transport, so the cloud integration layer is still missing. — react/src/lib/__tests__/ledgerWorkflow.test.ts:1,11,16 (store + real LocalStorageAdapter + fake-indexeddb, supabase mocked out); loanPaymentWorkflow.test.ts:8,36 (cloudEnabled flipped with a mocked adapter.recordLoanPay… |
| TD-15 | MFA / leaked-password protection | open | Worse than the register says. Besides leaked-password protection being off (a dashboard setting that can't be checked from the repo), MFA is never asked for at sign-in. A user with TOTP enrolled gets in with just a password (or a magic link) at AAL1, and no RLS policy checks aal, so the second factor protects nothing.… — react/src/pages/auth/SignIn.tsx:35-37 navigates straight in after signIn(); react/src/lib/auth.ts:27-30 signInWithPassword only, and auth.ts:166-189 has enroll/challengeAndVerify/list/unenroll but nothing calls getAuthe… |
| TD-16 | Backups/exports unencrypted at rest | open | Exports are still plaintext, with only a generic warning at Settings.tsx:632. A related defect: the 'Full backup' leaves out accounts, budgetAllocations, recurringSchedules and net-worth snapshots, and stamps version 6.4.9. Balances can't be rebuilt from it, and there is no restore path. — react/src/pages/Settings.tsx:275-280 backupSnapshot() = {version:'6.4.9', profile, transactions, budgets, goals, members, debts, assets, exchangeRates}; :285 clipboard.writeText(JSON); :292-299 plaintext Blob download; … |
| TD-19 | E2E Lane B (cloud + RLS isolation) | partially-fixed | Lane B exists and asserts cross-household RLS, but only on transactions/households/memberships. Nothing keeps the vyact-test schema in step with the 87 migrations, and an unconfigured lane passes the job instead of failing it. — react/e2e/lane-b/rls-isolation.spec.ts:53,76,98 (read/modify/insert isolation, transactions only); .github/workflows/ci.yml:159-195 Lane B runs on PRs only and finishes green with a notice when the secret is unset (:183… |
| TD-29 | Lane A e2e failures / required check | partially-fixed | Lane A runs on every PR, but I could not re-run it to confirm the claimed 0 failures. The remaining acceptance step (make it a required check) can't be done on the current GitHub plan, and two CI retries can hide flakes. — .github/workflows/ci.yml:116-135 (Lane A on pull_request only); ci.yml:5-6 notes the private repo on GitHub Free has no branch protection; react/playwright.config.ts:24 retries: 2 in CI; e2e fixme/skip in budgets, dashb… |
| TD-30 | Vitest does not type-check unit tests | open | Unchanged. About 97 unit test files in react/src/lib/__tests__ are transpiled by esbuild and never type-checked. — react/tsconfig.json:22 exclude ['src/**/*.test.ts','src/**/*.test.tsx','e2e']; admin/tsconfig.json:17 same exclusion; no tsconfig.test.json in react/ or admin/; scripts/automation-run.mjs:60-76 gates are typecheck, type… |
| TD-31 | Spec INV-7 atomicity has no test | open | Cloud EMIs are atomic by construction (one RPC), and a transfer is one row. Still, no test forces a leg to fail and checks for zero state change, and the local-mode EMI is knowingly non-atomic (a failure after the interest leg leaves a half-applied payment). Acceptance not met. — react/src/lib/__tests__/moneyModel.invariants.test.ts:21,30-35 ('spec INV-7 atomicity -> NOT COVERED'); react/src/store/slices/dataSlice.ts:792-817 cloud EMI goes through the atomic record_loan_payment RPC; dataSlice.ts… |
| TD-32 | Test fidelity: Edge handlers on npm supabase-js; no cloud-mode unit coverage | partially-fixed | Some store branches are now tested with cloudEnabled set and a mocked adapter. Edge handlers are still tested against a very different supabase-js build than the one Deno loads, and nothing runs under Deno in CI. — react/vitest.config.ts:8 aliases esm.sh/@supabase/supabase-js@2.45.0 to the npm package; react/package.json lists @supabase/supabase-js ^2.117.2 (Edge Functions import 2.45.0, a gap of about 70 minor versions); vitest.c… |
| TD-34 | pg_trgm installed in public | open | Unchanged. No migration in the repo defines a gin_trgm_ops index (only a comment mentions it), so the reason for deferring may not apply. Check production indexes before moving the extension. — supabase/migrations/00000000000001_production_state_baseline.sql:36 'create extension if not exists pg_trgm schema public'; 20260909150000_v1022_lock_down_definer_functions.sql:91-93 defers it; no ALTER EXTENSION / SET … |
| TD-35 | Audit release blockers: loan repair, webhook inbox, ownerless outbox | partially-fixed | The webhook inbox can now be replayed. Quarantined ownerless or other-user outbox ops are never resolved, and they inflate the pending badge for good. Historical loan balances have not been re-derived. — Inbox fixed: supabase/functions/whatsapp-webhook/index.ts:139-146 (?mode=sweep), :264 marks failed with attempts+1 and last_error, :275-282 sweep. Outbox open: react/src/lib/sync/outbox.ts:78 migrated legacy ops get own… |
| TD-36 | Surfaces still on the two-account investment model | open | Still latent: the agent pipeline has no live write entrypoint, so nothing writes a two-account investment today. It would fail ck_txn_accounts_by_type once connected. — supabase/functions/_shared/agent/resolver.ts:500-517 resolves an investment destination through resolveAccountRef(..., accounts); _shared/agent/pipeline.ts:178 (runIngestion) is not imported by any function index.ts; re… |
| TD-37 | R6 atomic reconcile | partially-fixed | WhatsApp reconciles are now atomic on the server. The app's reconcile is still two separate writes through the queue, so a device can see the account and its linked Asset/Debt disagree. Its doc comment at reconcileSlice.ts:15-17 still says it writes a 'Balance Adjustment transaction', which contradicts the money model. — supabase/migrations/20261001120000_w6_whatsapp_name_and_update.sql:96-149 whatsapp_reconcile_account does the offset, log, last_reconciled_at and Asset/Debt bridge in one transaction with an expected-offset check (servi… |
| TD-38 | npm audit advisories never triaged | open | No classification of reachable vs unreachable exists. I couldn't re-count the advisories in a read-only, offline audit. Dependabot only mitigates part of this. Also, react/package.json has an odd self-dependency "vyact-react": "file:". — .github/dependabot.yml (monthly version updates; security PRs on advisory); no triage record in docs/ (only docs/CORRECTIVE_REVIEW_2026-09-09.md mentions the 17 advisories) |
| TD-40 | UI Standardization Pilot remaining gates | open | The native-confirm replacement hasn't happened (about 25 call sites, including irreversible account and household deletion). I did not reproduce the -$95 Cash summary display or the transparent backdrop. — Native confirm() still used at react/src/pages/Budgets.tsx:93, Debts.tsx:72, Households.tsx:303,396,413,510,563, NetWorth.tsx:129, Recurring.tsx:317, Settings.tsx:153,169,184,202,776, Splits.tsx:86,148, components/trans… |
| TD-41 | Superseded docs never retired | open | None of the five docs or the fixme comment has been archived or pruned, and there's no retire-docs step in the release process. — docs/ROADMAP_AUTO_LINKING.md:1 '# FinFlow — Auto-Linking Roadmap' not archived; docs/handoff-plans/todo.yaml still outside archive/ (archive/ holds only BRIEF_deprecate_vanilla.md); CLAUDE-1.md:308 'Known Limitations' s… |
| TD-42 | Security advisors: RLS-no-policy tables, authenticated-callable SECURITY DEFINER | partially-fixed | anon is locked out and erase_household_data has its own guard. But the authenticated-executable definer list and the RLS-no-policy tables are not individually recorded as accepted, and the empty _backup_v9 tables still exist. Acceptance not met. — supabase/migrations/20260909150000_v1022_lock_down_definer_functions.sql:36-71 revokes PUBLIC/anon and grants authenticated; later migrations follow the same pattern (e.g. 20261003120000_web_push.sql:125-130,188-195; 20… |
| TD-43 | No real-provider test of deployed ask-vyact gateway | open | Both parts of the acceptance are unmet: there's no CI call to the deployed endpoint with a real JWT, and provider failures still aren't logged. — .github/workflows/deploy.yml:152-159 deploys ask-vyact with no post-deploy smoke step; supabase/functions/ask-vyact/index.ts:515-523 the !result.ok branch returns respond(...) with no console line (only metering failure… |
| TD-44 | Temporary Claude Code relay stores message content | open | The relay is fully present 19 days after v10.37. Message content is kept with no automatic purge. Poll access is scoped by user_id and the table is service-role only. — supabase/functions/ask-vyact/index.ts:92-116,274-307 relay branch + relayPoll; supabase/functions/ask-vyact-relay-status/index.ts (no-JWT count endpoint); supabase/migrations/20260915120000_v1037_ask_vyact_relay.sql:25-… |
| TD-01 | Floating-point money arithmetic (resolved; spot-check) | partially-fixed | The money projections added since (account balances, net worth, card dues) skip the Dinero rule and only round at the end. Today's magnitudes give no wrong cents, but the register's claim that every aggregator folds in Dinero no longer holds. — react/src/lib/calculations.ts:61-62,77 still fold via sumDinero; but react/src/lib/accountBalance.ts:58-70 computeAccountBalance accumulates with float `bal += amt` then rounds; accountBalance.ts:80-91 computeAssetValue… |
| TD-03 | Optimistic concurrency (resolved; spot-check) | fixed | Still in place, and extended to accounts, recurring and saved views. Members (crudSlice.ts:174) and allocations (:153) write without a precondition. — react/src/lib/supabaseAdapter.ts:1093-1105 guarded UPDATE with .eq('updated_at', expected) and ConcurrencyConflictError; crudSlice.ts:86,162,196,209,272,445 and recurringSlice.ts:72-75 pass updated_at; dataSlice.ts:608-… |
| TD-05 | Render error boundary (resolved; spot-check) | fixed | No regression. — react/src/main.tsx:7,43-48 <ErrorBoundary> wraps the app |
| TD-06 | Delta sync / pagination (resolved; spot-check) | partially-fixed | Paging works, but the cursor is a commit-order-unsafe timestamp. A row written by a longer transaction (an RPC, an import, a cron) that commits after another device has read past its now() is skipped by that device for good, until the user taps Refresh. The window is rare but real. — react/src/lib/hybridAdapter.ts:121-124 delta via listSince; supabaseAdapter.ts:1044-1054 composite (updated_at,id) keyset; baseline.sql:358-360,613 set_updated_at() uses now() (transaction START time) and inserts take t… |
| TD-09 | Atomic replaceAll (resolved; spot-check) | fixed | No regression on the paths that run in cloud. The seed's replaceAll('recurring') at dataSlice.ts:222 runs in local mode only. — react/src/lib/supabaseAdapter.ts:1240-1248 routes to replace_<entity> RPCs; budgetAllocations kept as a scoped soft-delete + per-row upsert at :1214-1236 (documented, superseded by upsertBudgetWithAllocations) |
| TD-10 | Sync retry cap / visibility (resolved; spot-check) | fixed | Still in place. Note the badge count includes quarantined ownerless ops (see TD-35). — react/src/lib/sync/backoff.ts:2 MAX_RETRIES=5; sync/conflict.ts:23 dead-letters past the cap |
| TD-14 | Storage quota handling (resolved; spot-check) | fixed | No regression. — react/src/lib/kvStore.ts:105-124 emitStorageEvent on quota and unexpected() on other persist failures; App.tsx:6 subscribes to storage events |
| TD-21 | RLS initplan wrapping (resolved; spot-check) | regressed | A minor performance regression on a hidden feature (Saved Views). Newer policies elsewhere use helper functions. Wrap as (select auth.uid()). — supabase/migrations/20260602140000_money_map_saved_views.sql:67-83 (created the day after the TD-21 migration 20260601120000) uses bare `user_id = auth.uid()` and per-row is_admin('roles') in all four saved_views polici… |
| TD-24 | Error opacity / silent write-loss catches (resolved; spot-check) | regressed | New silent catches on write and contract paths, which CLAUDE.md forbids. A failed cross-household split delete vanishes for the owner while participants still see it, and a failed legacy migration deletes the only copy of the data. — react/src/store/slices/sharedSplitsSlice.ts:111 `try { await deleteSharedSplit(existing.id); } catch { /* best-effort */ }` then removes it locally; recurringSlice.ts:133,162 swallow schedule-advance writes; dataSlice.t… |
| TD-33 | Consumer deploy raced Edge Functions (resolved; spot-check) | regressed | The fix (`consumer needs: deploy-edge-functions`) no longer exists, so the race is back. CLAUDE.md documents it as an operational rule, but the register still says resolved. Also, the v10.59/v10.60 changes to send-split-email, and delete-account, never reach production through CI and need a manual deploy. — .github/workflows/deploy.yml:6-12 the consumer/admin jobs were removed on 1 Oct 2026, and Vercel's GitHub connection publishes in parallel; deploy.yml:58-63 admits the app can go live before its migration. deploy.yml:13… |
| TD-39 | budget_threshold never emitted (resolved; spot-check) | fixed | No regression. Small residual: a legacy alias id stored in an allocation (e.g. 'transport') is looked up literally in spend[line.category] at :207. — react/src/lib/notifications.ts:183-226 iterates each BudgetAllocation over the budget's own period with spendByCategoryInRange; react/src/store/slices/dataSlice.ts:627 refreshNotifications after an expense save |

## 11. Findings index

| ID | Severity | Area | Title | Verification | Known | Status (13 Oct) | PRs |
|---|:---:|---|---|---|---|---|---|
| DB-SEC-01 | CRITICAL | Database | replace_* bulk RPCs let any member, even a viewer or child, take over or wipe a household | confirmed (adversarial: confirmed) | TD-42 | Closed | #166 |
| DB-SEC-02 | CRITICAL | Database | transfer_ownership's owner check passes for non-members (NULL <> 'owner'), letting anyone promote members | confirmed (adversarial: confirmed) | 2026-09 audit S2 | Closed | #166 |
| XC-PRV-01 | CRITICAL | Cross-cutting | Production Supabase secret API key committed in git history (setup.sh) while the repo was public | confirmed (adversarial: confirmed) |  | Closed (decision) | #165 |
| FE-MNY-01 | HIGH | Frontend | Recurring engine ignores the schedule the user chose: weekday, yearly date, nth-weekday and COUNT never reach it | confirmed (adversarial: confirmed) |  | Closed | #172, #173 |
| FE-MNY-04 | HIGH | Frontend | Deleting or editing a debt leaves its loan account's liability in net worth, with no UI to correct it | confirmed (adversarial: confirmed) |  | Closed | #178, #179, v10.102.0 |
| FE-PIP-01 | HIGH | Frontend | Pip compares annual budget limits with ONE month's spend (affordability verdict, lookup, status) | confirmed (adversarial: confirmed) |  | Closed | #182 |
| FE-PIP-03 | HIGH | Frontend | 'Split' capture opens the plain transaction form, which drops the split: full bill booked as spend | confirmed (adversarial: confirmed) |  | Closed | #176, #182 |
| FE-PIP-04 | HIGH | Frontend | Facts that can be negative still go through money(), which drops the sign (net worth, headroom) | confirmed (adversarial: confirmed) |  | Closed | #182 |
| FE-PUB-01 | HIGH | Frontend | Public privacy claims contradict the real access model ("Private" entries and platform-admin reads) | confirmed (adversarial: confirmed) | 2026-09 audit S3 (privacy-model clarification: excluded flag is not row-level privacy; roles admins read household tables) — still open, and now contradicted by public copy | Closed | #165, #166, v10.92.0, v10.93.0 |
| FE-SYN-01 | HIGH | Frontend | Cache restamps updated_at with the client clock, so later edits fail with false conflicts and get dead-lettered | confirmed (adversarial: confirmed) | 2026-09 audit F7 (partially fixed: fold-back + ack injection; still open via delta restamp and store copy) | Closed | #171 |
| FE-SYN-03 | HIGH | Frontend | Offline writes after the token expires are stamped ownerUid=null and are never flushed | confirmed-with-caveats (adversarial: partial) | TD-35 | Closed | #171 |
| FE-UIS-02 | HIGH | Frontend | Two-factor auth is decorative: no AAL2 step at sign-in, TOTP secret sent to Google Charts | confirmed (adversarial: confirmed) | TD-15 | Closed (decision) | #165 |
| FE-UIS-04 | HIGH | Frontend | Bell 'Skip once' on a stale bill notification skips the NEXT occurrence; stale 'Approve' falsely toasts | confirmed (adversarial: confirmed) |  | Closed | #177 |
| ADM-01 | HIGH | Admin | Stored XSS on vyact.app: CMS category/slug break out of the inline script on /learn/<slug> | confirmed (adversarial: confirmed) | 2026-09 audit S4 (partially fixed: JSON-LD boundary hardened; the inline-script and href sinks remain, and the CSP S4 asked for was never added) | Closed | #165 |
| ADM-02 | HIGH | Admin | God-mode admin access has no MFA/AAL2 requirement and no session limit, client or server | confirmed (adversarial: confirmed) | 2026-09 audit 7.1 — still open as described | Closed (decision) | #165 |
| BE-FN-02 | HIGH | Backend | Scheduled 30-day deletion never executes, and signing in after the deadline silently cancels it | confirmed (adversarial: confirmed) | 2026-09 audit S6 ('Scheduled deletion is not demonstrably automated'). Confirmed still open. The post-deadline cancellation is new. | Closed (decision) | #167 |
| BE-FN-07 | HIGH | Backend | One failing push endpoint aborts the whole web-push dispatch, which also does not scale | confirmed (adversarial: confirmed) |  | Closed | #165, v10.116.0 |
| BE-WA-01 | HIGH | Backend | Removed members keep WhatsApp read access: Pip answers and scheduled pushes skip membership checks | confirmed (adversarial: confirmed) | 2026-09 audit S1 (partially resolved: write RPCs revalidate membership; WhatsApp reads and proactive sends still do not) | Closed | #166 |
| DB-INT-05 | HIGH | Database | erase_household_data always rolls back: its own audit insert violates the activity_log CHECK | confirmed (adversarial: confirmed) | 2026-09 audit S6 (the onboarding cause is fixed; this second cause is still open) | Closed | #165 |
| DB-SEC-03 | HIGH | Database | upsert_budget/replace_budgets ON CONFLICT (id) DO UPDATE has no household guard: cross-household budget overwrite and read | confirmed (adversarial: confirmed) |  | Closed | v10.130.0 |
| INT-HH-03 | HIGH | Integration | Account deletion erases data, then fails on auth-user foreign keys and cannot be retried | confirmed (adversarial: confirmed) |  | Closed | #167 |
| INT-PAR-01 | HIGH | Integration | Server engine replaces the default FX rates with saved ones; the app merges them, so foreign rows convert at 1 | confirmed (adversarial: confirmed) |  | Closed (decision) | #170 |
| INT-TXN-01 | HIGH | Integration | Editing a split from Transactions/Dashboard erases the split; deleting it there leaves the shared split live | confirmed (adversarial: confirmed) |  | Closed | #176 |
| INT-TXN-04 | HIGH | Integration | computeNextDueDate overflows month-end: schedules on the 29th–31st skip whole months | confirmed (adversarial: confirmed) |  | Closed | #173 |
| INT-TXN-05 | HIGH | Integration | 'Daily' schedules violate both DB CHECKs: never sync, post device-only money every day | confirmed (adversarial: confirmed) | TD-31 (related: the multi-leg recurring event is not atomic) | Closed | #172, #173 |
| INT-TXN-06 | HIGH | Integration | Recurring engine runs on stale cache and writes last-write-wins: reposts deleted bills, reverts edits | confirmed (adversarial: confirmed) |  | Closed | #174, #175 |
| INT-TXN-07 | HIGH | Integration | loan_emi stored as a plain full-amount expense by recurring, WhatsApp log and WhatsApp correct | confirmed (adversarial: confirmed) | 2026-09 audit F2 (fixed for the form; still open for these writers) | Closed | #178, #179, #180, v10.89.0 |
| INT-TZC-02 | HIGH | Integration | Base-currency change relabels account opening balances and offsets without converting them | confirmed (adversarial: confirmed) | 2026-09 audit F4 (account-balance units are not explicit) — still open; R1 formalised the relabel instead of fixing it | Closed (decision) | #170 |
| INT-TZC-03 | HIGH | Integration | Client 'today' and 'this month' are UTC, so entries, bills and month boundaries use the wrong local day | confirmed (adversarial: confirmed) |  | Closed | #169 |
| OPS-01 | HIGH | Platform & Ops | Production release is ungated: Vercel ships the app regardless of CI, migrations or Edge deploy | confirmed (adversarial: confirmed) | 2026-09 audit 10.1 (still open); TD-33 (marked resolved, regressed when the consumer job was removed) | Partly | v10.128.0 |
| OPS-06 | HIGH | Platform & Ops | No production observability: faults go nowhere, cron/pg_net results unchecked, no alerting | confirmed (adversarial: confirmed) | 2026-09 audit 10.4 (still open, now worse: the in-app transport is gone); TD-43 | Closed | v10.132.0 |
| XC-PRV-03 | HIGH | Cross-cutting | Session replay (Contentsquare) and Userback screenshots run on every finance screen, undisclosed, no consent | confirmed (adversarial: confirmed) |  | Partly | #165, #189, v10.125.0, v10.132.0 |
| FE-MNY-06 | MEDIUM | Frontend | Dashboard insight chips use the static asset/debt arrays and raw budgets, contradicting the net-worth card | confirmed (adversarial: confirmed) | 2026-09 audit F3/F5 (partially open: NW card fixed, insight chips not) | Closed | #186, v10.99.0 |
| FE-MNY-08 | MEDIUM | Frontend | Split expenses debit only 'your share' from the paying account, so bank balances and reconciliations drift | confirmed (adversarial: confirmed) |  | Open | — |
| FE-MNY-10 | MEDIUM | Frontend | Essential and typical monthly spend have two definitions: Pip and Net Worth disagree with the Reports runway | confirmed (adversarial: confirmed) |  | Closed | v10.98.0 |
| FE-PIP-02 | MEDIUM | Frontend | Model-chosen purchase amount is never checked against the user's words; entities are untyped | confirmed-with-caveats (adversarial: partial) |  | Closed | #182 |
| FE-PIP-05 | MEDIUM | Frontend | A stated period is silently replaced by 'this month' for diagnostic, budget and advice questions | confirmed-with-caveats (adversarial: partial) |  | Closed | #182 |
| FE-PIP-06 | MEDIUM | Frontend | Recurring bill descriptions egress to the model via vars.detail, and stored text is not fenced as data | confirmed (adversarial: confirmed) |  | Closed | #182, v10.90.0 |
| FE-PIP-07 | MEDIUM | Frontend | Capture seeds the model's raw category word, so invalid ids like 'fuel' get saved | confirmed-with-caveats (adversarial: partial) |  | Closed | v10.90.0 |
| FE-PIP-08 | MEDIUM | Frontend | 'What's my balance' headline calls total assets (house, car, investments) money 'across your accounts' | confirmed (adversarial: confirmed) |  | Closed | #182 |
| FE-PIP-09 | MEDIUM | Frontend | Every chat turn writes an extra backend='llm' ai_usage row that eats the quota and skews metering | confirmed (adversarial: confirmed) | 2026-09 audit A2 (householdId omission still open; reservation itself fixed) | Closed | #168, v10.122.0 |
| FE-PIP-10 | MEDIUM | Frontend | Pip mixes UTC month keys with local day windows; the WhatsApp engine runs in UTC | confirmed (adversarial: confirmed) |  | Closed | #169 |
| FE-PIP-11 | MEDIUM | Frontend | Figure guard: small-number exemption ignores currency and magnitude ('12 lakh' passes) | confirmed (adversarial: confirmed) | 2026-09 audit A1 (partially fixed: 100 removed and the year band guarded; the HARMLESS and magnitude hole remains) | Closed | v10.90.0 |
| FE-PLT-01 | MEDIUM | Frontend | Post-sign-in open redirect: SignIn.tsx ignores safeNext, and safeNext itself is bypassable | confirmed (adversarial: confirmed) |  | Closed | #165 |
| FE-PLT-04 | MEDIUM | Frontend | No Content-Security-Policy on vyact.app, /learn or admin, while session tokens sit in localStorage | confirmed (adversarial: confirmed) | 2026-09 audit S4 (CSP half still open; the JSON-LD escaping half is fixed in api/_page.js:23) | Partly | #188, #189, v10.125.0 |
| FE-PUB-04 | MEDIUM | Frontend | Service worker answers /v/<n> video short links with the app shell, not the lesson redirect | confirmed (adversarial: confirmed) |  | Closed | #183 |
| FE-SYN-04 | MEDIUM | Frontend | Sign-out and epoch purge miss allocations, net worth history, onboarding and dead-letter keys | confirmed (adversarial: confirmed) | 2026-09 audit S5 (partially addressed) | Closed | v10.110.0 |
| FE-SYN-05 | MEDIUM | Frontend | Dead-letter buckets are device-wide and the retry cap is 30 seconds, so Dismiss can delete other users' writes | confirmed (adversarial: confirmed) | TD-10 | Closed | v10.110.0 |
| FE-SYN-06 | MEDIUM | Frontend | refresh() and store writes race: a stale snapshot can erase a just-saved entry from the store | confirmed (adversarial: confirmed) |  | Closed | v10.111.0 |
| FE-SYN-07 | MEDIUM | Frontend | Delta sync can miss rows for good and reports fresh after reading only one 500-row page | confirmed (adversarial: confirmed) | 2026-09 audit F8 (partially fixed: keyset cursor + drained full list; delta still single-page) | Closed | v10.111.0 |
| FE-SYN-08 | MEDIUM | Frontend | "Synced · just now" is stamped on cache-only reads even when every cloud pull fails | confirmed (adversarial: confirmed) | 2026-09 audit F8 (lastSyncedAt item still open as described) | Closed | v10.110.0 |
| FE-UIC-04 | MEDIUM | Frontend | fmt() drops the sign: overdrafts, negative nets and negative net worth render as positive | confirmed (adversarial: confirmed) |  | Closed | #177 |
| FE-UIC-05 | MEDIUM | Frontend | Transaction edit picks the account from stale extras.paymentMethod and clears the FK | confirmed (adversarial: confirmed) |  | Closed | #186 |
| FE-UIC-06 | MEDIUM | Frontend | Debts page and Net Worth liabilities list bypass the canonical projection | confirmed (adversarial: confirmed) | 2026-09 audit F3 (fixed for Dashboard/Ask; still open on Debts page and the Net Worth liabilities list) | Closed | #178, #179, #183 |
| FE-UIC-07 | MEDIUM | Frontend | DTI and 'Kept this month' ratios use all-time income and a fake 1 when income is zero | confirmed (adversarial: confirmed) |  | Closed | #183 |
| FE-UIC-08 | MEDIUM | Frontend | Three screens compute 'budget left/over' on different bases | confirmed (adversarial: confirmed) | 2026-09 audit F5 (related; allocation consistency) | Closed | v10.99.0 |
| FE-UIC-09 | MEDIUM | Frontend | Edit forms rebuild rows from form fields, erasing loan tenure, payment log and links | confirmed-with-caveats (adversarial: partial) | 2026-09 audit F7 (still open for Debt/Split/Asset forms; transactions now carry updated_at) | Closed | #176, #179, #180, #186 |
| FE-UIC-10 | MEDIUM | Frontend | Amount inputs strip the decimal comma: '12,50' is saved as 1250 | confirmed (adversarial: confirmed) |  | Partly | #186 |
| FE-UIC-12 | MEDIUM | Frontend | Net Worth and Debts forms invite re-entering Accounts money; spendable figures diverge | confirmed-with-caveats (adversarial: partial) | 2026-09 audit F3 (structural remainder) | Partly | #178, #179 |
| FE-UIC-13 | MEDIUM | Frontend | Recurring Save has no in-flight guard or error handling; a double tap duplicates schedules | confirmed (adversarial: confirmed) |  | Closed | #173, #183 |
| FE-UIS-03 | MEDIUM | Frontend | Re-running onboarding relabels household currency, duplicates bill schedules, and half-commits on error | confirmed-with-caveats (adversarial: partial) |  | Partly | #170 |
| FE-UIS-06 | MEDIUM | Frontend | Settings saves household settings optimistically for non-owners; values revert, profile email is never saved | confirmed (adversarial: confirmed) |  | Closed | #183, #184 |
| FE-UIS-07 | MEDIUM | Frontend | Notifications, household switcher, account menu and ⌘K are modal dialogs without focus trap or focus return | confirmed (adversarial: confirmed) |  | Open | — |
| FE-UIS-08 | MEDIUM | Frontend | Toasts are silent to screen readers and vanish in 3.2s; bottom banners cover the tab bar and Save | confirmed (adversarial: confirmed) |  | Closed | #183, #184 |
| FE-UIS-09 | MEDIUM | Frontend | Aurora secondary text and status colours fail WCAG AA contrast, most in light theme | confirmed (adversarial: confirmed) |  | Closed (decision) | #190 |
| FE-UIS-10 | MEDIUM | Frontend | Single-key shortcuts n/b/d/a ignore modifiers (hijack Cmd+A, Ctrl+D) and cannot be turned off | confirmed (adversarial: confirmed) |  | Closed | #183, v10.91.0 |
| FE-UIS-11 | MEDIUM | Frontend | Onboarding's estimated cash balance shows as confirmed; hardcoded '35% confirmed'; nudge sells bank sync | confirmed (adversarial: confirmed) |  | Closed | #183 |
| FE-UIS-12 | MEDIUM | Frontend | One root ErrorBoundary: no reporting, 'Try Again' re-throws, no chunk-load recovery; e2e route live | confirmed (adversarial: confirmed) | TD-05 | Closed | #183, #190, v10.132.0 |
| FE-UIS-13 | MEDIUM | Frontend | Password change needs no re-auth (Settings, /auth/reset), unlike Danger Zone; instant delete keeps session | confirmed (adversarial: confirmed) |  | Closed | #183, #184 |
| ADM-03 | MEDIUM | Admin | 'roles' admins hold raw SELECT on every household's ledger; no admin page needs it | confirmed (adversarial: confirmed) | 2026-09 audit S3 privacy note and 7.1 'least-privilege RPCs instead of broad financial-table access' — still open | Closed | #166, v10.92.0, v10.93.0 |
| ADM-04 | MEDIUM | Admin | No audit trail of admin actions; 'Audit Log' is a deletable household changelog the Help page misdescribes | confirmed (adversarial: confirmed) | 2026-09 audit 7.1 ('Audited sensitive reads', 'Access review and revocation procedures') — still open | Closed | v10.130.0, v10.131.0 |
| ADM-06 | MEDIUM | Admin | Content-tier admins see every Pip user's email and per-user sentiment profile | confirmed (adversarial: confirmed) |  | Closed | v10.130.0 |
| ADM-07 | MEDIUM | Admin | Client role matrix contradicts server gates; tests cover only the client, never RLS/RPC | confirmed (adversarial: confirmed) | 2026-09 audit 7.5 — partially addressed (client gating tests added); server-side authorization tests still missing | Closed | v10.129.0, v10.131.0 |
| ADM-09 | MEDIUM | Admin | Admin builds always target production, so every branch preview runs unreviewed code on prod | confirmed (adversarial: confirmed) |  | Closed | v10.131.0 |
| BE-FN-04 | MEDIUM | Backend | Owner deletion destroys co-members' households through a non-atomic sequence of deletes | confirmed-with-caveats (adversarial: partial) | 2026-09 audit S6 (items 3 'shared-household rules' and 4 'transactional purge'). Still open. | Closed | #167 |
| BE-FN-06 | MEDIUM | Backend | send-split-email is an open spam/phishing relay from hello@vyact.app, with HTML injection via currency | confirmed-with-caveats (adversarial: partial) | 2026-09 audit §8.5 (spam and rate limits). Still open. The HTML injection and the brand-domain sender are new. | Closed | #168 |
| BE-FN-09 | MEDIUM | Backend | People added to a split while editing are promised an invite that is never sent | confirmed (adversarial: confirmed) |  | Closed | #168, v10.121.0 |
| BE-PIP-02 | MEDIUM | Backend | ask-vyact is a general LLM proxy: client-built system prompts, per-user cap is the only spend control | confirmed (adversarial: confirmed) | 2026-09 audit A3 | Closed | #168 |
| BE-PIP-03 | MEDIUM | Backend | ai_usage spend gate is client-writable, and client rows eat the gateway quota | confirmed (adversarial: confirmed) | 2026-09 audit A2 | Closed | #168 |
| BE-WA-03 | MEDIUM | Backend | Replies to pending questions are re-parsed as new ledger entries after a retry or a lost pending turn | confirmed (adversarial: confirmed) |  | Closed | #187 |
| BE-WA-04 | MEDIUM | Backend | Webhook returns 200 to Meta even when the inbox row was not stored, so the message is lost | confirmed (adversarial: confirmed) |  | Closed | #187 |
| BE-WA-06 | MEDIUM | Backend | OTP attempt limit is bypassable by parallel requests and resets on every resend | confirmed (adversarial: confirmed) |  | Closed (decision) | #187, v10.114.0 |
| BE-WA-07 | MEDIUM | Backend | whatsapp-notify lets any member send any template, with arbitrary text and button payloads, from Vyact's number | confirmed (adversarial: confirmed) |  | Closed | v10.118.0 |
| BE-WA-08 | MEDIUM | Backend | "No, that was X" can give an entry the wrong category type, and allows Loan/EMI | confirmed (adversarial: confirmed) |  | Closed | v10.89.0 |
| BE-WA-09 | MEDIUM | Backend | STOP and other consent/state writes ignore Supabase errors yet reply "Done" | confirmed (adversarial: confirmed) |  | Closed | #187, v10.118.0 |
| DB-INT-09 | MEDIUM | Database | Account and asset tombstones are not enforced: in-use and cash accounts can be deleted, and live rows land on deleted ones | confirmed (adversarial: confirmed) |  | Closed | v10.117.0 |
| DB-INT-11 | MEDIUM | Database | No unique (household_id, user_id) on memberships; invite accept and member limit race | confirmed (adversarial: confirmed) |  | Closed | v10.114.0 |
| DB-INT-13 | MEDIUM | Database | WhatsApp account alias matches by kind with 'limit 1', booking money to an arbitrary account | confirmed (adversarial: confirmed) |  | Closed | v10.130.0 |
| DB-OPS-03 | MEDIUM | Database | Repo no longer reproduces prod: budget owner/admin guard and other objects exist only in prod | confirmed (adversarial: confirmed) | TD-20 | Closed | v10.130.0 |
| DB-OPS-08 | MEDIUM | Database | Scheduler runs are unobservable, and web-push re-reads every subscribed ledger every 15 minutes | confirmed-with-caveats (adversarial: partial) |  | Closed | v10.132.0 |
| DB-OPS-10 | MEDIUM | Database | Delta-sync cursor relies on updated_at = now(), so out-of-order commits are skipped forever | confirmed (adversarial: confirmed) | 2026-09 audit F8 | Closed | v10.111.0 |
| DB-OPS-12 | MEDIUM | Database | Documented pg_dump --no-privileges restore strips every REVOKE the security model depends on | confirmed-with-caveats (adversarial: partial) | TD-16 | Closed | #189 |
| DB-SEC-06 | MEDIUM | Database | Any member, even a viewer, can insert P1 notifications that web-push sends to every member's lock screen | confirmed (adversarial: confirmed) |  | Closed | v10.115.0, v10.116.0 |
| DB-SEC-08 | MEDIUM | Database | erase_household_data: email-code gate is client-only, and the erase misses message text and notifications | confirmed (adversarial: confirmed) | 2026-09 audit S6 | Closed | #167, v10.88.0 |
| DB-SEC-09 | MEDIUM | Database | Tenant-consistency triggers (S3) skip asset_id, initiated_by, schedule and account links | confirmed (adversarial: confirmed) | 2026-09 audit S3 | Closed | v10.117.0 |
| DB-SEC-10 | MEDIUM | Database | No database authorization test suite: RLS and RPC role/tenant matrix untested | confirmed (adversarial: confirmed) |  | Closed | v10.129.0 |
| INT-HH-07 | MEDIUM | Integration | Owners and admins can add any user to a household without consent and read their profile | confirmed (adversarial: confirmed) | 2026-09 audit S2 ('whether user identity and household linkage can change' still open) | Closed | v10.114.0 |
| INT-HH-08 | MEDIUM | Integration | Household settings permissions disagree with RLS; partial writes and unhandled errors | confirmed-with-caveats (adversarial: partial) |  | Partly | #183, v10.130.0 |
| INT-HH-09 | MEDIUM | Integration | Invite acceptance is not atomic or single-use; stale tokens and legacy RPCs linger | confirmed (adversarial: confirmed) |  | Closed | #186, v10.114.0 |
| INT-HH-12 | MEDIUM | Integration | 'Child (own data only)' invite role can read the whole household's finances | confirmed (adversarial: confirmed) |  | Closed (decision) | #166 |
| INT-PAR-02 | MEDIUM | Integration | Client computeNextDueDate uses local-time setters; wrong in DST and negative-offset zones, unlike the UTC server port | confirmed (adversarial: confirmed) |  | Closed | #173 |
| INT-PAR-04 | MEDIUM | Integration | Three clocks: UTC today(), host-local getters (UTC on Deno) and IST localDay produce different days | confirmed (adversarial: confirmed) |  | Closed | #169 |
| INT-PAR-05 | MEDIUM | Integration | stale_balance push rule flags never-stamped accounts as stale and ignores last_reconciled_at | confirmed (adversarial: confirmed) |  | Closed | #186, v10.122.0 |
| INT-PAR-06 | MEDIUM | Integration | WhatsApp currency detection diverges from the app: 'dollars', 'euros', 'quid' are logged in base currency | confirmed (adversarial: confirmed) |  | Closed | #170 |
| INT-PAR-08 | MEDIUM | Integration | Deployed engine bundle can drift from the app: Edge deploy is neither gated on CI nor checks the bundle | confirmed (adversarial: confirmed) | TD-33 | Closed | v10.128.0 |
| INT-TXN-08 | MEDIUM | Integration | Rejected writes are retried as transient, then dead-lettered while the optimistic row stays forever | confirmed-with-caveats (adversarial: partial) | TD-10 (retry cap resolved; terminal-error handling and rollback still open) | Closed | #171 |
| INT-TXN-10 | MEDIUM | Integration | Delta sync still not guaranteed current: pulls overwrite pending local writes; commit-order cursor gap | confirmed-with-caveats (adversarial: partial) | 2026-09 audit F8 (pagination and composite cursor fixed; 'overlay pending local writes' still open; commit-order gap new) | Closed | v10.111.0 |
| INT-TXN-11 | MEDIUM | Integration | Split sharing is a separate online write that races the queued transaction and is never retried | confirmed (adversarial: confirmed) | 2026-09 audit 8.5 (still open) | Closed | v10.112.0 |
| INT-TXN-12 | MEDIUM | Integration | WhatsApp correction checks category fit against the wrong message; alias by kind picks arbitrary account | confirmed (adversarial: confirmed) |  | Closed | v10.89.0, v10.130.0 |
| INT-TZC-04 | MEDIUM | Integration | WhatsApp: untagged entries use the database's UTC current_date while 'yesterday' uses IST; dispatch hard-codes IST | confirmed (adversarial: confirmed) |  | Closed | #169 |
| INT-TZC-05 | MEDIUM | Integration | Due-day P1 pushes raised at 05:30 IST land in the default quiet hours and are then marked sent | confirmed (adversarial: confirmed) | TD-22 (resolved v10.48.0) — this is a new defect in its implementation | Closed | #169 |
| INT-TZC-07 | MEDIUM | Integration | FX uses a hard-coded, undated 2024 rate table and revalues historical foreign rows at today's rate | confirmed (adversarial: confirmed) | 2026-09 audit F4 ('Decide whether historical reporting uses transaction-date FX or current valuation FX'; 'Reject unknown currency/rate data') — still open; the ad hoc FX math in Transactions/aiSummary is fixed | Closed (decision) | #170 |
| OPS-02 | MEDIUM | Platform & Ops | Migrations first run against production: no CI apply, no dry run, no automatic backup | confirmed (adversarial: confirmed) | 2026-09 audit 10.1 / 10.2 (database migration validation); TD-02 (integration layer open) | Closed | v10.129.0 |
| OPS-03 | MEDIUM | Platform & Ops | `db push --include-all` applies out-of-order migrations, so 'last filename wins' can be false in prod | confirmed (adversarial: confirmed) |  | Closed | v10.128.0 |
| OPS-04 | MEDIUM | Platform & Ops | send-split-email and delete-account are never deployed by the pipeline; v10.59/v10.60 fixes not shipped | confirmed (adversarial: confirmed) | 2026-09 audit 10.1 (Edge manifest omission, still open) | Closed | #165 |
| OPS-05 | MEDIUM | Platform & Ops | Preview guard is skipped when VITE_SUPABASE_URL is 'All Environments'; admin previews use prod | confirmed-with-caveats (adversarial: partial) |  | Partly | #189, v10.131.0 |
| OPS-08 | MEDIUM | Platform & Ops | RLS isolation covers 3 of ~40 tables, PR-only, against a hand-synced schema; INV-7 still untested | confirmed-with-caveats (adversarial: partial) | TD-19 (Lane B partially delivered); TD-31 (open); 2026-09 audit 10.2 | Closed | #178, v10.102.0, v10.129.0 |
| OPS-11 | MEDIUM | Platform & Ops | LLM spend guard is per-user only and fails open if the cap env is unset or invalid | confirmed-with-caveats (adversarial: partial) | 2026-09 audit A2 (atomicity fixed; global ceiling and fail-closed config not addressed) | Partly | #168 |
| XC-ARC-05 | MEDIUM | Cross-cutting | Binding docs contradict themselves and send AI sessions to stale documents | confirmed (adversarial: confirmed) | TD-28 (marked resolved 2026-06-17; regressed), TD-41 (open) | Open | — |
| XC-ARC-06 | MEDIUM | Cross-cutting | Bundled engine left hand ports live: server money, recurring and budget alerts are duplicated | confirmed-with-caveats (adversarial: partial) |  | Closed | #173, v10.96.0, v10.122.0 |
| XC-ARC-08 | MEDIUM | Cross-cutting | 'Retired' Money Map flag still picks the transaction account picker; e2e tests the legacy path | confirmed-with-caveats (adversarial: partial) |  | Closed | v10.121.0 |
| XC-ARC-09 | MEDIUM | Cross-cutting | Edge Functions (12k lines of Deno TS) are never type-checked or linted | confirmed (adversarial: confirmed) | TD-32 / TD-30 (partially; the missing Deno type-check is not recorded) | Closed | v10.120.0 |
| XC-ARC-11 | MEDIUM | Cross-cutting | The 'never a silent write-loss catch {}' rule has no enforcement: 110 empty catches, 7 on writes | confirmed-with-caveats (adversarial: partial) | TD-24 (marked resolved; rule not enforced) | Closed | v10.121.0 |
| XC-ARC-13 | MEDIUM | Cross-cutting | Test effort sits away from risk: 1,390 unit cases, 5 SQL tests, 10 optional cloud tests | confirmed (adversarial: confirmed) | TD-31, TD-19, TD-32 (open) | Closed | v10.129.0 |
| XC-PRV-02 | MEDIUM | Cross-cutting | Recipient email and household-invite bearer tokens sent to GA4/Contentsquare via page URLs | confirmed-with-caveats (adversarial: partial) |  | Closed | #165 |
| XC-PRV-04 | MEDIUM | Cross-cutting | Email-code re-auth for erase/delete is client-side only; any session can wipe data immediately | confirmed (adversarial: confirmed) |  | Closed | #167 |
| XC-PRV-07 | MEDIUM | Cross-cutting | WhatsApp message content and phone numbers are retained forever and survive unlink, erase and deletion | confirmed (adversarial: confirmed) |  | Closed | #167 |
| XC-PRV-08 | MEDIUM | Cross-cutting | 'Erase household data' and the data export cover only the core ledger tables | confirmed (adversarial: confirmed) | 2026-09 audit S6 (household erasure) — onboarding bug fixed; table coverage still incomplete | Closed (decision) | #165, #167, #184, v10.88.0, v10.125.0 |
| XC-PRV-09 | MEDIUM | Cross-cutting | Consent record is unreliable: wrong version stored, errors swallowed, Google sign-in skips it | confirmed (adversarial: confirmed) |  | Closed | #186, v10.124.0, v10.125.0 |
| XC-PRV-10 | MEDIUM | Cross-cutting | Pip questions and figures routed through OpenRouter with no provider data policy enforced | confirmed-with-caveats (adversarial: partial) |  | Closed | v10.125.0 |
| XC-PRV-11 | MEDIUM | Cross-cutting | Privacy notice lacks DPDP/GDPR basics: controller, grievance contact, breach process, child accounts | confirmed-with-caveats (adversarial: partial) |  | Partly | #165, #166, #167, v10.125.0 |
| XC-PRV-12 | MEDIUM | Cross-cutting | resolve_participant_names lets any signed-up user bulk-test emails and learn real names | confirmed (adversarial: confirmed) |  | Closed | v10.114.0 |
| FE-MNY-11 | LOW | Frontend | CSV export writes user and WhatsApp-sourced text without neutralising formulas (CSV injection) | confirmed (adversarial: confirmed) |  | Closed | #183 |
| FE-MNY-12 | LOW | Frontend | Archived accounts with a balance count in net worth and Pip's liquid figure but drop out of 'Spendable now' | not independently verified (low/info) |  | Open | — |
| FE-MNY-13 | LOW | Frontend | Card reconcile forces every stated value negative, so an overpaid (credit) card cannot be recorded | not independently verified (low/info) |  | Open | — |
| FE-MNY-14 | LOW | Frontend | Planner 'income varies' rule includes the partial current month and flags stable earners early each month | not independently verified (low/info) |  | Closed | #184 |
| FE-MNY-15 | LOW | Frontend | 'Full backup' omits accounts, allocations and recurring schedules, so balances cannot be rebuilt from it | not independently verified (low/info) | TD-16 (exports, different aspect) | Closed | #184 |
| FE-MNY-16 | LOW | Frontend | Budget suggestion and forecast sum mixed currencies, inactive schedules and receivables | not independently verified (low/info) |  | Closed | #170, #181, #186, v10.91.0 |
| FE-PIP-12 | LOW | Frontend | Category 'usual month' includes the current partial month and later months for past-period lookups | not independently verified (low/info) |  | Closed | #182 |
| FE-PIP-13 | LOW | Frontend | No-history runway and cover use sentinel figures (burn = EMI + 1; 0.0 months 'thin cushion') | not independently verified (low/info) |  | Closed | #186 |
| FE-PIP-14 | LOW | Frontend | Per-bill amounts in Pip ignore the schedule's currency | not independently verified (low/info) |  | Closed (decision) | #170 |
| FE-PIP-15 | LOW | Frontend | Account matching falls back to the first card of any bank when the stated tail doesn't match | not independently verified (low/info) |  | Closed | #186 |
| FE-PIP-16 | LOW | Frontend | No client abort or timeout: Stop and New chat leave model calls and 5-minute relay polling running | not independently verified (low/info) | TD-44 (relay part) | Closed | #186 |
| FE-PIP-17 | LOW | Frontend | Switching household while /chat is mounted writes the old transcript under the new household | not independently verified (low/info) | 2026-09 audit S5 (household-scoped transcript, partially fixed) | Closed | #184 |
| FE-PIP-18 | LOW | Frontend | Browser authors the system prompts; dead FEATURES.askVyact.backend 'rules' config misdescribes Pip | not independently verified (low/info) | 2026-09 audit A3 (still open) | Closed | #168, #184 |
| FE-PLT-07 | LOW | Frontend | Signed-in visit to an invite link joins the household instantly with no confirmation | not independently verified (low/info) |  | Closed | #186 |
| FE-PLT-08 | LOW | Frontend | Passive sign-out (expired or revoked session) leaves push registered to the previous user | not independently verified (low/info) |  | Closed | #184 |
| FE-PLT-11 | LOW | Frontend | Platform config hygiene: stale root vercel.json, self-dependency, dead deps and a test route in prod | not independently verified (low/info) | TD-38 (dependency advisories untriaged; still open) | Closed | #185 |
| FE-PUB-03 | LOW | Frontend | Learn handler: no upstream timeout, empty library cached a day, bad source_url 503s a lesson | confirmed-with-caveats (adversarial: partial) |  | Closed | #185, #165 |
| FE-PUB-05 | LOW | Frontend | Guest demo's other address serves indexable public pages and reads the production DB | not independently verified (low/info) |  | Closed | #189 |
| FE-PUB-06 | LOW | Frontend | Soft-200 app shell still served for multi-segment /learn/*, /for/* and any dotted path | not independently verified (low/info) |  | Closed | #189 |
| FE-PUB-07 | LOW | Frontend | Vercel ignoreCommand diffs only HEAD^..HEAD, so a push ending in a docs-only commit skips deploy | not independently verified (low/info) |  | Closed | #185, #189 |
| FE-PUB-08 | LOW | Frontend | Anon content policy exposes every column of published rows, including author_id user UUIDs | not independently verified (low/info) |  | Closed | v10.130.0 |
| FE-PUB-10 | LOW | Frontend | Landing pre-render decides cloud mode from env alone and uses $-sensitive String.replace | not independently verified (low/info) |  | Closed | #185, #189 |
| FE-PUB-11 | LOW | Frontend | Learn topic pill uses raw var(--coral) on an HSL triplet token (binding Aurora rule) | not independently verified (low/info) |  | Closed | #183 |
| FE-SYN-10 | LOW | Frontend | Switching user without signing out keeps the previous user's ledger loaded and never purges | confirmed-with-caveats (adversarial: partial) | 2026-09 audit S5 ('Switching users on the same browser' not handled) | Closed | #186 |
| FE-SYN-11 | LOW | Frontend | Outbox flush polls every 100 ms while an entity's first op waits out a backoff | not independently verified (low/info) |  | Closed | #186 |
| FE-SYN-12 | LOW | Frontend | A failed cache read becomes [] and the next write saves it back, truncating the cache | not independently verified (low/info) |  | Closed | #186 |
| FE-SYN-13 | LOW | Frontend | Anonymous to cloud import is dead: the sign-in purge deletes the local data it would import | not independently verified (low/info) |  | Open | — |
| FE-UIC-14 | LOW | Frontend | Reconcile sheet announces adjustments the reconcile engine silently changes | not independently verified (low/info) |  | Closed | #184 |
| FE-UIC-15 | LOW | Frontend | Account ledger running balance ignores when reconcile offsets were applied | not independently verified (low/info) |  | Closed | #186 |
| FE-UIC-16 | LOW | Frontend | Transaction rows label first-class accounts 'Linked account' or 'Credit card' | not independently verified (low/info) |  | Closed | #184 |
| FE-UIC-17 | LOW | Frontend | List and calendar aggregates bypass the reportable/effective-amount rules | not independently verified (low/info) | 2026-09 audit F4 (FX part fixed for list nets; still open in TxnCalendar) | Closed | #184 |
| FE-UIS-14 | LOW | Frontend | Unlabelled form controls and missing autocomplete in households, onboarding, MFA and auth | not independently verified (low/info) |  | Closed | #184 |
| FE-UIS-15 | LOW | Frontend | Language setting offers 6 languages but translates ~10 nav strings and never sets <html lang> | not independently verified (low/info) |  | Closed | #184, #186 |
| FE-UIS-16 | LOW | Frontend | Hygiene: dead modules, typeless Buttons in forms, raw HOUSEHOLD_FULL text, expired invites block | not independently verified (low/info) |  | Closed | #184 |
| ADM-05 | LOW | Admin | Content-tier admins can rewrite global needs/wants classification, changing every family's floor | confirmed-with-caveats (adversarial: partial) |  | Closed | v10.130.0 |
| ADM-08 | LOW | Admin | Admin lists load whole tables unpaginated; PostgREST max-rows silently truncates counts | confirmed-with-caveats (adversarial: partial) | 2026-09 audit 7.2 — still open as described | Closed | v10.130.0, v10.131.0 |
| ADM-10 | LOW | Admin | Infographic deleted from storage before the content save is validated or committed | not independently verified (low/info) |  | Closed | #188, v10.130.0 |
| ADM-11 | LOW | Admin | Every edit of a published item resets published_at and writes the editor's email as author | not independently verified (low/info) |  | Closed | #188, v10.130.0 |
| ADM-12 | LOW | Admin | Settings shows state it does not check: DB 'connected', GA4 'connected', stale versions | not independently verified (low/info) | 2026-09 audit 7.4 — partially fixed (security rows relabelled 'planned'); the database, GA4 and version assertions remain | Closed | #188 |
| ADM-13 | LOW | Admin | Admin host has no CSP and publishes full source maps while holding god-mode JWT | not independently verified (low/info) |  | Closed | #188, #189 |
| ADM-14 | LOW | Admin | Revenue KPIs mix currencies and statuses: MRR summed across currencies, labelled USD | not independently verified (low/info) |  | Closed | #188, v10.130.0, v10.131.0 |
| BE-FN-11 | LOW | Backend | Deployment and auth config for these functions is not codified; cron hardcodes the prod URL | not independently verified (low/info) | 2026-09 audit §10.1 (Edge Functions missing from the deploy manifest). Still open. | Partly | #165, v10.123.0, v10.126.0, v10.128.0 |
| BE-PIP-04 | LOW | Backend | Untrusted learned recipes are written without confirmation, and one user can promote a global recipe | confirmed-with-caveats (adversarial: partial) |  | Partly | #187 |
| BE-PIP-05 | LOW | Backend | key_env_var denylist misses MAILERSEND_API_KEY; base_url host checks are bypassable | not independently verified (low/info) |  | Closed | #187 |
| BE-PIP-06 | LOW | Backend | TEMPORARY Claude Code relay is still live, with no retention bound and an unauthenticated status endpoint | not independently verified (low/info) | TD-44 | Open | — |
| BE-PIP-07 | LOW | Backend | Gateway failures are silent in logs but over-share config details with end users | not independently verified (low/info) | TD-43 | Closed | #187 |
| BE-WA-11 | LOW | Backend | A failed Meta send permanently uses up the dedupe slot; the daily cap check is racy | not independently verified (low/info) |  | Closed | #187 |
| BE-WA-12 | LOW | Backend | Replay relies on unrelated traffic, and stale claims replay without limit | not independently verified (low/info) | TD-35 (webhook inbox recovery marked resolved in v10.40.0; the scheduler and stale-claim cap are still missing) | Closed | #187, v10.118.0 |
| BE-WA-13 | LOW | Backend | Numbered follow-ups still answer after ANSWERS OFF | not independently verified (low/info) |  | Closed | #187 |
| DB-INT-14 | LOW | Database | Money CHECKs have NULL and allowlist gaps (budget scope, allocations, categories) | not independently verified (low/info) |  | Closed | v10.130.0 |
| DB-INT-15 | LOW | Database | Split sharing matches on auth.users.email without requiring email_confirmed_at | not independently verified (low/info) |  | Closed | v10.124.0 |
| DB-OPS-07 | LOW | Database | Every pg_cron job hard-codes the production URL; auto-generated secrets make test DBs call prod | confirmed-with-caveats (adversarial: partial) |  | Closed | v10.123.0 |
| DB-OPS-09 | LOW | Database | RLS evaluates SECURITY DEFINER helpers per row; hot lookups lack indexes and some indexes are duplicated | confirmed (adversarial: confirmed) | TD-21 | Closed | v10.130.0 |
| DB-OPS-14 | LOW | Database | Twin v91 migrations and stale process docs contradict the actual apply path | not independently verified (low/info) | TD-41 | Closed | #189 |
| INT-CON-04 | LOW | Integration | replace_<entity> RPCs are schema-stale: cloud bulk-replace drops money-model columns / violates CK_txn_accounts_by_type | confirmed-with-caveats (adversarial: partial) | TD-09 | Closed | #166 |
| INT-CON-05 | LOW | Integration | Category parity test covers only expense ids; income category drift is silent and unchecked | confirmed-with-caveats (adversarial: partial) |  | Closed | #184 |
| INT-CON-06 | LOW | Integration | Admin app household-type enum omits 'couple' and keeps retired multi_biz/shared | not independently verified (low/info) |  | Closed | #188 |
| INT-CON-07 | LOW | Integration | leave_household shares the same NULL-role guard idiom as transfer_ownership | not independently verified (low/info) |  | Closed | v10.114.0 |
| INT-HH-06 | LOW | Integration | Owner continuity not enforced: households can be left with no owner | confirmed-with-caveats (adversarial: partial) | 2026-09 audit S2 (owner continuity still open) | Closed | #166, v10.114.0 |
| INT-HH-13 | LOW | Integration | After leaving or deleting a household, the app stays on a household the user is no longer in | not independently verified (low/info) |  | Partly | #184 |
| INT-HH-14 | LOW | Integration | Admin Households page has a stale type list and member counts that cap at 1,000 rows | not independently verified (low/info) |  | Closed | #188, v10.130.0, v10.131.0 |
| INT-PAR-10 | LOW | Integration | Same event, different figures across channels: split large-spend alert and budget percentage rounding | not independently verified (low/info) |  | Closed | #187 |
| INT-TXN-14 | LOW | Integration | Audit trail loses the actor for server-side writers and records every delete as 'updated' | not independently verified (low/info) | TD-08 (resolved as 'populated'; actor/delete semantics gap new) | Closed | v10.130.0 |
| INT-TZC-08 | LOW | Integration | WhatsApp currency detection checks only the first three-letter word, so 'tea 50 aed' logs ₹50 | not independently verified (low/info) |  | Closed | #170 |
| GATE-03 | LOW | Platform & Ops | Public production build ships full source maps (87 maps, 8.3 MB) of the private codebase | observed (gate executed) |  | Closed | #185, #188 |
| GATE-04 | LOW | Platform & Ops | Unit tests do not type-check: ~43 errors incl. money-suite fixtures that no longer match types | observed (gate executed) | TD-30 (still open; now quantified at ~43 errors in 7 files) | Closed | v10.120.0 |
| OPS-07 | LOW | Platform & Ops | Prod Supabase token reachable from non-main branches; no permissions block; actions pinned by tag | confirmed-with-caveats (adversarial: partial) |  | Partly | #189 |
| OPS-09 | LOW | Platform & Ops | DEPLOY.md and OPERATIONS.md misdescribe the live pipeline and verify against an orphaned host | confirmed-with-caveats (adversarial: partial) | TD-41 (same class; these two docs not listed) | Closed | #189 |
| OPS-13 | LOW | Platform & Ops | Build and CI hygiene: npm install on Vercel, unpinned Node, cancelled main runs, HEAD^-only skip | not independently verified (low/info) |  | Closed | #185, #189 |
| XC-ARC-07 | LOW | Cross-cutting | About 4,000 lines of dormant agent pipeline and retired feature paths still shipped and tested | confirmed-with-caveats (adversarial: partial) | TD-36 (partial; still open) | Open | — |
| XC-ARC-10 | LOW | Cross-cutting | Store actions write pre-await snapshots back to state, without a household guard | confirmed-with-caveats (adversarial: partial) | 2026-09 audit section 9 (code-style priorities 2 and 3; still open) | Closed | v10.121.0 |
| XC-ARC-12 | LOW | Cross-cutting | Money model lives in CHECKs and prose; domain types and adapter generics do not encode it | confirmed-with-caveats (adversarial: partial) | 2026-09 audit sections 8.3/8.4 (still open) | Closed (decision) | — |
| XC-ARC-14 | LOW | Cross-cutting | Release cadence outpaces stabilisation: 40 minor releases in 27 days, AI-heavy, one maintainer | confirmed-with-caveats (adversarial: partial) | TD-25 (resolved; regressed), TD-28 | Closed (decision) | — |
| XC-ARC-15 | LOW | Cross-cutting | Repo carries 82 tracked binaries, duplicated handoffs and a 9.7k-line migration concat | not independently verified (low/info) | TD-41 (related) | Open | — |
| XC-PRV-14 | LOW | Cross-cutting | Personal data in tracked docs and screenshots; sensitive untracked files not gitignored | not independently verified (low/info) |  | Closed | #189, v10.125.0 |
| BE-FN-12 | INFO | Backend | Lock-screen pushes show payee names and amounts, with no option to hide them | not independently verified (low/info) |  | Closed | v10.126.0 |
| DB-OPS-16 | INFO | Database | pg_trgm sits in public but nothing uses it; TD-34's stated blocker does not exist in the repo | not independently verified (low/info) | TD-34 | Closed | v10.130.0 |
| INT-PAR-11 | INFO | Integration | Parity tests prove two copies agree in one process, not that server and browser agree in production | not independently verified (low/info) | TD-32 | Closed | #169, #170, #173, v10.120.0 |
| GATE-05 | INFO | Platform & Ops | npm audit: 22 (react) + 11 (admin) advisories still untriaged; all highs dev-only | observed (gate executed) | TD-38 (still open; count now 22 react / 11 admin) | Closed | #189 |
| GATE-06 | INFO | Platform & Ops | Main entry chunk 615 KB (180 KB gz) exceeds Vite's 500 KB warning | observed (gate executed) |  | Closed | #189 |

## 12. Findings in detail

Every critical, high and medium finding — evidence, failure scenario, recommendation and verifier notes — is in the companion file [VYACT_ARCHITECTURE_AUDIT_2026-10-04_FINDINGS.md](VYACT_ARCHITECTURE_AUDIT_2026-10-04_FINDINGS.md). Search it by finding ID.

## 13. Low and info findings

| ID | Sev | Area | Title | Where | Recommendation |
|---|:---:|---|---|---|---|
| FE-MNY-11 | low | Frontend | CSV export writes user and WhatsApp-sourced text without neutralising formulas (CSV injection) | react/src/lib/transactionsCsv.ts:9, react/src/lib/transactionsCsv.ts:17-22, react/src/pages/Settings.tsx:303 | In cell(), prefix a single quote (or tab) when the string starts with =, +, -, @, tab or CR, then quote. Apply this to text columns only and keep numeric Amount as a number. Also emit a UTF-8 BOM so non-ASCII descriptions open correctly in Excel. Test: transa… |
| FE-MNY-12 | low | Frontend | Archived accounts with a balance count in net worth and Pip's liquid figure but drop out of 'Spendable now' | react/src/lib/netWorth.ts:336-341, react/src/lib/accountsView.ts:177-189, react/src/lib/accounts.ts:383 | Either refuse to archive an account with a non-zero balance (offer move or transfer first, as delete does), or treat archived balances identically on every surface and label them. Test: archiving with a balance must either be rejected, or leave accountsSummar… |
| FE-MNY-13 | low | Frontend | Card reconcile forces every stated value negative, so an overpaid (credit) card cannot be recorded | react/src/lib/accountBalance.ts:211-213, react/src/lib/accountsView.ts:77-86 | Add an explicit 'in credit' toggle (or accept a signed value) on the card reconcile sheet and pass the sign through, keeping INV-11 for the default 'owed' case. Test: reconciling a card 'in credit 2,000' yields balance +2,000, outstanding 0, liquidity 'short'. |
| FE-MNY-14 | low | Frontend | Planner 'income varies' rule includes the partial current month and flags stable earners early each month | react/src/lib/plannerRules.ts:68-79, react/src/lib/plannerRules.ts:108-129, react/src/lib/personalInsights.ts:87-93 | Use completed months only (filter m < nowMonthKey(), as essentialRunway and spendBasis do) and require a minimum of 3. Test: the stable-salary fixture evaluated on day 2 yields no income.unstable recommendation. |
| FE-MNY-15 | low | Frontend | 'Full backup' omits accounts, allocations and recurring schedules, so balances cannot be rebuilt from it | react/src/pages/Settings.tsx:275-281, react/src/pages/Settings.tsx:649 | Include accounts, budgetAllocations, recurringSchedules and netWorthSnapshots and bump the version field, or relabel the button. Test: a snapshot round-trip into a fresh store reproduces computeNetWorth and the budget lines. |
| FE-MNY-16 | low | Frontend | Budget suggestion and forecast sum mixed currencies, inactive schedules and receivables | react/src/lib/budgetIntel.ts:131-143, react/src/lib/calculations.ts:179-199, react/src/components/budgets/BudgetFormModal.tsx:113-116 | Filter `s.active`, convert template amounts and debt minimums via convert() into the form currency, exclude owed_to_me, and count actual occurrences in the period (expandRRule) instead of pro-rating. Test with a mixed-currency, paused-schedule fixture. |
| FE-PIP-12 | low | Frontend | Category 'usual month' includes the current partial month and later months for past-period lookups | react/src/lib/askVyactBackend.ts:159-165, react/src/lib/askVyactBackend.ts:549-577 | Compute 'usual' over the n completed months immediately BEFORE the reported month (consistent with spendBasis), counting gap months as zero. Add a test for a past-month lookup with a partial current month. |
| FE-PIP-13 | low | Frontend | No-history runway and cover use sentinel figures (burn = EMI + 1; 0.0 months 'thin cushion') | react/src/lib/askVyactBackend.ts:1301-1308, react/src/lib/askVyactBackend.ts:254-261, react/src/lib/aiSummary.ts:199 | When the spend basis is empty, return an explicit 'not enough history' outcome with no cover, runway or floor figures (the WhatsApp runwaySnapshot already nulls months in this case). Never emit the +1 sentinel as a fact. |
| FE-PIP-14 | low | Frontend | Per-bill amounts in Pip ignore the schedule's currency | react/src/lib/askVyactBackend.ts:1152-1159, react/src/lib/askVyactBackend.ts:387-389 | Convert each bill with convert() when hasRate() holds for its currency; otherwise state it in its own currency. Add a fixture test. |
| FE-PIP-15 | low | Frontend | Account matching falls back to the first card of any bank when the stated tail doesn't match | react/src/lib/askVyactParser.ts:218-242 | Return null when the stated text names a bank or a masked tail that matches no account. Use the kind fallback only when exactly one account of that kind exists. Add parser tests. |
| FE-PIP-16 | low | Frontend | No client abort or timeout: Stop and New chat leave model calls and 5-minute relay polling running | react/src/lib/askVyactModelCall.ts:45-81, react/src/pages/Chat.tsx:216, react/src/pages/Chat.tsx:443-450 | Thread an AbortController from send() through runAssistant to the ModelCall, abort it on Stop, New chat and unmount, check it in the relay loop, and add a client deadline of about 30s. |
| FE-PIP-17 | low | Frontend | Switching household while /chat is mounted writes the old transcript under the new household | react/src/pages/Chat.tsx:75-95, react/src/pages/Chat.tsx:123, react/src/pages/Chat.tsx:141-147 | Key the Chat component on householdId (`<Chat key={householdId} />` in the route and the drawer), or reload history and clear lastAllowedRef in an effect on householdId change. Add a component test. |
| FE-PIP-18 | low | Frontend | Browser authors the system prompts; dead FEATURES.askVyact.backend 'rules' config misdescribes Pip | react/src/lib/askVyactModelCall.ts:46-56, react/src/config/features.ts:35-47, react/src/lib/askVyactBackend.ts:1500-1501 | Move prompt templates server-side: the client sends {kind: 'classify' \| 'phrase', question, facts} and the gateway builds the messages. Delete the dead flag and stale comments, or remove the unreachable rules classifier. |
| FE-PLT-07 | low | Frontend | Signed-in visit to an invite link joins the household instantly with no confirmation | react/src/pages/auth/AcceptInvite.tsx:21-46, supabase/migrations/20260601153000_fix_shareable_invite_accept_rpc.sql:13-64, supabase/migrations/00000000000001_production_state_baseline.sql:796-797 | Render an 'Join <household name> as <role>? Join / Cancel' step and call accept_invitation_link only on an explicit tap. Optionally warn when invited_email differs from the caller's email. Test: an e2e case where visiting /invite/<token> while signed in does … |
| FE-PLT-08 | low | Frontend | Passive sign-out (expired or revoked session) leaves push registered to the previous user | react/src/lib/auth.ts:49-55, react/src/components/auth/AuthGate.tsx:45-47, react/src/store/slices/cloudAuthSlice.ts:59-84 | In setSession's wasSignedIn && !isSignedIn branch, call `pushManager.getSubscription()?.unsubscribe()` locally even though the server RPC can no longer be authorised, and clear ENDPOINT_KEY. The server then retires the endpoint on its first 410. Test: a cloud… |
| FE-PLT-11 | low | Frontend | Platform config hygiene: stale root vercel.json, self-dependency, dead deps and a test route in prod | vercel.json:171-210, react/package.json:124, react/package.json:136 | Delete the root vercel.json, or make it a copy of react/vercel.json guarded by a test. Remove the self-dependency and @supabase/ssr. Gate /__e2e_error behind `import.meta.env.MODE === 'test'` and remove it from APP_SEGMENTS. Correct the askVyact comment and f… |
| FE-PUB-03 | low | Frontend | Learn handler: no upstream timeout, empty library cached a day, bad source_url 503s a lesson | react/api/_supabase.js:246, react/api/learn.js:159, react/api/learn.js:264 | In readContent, pass `signal: AbortSignal.timeout(4000)`. In the handler, return unavailable() when `all.length === 0`, as sitemap/llms already do. Make the source link safe with `let host; try { host = new URL(c.source_url).hostname } catch { /* omit link */… |
| FE-PUB-05 | low | Frontend | Guest demo's other address serves indexable public pages and reads the production DB | react/vercel.json:79, react/vercel.json:185, react/vite.config.ts:47 | In middleware.js, when isDemoHost() is true, redirect every non-app path (learn, for, about, private, v, sitemap, robots, llms) to https://vyact.app, and add the matcher entries those paths need. Or have _page.js emit `<meta name=robots content=noindex>` when… |
| FE-PUB-06 | low | Frontend | Soft-200 app shell still served for multi-segment /learn/*, /for/* and any dotted path | react/middleware.js:30, react/vercel.json:118, react/vercel.json:139 | Narrow the matcher to skip only real static extensions (js, css, png, svg, ico, txt, xml, json, webmanifest, woff2, map) and only single-segment /learn/<x>, /learn/topic/<x> and /for/<x>, so middleware 404s the rest. Use the build time (or the copy's last-cha… |
| FE-PUB-07 | low | Frontend | Vercel ignoreCommand diffs only HEAD^..HEAD, so a push ending in a docs-only commit skips deploy | react/vercel.json:7, admin/vercel.json:7 | Diff against the last deployed commit: `git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':!*.md' ':!**/*.md' ':!docs'`, falling back to building when the variable is empty. Apply it in both vercel.json files. |
| FE-PUB-08 | low | Frontend | Anon content policy exposes every column of published rows, including author_id user UUIDs | supabase/migrations/20261004120000_learn_public_read.sql:21, supabase/migrations/00000000000001_production_state_baseline.sql:218, supabase/migrations/00000000000001_production_state_baseline.sql:219 | Revoke table SELECT from anon and grant column-level SELECT only on the columns the public pages use (slug, title, category, body_md, tags, reading_seconds, video_url, video_updated_at, source_name, source_url, why_it_matters, published_at, updated_at, format… |
| FE-PUB-10 | low | Frontend | Landing pre-render decides cloud mode from env alone and uses $-sensitive String.replace | react/scripts/prerender-landing.mjs:87, react/scripts/prerender-landing.mjs:88, react/src/lib/supabase.ts:34 | In prerender-landing.mjs, mirror the runtime rule: `cloudMode = env.VITE_LOCAL_ONLY !== '1' && !(process.env.VERCEL_ENV === 'preview' && !process.env.VITE_SUPABASE_URL) && !process.env.VYACT_DEMO && Boolean(url && key)`, ideally through a shared helper. In la… |
| FE-PUB-11 | low | Frontend | Learn topic pill uses raw var(--coral) on an HSL triplet token (binding Aurora rule) | react/api/learn.js:94, react/api/_page.js:110 | Delete the inline style (the class rule already handles it), or change it to `hsl(var(--coral))`. Run the CLAUDE.md token grep over react/api/** in CI. |
| FE-SYN-10 | low | Frontend | Switching user without signing out keeps the previous user's ledger loaded and never purges | react/src/store/slices/cloudAuthSlice.ts:215-245, react/src/components/auth/AuthGate.tsx:42-47, react/node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:4354-4355 | In setSession, compare `session.user.id` with the previous `get().session?.user?.id`. On a change, run the sign-out reset followed by invalidateCacheForSession(newUid).then(init). Test: setSession(A) → setSession(B) asserts the purge ran, the store was reset … |
| FE-SYN-11 | low | Frontend | Outbox flush polls every 100 ms while an entity's first op waits out a backoff | react/src/lib/sync/outbox.ts:116-125, react/src/lib/sync/outbox.ts:182-186, react/src/lib/hybridAdapter.ts:42-48 | In nextWakeAt, ignore ops that claimDue would block: compute the wake time from each resource's head op only. Alternatively, have claimDue return the earliest due time. Test: a head op with nextRetryAt=now+8000 plus a follower → nextWakeAt returns now+8000. |
| FE-SYN-12 | low | Frontend | A failed cache read becomes [] and the next write saves it back, truncating the cache | react/src/lib/kvStore.ts:75-95, react/src/lib/dataAdapter.ts:167-173, react/src/lib/dataAdapter.ts:284-290 | Make the adapter's read distinguish 'absent' from 'failed'. On failure, the upsert, remove and replaceAll read-modify-writes must throw (the outbox still holds the op), never write a fallback. Test: stub kvGet to reject once, then upsert → the previous rows s… |
| FE-SYN-13 | low | Frontend | Anonymous to cloud import is dead: the sign-in purge deletes the local data it would import | react/src/lib/cacheInvalidation.ts:374-381, react/src/lib/cacheInvalidation.ts:300-306, react/src/lib/migration.ts:24-38 | Either delete the dead migration code and state that sign-in discards local-only data, or snapshot the anonymous keys before the purge, import them, and only then purge. Test: with fake-indexeddb, seed anonymous 'transactions', sign in, and assert they are ei… |
| FE-UIC-14 | low | Frontend | Reconcile sheet announces adjustments the reconcile engine silently changes | react/src/components/accounts/ReconcileSheet.tsx:64-71, react/src/components/accounts/ReconcileSheet.tsx:88-94, react/src/components/accounts/ReconcileSheet.tsx:148-153 | Reject or normalise negative input for cards (and for cash) in the sheet before computing drift. Use the delta returned by reconcileAccount in the toast. Test: an RTL test typing '-23990' on a card asserting no drift is shown. |
| FE-UIC-15 | low | Frontend | Account ledger running balance ignores when reconcile offsets were applied | react/src/pages/Accounts.tsx:427-447, react/src/pages/Accounts.tsx:454-470 | Interleave reconciliation_log entries by date and undo each delta when walking back past it. Format amounts with fmtSigned. Test: a unit test of the ledger rows for the scenario above. |
| FE-UIC-16 | low | Frontend | Transaction rows label first-class accounts 'Linked account' or 'Credit card' | react/src/components/transactions/TxnRow.tsx:28, react/src/components/transactions/TxnRow.tsx:87, react/src/lib/accounts.ts:94-106 | Resolve the label from the accounts store by FK (accountId/toAccountId), falling back to paymentMethod for legacy rows. Test: TxnRow renders the account name for a uuid-linked row. |
| FE-UIC-17 | low | Frontend | List and calendar aggregates bypass the reportable/effective-amount rules | react/src/pages/Transactions.tsx:213-226, react/src/pages/Transactions.tsx:273-284, react/src/pages/Transactions.tsx:51-55 | Use reportableTxns + effectiveAmount for the group/filtered nets (or label them 'including private') and for the calendar totals. Test: a fixture with a private row and a split row asserting the header equals the rail. |
| FE-UIS-14 | low | Frontend | Unlabelled form controls and missing autocomplete in households, onboarding, MFA and auth | react/src/pages/Households.tsx:494, react/src/pages/Households.tsx:840, react/src/pages/Onboarding.tsx:249 | Add `aria-label={`Role for ${m.display_name}`}` to the role select. Associate onboarding labels with ids (or wrap the inputs in <Field>). Label the MFA input. Give TimeDial a focus-visible ring and aria-valuemin/max/now. Add autoComplete attributes to the aut… |
| FE-UIS-15 | low | Frontend | Language setting offers 6 languages but translates ~10 nav strings and never sets <html lang> | react/src/constants.ts:284, react/src/hooks.ts:7, react/src/pages/Settings.tsx:525 | Either limit the Language select to English until coverage exists, or label the others 'Preview: navigation only'. Set `document.documentElement.lang` from profile.language in useTheme or AppShell. Move numberSystem to a profiles column so it syncs. Test: uni… |
| FE-UIS-16 | low | Frontend | Hygiene: dead modules, typeless Buttons in forms, raw HOUSEHOLD_FULL text, expired invites block | react/src/components/education/WhyChip.tsx:1, react/src/lib/insightsApi.ts:58, react/src/components/ui/Button.tsx:20 | Delete the dead modules. Default `type="button"` in Button (callers already pass type=submit where needed). Filter expired invitations in the limit check (or in listInvitations). Map AcceptInvite errors through householdLimitMessage. Add a dirty-state confirm… |
| ADM-05 | low | Admin | Content-tier admins can rewrite global needs/wants classification, changing every family's floor | supabase/migrations/00000000000001_production_state_baseline.sql:696, react/src/lib/categorization.ts:29, react/src/lib/categorization.ts:36 | Restrict writes to is_admin('super') (aal2), add a CHECK or FK so category matches the CATEGORIES_BY_TYPE expense ids, and log changes through the admin_audit trigger. Add a parity test that fails when a category_classifications row disagrees with NEEDS_WANTS… |
| ADM-08 | low | Admin | Admin lists load whole tables unpaginated; PostgREST max-rows silently truncates counts | admin/src/lib/adminApi.ts:120, admin/src/lib/adminApi.ts:137, admin/src/lib/adminApi.ts:145 | Replace with SQL-side aggregation: an admin_list_households(p_limit, p_offset, p_query) RPC returning member_count from a GROUP BY, and a paginated admin_list_users with server-side search. Show totals from count='exact' or the RPC. Test: seed 1,200 membershi… |
| ADM-10 | low | Admin | Infographic deleted from storage before the content save is validated or committed | admin/src/pages/Content.tsx:276, admin/src/pages/Content.tsx:293, admin/src/pages/Content.tsx:399 | Validate first, upsert, and delete the previous object only after upsertContent succeeds (and on content delete). Set allowed_mime_types = ['image/png','image/jpeg','image/webp'] and a file_size_limit on the bucket. Test: contentWorkflow.test.ts asserts that … |
| ADM-11 | low | Admin | Every edit of a published item resets published_at and writes the editor's email as author | admin/src/lib/contentApi.ts:157, admin/src/lib/contentApi.ts:175, admin/src/pages/Content.tsx:236 | Preserve published_at on update (set it only on the draft-to-published transition, or with a DB trigger), and pin author_name to a display byline ('Vyact'). Never use an email as an author. Limit the anon policy to the columns the public pages need, via a vie… |
| ADM-12 | low | Admin | Settings shows state it does not check: DB 'connected', GA4 'connected', stale versions | admin/src/pages/Settings.tsx:27, admin/src/pages/Settings.tsx:28, admin/src/pages/Settings.tsx:34 | Derive the DB status from a live round-trip (e.g. the result of fetchMyAdminRole or a ping RPC), remove the GA4 row, read the project ref from VITE_SUPABASE_URL, and use __APP_VERSION__ in Layout and the Settings footer. Test: render Settings with a failing s… |
| ADM-13 | low | Admin | Admin host has no CSP and publishes full source maps while holding god-mode JWT | admin/vercel.json:11, admin/vite.config.ts:10, admin/src/lib/supabase.ts:20 | Add a CSP to admin/vercel.json: default-src 'self'; connect-src 'self' https://dmxqkvploojokffuhxnz.supabase.co; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://*.supabase.co; frame-ancestors 'no… |
| ADM-14 | low | Admin | Revenue KPIs mix currencies and statuses: MRR summed across currencies, labelled USD | supabase/migrations/00000000000001_production_state_baseline.sql:510, admin/src/pages/Subscriptions.tsx:48, admin/src/pages/Subscriptions.tsx:96 | Filter paid subscriptions by status in ('active','trialing') and report MRR per currency, or convert with a stated rate, in SQL. Have the page show the RPC's per-currency figures instead of re-summing. Test: a SQL test inserting INR + USD rows asserts mrr is … |
| BE-FN-11 | low | Backend | Deployment and auth config for these functions is not codified; cron hardcodes the prod URL | .github/workflows/deploy.yml:136-160, supabase/config.toml:13, supabase/migrations/20261003120000_web_push.sql:210-216 | Add delete-account and send-split-email (with verify_jwt on) to the deploy.yml step. Add an `[auth]` section, or a checked-in auth-config snapshot verified by a script, to config.toml. Build the cron URL from a Vault secret (`project_url`) instead of a litera… |
| BE-PIP-04 | low | Backend | Untrusted learned recipes are written without confirmation, and one user can promote a global recipe | supabase/functions/_shared/agent/pipeline.ts:83, supabase/functions/_shared/agent/pipeline.ts:265-276, supabase/functions/_shared/agent/recipeStore.ts:104-115 | In `runIngestion`, treat `extractor === 'recipe'` as deterministic only when the recipe is trusted. Pass `trusted` through `ExtractionResult`, or apply a confidence threshold in the gate. Store confirmations per household (an `sms_recipe_confirmations(signatu… |
| BE-PIP-05 | low | Backend | key_env_var denylist misses MAILERSEND_API_KEY; base_url host checks are bypassable | supabase/functions/_shared/agent/router.ts:211-230, supabase/functions/_shared/agent/router.ts:265-278, supabase/functions/_shared/agent/router.ts:494-509 | Switch to an allowlist: require key names to match `^LLM_[A-Z0-9_]+_KEY$` (or an explicit list), both in `FORBIDDEN_KEY_ENV`/`checkConfig` and in the `ai_model_configs_key_env_var_*` CHECK. Optionally pin base_url hosts to a list (openrouter.ai, api.groq.com,… |
| BE-PIP-06 | low | Backend | TEMPORARY Claude Code relay is still live, with no retention bound and an unauthenticated status endpoint | supabase/functions/ask-vyact/index.ts:274-330, supabase/functions/ask-vyact/index.ts:442-471, supabase/functions/ask-vyact-relay-status/index.ts:18-38 | Close TD-44 as written: disable the row, purge the table, and remove the function, branch and table in one release. Until then, add a pg_cron job deleting relay rows older than 24h, and require a shared secret header on relay-status (or move it behind the ser… |
| BE-PIP-07 | low | Backend | Gateway failures are silent in logs but over-share config details with end users | supabase/functions/ask-vyact/index.ts:515-523, supabase/functions/ask-vyact/index.ts:374-383, supabase/functions/_shared/agent/router.ts:456-461 | `console.error('[ask-vyact] provider failure', {requestId, code, status, provider, model})` on every failure. Return only `{error: code, requestId}` plus a generic message to clients, and keep `hint` for admin callers (check `is_admin` via a service-side look… |
| BE-WA-11 | low | Backend | A failed Meta send permanently uses up the dedupe slot; the daily cap check is racy | supabase/functions/_shared/whatsapp-send.ts:121-152, supabase/functions/_shared/whatsapp-dispatch-rules.ts:285-288 | On a Meta failure, delete the slot row (or set a `retry_after` and let the claim `on conflict ... where status in ('failed') and attempts < 3` take it again). Count 'sending' as well as 'sent' in the cap, or enforce the cap inside a single RPC. Test: a mocked… |
| BE-WA-12 | low | Backend | Replay relies on unrelated traffic, and stale claims replay without limit | supabase/functions/whatsapp-webhook/index.ts:209-213, supabase/functions/whatsapp-webhook/index.ts:275-310, supabase/functions/whatsapp-webhook/index.ts:796-804 | Schedule `whatsapp-webhook?mode=sweep` every 5 minutes via pg_cron with a Vault-held service secret (the same pattern as the dispatch secret). Increment `attempts` when re-queuing a stale claim and stop at MAX_ATTEMPTS with a final user notice. Test: a stale … |
| BE-WA-13 | low | Backend | Numbered follow-ups still answer after ANSWERS OFF | supabase/functions/whatsapp-webhook/index.ts:479-498, supabase/functions/whatsapp-webhook/index.ts:516-526, supabase/functions/whatsapp-webhook/index.ts:1102-1104 | Resolve any open chips/reads_offer pending turn when answers are turned off (and on STOP). Also guard the chips branch with `await readsEnabled(...)`, offering answers instead. Test: ANSWERS OFF then "1" gives READS_OFFER and no model call. |
| DB-INT-14 | low | Database | Money CHECKs have NULL and allowlist gaps (budget scope, allocations, categories) | supabase/migrations/20260613120000_budget_scope_drop_custom.sql:17-19, supabase/migrations/20260612120100_v91_feedback_batch.sql:70-81, supabase/migrations/20260608120000_v9_txn_redesign.sql:151-161 | Make scope NOT NULL, add CHECK (amount >= 0) on budget_allocations, and add CHECK (account_id <> to_account_id) for transfers. In the WhatsApp category writers, refuse 'loan_emi' and any id outside an expense-category allowlist table, kept in parity with cons… |
| DB-INT-15 | low | Database | Split sharing matches on auth.users.email without requiring email_confirmed_at | supabase/migrations/20260724130000_shared_splits.sql:47-52, supabase/migrations/20260724130000_shared_splits.sql:119-136, supabase/migrations/20261002120000_w6b_whatsapp_template_senders.sql:44-62 | Add 'and email_confirmed_at is not null' in my_email() and in the recipients join. Confirm the project's auth confirmation setting and record it in SECURITY.md. |
| DB-OPS-07 | low | Database | Every pg_cron job hard-codes the production URL; auto-generated secrets make test DBs call prod | supabase/migrations/20260926120000_w2_whatsapp_preferences_dispatch.sql:11-15, supabase/migrations/20260926120000_w2_whatsapp_preferences_dispatch.sql:140-158, supabase/migrations/20260927120000_w2b_whatsapp_approve_recurring.sql:188-195 | Store the project's functions base URL in Vault (or a config table) and build the URL from it inside the job, for example `(select decrypted_secret from vault.decrypted_secrets where name='functions_base_url') \|\| '/whatsapp-dispatch?job=alerts'`. Alternativel… |
| DB-OPS-09 | low | Database | RLS evaluates SECURITY DEFINER helpers per row; hot lookups lack indexes and some indexes are duplicated | supabase/migrations/20260601120000_td06_td21_rls_perf_and_delta_sync_indexes.sql:25-30, supabase/migrations/20260601120000_td06_td21_rls_perf_and_delta_sync_indexes.sql:46-73, supabase/migrations/20260602120000_money_map_phase1_accounts.sql:128-129 | Rewrite read policies as `household_id in (select my_household_ids())`, using a STABLE SECURITY DEFINER function that returns setof uuid and is evaluated once as an initplan, OR-ed with `(select is_admin('roles'))`. Add indexes on whatsapp_inbound_messages(pr… |
| DB-OPS-14 | low | Database | Twin v91 migrations and stale process docs contradict the actual apply path | supabase/migrations/20260612120100_v91_feedback_batch.sql:9-15, supabase/migrations/20260612120100_v91_feedback_batch.sql:84-90, supabase/migrations/20260612120000_v91_budgets_recurring_receivables_deeplink.sql:31-53 | Rewrite MIGRATIONS.md §4 and OPERATIONS.md §2 to describe the real pipeline (merge the migration PR first, the Deploy job runs db push, then the app PR). Add a lint that fails if any migration file contains 'NOT auto-applied' or 'do not apply'. Drop the dupli… |
| INT-CON-04 | low | Integration | replace_<entity> RPCs are schema-stale: cloud bulk-replace drops money-model columns / violates CK_txn_accounts_by_type | supabase/migrations/20260529151000_td09_replace_all_rpcs.sql:20, supabase/migrations/20260602130000_money_map_replace_accounts_rpc.sql:24, react/src/lib/supabaseAdapter.ts:1210 | Regenerate every replace_<entity> RPC from the current table shape (mirror replace_budgets' v931 rewrite), or delete the ones with no cloud caller. Add a contract test that inserts a representative row of each entity through its replace RPC and asserts no col… |
| INT-CON-05 | low | Integration | Category parity test covers only expense ids; income category drift is silent and unchecked | react/src/lib/__tests__/categoryModel.test.ts:89, supabase/functions/_shared/whatsapp-parser.ts:21, react/src/constants.ts:70 | Extend categoryModel.test.ts to also assert INCOME_IDS (both copies) equal INCOME_CATEGORIES ids, mirroring the expense assertions. Optionally add a CHECK or a DB-side allowlist for transactions.category. |
| INT-CON-06 | low | Integration | Admin app household-type enum omits 'couple' and keeps retired multi_biz/shared | admin/src/lib/adminApi.ts:130, admin/src/pages/Households.tsx:8, admin/src/pages/Households.tsx:49 | Add 'couple' to the admin type union and TYPE_COLOR, add a couple count bucket, and share a normalizeHouseholdType equivalent so retired 'shared'/'multi_biz' map to family/business consistently with the consumer. |
| INT-CON-07 | low | Integration | leave_household shares the same NULL-role guard idiom as transfer_ownership | supabase/migrations/00000000000001_production_state_baseline.sql:460, react/src/lib/auth.ts:137 | Use `select role into v_role; if v_role is null then return; end if;` and compute owner_count only for an actual member, as part of the same membership-RPC hardening migration as finding 1. |
| INT-HH-06 | low | Integration | Owner continuity not enforced: households can be left with no owner | supabase/migrations/20260601120000_td06_td21_rls_perf_and_delta_sync_indexes.sql:92-95, supabase/migrations/20260908120100_audit_s2_membership_role_grants.sql:17-18, supabase/migrations/20260908120100_audit_s2_membership_role_grants.sql:29-38 | Add a BEFORE UPDATE/DELETE trigger on memberships that raises when the change would leave a household with zero owner rows (skip when the parent household is being deleted). Add a unique index on memberships(household_id, user_id) after de-duplicating. Route … |
| INT-HH-13 | low | Integration | After leaving or deleting a household, the app stays on a household the user is no longer in | react/src/pages/Households.tsx:302-309, react/src/pages/Households.tsx:394-402, react/src/store/slices/cloudAuthSlice.ts:92-119 | After leave or delete, call switchHousehold to the first remaining household (or route to Households / create-household when none remain), and purge that household's cache entries and cursors (forceFullResync plus a cache delete). Add a store test: after leav… |
| INT-HH-14 | low | Integration | Admin Households page has a stale type list and member counts that cap at 1,000 rows | admin/src/lib/adminApi.ts:127-159, admin/src/pages/Households.tsx:8-14, admin/src/pages/Households.tsx:45-50 | Use a count RPC (`select household_id, count(*) ... group by`) or `select('id, memberships(count)')`, paginate, and update the type union and colours to the four current types via a shared constant. Add a unit test that the union matches household_member_limi… |
| INT-PAR-10 | low | Integration | Same event, different figures across channels: split large-spend alert and budget percentage rounding | supabase/functions/_shared/whatsapp-dispatch-rules.ts:100, supabase/functions/_shared/whatsapp-dispatch-rules.ts:106, supabase/functions/_shared/whatsapp-dispatch-rules.ts:433 | Use effectiveAmount for the large-spend figure and threshold (or explicitly label the total). Share one percentage formatter between budgetThresholdNotifs and budgetAlerts, ideally by calling the bundled generator. Have budgetAlerts read lines via the bundled… |
| INT-TXN-14 | low | Integration | Audit trail loses the actor for server-side writers and records every delete as 'updated' | supabase/migrations/20260529150500_td08_audit_triggers.sql:32-52, supabase/migrations/20260928120000_w3_whatsapp_capture_conversation.sql:120, supabase/migrations/20260911120000_r4_investments_to_assets.sql:339-342 | Have the trigger derive the actor from `coalesce(auth.uid(), nullif(current_setting('vyact.actor', true), '')::uuid)`, set that GUC in each service-role RPC from p_profile_id, and log 'deleted' when deleted_at goes from null to non-null. Test: an SQL test tha… |
| INT-TZC-08 | low | Integration | WhatsApp currency detection checks only the first three-letter word, so 'tea 50 aed' logs ₹50 | supabase/functions/_shared/whatsapp-parser.ts:242-250, supabase/functions/whatsapp-webhook/index.ts:600 | Scan all three-letter tokens (matchAll) against the allowlist, prefer the one adjacent to the amount, and read the base from households.base_currency. Add parser tests ('tea 50 aed' -> AED; 'bus 12 sgd' -> SGD), mirrored in askVyactParser. |
| GATE-03 | low | Platform & Ops | Public production build ships full source maps (87 maps, 8.3 MB) of the private codebase | react/vite.config.ts:175, react/middleware.js:30 | Use sourcemap: 'hidden' (maps emitted but not referenced) and upload them to an error tracker if needed, or exclude *.map from the Vercel output. Add a build-gate assertion that no dist/assets/*.js contains 'sourceMappingURL'. |
| GATE-04 | low | Platform & Ops | Unit tests do not type-check: ~43 errors incl. money-suite fixtures that no longer match types | react/src/lib/__tests__/moneyModel.engines.test.ts:87, react/src/lib/__tests__/moneyModel.invariants.test.ts:250, react/src/lib/__tests__/ledgerWorkflow.test.ts:228 | Add react/tsconfig.tests.json (extends tsconfig.json, includes src/**/*.test.ts, types node + vitest, excludes or shims supabase/functions Deno imports), fix these 7 files, and wire 'Consumer · type-check (unit tests)' into ci.yml next to the e2e gate. Do the… |
| OPS-07 | low | Platform & Ops | Prod Supabase token reachable from non-main branches; no permissions block; actions pinned by tag | .github/workflows/deploy-test-functions.yml:175-202, .github/workflows/deploy.yml:41, .github/workflows/deploy.yml:65-70 | Store SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD only as `production-database` environment secrets, limited to the `main` branch. For vyact-test, use a separate Supabase account or org so its PAT cannot reach production, under its own `nonprod` environmen… |
| OPS-09 | low | Platform & Ops | DEPLOY.md and OPERATIONS.md misdescribe the live pipeline and verify against an orphaned host | DEPLOY.md:41-107, OPERATIONS.md:48-51, OPERATIONS.md:132-153 | Rewrite DEPLOY.md's authoritative section and OPERATIONS.md §2 and §6 from deploy.yml and ENVIRONMENTS.md: Vercel publishes, Actions only migrates and deploys functions, verification targets vyact.app and admin.vyact.app. Add both docs to TD-41, and make 'run… |
| OPS-13 | low | Platform & Ops | Build and CI hygiene: npm install on Vercel, unpinned Node, cancelled main runs, HEAD^-only skip | react/vercel.json:6-7, admin/vercel.json:6-7, react/package.json:7-24 | Use `npm ci` in both vercel.json files. Add `"engines": {"node": "22.x"}` and set the same version in Vercel and all CI jobs. Use `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. Change ignoreCommand to diff against `$VERCEL_GIT_PREVIOUS_SHA`… |
| XC-ARC-07 | low | Cross-cutting | About 4,000 lines of dormant agent pipeline and retired feature paths still shipped and tested | supabase/functions/_shared/agent/pipeline.ts:1-37, supabase/functions/_shared/agent/types.ts:10-23, scripts/test-inventory-config.mjs:45 | Move the ingestion pipeline to an `experimental/` folder outside supabase/functions (or a branch), and remove agent/types.ts from the CLAUDE.md three-places rule and the parity test. Delete router.test.ts (the vitest port covers it), the track_picker flag and… |
| XC-ARC-10 | low | Cross-cutting | Store actions write pre-await snapshots back to state, without a household guard | react/src/store/slices/dataSlice.ts:507, react/src/store/slices/dataSlice.ts:609-624, react/src/store/slices/dataSlice.ts:631-645 | Adopt one store helper, `commit(hid, updater)`, which drops the result if `get().currentHouseholdId !== hid` and applies `set(state => ({ transactions: updater(state.transactions) }))`. Use it in every slice action after an await, and add an ESLint rule (no-r… |
| XC-ARC-12 | low | Cross-cutting | Money model lives in CHECKs and prose; domain types and adapter generics do not encode it | react/src/types.ts:117-168, react/src/lib/dataAdapter.ts:49, react/src/lib/dataAdapter.ts:62 | Introduce a discriminated union, `ExpenseTxn \| IncomeTxn \| TransferTxn \| InvestmentBuy \| InvestmentWithdrawal`, plus a separate `LegacyTxnRow` compatibility type used only by row mappers. Map `Entity` to its row type (`list<E extends Entity>(e: E): Promise<En… |
| XC-ARC-14 | low | Cross-cutting | Release cadence outpaces stabilisation: 40 minor releases in 27 days, AI-heavy, one maintainer | VERSIONS.md, react/CHANGELOG.md, scripts/version-drift-check.mjs:7-9 | Adopt a release train: batch to at most 2 releases a week, with a 'stabilisation week' every 4th week limited to TD and defect work. Derive version strings from package.json at build time, and generate VERSIONS.md and the CHANGELOG index from conventional-com… |
| XC-ARC-15 | low | Cross-cutting | Repo carries 82 tracked binaries, duplicated handoffs and a 9.7k-line migration concat | Vyact App/finflow-ceo-roadmap.pptx, Vyact-handoff/vyact redesign/project/design_handoff_vyact_aurora/reference/vy-app-v2.jsx, Vyact Redesign/design_handoff_vyact_aurora/reference/vy-app-v2.jsx | Move business and design artefacts to a docs drive, or to a separate repo or Git LFS. Keep one design handoff. Replace db/schema.sql with a real effective-schema dump (`pg_dump --schema-only` from the migration-replay job), so it shows current definitions onl… |
| XC-PRV-14 | low | Cross-cutting | Personal data in tracked docs and screenshots; sensitive untracked files not gitignored | react/CHANGELOG.md:7628-7632, docs/WHATSAPP_TEMPLATES.md:77, whatsapp-closure-runbook.md:161 | Replace the real emails and phone numbers with placeholders (and purge them in the same history rewrite as the secrets finding). Move Userback screenshots out of the repo. Add the root working files (*.zip, `Inputs from CMO.md`, `vyact-master-todo.md`, `home.… |
| BE-FN-12 | info | Backend | Lock-screen pushes show payee names and amounts, with no option to hide them | supabase/functions/_shared/web-push-rules.ts:439-442, react/src/lib/notifications.ts:138, react/src/lib/notifications.ts:217-218 | Add a 'Hide amounts on the lock screen' preference. When it is on, send a generic title ('A bill is due today') and keep the detail in the app. The default could be hidden for health or loan categories. |
| DB-OPS-16 | info | Database | pg_trgm sits in public but nothing uses it; TD-34's stated blocker does not exist in the repo | supabase/migrations/00000000000001_production_state_baseline.sql:36, supabase/migrations/20260909150000_v1022_lock_down_definer_functions.sql:90-93, TECH_DEBT.md:1105-1121 | On production, list dependent indexes (`select indexrelid::regclass from pg_index i join pg_opclass o on o.oid = any(i.indclass) where o.opcname like 'gin_trgm%'`). If none exist, `drop extension pg_trgm` (or `alter extension pg_trgm set schema extensions`) i… |
| INT-PAR-11 | info | Integration | Parity tests prove two copies agree in one process, not that server and browser agree in production | react/src/lib/__tests__/serverEngine.test.ts:38, react/src/lib/__tests__/serverEngine.test.ts:70, react/src/lib/__tests__/webPush.test.ts:217 | Add an environment matrix rather than more fixtures: 1. Run the parity suites under TZ=UTC, Asia/Kolkata, Europe/London and America/New_York (vitest projects with `env.TZ`). 2. Add a saved-partial-rates fixture with a foreign-currency row. 3. Add a Deno smoke… |
| GATE-05 | info | Platform & Ops | npm audit: 22 (react) + 11 (admin) advisories still untriaged; all highs dev-only | react/package.json:58, react/scripts/capture-help.mjs:5, react/package.json | Close TD-38 by recording this triage. Upgrade react-router-dom in react/ and admin/ (runtime). Bump tailwindcss to the latest 3.4.x or plan v4. Bump puppeteer-core and vitest. Add a CI 'npm audit --omit=dev --audit-level=moderate' step so runtime advisories f… |
| GATE-06 | info | Platform & Ops | Main entry chunk 615 KB (180 KB gz) exceeds Vite's 500 KB warning | react/vite.config.ts:175 | Split vendor (supabase-js, framer-motion, zustand) from app code with build.rollupOptions/rolldownOptions manualChunks. Keep recharts lazy. Add a size budget (e.g. size-limit) for index-*.js in CI. |

## 14. Limitations and coverage

- **No production access.** There was no access to the production database, the Supabase dashboard or the vendor consoles. Several things could not be confirmed:
  - whether the leaked `sb_secret_` key has been rotated, or whether the repo was public at the time (XC-PRV-01);
  - production function definitions, so the `upsert_budget` guard drift is inferred from repo comments (DB-OPS-03);
  - Supabase Auth settings: leaked-password protection, MFA, CAPTCHA, redirect allowlist;
  - Contentsquare and Userback masking, which decides how severe XC-PRV-03 is;
  - Vercel environment scopes;
  - whether `send-split-email` and `delete-account` were deployed by hand.
- **Read-only, static review.** No SQL or RPC was executed against any database, and no exploit was run against a live system. The critical database findings were re-verified by reading the latest migration definitions, not by execution. The month-end skip was reproduced by running the algorithm under Node, in two time zones.
- **Deno tests and live calls were not run.** Deno is not installed, so the Edge Function tests did not run and Edge code was not type-checked. No live LLM provider, Meta WhatsApp or Web Push calls were made. Gateway, relay and model behaviour is inferred from code.
- **Lane A/B Playwright suites were not run,** so the claimed zero-failure state of Lane A is unconfirmed.
- **Verification depth varies.** 217 of 291 auditor findings were independently verified (every medium and above, plus some low), in a single adversarial pass per finding rather than by a panel. Zero refutations means the findings are well evidenced, not that every severity is exact; verifiers downgraded 41. The 71 low and 3 info findings marked "not independently verified" are reported as the auditors wrote them.
- **No gap-fill round.** About 143 areas were reported as not covered, and no second round filled them. These include:
  - full bodies of several WhatsApp RPCs and `record_loan_payment`;
  - the golden money snapshot contents;
  - admin CMS write paths;
  - realtime payload mapping;
  - storage bucket cleanup;
  - a full byte-level diff of the engine bundle;
  - fact-checking of the 116 public lesson answers.
- **Not measured:** dependency advisories were counted but not triaged for reachability (GATE-05), and performance and accessibility were assessed from code, not profiled or tested with real assistive technology.

**Coverage gaps reported by auditors:**

- [Money domain engine (client)] Contents of moneyModel.regression/engines tests and the golden snapshot (only the invariants header and case list were read)
- [Money domain engine (client)] react/src/lib/askVyactBackend.ts and aiSummary.ts beyond spendBasis (Pip's fact assembly belongs to another slice)
- [Money domain engine (client)] react/src/lib/serverEngine.ts and the engine.generated.js bundle parity
- [Money domain engine (client)] Accounts.tsx running-balance rendering and the move-and-delete RPC math
- [Money domain engine (client)] Full latest definitions of record_loan_payment / whatsapp_approve_recurring SQL bodies (validations only skimmed)
- [Money domain engine (client)] notifications.ts budget_threshold logic (TD-39) and NetWorth.tsx remaining sections
- [Money domain engine (client)] The recurring month-end skip and UTC today() were checked by running the logic under Node in two time zones; nothing was run against the deployed app
- [State, offline cache and sync] react/src/lib/seed.ts and react/src/store/slices/modalSlice.ts not read in detail (demo data / UI slots, low sync relevance)
- [State, offline cache and sync] lib/__tests__/sync.test.ts, outbox.test.ts, cacheBoundary.test.ts and cacheInvalidation.test.ts were only grepped, not read in full
- [State, offline cache and sync] Did not verify the latest migration definitions of the replace_<entity> RPCs or the accounts/recurring touch triggers beyond confirming they use now()
- [State, offline cache and sync] Did not trace pages/Onboarding.tsx or App.tsx's onboarding gate end-to-end for the hydrateOnboardingFromCloud regression
- [State, offline cache and sync] Did not measure refresh/poll request volume (about 14 requests per 90s refresh observed from code, not profiled)
- [State, offline cache and sync] Service-worker caching (vite.config.ts) only checked to confirm the S5 fix (authorised responses are not cached)
- [State, offline cache and sync] Did not run any tests (read-only audit)
- [Money screens and entity forms] Chat.tsx lines 300-722 (rendering of turns, chips, copy), apart from a grep for raw HTML
- [Money screens and entity forms] Reports.tsx lower panels in full (member/account tables were only scanned)
- [Money screens and entity forms] components/charts/DonutCharts.tsx, PulseGauge.tsx and budgets/BudgetPaceChart.tsx internals (axis/time-zone correctness not verified)
- [Money screens and entity forms] CategoryPicker, Select/Input, HalfSheet/FormPage internals beyond close handling
- [Money screens and entity forms] Dead components found but not reported as findings: AccountDrawer, TrackPicker, PaymentMethodChip, PulseGauge and the charts/Charts.tsx barrel have no importers; splitAcrossAccounts/accountSplitRows state in TransactionFormModal is vestigial
- [Money screens and entity forms] Local (IndexedDB) adapter upsert merge semantics and the outbox dead-letter path were not read in full
- [Money screens and entity forms] e2e/unit tests covering these screens were not opened
- [Money screens and entity forms] Performance: virtualization of long transaction months and selector memoization were not profiled
- [Shell, settings, onboarding, accessibility] components/insights/EvergreenLearn.tsx, EvergreenReel.tsx (beyond role/animation grep), FlippableCardDetail.tsx, CardVisual.tsx
- [Shell, settings, onboarding, accessibility] components/help/HelpInfoButton.tsx and HelpTopicBody.tsx; lib/helpContent.ts read only by grep
- [Shell, settings, onboarding, accessibility] components/layout/TopBar.tsx, SubNav.tsx, MobileHeader.tsx, FloatingTools.tsx, HistoryRestoration.tsx, DemoBanner.tsx, PhonePushPrompt.tsx and SyncConflictBanner.tsx (only greps or partial reads)
- [Shell, settings, onboarding, accessibility] components/whatsapp/WhatsAppConnectSheet.tsx; components/households/ActivityRow.tsx; components/dev/FaultsPanel.tsx (confirmed DEV-only mount, not read)
- [Shell, settings, onboarding, accessibility] pages/Terms.tsx (not read), Cookies.tsx (grep only), ResetPassword.tsx lines 120-343 (UI), VerifiedAuth.tsx, GoogleButton.tsx, AuthGate.tsx (control flow grep only)
- [Shell, settings, onboarding, accessibility] lib/motion.ts, lib/evergreen.ts, lib/educationProgress.ts, lib/insightVideos.ts, lib/onboardingTemplates.ts, lib/appNavigation.ts (not opened beyond import checks)
- [Shell, settings, onboarding, accessibility] Contentsquare and Supabase dashboard settings (text masking, Secure password change, leaked-password protection) are not in the repo and could not be verified
- [Shell, settings, onboarding, accessibility] Runtime checks (axe, real screen reader, contrast measured in the browser): contrast ratios were computed by hand from the hex tokens in index.css
- [Pip / Ask Vyact client and server engine source] supabase/functions/_shared/agent/router.ts (sanitiseMessages, chatCompletion timeout and retry internals) and relay.ts in depth
- [Pip / Ask Vyact client and server engine source] whatsapp-webhook prevAllowed storage and the affordabilityCard path beyond the call site
- [Pip / Ask Vyact client and server engine source] computePulseScore: whether Pulse shares the annual-budget denominator defect (likely; not verified)
- [Pip / Ask Vyact client and server engine source] Pip-related layout components (FloatingTools beyond the mount check, CommandPalette, WhatsAppConnectSheet) and admin AI usage pages
- [Pip / Ask Vyact client and server engine source] Unit test files beyond targeted greps (askVyactFacts, askVyact, serverEngine tests not read in full)
- [Pip / Ask Vyact client and server engine source] Full byte-level diff of engine.generated.js against sources (spot-checked only; relying on the --check gate)
- [Platform: auth, PWA, headers, build config] npm audit / lockfile vulnerability review (TD-38); needs a registry call
- [Platform: auth, PWA, headers, build config] Contentsquare and Userback project-side masking and recording settings (vendor consoles); these decide the real exposure of the session-replay finding
- [Platform: auth, PWA, headers, build config] Supabase Auth dashboard settings (Secure password change, rate limits, redirect allowlist, leaked-password protection)
- [Platform: auth, PWA, headers, build config] UpdateBanner / InstallBanner / GoogleButton / VerifiedAuth bodies beyond the navigation calls
- [Platform: auth, PWA, headers, build config] react/api/* public-page handlers beyond the JSON-LD serializer
- [Platform: auth, PWA, headers, build config] Admin app source beyond its sign-in call and vercel.json
- [Platform: auth, PWA, headers, build config] Runtime check of the ResetPassword double PKCE exchange (detectSessionInUrl plus a manual exchangeCodeForSession); suspected confusing error state, not confirmed so not reported
- [Public site, serverless API and pre-render] Live Vercel behaviour was not exercised: how rewrite params are decoded, whether the CDN caches non-200s or stale-while-revalidate responses, the platform maxDuration default. These were reasoned from config only.
- [Public site, serverless API and pre-render] Every one of the 116 LESSON_SEO answers was not fact-checked against its lesson body, because the bodies live in the production DB, not the repo.
- [Public site, serverless API and pre-render] react/scripts/capture-help.mjs, check-ui-pilot.mjs, serve-dist.mjs and lighthouse-budget.mjs were not read (dev/CI-only tooling).
- [Public site, serverless API and pre-render] The admin CMS write path (admin/src/pages/Content.tsx) was only grepped. Server-side validation of content fields beyond the DB CHECKs listed was not audited in full.
- [Public site, serverless API and pre-render] The rest of the anon RLS surface (non-content tables) was spot-checked only via the 20260909150000 lock-down; it belongs to the database slice.
- [Public site, serverless API and pre-render] The SW runtime cache rule for Supabase REST (cacheWillUpdate checks only Authorization) was noticed but not traced; it is out of this slice.
- [Admin application (admin.vyact.app)] Content.tsx card visual editor middle section (≈300-395, 420-555) and CardVisualPreview.tsx were skimmed for injection sinks only (no dangerouslySetInnerHTML found), not read line by line
- [Admin application (admin.vyact.app)] Dashboard.tsx and Intelligence.tsx rendering below the first ~120 lines
- [Admin application (admin.vyact.app)] Dependency vulnerability audit: npm audit was not run (read-only); package-lock.json not inspected
- [Admin application (admin.vyact.app)] Live Supabase settings that the repo does not hold (actual PostgREST max-rows, Auth MFA configuration, Google OAuth redirect allow-list, storage bucket limits set via dashboard) — findings that depend on them are marked medium confidence
- [Admin application (admin.vyact.app)] Whether Supabase Storage serves user-supplied text/html or image/svg+xml with that content type (affects the infographic-bucket sub-point)
- [Admin application (admin.vyact.app)] Edge functions (none reference admin_roles/is_admin) and react/api pages other than learn.js/_page.js
- [ask-vyact gateway and agent service] engine.generated.js bulk and react/src/lib/serverEngine.ts / askVyactBackend resolve() internals (facts and names egress were checked only at the payload-assembly level)
- [ask-vyact gateway and agent service] _shared/agent/classify.ts, grammar.ts, resolver.ts, dedupe.ts, ambiguity.ts read only via the pipeline call sites (unwired, test-only)
- [ask-vyact gateway and agent service] router.test.ts and agentRelay.test.ts not read in full
- [ask-vyact gateway and agent service] Live DB state (which ai_model_configs row is enabled, whether the relay row is still enabled, the actual ASK_VYACT_DAILY_CALL_CAP value) cannot be verified from the repo
- [ask-vyact gateway and agent service] Supabase Auth settings (email confirmation, anonymous sign-ins, CAPTCHA), which determine how cheaply accounts can be multiplied for the cost-abuse finding
- [ask-vyact gateway and agent service] whatsapp-send-otp membership check at link time not opened
- [WhatsApp integration (webhook, OTP, notify, dispatch)] supabase/functions/_shared/agent/engine.ts / engine.generated.js / assistantCore.ts (answerOnServer, renderForWhatsApp, serverModelCall metering and daily cap): only treated as a black box
- [WhatsApp integration (webhook, OTP, notify, dispatch)] Remaining body of whatsapp-templates.ts per-template copy (checked names/params/categories only) and whatsapp-receptionist.ts menu replies beyond line 60
- [WhatsApp integration (webhook, OTP, notify, dispatch)] _shared/money/calculations.ts beyond the reportable/spend/effective functions (account balance, asset value, EMI split parity)
- [WhatsApp integration (webhook, OTP, notify, dispatch)] Older superseded migrations (20260810120000, 20260906130000, 20260910180000) beyond confirming that r4 is the latest whatsapp_log_transaction
- [WhatsApp integration (webhook, OTP, notify, dispatch)] The React-side WhatsApp settings UI (link/unlink, preferences RPC callers) and whether leaving a household prompts an unlink
- [WhatsApp integration (webhook, OTP, notify, dispatch)] Runtime verification: no DB or Edge execution was performed (read-only), so the replay, OTP race and NULLS FIRST behaviours are established from code and Postgres/PostgREST semantics, not from a live reproduction
- [Other Edge Functions (delete-account, email, web-push)] Did not verify live Supabase dashboard settings (auth SMTP, verify_jwt on the manually deployed delete-account and send-split-email); conclusions there rely on repo docs.
- [Other Edge Functions (delete-account, email, web-push)] Did not check whether denomailer 1.6.0 sanitises CRLF in the subject/from (possible header injection via full_name on the SMTP transport).
- [Other Edge Functions (delete-account, email, web-push)] Did not open public/push-sw.js (service worker display, notificationclick URL handling) or the full register flow in lib/webPush.ts.
- [Other Edge Functions (delete-account, email, web-push)] Did not re-audit the later erase_household_data fix (20260908120200_audit_s6_erase_onboarding_fix.sql) or transfer_ownership's latest definition.
- [Other Edge Functions (delete-account, email, web-push)] Did not inspect storage buckets (attachment_url) for objects left behind after deletion.
- [Other Edge Functions (delete-account, email, web-push)] Did not confirm whether *.notify.windows.com / *.push.apple.com have wildcard DNS (this decides whether the unresolvable-endpoint DoS is attacker-triggerable or only transient).
- [RLS, grants, SECURITY DEFINER, tenant isolation] db/schema.sql was not diffed line by line against the migrations (only its header and greps); db/migrations-superseded/ was not read
- [RLS, grants, SECURITY DEFINER, tenant isolation] Production state could not be verified: the claims that the upsert_budget guard and migration_issues RLS exist in prod rest on the v9.5.0 comment and TD-42, not on introspection
- [RLS, grants, SECURITY DEFINER, tenant isolation] Edge Functions were read only where needed to prove a DB-layer claim (web-push, parts of whatsapp-webhook and whatsapp-send-otp); delete-account, ask-vyact, whatsapp-dispatch and whatsapp-notify authorization were not audited
- [RLS, grants, SECURITY DEFINER, tenant isolation] 20260620120100_insights_hub_seed_cards.sql seed content and 20260906140000 seed rows were only skimmed; the r1/r2/r4 data-migration arithmetic was not re-verified
- [RLS, grants, SECURITY DEFINER, tenant isolation] Realtime publication authorization (budgets, budget_allocations) and Supabase Auth settings (sign-up, email confirmation, MFA) were not checked
- [RLS, grants, SECURITY DEFINER, tenant isolation] The exact cascade-trigger firing order for household delete vs transactions.asset_id ON DELETE RESTRICT was not verified empirically
- [Constraints, RPC atomicity and money correctness in SQL] The full bodies of the earlier redefinitions of whatsapp_log_transaction (S1 and backdate versions); only the latest R4 definition was audited
- [Constraints, RPC atomicity and money correctness in SQL] audit_a2 (AI quota), audit_a4 (durable inbox), agent_ingestion_state, ai_model_configs, web_push, w2/w4/w5 preference RPCs, ai_feedback, learn_public_read
- [Constraints, RPC atomicity and money correctness in SQL] v98 privacy controls apart from erase (deactivate/request_account_deletion bodies)
- [Constraints, RPC atomicity and money correctness in SQL] Client store write paths (crudSlice/reconcileSlice/recurringSlice approveRecurring) beyond spot checks; the outbox resurrection of soft-deleted deterministic recurring rows was not traced
- [Constraints, RPC atomicity and money correctness in SQL] Live production pg_get_functiondef and constraint state; the upsert_budget guard drift and the activity_log CHECK should be confirmed against production
- [Constraints, RPC atomicity and money correctness in SQL] The negative-UTC-offset behaviour of the client computeNextDueDate could not be reproduced (TZ env not honoured by node on this Windows host); only the UTC month-end overflow was verified
- [Schema evolution, performance and operations] Not every function body was read line by line. Skimmed or not read: record_loan_payment and correct_loan_payment_contract, r2 delete_account/move_account_and_delete, r3 payment_mode, w2b approve_recurring, w4/w5/w6 WhatsApp RPCs, S3 tenant-consistency trigger bodies, v8 onboarding/provenance, insights hub seed and content migrations, learn_public_read, the ai_model_configs seed, split_participant_name_resolution, fix_shareable_invite_accept_rpc.
- [Schema evolution, performance and operations] Not verified against the live database (read-only, no DB access). The activity_log CHECK in erase, the prod-only upsert_budget guard, the presence of migration_issues RLS, the prod FK definitions and the vyact-test cron state should each be confirmed with a rolled-back DO block or catalog query on production and on vyact-test.
- [Schema evolution, performance and operations] Did not inspect .github/workflows/deploy-test-functions.yml or nonprod-db.yml in depth, or the Supabase plan/PITR settings (not in the repo).
- [Schema evolution, performance and operations] The db/schema.sql diff against production was not run; only the in-repo concatenation check passed.
- [Client to DB to Edge contracts] The whatsapp_log_transaction / whatsapp_approve_recurring / whatsapp_undo_last / whatsapp_correct_last RPC bodies were read for the account/category matrix but not exhaustively diffed against every parser field (p_payment_mode handling verified; conversation-capture turns only skimmed).
- [Client to DB to Edge contracts] Edge handler request-body parsing beyond ask-vyact and send-split-email (whatsapp-notify, whatsapp-dispatch, web-push server-side, whatsapp-send-otp/verify-otp) was not traced argument-by-argument against each RPC signature.
- [Client to DB to Edge contracts] admin/src write paths (content CMS, admin_set_role) were not opened — only the read fetchers in adminApi.ts.
- [Client to DB to Edge contracts] The reserve_ai_usage RPC signature and ai_usage/ai_feedback column shapes were not diffed against the Edge inserts (metering seam).
- [Client to DB to Edge contracts] realtime subscription payload mapping (lib/realtime.ts) for budgets/budget_allocations was not reviewed for row-shape parity with the adapters.
- [Client to DB to Edge contracts] Exact Deno engine.generated.js vs serverEngine.ts parity (bundle staleness) was out of this slice's reach; only the recurring/category/payment-mode allowlists were compared.
- [Server/browser logic parity and generated code] Full body of askVyactBackend.ts resolve() intents beyond the clock and rate helpers; aiSummary.ts and netWorth.ts read only through their bundled use
- [Server/browser logic parity and generated code] whatsapp-dispatch-rules vs bundle parity for paydayAlerts / monthClose / reengagement beyond reading the rules
- [Server/browser logic parity and generated code] Full moneyPortParity.test.ts fixture assertions (34 cases) — only the header and fixtures were read
- [Server/browser logic parity and generated code] whatsapp-followups.ts, whatsapp-conversation.ts, whatsapp-template-replies.ts beyond a scan for money logic
- [Server/browser logic parity and generated code] Deno-runtime behaviour itself (no Deno available; differences inferred from code, not executed)
- [Server/browser logic parity and generated code] ask-vyact gateway (supabase/functions/ask-vyact) and the relay — outside this slice
- [Server/browser logic parity and generated code] billCalendar.ts interplay with the month-end clamp/skip rules (inferred from rrule.ts and recurring.ts, not traced through the UI)
- [End-to-end: the life of a transaction] record_loan_payment SQL body (20260908120300 / 20260909140000) not re-read line by line; relied on its documented contract and the client wrapper
- [End-to-end: the life of a transaction] whatsapp_name_entries / whatsapp_reconcile_account (W6) and replace_* RPCs (TD-09) not audited
- [End-to-end: the life of a transaction] components/transactions/{TxnCalendar,AccountDrawer,TrackPicker,PaymentMethodChip,TxnRow beyond amount display}.tsx not read in full
- [End-to-end: the life of a transaction] reconcileSlice, cloudAuthSlice, cacheInvalidation/kvStore internals not traced
- [End-to-end: the life of a transaction] Ask Vyact capture seeds and serverEngine paths into transactions not traced
- [End-to-end: the life of a transaction] No tests or SQL were executed (read-only); the 'daily' CHECK finding assumes production matches the captured baseline and that no out-of-band DDL relaxed the constraints; the commit-order cursor race is reasoned, not reproduced
- [End-to-end: identity, households and membership] react/src/components/households/ActivityRow.tsx and lib/activityFormat.ts were only skimmed; whether activity_log row JSON exposes anything beyond what members can already read was not fully assessed.
- [End-to-end: identity, households and membership] The live Supabase Auth settings (email confirmation, secure email change) are not in supabase/config.toml, so my_email()'s 'verified email' assumption was not confirmed against the dashboard.
- [End-to-end: identity, households and membership] ask-vyact gateway membership enforcement and the in-app Pip path (another slice).
- [End-to-end: identity, households and membership] Recurring schedules and push-subscription cleanup on member removal were checked only through FK actions (owner_member_id set null) and the web-push membership filter, not end to end.
- [End-to-end: identity, households and membership] admin_list_users and the other admin RPCs beyond the baseline definitions; admin role-granting flows.
- [End-to-end: identity, households and membership] Supabase tests directory (only household_delete_activity_log_regression.sql exists) and e2e specs for households and invites were not executed (read-only audit).
- [End-to-end: time zones, dates and currency] askVyactBackend resolvePeriod / spendBasis month logic in depth (only its nowMonthKey use was confirmed)
- [End-to-end: time zones, dates and currency] lib/netWorth.ts computeNetWorth conversion of assets/debts in other currencies
- [End-to-end: time zones, dates and currency] lib/budgetTrends.ts and essentialRunway.ts completed-month boundaries
- [End-to-end: time zones, dates and currency] Budget allocation currency after a base-currency change (budgets.currency vs base)
- [End-to-end: time zones, dates and currency] whatsapp_correct_last / whatsapp_undo_last and pending-turns date handling
- [End-to-end: time zones, dates and currency] supabaseAdapter row mappers for date/timestamptz fields
- [End-to-end: time zones, dates and currency] Admin app date handling
- [End-to-end: time zones, dates and currency] Playwright/vitest TZ configuration beyond TECH_DEBT's note that e2e runs TZ=UTC
- [CI/CD, release, environments, observability, test strategy] Did not read other Playwright configs (category/corrective/finance/help) or the e2e README/E2E_RUNBOOK/REVIEW_CHECKLIST in depth
- [CI/CD, release, environments, observability, test strategy] Did not read react/middleware.js or react/api/* beyond vercel.json routing (public-pages slice)
- [CI/CD, release, environments, observability, test strategy] Did not read Lane B fixtures.ts, constraints.spec.ts, write-not-applied.spec.ts or account-patch.spec.ts in full
- [CI/CD, release, environments, observability, test strategy] Could not verify Vercel dashboard env scopes, GitHub environment protection rules, default GITHUB_TOKEN permissions or the Supabase plan/PITR from the repo; the preview-isolation and token-scope findings name the external check that would confirm them
- [CI/CD, release, environments, observability, test strategy] Did not verify Supabase CLI 1.226.4's exact transaction handling of files with explicit BEGIN/COMMIT (partial-apply risk stated with caveat)
- [CI/CD, release, environments, observability, test strategy] Did not read docs/TEST_GOVERNANCE.md, db/MIGRATIONS.md, docs/HANDOFF.md or scripts/build-agent-engine.mjs in full
- [CI/CD, release, environments, observability, test strategy] Did not audit the admin app's own CI coverage beyond the gates listed in automation-run.mjs
- [Secrets, PII and privacy compliance] Live production state: whether the leaked sb_secret_ key or Google OAuth secret has been revoked, which ai_model_configs row is enabled, OpenRouter account privacy settings, Contentsquare masking configured in its dashboard, and Supabase region; none can be verified read-only from the repo.
- [Secrets, PII and privacy compliance] Full contents of react/playwright-report*/index.html and every automation-runs/*/logs file were pattern-scanned (keys, emails, phones) but not read line by line; screenshots inside them were not viewed.
- [Secrets, PII and privacy compliance] Admin app (admin/) PII surfaces and admin_list_users RPC exposure were not audited in depth.
- [Secrets, PII and privacy compliance] Full git history scan for every secret format was limited to high-signal regexes (sb_secret_, PRIVATE KEY, JWT, EAA, sk-, AIza, ghp_, github_pat_, re_, sbp_, GOCSPX-, postgres:// with password); binary/LFS blobs not scanned.
- [Secrets, PII and privacy compliance] whatsapp-notify, web-push, ask-vyact gateway and ask_vyact_relay (TD-44) handlers were only partially read for logging; their authz is left to other slices.
- [Secrets, PII and privacy compliance] .wt-seo worktree copy was scanned by pattern only (it mirrors the main tree with older content).
- [Architecture, maintainability and AI-assisted development risk] Per-migration RLS/policy correctness (only counted; latest-definition audit of each policy left to the security slice)
- [Architecture, maintainability and AI-assisted development risk] admin/src beyond the visual kit and structure (auth, adminApi data loading)
- [Architecture, maintainability and AI-assisted development risk] react/api public pages and middleware.js internals
- [Architecture, maintainability and AI-assisted development risk] ask-vyact gateway router.ts/index.ts internals (token caps, relay) beyond the docs
- [Architecture, maintainability and AI-assisted development risk] HybridAdapter and lib/sync queue mechanics (F6/F8 status not re-verified)
- [Architecture, maintainability and AI-assisted development risk] Full read of askVyactBackend.ts facts/resolve branches and the PHRASE_SYSTEM contract
- [Architecture, maintainability and AI-assisted development risk] e2e spec contents beyond Lane B counts and one Lane A precondition
- [Architecture, maintainability and AI-assisted development risk] Whether send-split-email/delete-account were deployed by hand in production (needs Supabase dashboard access)

## Appendix A — Refuted findings (kept for transparency)

Raised by an auditor, then refuted by adversarial verification. Listed so they are not re-raised without new evidence.

| ID | Raised as | Title | Why refuted |
|---|:---:|---|---|

## Appendix B — Audit slices

| Slice | Area | Files read (approx) | Raised | Kept |
|---|---|---:|---:|---:|
| Money domain engine (client) (FE-MNY) | Frontend | 48 | 16 | 16 |
| State, offline cache and sync (FE-SYN) | Frontend | 34 | 13 | 13 |
| Money screens and entity forms (FE-UIC) | Frontend | 52 | 18 | 18 |
| Shell, settings, onboarding, accessibility (FE-UIS) | Frontend | 58 | 16 | 16 |
| Pip / Ask Vyact client and server engine source (FE-PIP) | Frontend | 30 | 18 | 18 |
| Platform: auth, PWA, headers, build config (FE-PLT) | Frontend | 48 | 11 | 11 |
| Public site, serverless API and pre-render (FE-PUB) | Frontend | 38 | 11 | 11 |
| Admin application (admin.vyact.app) (ADM) | Admin | 44 | 14 | 14 |
| ask-vyact gateway and agent service (BE-PIP) | Backend | 32 | 7 | 7 |
| WhatsApp integration (webhook, OTP, notify, dispatch) (BE-WA) | Backend | 34 | 13 | 13 |
| Other Edge Functions (delete-account, email, web-push) (BE-FN) | Backend | 32 | 12 | 12 |
| RLS, grants, SECURITY DEFINER, tenant isolation (DB-SEC) | Database | 105 | 13 | 13 |
| Constraints, RPC atomicity and money correctness in SQL (DB-INT) | Database | 38 | 15 | 15 |
| Schema evolution, performance and operations (DB-OPS) | Database | 48 | 16 | 16 |
| Client to DB to Edge contracts (INT-CON) | Integration | 45 | 7 | 7 |
| Server/browser logic parity and generated code (INT-PAR) | Integration | 38 | 11 | 11 |
| End-to-end: the life of a transaction (INT-TXN) | Integration | 38 | 16 | 16 |
| End-to-end: identity, households and membership (INT-HH) | Integration | 38 | 14 | 14 |
| End-to-end: time zones, dates and currency (INT-TZC) | Integration | 38 | 8 | 8 |
| CI/CD, release, environments, observability, test strategy (OPS) | Platform & Ops | 48 | 13 | 13 |
| Secrets, PII and privacy compliance (XC-PRV) | Cross-cutting | 62 | 14 | 14 |
| Architecture, maintainability and AI-assisted development risk (XC-ARC) | Cross-cutting | 58 | 15 | 15 |

## Appendix C — Remediation status by finding (updated 25 Oct 2026)

Baseline: `main` 5dc208a (consumer v10.84.0, admin v1.4.4), updated for v10.132.0. See §0 for the method, the summary, the conflicts and the action plan.

### C.1 Unresolved (25)

| ID | Sev | Status | PRs | What is left | Blocker | Effort |
|---|---|---|---|---|---|---|
| OPS-01 | high | Partly | v10.128.0 | v10.128.0 (Track Q1; owner decision D8, 20 Oct 2026: "Actions deploys the app last"): Deploy runs migrations → Edge Functions → promote-apps; scripts/promote-app.mjs promotes Vercel's staged production build of this commit for vyact and vyact-admin, so an app never goes live before its schema, and a failed migration keeps the previous app live. Left: the owner adds VERCEL_PROMOTE_TOKEN and turns "Auto-assign Custom… | Owner: VERCEL_PROMOTE_TOKEN + auto-assign off | S |
| XC-PRV-03 | high | Partly | #165, #189, v10.125.0, v10.132.0 | v10.125.0 asked first for GA4; v10.132.0 / admin v1.6.0 (Track Q4; owner decision D9, 20 Oct 2026): Userback never loads on localhost, a .test host or the demo (on in the Android app). Left for the owner: confirm in Userback that session replay, console capture and auto-screenshot are off. | Owner: confirm the Userback settings (replay, console capture, auto-screenshot off) | M |
| Q-AUTH-01 | high | Partly | v10.128.0 | v10.128.0 records the target (site_url https://vyact.app; allow-list vyact.app/**, www.vyact.app/**, vyact://auth-callback) in supabase/auth-config.json; each Deploy warns until it is live. Left: the owner changes it in the Supabase dashboard, then the check goes --strict. | Owner: Supabase Auth URL configuration | XS |
| Q-AUTH-02 | high | Partly | v10.128.0 | Recorded target: a real SMTP sender (MailerSend or Resend, as split email uses) at 30 an hour. Left: the owner sets custom SMTP in the dashboard; smtp_host is recorded once chosen. | Owner: custom SMTP | XS |
| FE-PLT-04 | medium | Partly | #188, #189, v10.125.0 | v10.125.0 (Track T4b; owner decisions 19 Oct 2026) ("collect reports, then enforce"): vyact.app's report-only policy now reports to /api/csp-report (report-uri + Reporting-Endpoints), which logs the directive, the blocked host and the page path only. T4B-008. Left: switch to an enforced Content-Security-Policy after about a week of clean reports. | Track Q8: enforce after the report week (from 26 Oct) | XS |
| FE-UIC-10 | medium | Partly | #186 | Dot-grouped, comma-decimal input ('1.234,56', '1.234') is still read about 1000x too small. This is silent in the account opening balance, card limit and reconcile fields. The parser does not use the locale or the household currency's convention, which the audit recommended (Intl.NumberFormat parts). Add the audit's '1.234,56' test case. | Track Q5 | S |
| FE-UIC-12 | medium | Partly | #178, #179 | Remove (or redirect to Add account) the cash, checking and savings asset types, and define 'free to spend' once: the Accounts summary should read the same projection as Net Worth and Pip, stating whether archived accounts count. Add a fixture test: Accounts spendable == Net Worth/Pip free-to-spend. | Track Q5: remove the cash/checking/savings asset types (owner) | S |
| FE-UIS-03 | medium | Partly | #170 | The currency part is fixed (a re-run keeps the household currency). A re-run can still duplicate bill schedules, and the wiring is neither idempotent nor atomic. | Track Q5 | S |
| INT-HH-08 | medium | Partly | #183, v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): database half: profiles.language is null until the person picks one (null follows the household); the stored default was cleared. Left: the app reads and writes the person's own language, and shows owner-only settings read-only (Q5). | Track Q5: per-person language and read-only settings in the app | S |
| OPS-05 | medium | Partly | #189, v10.131.0 | v10.84.0 fenced consumer previews; admin v1.5.0 / v10.131.0 (Track Q3b; owner decisions 20 Oct 2026) fences admin previews (ADM-09). Left for the owner: scope vyact-admin's production Supabase env to Production and give Preview the vyact-test values. | Owner: scope the vyact-admin Vercel env (Production / Preview) | XS |
| OPS-11 | medium | Partly | #168 | The per-user cap now fails closed (parseDailyCallCap: only "off" disables it). A global LLM spend ceiling is backlog (owner: not now). | Track Q7: global daily ceiling (owner brought it in from backlog) | S |
| XC-PRV-11 | medium | Partly | #165, #166, #167, v10.125.0 | v10.125.0 (Track T4b; owner decisions 19 Oct 2026): Privacy adds the DPDP section (rights, nomination, Grievance Officer, Data Protection Board), a processor list with regions, withdrawal of optional processing in Settings (analytics), §10 breach and §12 18+ only (no child accounts; Terms too). SECURITY.md has the breach runbook (DPDP Board, 72 hours, GDPR). POLICY_VERSION bumped with re-consent (XC-PRV-09). T4B-006… | Owner: legal entity, address, Grievance Officer, Supabase region | M |
| FE-MNY-08 | medium | Open | — | Decide the split money model: (a) the paying account drops by the full bill; (b) the others' shares become a receivable, and the owner chooses where it shows (Net Worth, Pip, free-to-spend); (c) settling moves money back into a named account. Then implement it with a money-model invariant (an account drops by the full amount; settling restores the share) and update the golden file deliberately. | Track Q6: full debit + Owed to you (owner) | L |
| FE-UIS-07 | medium | Open | — | NotificationSheet, HouseholdSheet, AccountMenu and CommandPalette still have no focus trap or focus return. They do not use AccessibleDialog (Radix), even after Aurora #190–#192. | Track Q5 | M |
| XC-ARC-05 | medium | Open | — | Restructure CLAUDE.md and freeze old docs? (W8 §3) | Track Q8: fix the stale lines, then close (owner) | S |
| BE-FN-11 | low | Partly | #165, v10.123.0, v10.126.0, v10.128.0 | v10.126.0 (T4c) built the snapshot and the drift check; v10.128.0 (Q1) recorded the 29 live values with the owner's decisions (Q-AUTH-01..04). Left: --strict once the dashboard matches (Q-AUTH-01/02). | Owner: Q-AUTH-01/02 in the dashboard, then --strict | S |
| BE-PIP-04 | low | Partly | #187 | A learned recipe is deterministic only when trusted (#187). No confirmation or promotion flow was built; the pipeline is not connected to any entrypoint, so nothing is exposed today. | Track Q8 (parked with XC-ARC-07) | S |
| INT-HH-13 | low | Partly | #184 | Purge the exited household's cache entries and delta cursors. Route to Households/create when no household remains after a leave. | Track Q5 | XS |
| OPS-07 | low | Partly | #189 | `permissions: contents: read` is on every workflow. Left: a separate Supabase token or environment for vyact-test deploys (owner). | Owner: separate token | XS |
| FE-MNY-12 | low | Open | — | Either refuse to archive an account with a non-zero balance (offer move or transfer first), or count archived balances the same way on every surface and label them. Add the test from the finding. | Track Q5: the archive guard (database) ships with its dialog (app), so no one meets a bare error | S |
| FE-MNY-13 | low | Open | — | Add an explicit 'in credit' toggle on card reconcile that passes a positive balance through. Keep INV-11 for the default 'owed' case. Test: 'in credit 2,000' gives balance +2,000, outstanding 0, liquidity 'short'. | Track Q5: card "in credit" (owner) | S |
| FE-SYN-13 | low | Open | — | On sign-in, discard local-only data (and delete the dead import), or import it? (W8 §3) | Track Q5: delete the dead import (owner) | S |
| BE-PIP-06 | low | Open | — | Owner, 13 Oct: keep the Claude Code relay for now (TD-44). | Track Q7: retire the relay (owner) | S |
| XC-ARC-07 | low | Open | — | Park or delete the dormant SMS/agent pipeline? (W8 §3) | Track Q8: park the dormant pipeline (owner) | M |
| XC-ARC-15 | low | Open | — | Move tracked binaries and duplicate handoffs out of the repo? (W8 §3) | Track Q8: clean up; binaries to release assets (owner) | S |

### C.2 Resolved, but to be confirmed in production (16)

| ID | Sev | Status | PRs | Check |
|---|---|---|---|---|
| XC-PRV-01 | critical | Closed (decision) | #165 | (1) Confirm in production that the old key returns 401. The repo cannot prove revocation. (2) Rotate the Google OAuth client secret: vyact-master-todo.md:131 (untracked) still lists item #2 as Open. (3) No review of Supabase API/auth logs since 2026-05-10 is recorded anywhere. (4) Optional: a pre-commit hook. The scanner reads tracked files at the tip only,… |
| FE-MNY-01 | high | Closed | #172, #173 | Data follow-up only. Before v10.69.0, the form's weekday, annual date, nth weekday and COUNT were never stored. The W3d backfill derived each old schedule's rule from its columns (start date = creation day). So a weekly or yearly schedule created before 7 Oct 2026 still fires on the wrong day until the user re-saves it. A production query (weekly/yearly or… |
| BE-FN-02 | high | Closed (decision) | #167 | Requests scheduled before v10.63.0 were never executed. If one of those users signs in, the request is still silently erased ('Welcome back'). Do this in production: list them (select id, deletion_requested_at, deletion_scheduled_for from profiles where deletion_requested_at is not null) and run purge_account plus the auth delete after the owner confirms (P… |
| INT-HH-03 | high | Closed | #167 | Operational only (PR #167 owner checks): confirm production JWTs carry amr timestamps, otherwise every delete and erase is refused as reauth_required. Process the pre-v10.63 users who chose the old 30-day 'scheduled deletion'; nothing deletes them automatically. |
| INT-TZC-02 | high | Closed (decision) | #170 | Before release, count rows in production whose currency label differs from their household's (PR #170 owner check). They now count at face value. |
| FE-UIC-06 | medium | Closed | #178, #179, #183 | Production check, shared with FE-MNY-04: a household with a loan account orphaned before v10.74.0 would see the Net Worth total exceed the Debts total, because Debts lists live debts only. |
| ADM-03 | medium | Closed | #166, v10.92.0, v10.93.0 | Done (owner decision 13 Oct): admins see who, when and what, never the values. v10.92.0 added admin_activity_feed (no `changes`); v10.93.0 / admin v1.4.5 moved the Audit page and its CSV onto it and made activity_log_read members only (every admin read policy swept). A SQL test confirms that a non-member admin reads 0 rows from the table. |
| INT-TZC-04 | medium | Closed | #169 | Production check (PR #169): cron.job shows '0,30 * * * *' for the whatsapp-dispatch jobs. Remove the unused VYACT_TZ_OFFSET_MINUTES secret. |
| INT-TZC-07 | medium | Closed (decision) | #170 | Count legacy foreign-labelled rows in production; they now count at face value (USD 120 becomes ₹120), per the #170 owner check. Remove the inert rate plumbing (TD-45) and later drop the exchange_rates table (plan backlog item 'drop the rates table'). |
| XC-PRV-02 | medium | Closed | #165 | (1) Production check in GA4 DebugView: confirm that enhanced-measurement history-change page_views keep the redacted value. The concrete case is /invite/<token> followed by a click to /auth/sign-in?next=%2Finvite%2F<token>, an SPA navigation from AcceptInvite.tsx:79-91. If they do not keep it, turn off 'page changes based on browser history events' or redac… |
| XC-PRV-04 | medium | Closed | #167 | Confirm that production JWTs carry amr with timestamps. PR #167 asked the owner to check this before merging. If they do not, every erase and delete is refused. |
| XC-PRV-07 | medium | Closed | #167 | Confirm that the 'whatsapp-retention' job exists and runs in production (cron.job / cron.job_run_details). |
| FE-PUB-05 | low | Closed | #189 | see PR |
| FE-PUB-06 | low | Closed | #189 | Possible small residual: the recommendation text in the report is cut off ('Use the build time (or the copy's last-cha…'). If it meant sitemap lastmod, /about, /for/* and /private still report the request date (react/api/sitemap.js:21-26). |
| FE-PUB-07 | low | Closed | #185, #189 | see PR |
| ADM-13 | low | Closed | #188, #189 | see PR |

### C.3 Resolved, with a residual note (108)

| ID | Sev | Status | PRs | Note |
|---|---|---|---|---|
| DB-SEC-01 | critical | Closed | #166 | Production check: rpc("replace_memberships") should return "function not found". |
| FE-MNY-04 | high | Closed | #178, #179, v10.102.0 | v10.102.0 (Track E, E7; owner decisions E-8 and 14 Oct 2026): (1) migration 20261024120000 clears every live loan account LINKED to a deleted loan as mark_loan_paid_off does (offset + dated log, kind loan, never a transaction) and archives it; net worth loses the phantom debt. A loan account with NO link is left alone… |
| FE-PIP-01 | high | Closed | #182 | Owner decision P1: an annual line gets no monthly verdict and Pip points to Budgets (the audit had recommended measuring it over its own window). The Dashboard panel half is tracked under FE-MNY-06 / FE-UIC-08. |
| FE-PUB-01 | high | Closed | #165, #166, v10.92.0, v10.93.0 | Done: the Private toggle copy (#165, D21); admins no longer read household values (#166 for the ledger, v10.92.0 + v10.93.0 for activity_log); Privacy says staff can see that an action happened, never its amounts, names or descriptions (v10.93.0, owner decision 13 Oct). The public FAQ lines (about.js, for.js, llms.js)… |
| FE-UIS-02 | high | Closed (decision) | #165 | D23: two-factor auth was removed for consumer and admin (accepted risk, partly mitigated by D24). |
| ADM-01 | high | Closed | #165 | Defence in depth only. content_items.category and slug still have no CHECK (only source_url has one). The source_url CHECK is NOT VALID, so existing rows were never validated. The vyact.app CSP is Report-Only and allows 'unsafe-inline' scripts (react/vercel.json:105), so it would not block an injected inline script. E… |
| ADM-02 | high | Closed (decision) | #165 | The session-limit half has no decision: there is no admin inactivity sign-out and no short refresh-token lifetime. Ask the owner whether to add one as a cheap compensating control, since MFA is not used. |
| BE-FN-07 | high | Closed | #165, v10.116.0 | W0 (#165) stopped one endpoint aborting the run. v10.116.0 (Track T2b-2) finished the hardening list: exact push hosts (web.push.apple.com, wns2-*.notify.windows.com) in isPushEndpoint and register_push_subscription; at most 10 live devices a person (an 11th retires the least recently used); an oversize payload is sho… |
| DB-SEC-03 | high | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): upsert_budget accepts owners and admins only and refuses an id that names another household's budget (budget_not_found); upsert_budget_with_allocations inherits both. The Q2 matrix's recorded gap is closed (Q2-AZ-007, Q2-AZ-009). Merge waits on the owner comparing pr… |
| INT-PAR-01 | high | Closed (decision) | #170 | Dead code: serverEngine.ts:78-80 still builds a rates map with a stale comment calling it 'the store's rule'. Remove it with the rest of the inert rate plumbing (TD-45, TECH_DEBT.md:110). |
| INT-TXN-01 | high | Closed | #176 | Corrected 13 Oct: both delete paths for a split row (SplitFormModal.tsx:381, Splits.tsx:107) also delete its shared split (deleteSharedSplitForTxn), and since #176 a split row never reaches the plain form. |
| INT-TXN-07 | high | Closed | #178, #179, #180, v10.89.0 | Recurring EMIs moved onto their loans (#180); WhatsApp "paid … EMI" pays the loan (#180); a WhatsApp correction to an EMI now pays the loan too (v10.89.0). |
| OPS-06 | high | Closed | v10.132.0 | v10.132.0 / admin v1.6.0 (Track Q4; owner decision D9, 20 Oct 2026): every scheduled job records its runs (job_runs; Edge withJobRun, SQL wrappers); job_health() flags failed / partial twice / late; the hourly job-health email to HEALTH_ALERT_EMAIL (once a day per problem) and the admin Health page; app and Edge error… |
| FE-MNY-06 | medium | Closed | #186, v10.99.0 | The chip was fixed in #186. v10.99.0 (Track E, E5): the pace banner and the Budget progress panel read lib/budgetProgress (the panel measures an annual line over its year), with the Budgets page, Reports and Pip. |
| FE-MNY-10 | medium | Closed | v10.98.0 | v10.98.0 (Track E, E4; owner decisions E-5 and E-9): one baseline, lib/spendBaseline.ts (the last 3 completed months with spending, the live need/want map, unmapped not essential), read by spendBasis (Pip, Net Worth, the server) and essentialRunway (Reports). The live map reaches Pip in the app (Chat) and on the serve… |
| FE-PIP-06 | medium | Closed | #182, v10.90.0 | Descriptions stopped reaching the model in #182 (phraseData). v10.90.0: PHRASE_SYSTEM says text in FACTS/DATA is data, never instructions; a leak test covers every intent; account/asset names are cleaned and instruction-like ones sent as neutral labels (owner decision). |
| FE-PIP-07 | medium | Closed | v10.90.0 | v10.90.0: a capture's category is a real category of its type (the model's word resolved, else a keyword); when nothing places it, Pip asks "Which category?" with chips before any form opens (owner decision). |
| FE-PIP-08 | medium | Closed | #182 | The model no longer receives the `vars` headline (#182); its facts carry total_assets, liquid_savings and liquid_by_source separately. Cosmetic: the unused headline still says "across your accounts". |
| FE-PIP-09 | medium | Closed | #168, v10.122.0 | v10.122.0 (Track T5c; owner, 19 Oct 2026: "timed turns only; admin counts read only the server's rows"): logAiUsage writes only for a turn that called the model (turnCalledModel over its timings; quick replies, greetings and the assistant switched off write none), and migration 20261105120000 makes admin_ai_usage_summ… |
| FE-PIP-11 | medium | Closed | v10.90.0 | v10.90.0: a number after ₹/Rs or before lakh/crore/k/million is an amount and must match a computed figure (scaled); HARMLESS covers plain counts only. |
| FE-SYN-04 | medium | Closed | v10.110.0 | v10.110.0 (Track F1a; owner decision 18 Oct 2026: purge everything + test): the purge list reads ENTITIES from dataAdapter (budgetAllocations, with the old budget_allocations spelling) and adds net_worth_snapshots and the bell's notifications_ copy; F1A-002 fails when the adapter writes a key nothing purges. The onboa… |
| FE-SYN-05 | medium | Closed | v10.110.0 | v10.110.0 (Track F1a; owner decision 18 Oct 2026: retry until it lands): no retry cap, backoff up to 5 minutes; only a refused write (now incl. PGRST1xx) or a conflict is set aside. Counts, clears, Dismiss and re-reads take the cache owner; ownerless legacy entries are adopted at the session boundary; Dismiss on a fai… |
| FE-SYN-06 | medium | Closed | v10.111.0 | v10.111.0 (Track F1b; owner decision 18 Oct 2026: row-level merge): refresh merges row by row (keepLocalChanges): rows changed, added or deleted on this device while it was in flight keep their on-screen state. Every store save/edit/delete lands in the CURRENT list (functional set + withRow), never a list read before… |
| FE-SYN-07 | medium | Closed | v10.111.0 | v10.111.0 (Track F1b; owner decision 18 Oct 2026: 2-minute overlap + every page): pullDelta starts 2 minutes before the cursor and reads every page until a short one; the entity is fresh (noteCloudApplied, so positionIsCloudFresh and the Synced time) only then; a page is applied in one locked write; rows held at the s… |
| FE-SYN-08 | medium | Closed | v10.110.0 | v10.110.0 (Track F1a; owner decision 18 Oct 2026: last cloud time only): lastSyncedAt is the cloud read behind the rows shown (HybridAdapter.cloudReadAt: the oldest of the synced entities as of their cache read), kept while reads fail, "Syncing…" before the first; settleFromCloud repaints once the background reads lan… |
| FE-UIC-04 | medium | Closed | #177 | Nothing from the cited list. One uncited instance remains: AccountFormModal.tsx:284 'Available now' uses fmt, so a card over its limit shows a positive available figure. The suggested lint/grep gate against fmt( on balance or net values was not added. |
| FE-UIC-05 | medium | Closed | #186 | Cosmetic only: move_account_and_delete (still the 20260910150000 definition) does not rewrite extras.paymentMethod. This is harmless now that the form reads the FK first. |
| FE-UIC-08 | medium | Closed | v10.99.0 | v10.99.0 (Track E, E5; owner decisions E-6 and 14 Oct 2026): one budget-progress function, lib/budgetProgress.ts, read by the Budgets page (hero, pace chart and cards), the Dashboard (pace banner and Budget progress panel), Reports' budget vs actual and Pip. A total counts all spending in its own period (an annual tot… |
| FE-UIS-09 | medium | Closed (decision) | #190 | Owner, 20 Oct 2026: keep the look (no darker secondary text). Closed by decision. |
| FE-UIS-10 | medium | Closed | #183, v10.91.0 | v10.91.0: the single-key n/b/d/a shortcuts are removed (owner decision), so there is nothing to switch off. Transactions' "/" (focus only) and Cmd/Ctrl+K stay. |
| FE-UIS-12 | medium | Closed | #183, #190, v10.132.0 | #183 fixed chunk recovery and the e2e route, #190 the crash screen; v10.132.0 / admin v1.6.0 (Track Q4; owner decision D9, 20 Oct 2026): a crash the ErrorBoundary catches (through faults.unexpected), and any uncaught error from the app's scripts, is reported to Sentry, scrubbed. Q4-005..007. |
| ADM-04 | medium | Closed | v10.130.0, v10.131.0 | v10.130.0 built the append-only trail and the RPCs; admin v1.5.0 / v10.131.0 (Track Q3b; owner decisions 20 Oct 2026): super admins change staff roles on Users (confirmed; the last super kept) and read Audit Log → Staff actions; Help corrected. Q3B-ADM-003/004/008. |
| ADM-06 | medium | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): per-person segments (email, sentiment) in admin_ai_usage_summary are super-only; ai_usage rows are their household's only (staff read summaries). Q3A-012, Q2 matrix. |
| ADM-07 | medium | Closed | v10.129.0, v10.131.0 | v10.129.0 pinned the server tiers; admin v1.5.0 / v10.131.0 (Track Q3b; owner decisions 20 Oct 2026): one page-to-tier table (PAGE_ROLES) drives the sidebar and the routes, narrowed to them (content: Content + AI; roles: Dashboard, Users, Households, Audit; super: all). q3bAdminPages Q3B-ADM-001, roleGating. |
| ADM-09 | medium | Closed | v10.131.0 | admin v1.5.0 / v10.131.0 (Track Q3b; owner decisions 20 Oct 2026): admin previews build only on staging/develop (vercel.json ignoreCommand); a preview build on the production URL fails before building (previewGuard.ts in vite.config); the production fallback in lib/supabase.ts is gone. Q3B-ADM-007. |
| BE-FN-06 | medium | Closed | #168 | Optional, not required by D28: (1) cap shares per split (the audit suggested 20); (2) the sender display name in subject and heading still comes from user_metadata.full_name (send-split-email/index.ts:189-191, emailTemplates.ts:130,154), stripped of control characters but still spoofable, e.g. 'Vyact Security'. |
| BE-FN-09 | medium | Closed | #168, v10.121.0 | v10.121.0 (Track T5b; owner, 19 Oct 2026: "queue it" for splits marked paid): settleMySplitShare and closeMySplit read the email result and say when it did not go out (splitEmailNotice(result, event): settled / closed / daily limit wording), after the action's own message; a failed self-settle is said too. |
| BE-WA-03 | medium | Closed | #187 | Residual edge only: the reopen runs only on a returned 'retry'. If the worker dies after resolvePending (a stale claim is replayed), or an exception escapes processInboundTurn, the question stays closed. The audit's stronger design (resolve the pending turn inside the action's RPC transaction, or keep it on the inbox… |
| BE-WA-06 | medium | Closed (decision) | #187, v10.114.0 | Closed by owner decision, 18 Oct 2026: "ignore the whole OTP track cause it serves no use case anymore". The compare-and-set attempt claim (W8b) stays; no further work. Note: Settings' Link WhatsApp still calls whatsapp-send-otp / whatsapp-verify-otp; retiring that flow would be its own change. |
| BE-WA-07 | medium | Closed | v10.118.0 | v10.118.0 (Track T2d; owner: T2 reopens Batch E): whatsapp-notify takes the service key only; a member's JWT, of any role, is 403 service_only. The app never called it; its one caller is whatsapp-verify-otp's welcome, as the service. W0-007, W0-012. |
| BE-WA-08 | medium | Closed | v10.89.0 | v10.89.0: a WhatsApp correction to an EMI turns the entry into a loan payment (whatsapp_correct_to_loan: server split, expense removed, never twice); whatsapp_correct_last refuses loan_emi. |
| BE-WA-09 | medium | Closed | #187, v10.118.0 | W8b (#187) checked prefs, opt-out and pending-turn writes. v10.118.0 (Track T2d) checks the rest: the inbox claim, done/failed and delivery-status writes (setInboxStatus tries twice, then logs and leaves the row for the sweep; a failed claim leaves the message pending), guardedSend's sent and slot-freeing writes (sett… |
| DB-INT-09 | medium | Closed | v10.117.0 | v10.117.0 (Track T2c; owner decisions 18 Oct 2026, T2 reopens Batch E): "all three guards": accounts_guard_lifecycle refuses, from the app, archiving / deleting / converting Cash in Hand, a tombstone not set by delete_account or move_account_and_delete (transaction-local flag), and lifting a tombstone; the client DELE… |
| DB-INT-11 | medium | Closed | v10.114.0 | v10.114.0 (Track T2a; owner decisions 18 Oct 2026, T2 reopens Batch E): duplicate memberships merged (highest role kept, references re-pointed, WhatsApp unlink only when no membership is left), then uq_memberships_household_user; the member-limit trigger counts with the household locked. JOIN-002, JOIN-006. |
| DB-INT-13 | medium | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): a WhatsApp account alias picks the account named exactly, else the household's default of that kind, else the oldest; the reply names it (owner: "use the default"). Q3A-006. |
| DB-OPS-03 | medium | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): the production-only objects are under the migrations: upsert_budget's owner/admin guard (the repo's function plus the guard; production's body compared before merge), migration_issues server-only (RLS, API grants revoked), the _backup_v9_* tables dropped (owner D4). |
| DB-OPS-08 | medium | Closed | v10.132.0 | v10.132.0 / admin v1.6.0 (Track Q4; owner decision D9, 20 Oct 2026): scheduler runs are recorded in job_runs (counts, status, error; 30 days) and read by job_health() / the admin Health page; the SQL jobs run through recording wrappers. Q4-SQL-001..008, Q4-RP-007 (every cron job is watched). |
| DB-OPS-10 | medium | Closed | v10.111.0 | v10.111.0 (Track F1b; owner decision 18 Oct 2026: overlap window, not a commit-ordered revision): each delta pull re-reads 2 minutes behind its cursor, so a row whose transaction started before an already-pulled row but committed after it is fetched (F1B-008). Residual by design: a write transaction longer than 2 minu… |
| DB-SEC-06 | medium | Closed | v10.115.0, v10.116.0 | v10.115.0 + v10.116.0 (Track T2b; owner decision 18 Oct 2026: "push only the server's"). Every notification records who raised it (source client \| server) and web-push pushes only the server's; raise_server_notifications (service role) takes over a device card with the same key and never rewrites its own. A device in… |
| DB-SEC-08 | medium | Closed | #167, v10.88.0 | Server-side recency check (#167); the erase now also removes notifications, WhatsApp questions, agent conversations, relay messages and loan history (v10.88.0). |
| DB-SEC-09 | medium | Closed | v10.117.0 | v10.117.0 (Track T2c; owner decisions 18 Oct 2026, T2 reopens Batch E): assert_txn_tenant_consistency (now SECURITY DEFINER) also checks asset_id on every write and initiated_by / recurring_schedule_id when set or changed; new assert_account_tenant_consistency (asset_id, debt_id) and assert_recurring_tenant_consistenc… |
| DB-SEC-10 | medium | Closed | v10.129.0 | v10.129.0 (Track Q2; owner decision D10, 20 Oct 2026: "replay every migration, and an authz matrix"): authzMatrixSql runs nine personas (signed out, an outsider, owner, admin, member, viewer, super / roles / content staff) against every table with a policy, the views, the infographics bucket and every household, split… |
| INT-HH-07 | medium | Closed | v10.114.0 | v10.114.0 (Track T2a; owner decisions 18 Oct 2026, T2 reopens Batch E): the client INSERT policy on memberships is dropped, so people join only through the definer accepts and handle_new_household; memberships_keep_identity refuses changing a membership's user or household; the legacy profile phone copies are cleared… |
| INT-HH-09 | medium | Closed | #186, v10.114.0 | v10.114.0 (Track T2a; owner decisions 18 Oct 2026, T2 reopens Batch E): accept_invitation_link and accept_invitation_by_id lock the invitation and then the household and claim it only where accepted_at is null (row_count checked); an existing member opening a link leaves it usable; the legacy accept_invitation(text/uu… |
| INT-HH-12 | medium | Closed (decision) | #166 | Cleanup: a later migration should drop 'child' from the role CHECKs and the trigger once old clients age out (the W1a migration kept them 'for one release'). |
| INT-PAR-05 | medium | Closed | #186, v10.122.0 | v10.122.0 (Track T5c; owner, 19 Oct 2026: "timed turns only; admin counts read only the server's rows"): the WhatsApp stale-balance nudge counts with serverEngine.staleAccountCount (staleAccounts over mapped rows; the dispatcher reads whole account rows). T5C-005 is the audit's test: one fixture, the same count from "… |
| INT-PAR-08 | medium | Closed | v10.128.0 | v10.128.0 (Track Q1; owner decision D8, 20 Oct 2026: "Actions deploys the app last"): the Edge deploy runs build-agent-engine --check on the code it deploys, stores the commit as BUILD_SHA, and the new public `version` function must report it after the deploy, or the run fails and the apps are not promoted. deploy-wor… |
| INT-TXN-10 | medium | Closed | v10.111.0 | v10.111.0 (Track F1b): a cloud pull leaves every row with a queued write as the device has it: overlayQueued for full pulls (a row created offline survives, a queued delete stays deleted), mergeCloudDelta for deltas, read from outbox.queuedWrites under the list lock where upsert/remove queue their op. A same-row edit… |
| INT-TXN-11 | medium | Closed | v10.112.0 | v10.112.0 (Track F1c; owner decisions 18 Oct 2026: queued behind the transaction, sent by sync; "today's calls, repeat-safe"): create, edit and delete queue a shareSplit outbox op behind the transaction; the outbox claims it only after every earlier write of its transaction has landed (own lane, never holding up trans… |
| INT-TXN-12 | medium | Closed | v10.89.0, v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): the alias half (DB-INT-13) is fixed; the correction half was fixed in v10.89.0. |
| OPS-02 | medium | Closed | v10.129.0 | v10.129.0 (Track Q2; owner decision D10, 20 Oct 2026: "replay every migration, and an authz matrix"): migrationReplaySql applies every migration, in order and as written, to an empty PGlite set up as a new Supabase project (auth, storage, vault, realtime and default grants stood in; pg_cron and pg_net created by the m… |
| OPS-03 | medium | Closed | v10.128.0 | v10.128.0 (Track Q1; owner decision D8, 20 Oct 2026: "Actions deploys the app last"): `supabase db push` runs without --include-all, so an out-of-order migration is refused, never applied; scripts/migration-order-check.mjs (the db-migrations gate) refuses a branch's migration that is not newer than main's latest. Test… |
| OPS-08 | medium | Closed | #178, v10.102.0, v10.129.0 | v10.129.0 (Track Q2; owner decision D10, 20 Oct 2026: "replay every migration, and an authz matrix"): RLS isolation now covers every table, on every pull request, against the schema the migrations build (not a hand-synced one): authzMatrixSql Q2-AZ-001/002. INV-7 atomicity was covered in v10.102.0. |
| XC-ARC-06 | medium | Closed | #173, v10.96.0, v10.122.0 | v10.122.0 (Track T5c; owner, 19 Oct 2026: "timed turns only; admin counts read only the server's rows"): the WhatsApp budget alert sends the bell's own lines (lib/notifications.ts budgetThresholdLines, exposed to the bundle as serverEngine.budgetLinesOnServer; the 80% band only, the dedupe key unchanged), so its own 8… |
| XC-ARC-08 | medium | Closed | v10.121.0 | v10.121.0 (Track T5b; owner, 19 Oct 2026: "queue it" for splits marked paid): the Money Map flag (getMoneyMapMode, `money_map`) and the assets + debts picker derivation (buildAccounts) are deleted; both forms list the household's accounts in every build. In local-only builds (Lane A, the guest demo) the legacy list of… |
| XC-ARC-09 | medium | Closed | v10.120.0 | v10.120.0 (Track T5a; owner, 19 Oct 2026: TypeScript and Deno): every Edge Function is type-checked under strict TypeScript (`typecheck:edge`, scripts/typecheck/edge.tsconfig.json, Deno globals stubbed; 12 errors fixed) in the automation gates, and .github/workflows/edge.yml runs `deno check` (1 more error fixed) and… |
| XC-ARC-11 | medium | Closed | v10.121.0 | v10.121.0 (Track T5b; owner, 19 Oct 2026: "queue it" for splits marked paid): the gate No silent catches (scripts/silent-catch-check.mjs, TypeScript AST, app + admin + Edge; tests in scripts/__tests__) refuses any catch block or empty .catch callback that neither reports nor says why (`fault-ok: <reason>`). All 134 we… |
| XC-ARC-13 | medium | Closed | v10.129.0 | v10.129.0 (Track Q2; owner decision D10, 20 Oct 2026: "replay every migration, and an authz matrix"): the SQL suites now carry the risk: every migration replayed (Q2-RP-001..006) and a role × household matrix over every table and API-callable function (Q2-AZ-001..009). |
| XC-PRV-08 | medium | Closed (decision) | #165, #167, #184, v10.88.0, v10.125.0 | v10.125.0 (Track T4b; owner decisions 19 Oct 2026): closed by the owner's scope decision ("Download should limit to transactions, splits, debts, accounts, networth, recurring schedules, households"). lib/backup.ts holds exactly that (household = name, type, currency, members' names and roles); no budgets, goals or pro… |
| XC-PRV-09 | medium | Closed | #186, v10.124.0, v10.125.0 | v10.125.0 (Track T4b; owner decisions 19 Oct 2026): the sign-up form sends policy_version for handle_new_user to record (T4a). AuthGate reads profiles.privacy_version and asks anyone on an older version (or none, e.g. a Google sign-up) to accept PolicyUpdateSheet (what changed, Accept or Sign out), never over the lega… |
| XC-PRV-10 | medium | Closed | v10.125.0 | v10.125.0 (Track T4b; owner decisions 19 Oct 2026) ("Name both; OpenRouter keeps no data"): router.ts sends provider: { data_collection: 'deny' } on every openrouter.ai request, after params.extra so no config row can change it (fallbacks stay allowed, but only to providers that keep no data). Privacy §5/§11 name AWS… |
| XC-PRV-12 | medium | Closed | v10.114.0 | v10.114.0 (Track T2a; owner decision 18 Oct 2026: "known emails only"): resolve_participant_names answers only for emails on a split the caller owns or takes part in, or of members of their households, at most 200 per call; everyone else gets no answer. The Split form confirms a new person by email with neutral wordin… |
| FE-MNY-11 | low | Closed | #183 | Optional, part of the recommendation but not the defect: no UTF-8 BOM is emitted (downloadCsv at :40-45), so non-ASCII descriptions may garble in Excel. |
| FE-MNY-15 | low | Closed | #184 | Nothing for the export. There is still no restore (the owner-only 'Restore from backup' is in the plan's backlog), so the round-trip test from the recommendation has nothing to run against. |
| FE-MNY-16 | low | Closed | #170, #181, #186, v10.91.0 | v10.91.0: the forecast counts each bill's real dates in the period through ruleOf/expandRRule, as the bill calendar does (owner decision); the unused _shared port is deleted. Suggest still proposes a monthly average, by design. |
| FE-PIP-14 | low | Closed (decision) | #170 | Moot under D14: one currency per household, nothing converted. |
| FE-PUB-08 | low | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): signed out, content_items is readable in 16 public columns only (author ids hidden); Q3A-013 fails when a react/api query asks for a column that is not granted. |
| FE-UIS-15 | low | Closed | #184, #186 | Owner decision: non-English options are labelled "Preview: navigation only". |
| FE-UIS-16 | low | Closed | #184 | Expired invitations no longer count toward the member limit (migration 20261007120000:62). The recommendation's optional dirty-form confirm was not added. |
| ADM-05 | low | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): only super admins write category_classifications; a category must look like an app id (lowercase, NOT VALID check: no fourth copy of the category list); changes are in the staff audit trail. A parity test against NEEDS_WANTS_MAP cannot see production's rows; the owne… |
| ADM-08 | low | Closed | v10.130.0, v10.131.0 | v10.130.0 added the paged RPCs; admin v1.5.0 / v10.131.0 (Track Q3b; owner decisions 20 Oct 2026): Users and Households read 100 at a time with server search and server counts (admin_people_summary). Q3B-ADM-002. |
| ADM-10 | low | Closed | #188, v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): the insight-infographics bucket takes image/png, image/jpeg and image/webp up to 5 MB (Q3A-014). The upload-after-save order was fixed in admin v1.4.x. |
| ADM-11 | low | Closed | #188, v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): email bylines became "Vyact" (Q3A-014). Publish dates that edits reset are not recoverable. |
| ADM-14 | low | Closed | #188, v10.130.0, v10.131.0 | v10.130.0 made the RPC per currency; admin v1.5.0 / v10.131.0 (Track Q3b; owner decisions 20 Oct 2026): the Dashboard tile shows each currency (revenueFromMap). Q3B-ADM-005. |
| BE-WA-12 | low | Closed | #187, v10.118.0 | W8b (#187) counted stale claims as attempts. v10.118.0 (Track T2d; owner: every 5 minutes) adds pg_cron whatsapp-inbox-sweep with a Vault secret (whatsapp_sweep_cron_ok); the sweep also claims messages left pending over 2 minutes (inside 24 h), and a stale claim that runs out of attempts sends one "Sorry, I couldn't p… |
| DB-INT-14 | low | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): a transfer to the same account and a negative budget line are refused for new rows (NOT VALID checks), and WhatsApp refuses a Loan / EMI expense (it must pay the loan). Budget scope stays optional: the older category budgets have none (by design). |
| DB-INT-15 | low | Closed | v10.124.0 | v10.124.0 (Track T4a; owner, 19 Oct 2026: "confirmed email only"): my_email() returns the email only once email_confirmed_at is set, so is_split_participant, the shared_split_shares_select policy, settle_share and resolve_participant_names ignore an unconfirmed address (settle_share says to confirm first). Decided wit… |
| DB-OPS-07 | low | Closed | v10.123.0 | v10.123.0 (Track T5d; owner, 19 Oct 2026: "Deploy writes it"): the eight HTTP pg_cron jobs (five WhatsApp dispatches, web push, recurring-post, the inbox sweep) build their URL from Vault project_url (migration 20261106120000; no row, no call), stored by each project's deploy right after its migrations (scripts/store-… |
| DB-OPS-09 | low | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): 14 indexes on lookups that had none, 3 duplicate indexes dropped (Q3A-016). The policy rewrite to a per-request household list was declined by the owner ("indexes only"); the Q2 matrix will guard it if it is ever done. |
| INT-CON-07 | low | Closed | v10.114.0 | v10.114.0 (Track T2a; owner decisions 18 Oct 2026, T2 reopens Batch E): leave_household reads the caller's role null-safely: a non-member leaves nothing, the last owner cannot leave. JOIN-007. |
| INT-HH-06 | low | Closed | #166, v10.114.0 | v10.114.0 (Track T2a; owner decisions 18 Oct 2026, T2 reopens Batch E): the unique (household_id, user_id) index is in place (with the merge); the W1a deferred owner trigger already guards continuity. The owner's read-only check for households left ownerless before that trigger is listed in the PR. |
| INT-HH-14 | low | Closed | #188, v10.130.0, v10.131.0 | admin v1.5.0 / v10.131.0 (Track Q3b; owner decisions 20 Oct 2026): member counts and type counts come from the server; the page shows the four current types. Q3B-ADM-002. |
| INT-TXN-14 | low | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): the activity log's actor is auth.uid(), else the transaction-local vyact.actor that each of the 10 WhatsApp writers sets to the sender; scheduled jobs have none ("Vyact (automatic)", the label in Q3b). Setting deleted_at logs 'deleted'. Q3A-008/009. |
| GATE-03 | low | Closed | #185, #188 | Live-verified 12 Oct: no .map is served for the vyact.app or admin entry chunks. |
| GATE-04 | low | Closed | v10.120.0 | v10.120.0 (Track T5a; owner, 19 Oct 2026: TypeScript and Deno): react/tsconfig.tests.json + the `typecheck:tests` gate compile the unit tests and the JS and Edge code they import; 121 errors fixed without changing an assertion (a fixture used a payment mode that never existed; a schedule fixture lacked two fields). |
| OPS-13 | low | Closed | #185, #189 | The ignoreCommand regression introduced in #185 was fixed in #189. |
| XC-ARC-10 | low | Closed | v10.121.0 | v10.121.0 (Track T5b; owner, 19 Oct 2026: "queue it" for splits marked paid): store/landIn.ts: `commit(householdId, update)` lands a post-await write only if that household is still open, in every household-scoped action of the crud, data, recurring and notify slices (38 writes), plus the role, household invitations a… |
| XC-ARC-12 | low | Closed (decision) | — | Owner, 20 Oct 2026: not planned. The money model is held by the database CHECKs and the money-model test suite. Closed by decision. |
| XC-ARC-14 | low | Closed (decision) | — | Owner, 20 Oct 2026: a process observation, not a code defect; the gates added since (T5, Q1) cover the risk. Closed by decision. |
| XC-PRV-14 | low | Closed | #189, v10.125.0 | v10.125.0 (Track T4b; owner decisions 19 Oct 2026): the work email in react/CHANGELOG.md and the migration comment became manu@example.com (schema.sql regenerated); home.html is gitignored; W8d-PRV14-001 fails on any address outside the example and Vyact domains across the docs, schema.sql and every migration. The his… |
| BE-FN-12 | info | Closed | v10.126.0 | v10.126.0 (Track T4c; owner decisions 19 Oct 2026) ("show by default, and hide via settings"): Settings → Notifications → "Show details on the lock screen", per device and on by default (NotificationPrefs.lockScreenDetails, sent in the push prefs). Off, the pushed payload (payloadFor) and the open app's popup (deviceN… |
| DB-OPS-16 | info | Closed | v10.130.0 | v10.130.0 (Track Q3a; owner decisions 20 Oct 2026): pg_trgm is dropped when no index or function in the database uses it, else kept with a notice; a drop the deploy role does not own logs a notice instead of failing. Q3A-015 runs both ways. |
| INT-PAR-11 | info | Closed | #169, #170, #173, v10.120.0 | v10.120.0 (Track T5a; owner, 19 Oct 2026: TypeScript and Deno): the `test:tz` gate runs 10 date-sensitive suites under UTC, Asia/Kolkata, Europe/London, America/New_York and Pacific/Kiritimati (a planted UTC-day today() passes in UTC and fails in three zones), and scripts/deno-smoke.ts loads the engine bundle and shar… |
| GATE-05 | info | Closed | #189 | Triaged (docs/SECURITY_AUDIT_TRIAGE.md), with a CI npm-audit gate. The moderate React Router advisory is mitigated by safeNext; its full fix is v7. |
| Q-AUTH-03 | medium | Closed (decision) | — | Owner, 20 Oct 2026: keep as is. Recorded as intended in supabase/auth-config.json, so a change is noticed. |
| Q-AUTH-04 | low | Closed (decision) | — | Owner, 20 Oct 2026: keep as is. Recorded as intended in supabase/auth-config.json. |
| Q-WA-01 | medium | Closed | v10.132.0 | v10.132.0 / admin v1.6.0 (Track Q4; owner decision D9, 20 Oct 2026): TOPICS.weekly needs insights consent (owner, 20 Oct); the weekly job plans the summary for insights and the nudges for marketing; Settings → WhatsApp and "Messages I send you" say which switch sends what; runs recorded in job_runs. Q4-013, Q4-014. |
| Q-DOC-01 | low | Closed | v10.128.0 | v10.128.0 (Track Q1; owner decision D8, 20 Oct 2026: "Actions deploys the app last"): restored from the clean v10.127.0 copy (149 duplicated lines removed, nothing else changed). |
