# Vyact — email templates (v1, 4 Oct 2026)

Every email Vyact sends or should send, by module: when it's sent, to whom, the exact copy (subject options,
preview text, heading, body, button, footer) and what's live today.

**Voice** (owner rules, `landingCopy.ts`): plain English, warm, calm and honest about money. Vyact is
"the family budget app", for any household anywhere. Lead with what Vyact does. Never "Vyact Finance". No
WhatsApp in public or marketing copy. No figures that the app didn't compute.

## 0. Sending setup — why email doesn't work today (triage, 4 Oct 2026)

| # | Finding | Evidence | Effect |
|---|---|---|---|
| 1 | **No email provider is configured** for the app's own emails | Edge Function secrets: no `RESEND_API_KEY`, `MAILERSEND_API_KEY`, `SMTP_HOST` or `SPLIT_EMAIL_FROM` | `send-split-email` returns `{ ok: false, reason: 'email_not_configured' }` on every call. The 4 Oct test split ("Delhi dhaba") returned 200 and **sent nothing** |
| 2 | **The failure is silent** | The function logs nothing; `lib/splitEmail.ts` ignores the response | Nobody (user or team) could see that email wasn't going out |
| 3 | **Auth email uses Supabase's built-in sender** | Authentication → SMTP Settings: "Enable custom SMTP" is **off** | Sign-up confirmation, password reset and sign-in links come from a Supabase address, not vyact.app. Supabase's built-in sender is rate-limited and delivers **only to the project team's own addresses**, so a real user's reset email never arrives |
| 4 | **vyact.app DNS only authorises GoDaddy mail** | `v=spf1 include:secureserver.net -all`; DMARC `p=quarantine`; no DKIM for any sending provider | Mail "from @vyact.app" sent by any other service fails SPF and DKIM and is quarantined or rejected |

**Fix (to send everything from vyact.app):**

1. **Owner:** create a Resend account. It's free for 3,000 emails a month and works for both transactional and Auth email. Add the domain `vyact.app` in Resend.
2. **Owner, GoDaddy DNS:** add the records Resend shows:
   - `resend._domainkey` TXT (DKIM);
   - `send` MX, pointing to Resend's feedback host;
   - `send` TXT SPF (`v=spf1 include:amazonses.com ~all`).

   The root SPF record stays as it is, so GoDaddy mail for support@vyact.app keeps working. DMARC passes through DKIM alignment (`adkim=r`).
3. **Owner, Supabase → Edge Function secrets:** set `RESEND_API_KEY` and `SPLIT_EMAIL_FROM` to `Vyact <hello@vyact.app>`.
4. **Owner, Supabase → Authentication → SMTP Settings:** turn custom SMTP on with these settings:
   - host `smtp.resend.com`, port `465`, user `resend`;
   - password: the Resend API key;
   - sender `hello@vyact.app`, name `Vyact`.

   Then raise the Auth email rate limit.
5. **Code (PR):** log every send outcome without addresses; default sender `Vyact <hello@vyact.app>`; reply-to `support@vyact.app`; tell the person in the app when the email couldn't be sent.
6. **Verify:** create a split shared with a second address and run a password reset. Both must arrive from `hello@vyact.app`, with SPF/DKIM/DMARC passing in the message headers.

**Senders.** Every email comes from `Vyact <hello@vyact.app>` with replies going to `support@vyact.app`. One sender keeps the reputation in one place.

---

## 1. Inventory

| # | Template | Module | Trigger | Recipient | Kind | Status |
|---|---|---|---|---|---|---|
| A1 | Confirm your email | Account | Email sign-up | New user | Transactional (Auth) | Supabase default copy, **not delivered** (see §0) |
| A2 | Your sign-in link / code | Account | "Email me a link" | User | Transactional (Auth) | Supabase default copy, not delivered |
| A3 | Reset your password | Account | "Forgot password" | User | Transactional (Auth) | Supabase default copy, not delivered |
| A4 | Confirm your new email | Account | Email change | User (new address) | Transactional (Auth) | Supabase default; no in-app flow yet |
| A5 | Deletion requested | Account | `request_account_deletion` | User | Transactional | **To build** |
| A6 | Account deactivated | Account | `deactivate_my_account` | User | Transactional | **To build** |
| S1 | A split was shared with you | Splits | Split saved, recipient has an account | Participant | Transactional | Built (`splitSharedEmail`), not delivered |
| S2 | You're invited to settle a bill | Splits | Split saved, recipient has no account | Invitee | Transactional | Built (`splitInviteEmail`, v10.59.0), not delivered |
| S3 | Your share was settled | Splits | Participant settles | Split owner | Transactional | Built (`splitSettledEmail`), not delivered |
| S4 | A split was closed | Splits | Owner closes the split | Participants | Transactional | Built (`splitClosedEmail`), not delivered |
| S5 | Reminder: a share is still open | Splits | 7 days after S1/S2, share unpaid | Participant | Transactional | **To build** (once per share) |
| H1 | You're invited to a household | Households | Owner invites by email | Invitee | Transactional | **To build** (invites are link-only today) |
| H2 | A new member joined | Households | Invite accepted | Owner | Transactional | **To build** |
| L1–L5 | Welcome and first-week series | Lifecycle | Sign-up | New user | Lifecycle (service) | **To build** |
| L6 | Invite your partner | Lifecycle | Day 5, Couple/Family, no other member | Owner | Lifecycle (service) | **To build** |
| R1–R3 | We've missed you | Lifecycle | 14 days with nothing logged | User | Marketing (opt-in) | **To build** |
| M1 | Your month in Vyact | Insights | 1st of each month | Opted-in users | Marketing (opt-in) | **To build** |

