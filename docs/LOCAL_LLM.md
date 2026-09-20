# Running Ask Vyact on a self-hosted model (LM Studio / Gemma)

> **Status (v10.38.0):** supported by configuration alone — no code change is needed to
> point Ask Vyact at a local model. What v10.38 added is the ability to pilot it on
> **one account** first: a config row carrying `params.allowed_user_ids` serves only
> those users, and everyone else resolves the next row by priority.

## Why this works at all

Binding rule §2.7a: *providers are OpenAI-compatible, so a model swap is a DB row.*
LM Studio's server speaks the OpenAI chat-completions API, so it is a provider like any
other. Nothing in the client changes, and the safety properties are unchanged: stage 4
still computes every figure, and `assertNoInventedFigures` still judges the reply.

```
vyact.app ──JWT──► ask-vyact (Supabase Edge, cloud)
                       │  POST {base_url}/v1/chat/completions
                       ▼
            https://vyact-llm.example.com          ← public HTTPS, yours
                       │  Cloudflare Tunnel
                       ▼
            http://127.0.0.1:1234  (LM Studio, Gemma)
```

## Three constraints the gateway enforces

Read these before you start; each one refuses a configuration that looks reasonable.

| Constraint | Where | What it means for you |
|---|---|---|
| **`base_url` must be public HTTPS** | `router.ts` `checkConfig` — loopback is refused with `unreachable`, and `http` to a public host with `invalid_config` | Supabase Edge runs in the cloud. `http://localhost:1234` and `http://192.168.x.x:1234` can never work. You need a tunnel. |
| **The path is appended for you** | `checkConfig` builds `base_url + '/v1/chat/completions'` | The row holds `https://vyact-llm.example.com` — **no** `/v1` suffix. |
| **20-second budget by default** | `ASK_VYACT_TIMEOUT_MS`, clamped to 55 s by `MAX_TIMEOUT_MS` | This is exactly what killed the free Nemotron model. Measure your first token latency and raise it. |

## Step 1 — expose LM Studio over HTTPS

In LM Studio: load Gemma, start the local server (default `:1234`), and leave
"serve on local network" off — the tunnel is the only way in.

Then run a Cloudflare Tunnel on that PC. Prefer a **named** tunnel on a domain you
control over a quick tunnel: the hostname is stable, so the config row does not need
editing every restart.

```bash
cloudflared tunnel login
cloudflared tunnel create vyact-llm
cloudflared tunnel route dns vyact-llm vyact-llm.example.com
cloudflared tunnel run --url http://127.0.0.1:1234 vyact-llm
```

🔴 **LM Studio has no authentication of its own.** Until you put something in front of
it, anyone who learns the hostname can spend your GPU and read whatever the model is
told. Two ways to close that, in order of preference:

1. **Cloudflare Access with a service token** — Access sits in front of the hostname and
   rejects anything without the token headers. The gateway sends a single
   `Authorization: Bearer <key>` header, so pair this with a small worker or a reverse
   proxy that maps that bearer to the Access headers.
2. **A reverse proxy that checks the bearer directly** (Caddy, nginx, a Cloudflare
   Worker): accept the request only when `Authorization: Bearer <your-token>` matches,
   then forward to `127.0.0.1:1234`. Simpler, and it matches what the gateway already
   sends.

Either way the shared secret is stored as a Supabase Function secret and named by
`key_env_var` — never in the database, never in the repo.

## Step 2 — the secrets (you run these)

```bash
supabase secrets set LOCAL_LLM_KEY=<the token your proxy expects>
supabase secrets set ASK_VYACT_TIMEOUT_MS=45000
```

`key_env_var` must match `^[A-Z][A-Z0-9_]{2,63}$` and may not start with `SUPABASE_`,
`WHATSAPP_`, `VYACT_` … or contain `SERVICE_ROLE`, `JWT`, `DB_` (a DB CHECK enforces
this, so the gateway can never be tricked into posting a platform key to your endpoint).

## Step 3 — the config row, piloted to one account

```sql
insert into public.ai_model_configs
  (seam, provider, model, base_url, key_env_var, params, enabled, priority)
values (
  'assistant', 'lmstudio', 'google/gemma-3-27b-it',
  'https://vyact-llm.example.com',          -- no /v1
  'LOCAL_LLM_KEY',
  jsonb_build_object(
    'temperature', 0.2,
    'max_tokens', 900,                       -- THE live cap: the gateway does not
                                             -- forward the client's maxOutputTokens
    'allowed_user_ids', jsonb_build_array('<your-user-id>'),
    'price_per_mtok_input', 0,               -- self-hosted: no provider bill
    'price_per_mtok_output', 0
  ),
  true, 200
);
```

`priority 200` puts it above the hosted model. Because of the allowlist, **only your
account resolves it**; every other user skips the row and gets the next one down. That
also covers the obvious failure mode — your PC is asleep — for everyone but you.

Check readiness without spending a token: the gateway's probe path (`{"probe": true}`)
returns `ready` plus a reason, and `checkConfig` will name a bad URL or a missing secret
precisely.

## Step 4 — validate, then promote

Validate with the Period 6 list in `ASK_VYACT_LLM_RUN_LOG.md`, and watch three things
Gemma is likely to struggle with more than a frontier model:

- **Classify must return strict minified JSON.** A 27B local model usually manages it;
  a smaller quant may wrap it in prose, which the gateway treats as `fallback`. Watch for
  a run of `intent: fallback` in `ai_usage`.
- **Latency.** `ai_usage.latency_ms` per call; if it approaches the timeout, either raise
  `ASK_VYACT_TIMEOUT_MS` (max 55 s) or use a smaller quant.
- **Figure discipline.** The guard is the backstop, but a weaker model invents more. A
  rise in `outcome='error'` rows means the retry and then the refusal are firing.

**Promotion is one edit, no deploy:**

```sql
update public.ai_model_configs
   set params = params - 'allowed_user_ids'
 where seam = 'assistant' and provider = 'lmstudio';
```

Before you do that, be honest about what it means: every household member's questions —
and the facts that travel with them — then route through that PC, and Ask Vyact is down
whenever the machine is. If the model is for the household rather than the desk, host it
somewhere that stays up and keep the allowlist for pilots.

## Privacy note

A self-hosted model is the strongest privacy position available here: the payload never
leaves hardware you own. What leaves the browser is unchanged — `SafeSummary`-shaped
facts, category labels and debt *types*, never merchant text or descriptions — and the
same egress rules apply. The one new exposure is the tunnel itself, which is why the
proxy in step 1 is not optional.
