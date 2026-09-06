-- v10.20 · Model catalogue — premier + value models, ALL DISABLED.
--
-- WHY SEED ROWS AT ALL
-- "Plug-n-play" means switching models is a ROW CHANGE, not a deploy. That only
-- holds if the rows exist. This seeds a ready catalogue so switching is one
-- UPDATE, and so the multi-model bake-off (architecture §7 layer 7) has a matrix
-- to run against.
--
-- 🔴 EVERY ROW SHIPS `enabled = false`. Nothing here spends a cent until someone
--    deliberately flips one on. The gateway with no enabled row does exactly one
--    config SELECT and answers `enabled:false` — the inert default.
--
-- PROVIDER CHOICE: OpenRouter, because it exposes Claude, GPT, Gemini, Llama,
-- Qwen and DeepSeek behind ONE OpenAI-compatible endpoint and ONE key. Anthropic's
-- own API is not OpenAI-shaped (different path, auth header and body), so reaching
-- Claude directly would need a bespoke adapter in the router; via OpenRouter it
-- needs nothing. Direct per-vendor adapters can come later purely as a cost play.
--
-- NO SECRET IS STORED HERE. `key_env_var` is the NAME of a Supabase Function
-- secret; the value lives only in the edge runtime.
--
-- Pricing below was read from OpenRouter's public /api/v1/models on 2026-09-06
-- and feeds ai_usage.cost_usd. It is OPERATIONAL SPEND (our provider bill), never
-- ledger money. Re-check it before trusting a cost report — vendors move prices.

BEGIN;

insert into public.ai_model_configs
  (seam, provider, model, base_url, key_env_var, params, enabled, priority)
values
  -- ── PREMIER TIER ──────────────────────────────────────────────────────────
  ('assistant','openrouter','anthropic/claude-sonnet-5','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":2.00,"price_per_mtok_output":10.00}'::jsonb,false,100),
  ('assistant','openrouter','anthropic/claude-opus-5','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":5.00,"price_per_mtok_output":25.00}'::jsonb,false,90),
  ('assistant','openrouter','openai/gpt-5.1','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":1.25,"price_per_mtok_output":10.00}'::jsonb,false,80),
  ('assistant','openrouter','google/gemini-2.5-pro','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":1.25,"price_per_mtok_output":10.00}'::jsonb,false,70),
  -- ── VALUE TIER — the bake-off cost floor ──────────────────────────────────
  ('assistant','openrouter','openai/gpt-oss-120b','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":0.04,"price_per_mtok_output":0.17}'::jsonb,false,40),
  ('assistant','openrouter','meta-llama/llama-3.3-70b-instruct','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":0.10,"price_per_mtok_output":0.32}'::jsonb,false,30),
  ('assistant','openrouter','qwen/qwen3-235b-a22b-2507','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":0.09,"price_per_mtok_output":0.55}'::jsonb,false,20),
  ('assistant','openrouter','deepseek/deepseek-v4-flash','https://openrouter.ai/api','OPENROUTER_API_KEY',
   '{"temperature":0.2,"max_tokens":600,"price_per_mtok_input":0.08,"price_per_mtok_output":0.16}'::jsonb,false,10)
on conflict (seam, provider, model, base_url) do nothing;

COMMIT;

-- TO SWITCH MODELS (exactly one enabled row is the clearest mental model;
-- with several enabled, the HIGHEST priority wins):
--
--   update public.ai_model_configs set enabled = false where seam = 'assistant';
--   update public.ai_model_configs set enabled = true
--    where seam = 'assistant' and model = 'anthropic/claude-sonnet-5';