**Consent.**
- A1–A6, S1–S5 and H1–H2 are transactional: they're sent because of something the person or their household did. They carry no unsubscribe link, but they do carry the reason they were sent.
- The L series is service email about the account the person just created. Send it only within the first 14 days, with a one-click unsubscribe.
- R and M are marketing. They need an email opt-in, which Settings doesn't have yet (the WhatsApp opt-in doesn't count), plus an unsubscribe link and a postal address in the footer.

---

## 2. Account (Supabase Auth templates: paste into Authentication → Email Templates)

Supabase variables: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`.

### A1 · Confirm your email
- **Subject:** *Confirm your email for Vyact* · alternatives: *One step left: confirm your email* · *Finish setting up Vyact*
- **Preview:** Tap once to confirm and open your household.
- **Heading:** Confirm your email
- **Body:** Thanks for signing up to Vyact, the family budget app. Confirm this email address to finish setting up your account.
- **Button:** Confirm email → `{{ .ConfirmationURL }}`
- **Footer:** You're receiving this because someone signed up to Vyact with {{ .Email }}. If it wasn't you, ignore this email and no account will be created.

### A2 · Your sign-in link / code
- **Subject:** *Your Vyact sign-in link* · *Sign in to Vyact* · (code variant) *Your Vyact code: {{ .Token }}*
- **Preview:** It works once, for the next hour.
- **Heading:** Sign in to Vyact
- **Body:** Tap the button to sign in. The link works once and expires in an hour. Or enter this code: **{{ .Token }}**
- **Button:** Sign in → `{{ .ConfirmationURL }}`
- **Footer:** Didn't ask to sign in? Ignore this email. Your account stays as it is.

### A3 · Reset your password
- **Subject:** *Reset your Vyact password* · *Set a new password for Vyact*
- **Preview:** The link works once, for the next hour.
- **Heading:** Set a new password
- **Body:** Someone asked to reset the password for {{ .Email }}. If that was you, choose a new password below. The link works once and expires in an hour.
- **Button:** Set a new password → `{{ .ConfirmationURL }}`
- **Footer:** Didn't ask for this? Ignore this email. Your password won't change.

### A4 · Confirm your new email
- **Subject:** *Confirm your new email address* · **Preview:** Your Vyact sign-in changes once you confirm.
- **Heading:** Confirm your new email
- **Body:** You asked to change your Vyact email to {{ .NewEmail }}. Confirm it to switch. Until then, you sign in with your current address.
- **Button:** Confirm new email → `{{ .ConfirmationURL }}`
- **Footer:** Didn't ask for this? Ignore this email and nothing changes.

### A5 · Deletion requested
- **Subject:** *We've received your request to delete your account* · **Preview:** Here's what happens next, and how to cancel.
- **Heading:** Your account is scheduled for deletion
- **Body:** We've received your request to delete your Vyact account. Your data will be deleted on **{date}**. Until then, you can sign in and cancel from Settings. Households you share stay with their other members. Splits you're part of stay visible to the people you shared them with.
- **Button:** Cancel deletion → `https://vyact.app/settings`
- **Footer:** You're receiving this because a deletion was requested from your account. Questions? Reply to this email.

### A6 · Account deactivated
- **Subject:** *Your Vyact account is paused* · **Preview:** Sign in any time to pick up where you left off.
- **Heading:** Your account is paused
- **Body:** Your Vyact account is deactivated. Nothing has been deleted. Sign in any time to reactivate it, and everything will be where you left it.
- **Button:** Sign in → `https://vyact.app/auth/sign-in`

---

## 3. Splits (`supabase/functions/_shared/emailTemplates.ts`)

