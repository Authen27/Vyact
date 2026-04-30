## What changed

<!-- One-paragraph summary. Link to issue if relevant. -->

## Why

<!-- The user-visible problem this solves, or the strategic reason. -->

## How to verify

- [ ] CI green (consumer + admin builds)
- [ ] Local `npm run dev` works in any affected app
- [ ] If schema changed: ran `apply_migration` against staging Supabase project
- [ ] If RLS changed: ran security advisor + reviewed warnings
- [ ] If user-facing: tested both the empty state and the populated state

## Risk

<!-- What could break? Migration-without-rollback? Behaviour change for existing users? -->

## Screenshots (if UI)

<!-- Drag and drop here -->
