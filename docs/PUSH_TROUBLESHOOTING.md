# Push notifications: why one didn't reach the lock screen

v10.126.0 (T4c, 19 Oct 2026). The owner reported that push notifications have not reached the lock screen,
on the Play Store Android app and on Vyact installed from Chrome (PWA). This page records what the code
review found, and the read-only checks that find the cause for a given phone.

## How a push travels

1. **The phone registers.** In Settings → Notifications, "Push notifications on this device" asks the browser
   for permission and subscribes with its push service (Google's, for Chrome on Android). Then
   `register_push_subscription` stores the device in `push_subscriptions`, with the household open at that
   moment, the phone's time zone and its switches.
2. **The server raises.** Every 15 minutes pg_cron's `web-push-dispatch` calls the `web-push` function. For each
   household with a device, it runs the app's own notification rules and stores what they raise as
   `source = 'server'` rows in `notifications`.
3. **The server pushes.** Each unread **action-required (P1)** server row from the last 24 hours goes to each of
   the household's devices, unless that device's switches or quiet hours say no. Each attempt is logged in
   `push_deliveries`, and the row is stamped `pushed_at`.
4. **The phone shows it.** The service worker (`public/push-sw.js`) always shows a notification.

## What the review found

### Play Store Android app: confirmed, it could not receive them

The Android app is the website inside a WebView (Capacitor). An Android WebView has no Web Push API, so the
app could never subscribe. It showed alerts as Android local notifications, but only while the app happened
to be running: with the app closed, nothing raised them.

- **v10.126.0:** an app without push says so ("The Vyact Android app can't show notifications on your lock
  screen yet…") and its switch is disabled.
- **v10.127.0 (T4d), the server side of native push:** an app whose APK carries `@capacitor/push-notifications`
  registers the phone's Firebase Cloud Messaging token (`register_native_push`, a `push_subscriptions` row of
  kind `fcm`). The dispatcher sends it the same alerts under the same rules, through FCM. Owner decisions,
  19 Oct 2026:
  - **one device list** (browsers and phones together, one 10-device cap);
  - **the server is the only source** on a registered phone (the app's own local notifications stop);
  - **on by default** in the app (Android's permission is asked once, the first time);
  - **a tap opens the app** on the alert.
- **What is still to do:** the Vyact-Android build (the plugin, `google-services.json` and the notification icon)
  and the Firebase setup below. Until both are live, the Play Store app keeps showing alerts only while open.

### Setting up Firebase (owner, once)

1. In the Firebase console, add a project (or use the Google Cloud project you already have), then add an
   **Android app** with the package name **`com.vyact.app`**. Download its `google-services.json`.
2. In GitHub, Authen27/Vyact-Android → Settings → Secrets and variables → Actions, add
   **`GOOGLE_SERVICES_JSON_BASE64`**: the file, base64-encoded (`base64 -w0 google-services.json`). The Android
   build writes it into the app. It holds no secret, but keep it out of the repository.
3. In Firebase → Project settings → **Service accounts**, generate a new private key (a JSON file). Store it as
   a Supabase Edge Function secret, then **delete the file**:

   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat key.json)" --project-ref dmxqkvploojokffuhxnz
   ```

   The web-push function reads it and nothing else does. Without it, phones are skipped
   (`fcm_not_configured` in query 5), and browsers are unaffected.
4. Check that the **Firebase Cloud Messaging API (V1)** is enabled for the project (Google Cloud console → APIs).

Never commit either file. This repository's `.gitignore` refuses them, and the secret scan fails on a private key.

### Chrome on Android (PWA): the code path is sound

The review covered:

- the push-service host allowlist (`fcm.googleapis.com` is allowed);
- the worker importing `push-sw.js`;
- the encryption (RFC 8291, tested against an independent decryptor);
- the TTL (24 hours, urgency high);
- the server-only rows (T2b-2) and the 15-minute job.

None of these drops a push. What remains is something about one phone or one household. These are the known
reasons a push is not sent, in the order to check them:

| Reason | What it looks like | What to do |
|---|---|---|
| The phone isn't registered | Settings says "this phone isn't set up to receive them yet", or there is no `push_subscriptions` row (query 1) | Turn the switch off and on in the installed app, then "Send a test notification" |
| The phone follows another household | Query 1's household is not the one the alert is about. A device registers the household that was open on it, and is pushed only that household's alerts | Open the household you want alerts for on that phone (it re-registers) |
| It isn't action-required | Only bills awaiting approval, budgets at 80% / 100%, loan payments due and balances to check are pushed. Bills that post themselves, income and insights stay in the bell | None; this is by design |
| Quiet hours | 22:00–07:00 by default, in the phone's time zone. The alert is held and sent after | Change quiet hours in Settings, or wait |
| Already read, or raised before the phone registered | An alert you opened in the bell is not pushed. Nothing from before the phone registered (or last switched household, which starts it afresh) is pushed, and nothing older than 24 hours | None |
| The push service retired the phone | `disabled_at` set, `last_status` 404 or 410 (query 1) | Turn the switch off and on |
| The job isn't running, or failed | Query 4 shows no recent runs or failures; query 5 shows errors | Check `web-push-dispatch` is active, and the Deploy run's "Store this project's URL" step (T5d) |
| Android or Chrome blocks it | `push_deliveries` shows 201 (accepted) but nothing appears | Android Settings → Apps → Chrome (and the installed Vyact): notifications allowed, battery "Unrestricted", Do Not Disturb off; Chrome → Site settings → vyact.app → Notifications: Allow |

## Read-only checks (Supabase SQL editor, production)

Replace `<your email>` and `<household id>`. These only read; none changes anything.

```sql
-- 1. This person's devices: which household each follows, its push host, switches, last answer.
select s.id, s.kind, s.household_id, h.name as household, split_part(s.endpoint, '/', 3) as push_host, s.user_agent,
       s.tz, s.prefs, s.created_at, s.last_status, s.last_success_at, s.failures, s.disabled_at
  from push_subscriptions s
  join auth.users u on u.id = s.user_id
  left join households h on h.id = s.household_id
 where u.email = '<your email>'
 order by s.created_at desc;

-- 2. What was sent to them in the last 7 days, and what the push service answered
--    (201 accepted · 404/410 gone · 403 key mismatch · 0 no answer; an Android app phone (FCM): 200 accepted,
--    404 UNREGISTERED gone, 0 with "fcm_auth" = the service account was refused).
select d.created_at, d.kind, d.status, d.error, n.type
  from push_deliveries d
  join auth.users u on u.id = d.user_id
  left join notifications n on n.id = d.notification_id
 where u.email = '<your email>' and d.created_at > now() - interval '7 days'
 order by d.created_at desc limit 50;

-- 3. What the server raised for the household in the last 3 days, and whether it was pushed.
select created_at, type, priority, status, source, pushed_at
  from notifications
 where household_id = '<household id>' and created_at > now() - interval '3 days'
 order by created_at desc;

-- 4. Is the job running?
select j.jobname, j.schedule, j.active, r.status, r.return_message, r.start_time
  from cron.job j
  left join lateral (select * from cron.job_run_details d where d.jobid = j.jobid
                      order by d.start_time desc limit 5) r on true
 where j.jobname = 'web-push-dispatch';

-- 5. What the function answered on its last runs: households, raised, pushed, and why the rest were skipped.
select created, status_code, left(content::text, 500) as answer
  from net._http_response
 where content::text like '%"pushed"%'
 order by created desc limit 10;
```

**Reading query 5:** `skipped` counts each device × alert that was not sent, by reason:

- `other_household`: the device follows another household;
- `not_action_required`: a P2 alert, bell only;
- `already_seen`: read in the bell;
- `before_subscribed`: raised before the device registered;
- `all_off` / `type_off`: the device's switches;
- `quiet_hours`: held for later;
- `device_disabled`: retired by the push service;
- `not_a_member`: the person left the household;
- `fcm_not_configured`: an Android app phone, with no `FCM_SERVICE_ACCOUNT_JSON` secret set;
- `already_pushed`: sent on an earlier run;
- `endpoint_not_allowed`: not a known push service;
- `send_error`: the send threw (see `problems`).

**The quickest end-to-end check** is Settings → Notifications → "Send a test notification" in the installed app.
"Sent. The push service accepted it (201)" with nothing on the phone points at Android or Chrome settings (the
last row of the table). Any other answer is the device's registration.

## Lock-screen details (v10.126.0)

Settings → Notifications → "Show details on the lock screen" is on by default, and switching it off is per
phone. Off, a push and the open app's popup say only what needs a look ("A bill is due", "A budget needs a
look"): no amount, payee, account or name. The words are `lockScreenText` in `react/src/lib/notifications.ts`,
and the server reads the same table through the bundled engine.