### S1 · A split was shared with you (they have an account)
- **Subject:** *{Owner} shared "{description}" with you* · alternatives: *Your share of {description}: {amount}* · *{Owner} split a bill with you*
- **Preview:** Your share is {share}. Settle it in Vyact when you're ready.
- **Heading:** {Owner} shared "{description}" with you
- **Body:** Total {total}, paid by {Owner} on {date}. **Your share is {share}.** Then the list of everyone in the split and their shares.
- **Button:** View the split → `https://vyact.app/splits`
- **Footer:** You're receiving this because {Owner} shared a bill split with this email address on Vyact.

### S2 · You're invited to settle a bill (no account) — live copy since v10.59.0
- **Subject:** *{Owner} invited you to settle "{description}" on Vyact* · alternatives: *{Owner} split "{description}" with you* · *Your share of "{description}" is waiting*
- **Preview:** Your share is {share}. Join free with this email to see it and settle up.
- **Heading:** {Owner} invited you to settle a shared bill
- **Body:**
  - {Owner} ({owner email}) added you to **"{description}"** on Vyact, the family budget app, so you can see your share and settle it.
  - Then the split lines.
  - Create your free Vyact account with **{your email}**. The split will be waiting in Splits when you sign in.
- **Button:** Join Vyact to review and settle → sign-up with the email pre-filled, landing on `/splits`
- **Footer:** You're receiving this because {Owner} shared a bill split with this email address on Vyact. If you don't know them, you can ignore this email.

### S3 · Your share was settled (to the owner)
- **Subject:** *{Person} settled their share of "{description}"* · **Preview:** {amount} is marked as paid.
- **Heading:** {Person} settled up
- **Body:** {Person} marked their {amount} share of "{description}" as settled. {N} share(s) are still open.
- **Button:** View the split

### S4 · A split was closed (to participants)
- **Subject:** *{Owner} closed "{description}"* · **Preview:** Nothing more to settle on this one.
- **Heading:** This split is closed
- **Body:** {Owner} closed "{description}". There's nothing more to settle on it, and it stays in your Splits history.

### S5 · Reminder: a share is still open (to build)
- **When:** 7 days after S1/S2 if the share is unpaid. Once per share, never more than one a week per person.
- **Subject:** *Still open: your {share} share of "{description}"* · alternatives: *A quick nudge from {Owner}* · *"{description}" is waiting for you*
- **Preview:** Settle it in a tap when you're ready.
- **Body:** Your {share} share of "{description}" with {Owner} is still open. When you've paid them, mark it as settled so you're both square.
- **Button:** Settle my share
- **Footer:** One reminder per split. {Owner} can see when you've settled.

---

## 4. Households (to build; invites are link-only today)

### H1 · You're invited to a household
- **Subject:** *{Owner} invited you to "{household}" on Vyact* · **Preview:** Share budgets, bills and spending in one place.
- **Heading:** Join {household} on Vyact
- **Body:** {Owner} ({owner email}) invited you to share their household on Vyact, the family budget app. You'll see the same budgets, bills and totals, and they've given you **{role}** access.
- **Button:** Accept the invitation → `/invite/{token}` · **Footer:** The invitation expires on {date}. Not expecting it? Ignore this email.

### H2 · A new member joined
- **Subject:** *{Person} joined {household}* · **Body:** {Person} accepted your invitation and now has {role} access. You can change their access in Households.

---

## 5. Lifecycle — welcome and first week (sequence)

**Goal:** a new household logs its first entries, sets a budget and invites its people.
**Exit:** the household has logged at least 5 entries and has a budget for this month. **Suppress:** after an unsubscribe, after account deletion, and on the same day as a transactional email.

| # | Day | Subject (lead) | Purpose | CTA | Condition |
|---|---|---|---|---|---|
| L1 | 0 | Welcome to Vyact | Set expectations; the first entry | Add your first entry | Everyone |
| L2 | 1 | Your money, in one place | Accounts and the two numbers | Add an account | No account besides Cash |
| L3 | 3 | Give every {currency} a job | First budget | Set this month's budget | No budget this month |
| L4 | 5 | Ask Pip before you spend | Pip and the "can we afford it?" question | Ask Pip a question | Logged ≥ 1 entry |
| L6 | 5 | Money's easier together | Invite partner/family | Invite someone | Couple/Family, no other member |
| L5 | 10 | Bills that don't slip | Recurring bills and the calendar | Add a recurring bill | No recurring schedule |

### L1 · Day 0
- **Subject:** *Welcome to Vyact* · alternatives: *Your household is ready* · *Let's log your first entry*
- **Preview:** Two minutes now gives you a clear picture by the weekend.
- **Body:**
  - Welcome to Vyact, the family budget app.
  - Your household is set up in {currency}. Start with one thing: **log what you spent today**. It takes a few taps, and every entry makes your picture clearer.
  - Over the next week we'll show you one feature at a time.
