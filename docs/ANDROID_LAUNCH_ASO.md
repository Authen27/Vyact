# Android launch: store listing (ASO) copy pack

Drafted 18 Oct 2026 (v10.108.0) for the Google Play listing of `com.vyact.app`. The owner pastes these into
Play Console → Grow → Store presence → Main store listing. Every claim matches the live app and the
store listing the owner approved (release 9, version 0.5). The owner kept WhatsApp in the **Play listing
only**; it never appears on vyact.app's public pages (CLAUDE.md, PUB-011).

Brand rules: "Vyact — family budget app"; never "Vyact Finance"; the "Family Finance OS" tagline is retired
(owner, 2 Oct 2026). Global positioning: lead with what the app does, for any household, anywhere.

## App name (30 max)

**`Vyact: Family Budget Tracker`** (28 characters)

Play weights the app name most. It carries the brand and two head terms ("family budget", "budget tracker").
- Alternative: `Vyact: Family Budget Planner` (28).
- Replaces: "Vyact — Family Finance OS".

## Short description (80 max)

**`Family budget & expense tracker: shared bills, splits and an AI money helper.`** (77 characters)

## Full description (4000 max)

```
Vyact is the family budget app your household runs together. Track household expenses, share budgets and bills, split costs and plan debt payoff, and everyone works from the same numbers.

Budgeting as a couple, running a family budget or sharing a flat: Vyact brings your spending, budgets, bills, debts and net worth into one shared picture, so you know where the money went, what's coming next and what you can afford.

ASK PIP, YOUR MONEY HELPER
Ask about your money in plain words. "Can we afford a weekend away?" "How much is left for groceries?" Pip answers from your own budgets and balances, with the figures, and tells you plainly when something is tight. When you tell Pip about a spend, it shows what it understood so you can check it before saving.

ONE SHARED BUDGET FOR THE WHOLE HOUSEHOLD
Invite your partner or family. Choose who can edit and who can only view. Personal spending can stay out of the shared totals.

FAMILY BUDGETS THAT WARN YOU EARLY
Set monthly or annual budgets by category. Vyact tells you when a category reaches 80%, before it runs out.

SPLIT BILLS WITH ANYONE
Share a bill with people inside or outside your household. Only your share counts toward your spending. See who owes what and settle up.

A CLEAR DEBT PAYOFF PLAN
Loans and cards side by side, an avalanche or snowball payoff order, the interest inside every payment, and what an extra payment does to the date you're clear.

BILLS THAT DON'T SLIP
Recurring bills and income in a calendar. Approve what's due, skip it once, or let it post by itself.

NET WORTH AND REPORTS
Net worth across cash, bank accounts, cards, loans and investments, recorded month by month. Cash-flow and category reports for any date range.

LOG A SPEND FROM WHATSAPP
Link your number and message Pip like a friend: "auto 450" or "groceries 2340". The entry lands in the right account and budget, and you can undo it from the chat.

ALSO
• Light and dark themes
• Works in your household's own currency
• Works offline; changes sync when you're back
• Undo for quick actions
• Free money lessons in plain English

Pip is AI-based and can make mistakes. Check entries before you save them, and use the thumbs up or down on any answer to tell us how it did.

WhatsApp is a trademark of WhatsApp LLC. Vyact is not affiliated with or endorsed by WhatsApp.
```

What changed from the release-9 text:
- The first two paragraphs now carry the searched phrases ("family budget app", "household expenses", "split costs", "debt payoff", "budgeting as a couple").
- The section heads carry "shared budget", "family budgets", "split bills" and "debt payoff plan".
- WhatsApp moved below the core jobs.
- The lessons line was added: the Learn library is live and free.

**Before saving, owner:** WhatsApp inbound has been down since 9 Oct (audit, 16 Oct). Fix it before more testers arrive, or drop the WhatsApp section until it works.

## Graphics

- **Phone screenshot order:** `01-ask-pip`, `03-household`, `04-budgets`, `05-splits`, `06-debt`, `02-whatsapp`, `07-bills`, `08-net-worth`. The first three are what a searcher decides on, so they show the core jobs.
- **Video:** `https://www.youtube.com/watch?v=NTGKS3WBjUg`. Play requires the video to be public or unlisted, with no ads, and not "made for kids".
  - **Re-export recommended:** the video's opening frame still shows the retired tagline under the logo. After re-uploading, change `PROMO.id` in `react/src/content/landingCopy.ts` (one line) and the Play video URL.
- **Feature graphic:** check that it doesn't carry the retired tagline either (`assets-src/play-feature-graphic.svg` in the Android repo).

## YouTube description for the promo

```
Vyact is the family budget app a household runs together: shared budgets, bills, splits, debt payoff and net worth, and Pip, who answers "can we afford it?" from your own numbers.

Try it free: https://vyact.app/?utm_source=youtube&utm_medium=video&utm_campaign=promo_15s
Learn money in 60 seconds: https://vyact.app/learn

#familybudget #budgetapp #householdbudget
```

Add the Play link once the listing is public: `https://play.google.com/store/apps/details?id=com.vyact.app&referrer=utm_source%3Dyoutube%26utm_campaign%3Dpromo_15s`.

## Category and tags

- **Category:** Finance.
- **Tags:** Budgeting, Personal finance, Expense tracker (pick the closest that Play Console offers).

## After production

- **Store listing experiments:** test the first screenshot and the short description.
- **Custom store listings:** couples, families and bill splitting, mirroring `/for/couples`, `/for/families` and `/for/splitwise-users`.
- **Localised listings:** for the next markets.
