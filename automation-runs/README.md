# Automation Runs

Every automation run (local or CI) produces a self-contained evidence folder here:

```
automation-runs/
├── INDEX.md                      ← append-only register of all runs (tracked)
└── <UTC-timestamp>__<shortsha>/  ← one folder per run (CI artifact; gitignored locally)
    ├── report.md                 ← human-readable summary (start here)
    ├── summary.json              ← machine-readable result
    ├── vitest.json               ← raw unit-test results
    └── logs/<gate>.log           ← full output of each quality gate
```

## How to produce one

```bash
node scripts/automation-run.mjs          # lint + unit + builds
node scripts/automation-run.mjs --e2e    # also run Playwright E2E
```

The script exits non-zero if any gate fails, so it doubles as a local pre-push / CI merge gate.

## Why the run folders aren't committed

Run output is **evidence**, not source. Committing every run would bloat the repo without bound. Instead:

- **CI** uploads each run folder as a build **artifact** (retained 90 days — see [`docs/TEST_GOVERNANCE.md`](../docs/TEST_GOVERNANCE.md)).
- **`INDEX.md`** (the register) and this README **are** tracked, so the *history of runs* is always in version control even though the bulky artifacts are not.

See [`docs/TEST_GOVERNANCE.md`](../docs/TEST_GOVERNANCE.md) for the full governance policy.