- **Button:** Add your first entry → `/transactions?add=1`

### L2 · Day 1
- **Subject:** *Your money, in one place* · **Preview:** Add the accounts you use so your balances stay real.
- **Body:** Vyact keeps two numbers honest: **cash flow** (what came in and went out this month) and **net worth** (what you own minus what you owe). Add the bank account and card you use most, and both stay true.
- **Button:** Add an account → `/accounts`

### L3 · Day 3
- **Subject:** *Give every {currency} a job* · alternatives: *Set this month's budget in two minutes* · *A budget you'll actually keep*
- **Preview:** Start from what you really spend. Vyact suggests the limits.
- **Body:** A budget is a plan, not a punishment. Pick your main categories and set a limit for each. Vyact warns you when a category reaches 80%, before the month runs away.
- **Button:** Set this month's budget → `/budgets`

### L4 · Day 5
- **Subject:** *Ask Pip before you spend* · **Preview:** "Can we afford it?" answered from your own numbers.
- **Body:** Pip is Vyact's assistant. Ask "can we afford a weekend away?" or "how much is left for groceries?". Pip answers from your own budgets and balances, and says plainly when something's tight.
- **Button:** Ask Pip → `/chat`

### L6 · Day 5 (Couple/Family, no other member)
- **Subject:** *Money's easier together* · alternatives: *Bring {partner} into Vyact* · *One household, one picture*
- **Preview:** Invite them and you'll both see the same budgets and bills.
- **Body:** Vyact works best when everyone who spends is in it. Invite your partner or family, choose whether they can edit or just view, and you'll all see the same budgets, bills and totals.
- **Button:** Invite someone → `/households?invite=1`

### L5 · Day 10
- **Subject:** *Bills that don't slip* · **Preview:** Rent, subscriptions and salary, on a calendar.
- **Body:** Add the bills that repeat (rent, phone, subscriptions) and your salary. Vyact puts them on a calendar, posts them for you or asks first, and shows what's already committed before the month starts.
- **Button:** Add a recurring bill → `/recurring`

**Benchmarks (onboarding):** opens 50–70%, clicks 10–20%, completion (5 entries + budget) 15–30%, unsubscribes < 0.5%.
**A/B tests:** L1 subject (*Welcome to Vyact* vs *Let's log your first entry*); L3 send day (3 vs 2); L6 subject (benefit vs name).

---

## 6. Re-engagement (marketing, opt-in only)

**Trigger:** 14 days with nothing logged. **Exit:** any new entry. **Re-entry:** after 90 days.

| # | Day | Subject | Body (lead) | CTA |
|---|---|---|---|---|
| R1 | 14 | *Your picture's going stale* · *A quick catch-up?* | It's been two weeks since anything was logged. One line catches you up: add today's spending and your month comes back into focus. | Log today's spending |
| R2 | 21 | *What changed this month* | Your budget for {month} is {pct}% used with {days} days to go. (Only if a budget exists; otherwise: *Set this month's budget* copy.) | See this month |
| R3 | 30 | *Should we keep sending these?* | We'll stop these reminders unless you'd like them. Your household and everything in it stay exactly where they are. | Keep me posted · Stop these |

**Benchmarks:** opens 15–25%, clicks 2–5%, return-to-logging 3–8%, unsubscribes 1–2%.

## 7. Your month in Vyact (marketing, opt-in only)

- **When:** the 1st, about the month just closed. Figures come from the app's own calculations only.
- **Subject:** *Your {month} in Vyact* · alternatives: *{month}: {spent} spent, {comparison}* · *Your month, explained*
- **Preview:** Where the money went, and what's coming up.
- **Body:** Spent {spent} ({comparison} {prior month}). Biggest slice: {category} {amount}. Budgets on track: {n of m}. Bills due this month: {count}, {total}.
- **Button:** See the full month → `/reports` · **Footer:** You opted in to monthly summaries. Unsubscribe in one click. {postal address}

---

## 8. UX copy rules for every email

1. **Subject ≤ 50 characters**, the most important words first; never "Re:"/"Fwd:" tricks; no ALL CAPS.
2. **The preview complements the subject**, never repeats it.
3. **The button starts with a verb and says the outcome:** "Settle my share", not "Click here".
4. **Say who and why:** every transactional email names the sender or trigger and says why this address got it.
5. **Money is formatted by the app** with the household's currency symbol. Never compute figures in the template.
6. **One primary action per email.**

**Localization notes.**
- Avoid idioms: no "on the same page" in subjects.
- Keep `{currency}` symbol placement locale-aware.
- Allow 30% text expansion in buttons (German/Spanish).
- Dates are written out ("5 Oct 2026"), never `05/10`.
