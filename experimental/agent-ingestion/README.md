# Parked: the learned-ingestion pipeline

**Parked in v10.136.0** (Track Q8; audit XC-ARC-07, BE-PIP-04; owner decision 20 Oct 2026: "park the dormant
pipeline, out of the build and the default tests").

## What it is

`runIngestion` takes free text, a bank SMS or a receipt and decides what to do with it:
- **write** the transaction;
- **draft** it for the person to confirm;
- **ask** a question;
- **block** it (a question is never logged).

It works in stages: classify → grammar → resolve against the household's accounts → ambiguity → duplicates →
validate. A bank format it has extracted before is cached as a learned recipe (`sms_format_recipes`, keyed by a
digit-masked signature). See `vyact-agent-architecture.md` §3 and §7.

| Folder | Holds |
|---|---|
| `src/` | The 11 modules, moved unchanged from `supabase/functions/_shared/agent/`. |
| `tests/` | Their Vitest suites, plus the two cases that ran elsewhere: the allowlist parity checks (`parity.test.ts`) and the trusted-recipe check (`trustedRecipe.test.ts`). |
| `evals/` | The golden corpus and its offline runner. |

## Why it is parked

Nothing ever called it:
- WhatsApp logs through `_shared/whatsapp-parser.ts`;
- the app logs through its own forms and Pip's capture.

Even so, about 3,900 lines sat in `supabase/functions`. They were type-checked, linted and tested on every commit,
and `types.ts` kept a third copy of the app's category and payment-mode sets, which the binding rules then had to
keep in step.

## Run it

```bash
npm --prefix react run test:parked
```

```bash
node experimental/agent-ingestion/evals/runner.mjs
```

The default `npm test` and the test inventory do not include it. The two type-check gates (`typecheck:edge`,
`typecheck:tests`) and `deno lint` no longer read it.

## Before it can go live again

1. **BE-PIP-04: who may teach a recipe.**
   - Today a learned recipe writes only when it is TRUSTED (W8b; `tests/trustedRecipe.test.ts`).
   - What is still missing:
     - a per-household confirmation (for example a `sms_recipe_confirmations(signature, household_id, …)` row) before a recipe the household has not confirmed may write;
     - a rule that one household's confirmations can never promote a global recipe.
2. **TD-36: investments.** `resolver.ts` resolves an investment's destination against ACCOUNTS. Since v10.26.0 an
   investment moves money from an account into an investment ASSET (`asset_id`). It must resolve against assets, or
   every proposed investment fails `ck_txn_accounts_by_type`.
3. **The money model since it was written.**
   - A split you pay takes the whole bill from your account (v10.134.0).
   - A loan payment goes through `pay_loan` and never as a plain `loan_emi` expense.
   - Every write goes through `upsertTransaction` / `whatsapp_log_transaction`, never a writer of its own.
4. **The eval gate** must be green at its declared threshold, with no failing `safety` case.

## To revive it

1. Move the code and tests back:
   - `git mv` `src/*.ts` back to `supabase/functions/_shared/agent/`;
   - move `tests/*.test.ts` back to `react/src/lib/__tests__/` and re-aim their imports;
   - point `evals/runner.mjs` at the pipeline's new path.
2. Put the parity cases back where they ran:
   - CON-UNIT-162 and W7a-CON05-002 into `categoryModel.test.ts`;
   - the payment-mode case into `whatsappParser.test.ts`;
   - W8b-PIP04-001 into `w8bEdgeFixes.test.ts`.
3. Update the rules and the inventory:
   - restore `_shared/agent/types.ts` in CLAUDE.md's "categories" and "payment modes" rules (three places again);
   - restore the "Learned ingestion" group in `scripts/test-inventory-config.mjs`.
4. Wire it to an entrypoint only through the existing writers. Proposals are confirmed by the person (binding
   rule 3), and a model's extraction never writes on its own.
