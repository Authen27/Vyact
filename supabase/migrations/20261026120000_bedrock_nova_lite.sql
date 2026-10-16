-- v10.106.1 · Amazon Nova Lite on Bedrock for Pip (owner, 16 Oct 2026: "Bedrock's Nova Lite will power Pip").
--
-- Adds ONE model row, DISABLED, like every catalogue row (20260906140000_seed_model_catalogue.sql): this
-- migration changes what Pip does by exactly zero. It goes live with one UPDATE once the AWS secrets
-- are set on the Edge Functions (see the end of this file).
--
-- THE ROUTE
--   provider 'bedrock' is the router's one non-OpenAI path (supabase/functions/_shared/agent/bedrock.ts):
--   Bedrock's Converse API at https://bedrock-runtime.<region>.amazonaws.com/model/<model>/converse.
--   Region: Asia Pacific (Sydney), ap-southeast-2, which serves Nova Lite in-region under the plain id
--   `amazon.nova-lite-v1:0` (owner's choice). The router reads the region from base_url.
--
-- AUTH
--   key_env_var 'AWS_ACCESS_KEY_ID' means: sign with AWS Signature Version 4 using the Edge Function
--   secrets AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ AWS_SESSION_TOKEN if set). The keys belong to an
--   IAM user allowed only `bedrock:InvokeModel` on Nova Lite. NO SECRET IS STORED HERE; the router refuses
--   AWS credential names on any row that is not provider 'bedrock' with a bedrock-runtime host.
--   (A Bedrock API key also works: set key_env_var to 'AWS_BEARER_TOKEN_BEDROCK'.)
--
-- PRICING (operational spend for ai_usage.cost_usd, never ledger money): Nova Lite on demand, about
--   $0.063 per million input and $0.252 per million output tokens in Asia Pacific (third-party price
--   trackers, June 2026; confirm on the AWS pricing page). Cheap enough that a Pip answer (~1,500 tokens
--   in, ~150 out) costs about $0.00013.
--
-- PRIORITY 120: above the OpenRouter row enabled today (110), so enabling this row makes it Pip's model
--   for every user without touching the other row. The test-only Claude Code relay (200, one allowlisted
--   user, TD-44) still wins for that user until it is disabled.

begin;

insert into public.ai_model_configs
  (seam, provider, model, base_url, key_env_var, params, enabled, priority)
select 'assistant', 'bedrock', 'amazon.nova-lite-v1:0',
       'https://bedrock-runtime.ap-southeast-2.amazonaws.com', 'AWS_ACCESS_KEY_ID',
       '{"max_tokens":600,"temperature":0.2,"price_per_mtok_input":0.063,"price_per_mtok_output":0.252,"note":"Amazon Nova Lite, Bedrock Sydney (ap-southeast-2), SigV4"}'::jsonb,
       false, 120
where not exists (
  select 1 from public.ai_model_configs
  where seam = 'assistant' and provider = 'bedrock' and model = 'amazon.nova-lite-v1:0'
);

commit;

-- TO GO LIVE (after `supabase secrets set AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…`):
--   update public.ai_model_configs set enabled = true
--   where seam = 'assistant' and provider = 'bedrock' and model = 'amazon.nova-lite-v1:0';
-- TO GO BACK: the same with enabled = false (the OpenRouter row at 110 answers again).
