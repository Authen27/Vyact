# Solution: In-Amount Calculator (Item #6)

**Status:** Draft · **Target:** v7.1 (Variant A) · v7.1.1 (Variant B) · **Owner:** Consumer
**Depends on:** [`SOLUTION_TRACK_TXN_MODAL.md`](SOLUTION_TRACK_TXN_MODAL.md) (shares `AmountField`)
**Related:** [`MEASUREMENT_PLAN.md`](MEASUREMENT_PLAN.md) (`calc_expression_used`)

## Problem
Households reconcile receipts, split bills, and convert currencies inline. Today users
leave the modal, open the OS calculator, copy/paste a number back. This breaks flow and
loses the *intent* (e.g. "12.50 + 3.25 tip"). Mobile-first, mixed-literacy users (elders,
children) need a path that does not require knowing operator precedence.

## Goals
- Allow `+ - * /` and parentheses inside the amount field.
- Locale-aware decimal (`,` for `de-DE` / `fr-FR`, `.` for `en-US`).
- No `eval` / `new Function` (per [`SECURITY.md`](../SECURITY.md)).
- Preserve the original expression alongside the resolved amount for audit / edit.

## Non-Goals
- Currency conversion in the expression (use Reports rates editor).
- Variables / named refs (e.g. `=lastWeek - 50`).
- Scientific functions.

## Variants

### Variant A — Inline parser (v7.1, default)
Type `12.50 + 3.25` → on blur (or pressing `=`), the field shows the resolved value and
a small chip below: `12.50 + 3.25`. Tapping the chip restores the expression for editing.

### Variant B — Drawer numpad (v7.1.1, opt-in for low-literacy / large-touch users)
A bottom-sheet keypad with big tactile keys, expression preview, undo, and `=`. Toggled
by a calculator icon in the field. Settings: "Always show numpad on amount" (off by default,
recommended on for elder profiles).

### Variant C — Line-item splitter (deferred to v7.3)
Multi-row "split this purchase" UX (groceries → produce/dairy/etc with category per row).
Out of scope for v7.1; tracked in roadmap.

## Architecture

```
react/src/lib/expressionEval.ts        ← shunting-yard parser, pure, unit-tested
react/src/components/ui/AmountField.tsx ← input + chip + optional drawer trigger
react/src/components/ui/CalcDrawer.tsx  ← Variant B numpad (lazy-loaded)
```

`Transaction` type (additive, optional):
```ts
amount: number;            // resolved value (existing)
amountExpr?: string;       // raw expression e.g. "12.50 + 3.25" (NEW, optional)
```
Persisted via existing adapter; ignored by reports/aggregations.

## Parser (`lib/expressionEval.ts`)

Shunting-yard → RPN → evaluator. **No `eval`. No `Function`.**

```ts
export type EvalResult =
  | { ok: true; value: number; canonical: string }
  | { ok: false; error: 'syntax' | 'div_zero' | 'overflow' | 'too_long' };

export function evalExpression(input: string, locale: string): EvalResult;
```

Rules:
- Strip locale group separators (`,` for `en-US`, `.` for `de-DE`).
- Replace locale decimal with `.` for tokenization, restore on display.
- Token max length 32 chars; expression max 64 chars (cheap DoS guard).
- Reject anything outside `[0-9 . + - * / ( ) whitespace]`.
- `Number.isFinite` check; reject `Infinity` / `NaN` post-eval.
- Return `canonical` as ASCII-normalized for storage.

Test fixtures (`expressionEval.test.ts`):
- `"12.5 + 3.25"` → `15.75`
- `"100 - (10 + 5)"` → `85`
- `"7,5 + 2,5"` (de-DE) → `10`
- `"1/0"` → `div_zero`
- `"alert(1)"` → `syntax`
- `"1+".repeat(50)` → `too_long`

## `AmountField` behavior

- Pure-numeric input (no operators) → identical to v7.0 behavior; no chip rendered.
- Operator detected → switch to "expression mode": parse on blur / `=` / `Enter`.
- On parse success: field shows resolved number, chip below shows `amountExpr`. Click
  chip → field becomes editable expression again.
- On parse failure: field stays editable, red helper text `"Couldn't calculate — check
  your math"`. Save button disabled.
- Mobile: keyboard `inputmode="decimal"` when no operator typed yet, `inputmode="text"`
  once operator detected (so `+` is reachable).

## Telemetry
Fire `calc_expression_used` (already in `events.yaml`) with `{ length, has_parens,
operator_count, resolved_bucket }`. Never log raw expression. Bucket via `bucketAmount()`.

## Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| C-1 | Locale decimal confusion (user in `de-DE` types `1.000` meaning 1000, parser reads 1.0) | High | Strip group separators **only** when locale-correct; show resolved value before save |
| C-2 | Parser bug evaluates malicious input → XSS via persisted note | Critical | Strict allowlist regex pre-tokenize; unit tests cover injection patterns |
| C-3 | Mobile keyboard hides operators, blocking the feature | Medium | Auto-switch `inputmode`; Variant B drawer as escape hatch |
| C-4 | Expression chip persisted then schema migrates → orphan field | Low | `amountExpr` optional; adapter ignores unknown fields; covered by HybridAdapter cache rules |
| C-5 | Power users expect `%` (tip calc) | Medium | v7.1.1 adds `%` as `× 0.01` postfix; document in Help |

## Release Gates
1. `expressionEval.test.ts` ≥ 95% line coverage, includes injection fuzz.
2. Playwright `TXN-FC-012` (calculator success) + `TXN-FC-013` (calculator failure UX).
3. `A11Y-FC-006`: VoiceOver announces resolved value + expression chip role.
4. SECURITY.md sign-off: no `eval`, no `Function`, no `setTimeout(string)`.

## Test IDs (add to `react/e2e/TEST_CASE_INVENTORY.md`)
- `TXN-FC-012` — type `12.5+3.25`, blur, resolves to `15.75`, chip visible
- `TXN-FC-013` — type `1/0`, save disabled, helper text shown
- `A11Y-FC-006` — screen reader reads `"15 dollars 75 cents, calculated from 12.5 plus 3.25"`

## Open Questions
1. Should the expression chip survive across edits, or reset once user touches the
   amount? (Recommend: reset on manual edit, preserve on field re-open.)
2. Variant B drawer: ship in v7.1.1 universally, or gate behind elder-profile flag?
