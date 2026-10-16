// Vyact Agent — the AMAZON BEDROCK path of the model router (owner, 16 Oct 2026: Nova Lite powers Pip).
//
// Bedrock does not speak the OpenAI chat-completions dialect the rest of the router uses. It has its
// own Converse API (`POST https://bedrock-runtime.<region>.amazonaws.com/model/<modelId>/converse`)
// and AWS authentication. This module holds only what differs:
//   • the endpoint and host check for a `provider = 'bedrock'` row;
//   • OpenAI-style messages → a Converse body, and a Converse reply → the router's parsed shape;
//   • authentication: a Bedrock API key (`Authorization: Bearer …`), or IAM keys signed with
//     AWS Signature Version 4 (the route AWS recommends for production).
//
// Like router.ts it is PURE: no imports, no database client, no write path. The only ambient global is
// `crypto.subtle` (Web Crypto, present in Deno and Node 18+) for SHA-256 / HMAC. It never computes
// money and never interprets model output.

// ── Which rows take this path ────────────────────────────────────────────────

/** A `provider` value that routes a config row through Bedrock. */
export const isBedrockProvider = (provider: unknown): boolean =>
  typeof provider === 'string' && /^(aws[-_ ]?)?bedrock$/i.test(provider.trim());

/** `bedrock-runtime.<region>.amazonaws.com` (FIPS endpoints included). Anything else is refused, so
 *  a config row can never point AWS credentials, or a signature, at another host. */
const BEDROCK_HOST = /^bedrock-runtime(-fips)?\.([a-z]{2}(-gov)?-[a-z]+-\d)\.amazonaws\.com$/;

export function bedrockRegion(hostname: string): string | null {
  const m = BEDROCK_HOST.exec(hostname.toLowerCase());
  return m ? m[2] : null;
}

/** The secret names a Bedrock row may give in `key_env_var`:
 *   • `AWS_BEARER_TOKEN_BEDROCK` (the name AWS's own SDKs read) or `LLM_BEDROCK_KEY` — a Bedrock API key;
 *   • `AWS_ACCESS_KEY_ID` — sign with SigV4 using AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
 *     (+ AWS_SESSION_TOKEN when set). */
export const BEDROCK_BEARER_KEY_ENVS = new Set(['AWS_BEARER_TOKEN_BEDROCK', 'LLM_BEDROCK_KEY']);
export const BEDROCK_SIGV4_KEY_ENV = 'AWS_ACCESS_KEY_ID';
export const isBedrockKeyEnv = (name: string): boolean =>
  BEDROCK_BEARER_KEY_ENVS.has(name) || name === BEDROCK_SIGV4_KEY_ENV;

export function bedrockEndpoint(baseUrl: string, model: string): { ok: true; url: URL; region: string } | { ok: false; message: string } {
  let base: URL;
  try { base = new URL(String(baseUrl).replace(/\/+$/, '')); } catch { return { ok: false, message: 'base_url is not a valid URL.' }; }
  if (base.protocol !== 'https:') return { ok: false, message: 'A Bedrock base_url must use https.' };
  const region = bedrockRegion(base.hostname);
  if (!region) {
    return { ok: false, message: 'A Bedrock base_url must be https://bedrock-runtime.<region>.amazonaws.com.' };
  }
  const id = String(model).trim();
  if (!/^[A-Za-z0-9.:_\-/]{3,200}$/.test(id) || id.includes('..')) {
    return { ok: false, message: 'model is not a valid Bedrock model or inference profile id.' };
  }
  // The model id (e.g. `amazon.nova-lite-v1:0`, `eu.amazon.nova-lite-v1:0`, or an ARN) is one path segment.
  return { ok: true, url: new URL(`https://${base.hostname}/model/${encodeURIComponent(id)}/converse`), region };
}

// ── Messages → Converse ──────────────────────────────────────────────────────

export interface PlainMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }

export interface ConverseBody {
  messages: { role: 'user' | 'assistant'; content: { text: string }[] }[];
  system?: { text: string }[];
  inferenceConfig: { maxTokens: number; temperature?: number; topP?: number; stopSequences?: string[] };
}

/**
 * Build a Converse body. System messages become `system`; the conversation must start with a user turn
 * and alternate, so consecutive same-role turns are joined and a leading assistant turn is dropped. A
 * `tool` message (none today: Pip sends no tools) is passed as user text.
 */
export function toConverseBody(
  messages: readonly PlainMessage[],
  opts: { maxTokens: number; temperature?: number; topP?: number; stop?: unknown },
): ConverseBody | null {
  const system: { text: string }[] = [];
  const turns: ConverseBody['messages'] = [];
  for (const m of messages) {
    const text = String(m.content ?? '');
    if (!text.trim()) continue;
    if (m.role === 'system') { system.push({ text }); continue; }
    const role: 'user' | 'assistant' = m.role === 'assistant' ? 'assistant' : 'user';
    if (!turns.length && role === 'assistant') continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content[0].text += `\n\n${text}`;
    else turns.push({ role, content: [{ text }] });
  }
  if (!turns.length) return null;
  const body: ConverseBody = { messages: turns, inferenceConfig: { maxTokens: opts.maxTokens } };
  if (system.length) body.system = system;
  if (typeof opts.temperature === 'number') body.inferenceConfig.temperature = opts.temperature;
  if (typeof opts.topP === 'number') body.inferenceConfig.topP = opts.topP;
  const stop = Array.isArray(opts.stop) ? opts.stop : typeof opts.stop === 'string' ? [opts.stop] : [];
  const stops = stop.filter((s): s is string => typeof s === 'string' && s.length > 0).slice(0, 4);
  if (stops.length) body.inferenceConfig.stopSequences = stops;
  return body;
}

// ── Converse → parsed reply ──────────────────────────────────────────────────

export interface ConverseParsed {
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  finishReason: string | null;
}

const asInt = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function parseConverse(data: unknown, maxChars: number): ConverseParsed | null {
  if (!data || typeof data !== 'object') return null;
  const output = (data as { output?: unknown }).output as { message?: { content?: unknown } } | undefined;
  const content = output?.message?.content;
  if (!Array.isArray(content)) return null;
  let text = content
    .map(part => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') ? (part as { text: string }).text : '')
    .join('');
  if (text.length > maxChars) text = text.slice(0, maxChars);
  const u = ((data as { usage?: unknown }).usage ?? {}) as Record<string, unknown>;
  const promptTokens = asInt(u.inputTokens);
  const completionTokens = asInt(u.outputTokens);
  const stop = (data as { stopReason?: unknown }).stopReason;
  return {
    text,
    usage: { promptTokens, completionTokens, totalTokens: asInt(u.totalTokens) || promptTokens + completionTokens },
    finishReason: typeof stop === 'string' ? stop : null,
  };
}

/** An operator-facing next step for a Bedrock error body (never shown with the body itself). */
export function bedrockErrorHint(status: number, detail: string): string | undefined {
  if (/on-demand throughput isn.t supported|inference profile/i.test(detail)) {
    return 'This model needs an inference profile id in this region (e.g. eu.amazon.nova-lite-v1:0), or use a region that serves it in-region.';
  }
  if (status === 403 && /model access|don.t have access|not authorized|AccessDenied/i.test(detail)) {
    return 'Bedrock refused the call. Enable Nova Lite under Model access for this region, and allow bedrock:InvokeModel for the key\'s IAM user.';
  }
  if (status === 401 || status === 403) return 'The AWS credential was rejected. Rotate the secret named by key_env_var.';
  if (status === 429) return 'Bedrock throttled the request (account quota).';
  return undefined;
}

// ── AWS Signature Version 4 ──────────────────────────────────────────────────

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(data: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(data)));
}
async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

/** RFC 3986 encoding, as SigV4 requires (encodeURIComponent leaves !'()* alone). */
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export interface SigV4Input {
  method: string;
  url: URL;
  /** Headers to send and sign (lower-cased internally). `host` and `x-amz-date` are added. */
  headers: Record<string, string>;
  body: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** The signing instant. */
  date: Date;
}

/**
 * Sign a request with AWS Signature Version 4 and return the headers to send (the input headers plus
 * `x-amz-date`, `x-amz-security-token` when a session token is given, and `authorization`). The path is
 * URI-encoded once more for the canonical request, as every AWS service except S3 expects (the model id
 * in a Converse path carries an encoded `:`).
 */
export async function signSigV4(input: SigV4Input): Promise<Record<string, string>> {
  const amzDate = input.date.toISOString().replace(/[:-]|\.\d{3}/g, '');   // 20150830T123600Z
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers)) headers[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  headers.host = input.url.host;
  headers['x-amz-date'] = amzDate;
  if (input.sessionToken) headers['x-amz-security-token'] = input.sessionToken;

  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders = signedNames.map(n => `${n}:${headers[n]}\n`).join('');
  const signedHeaders = signedNames.join(';');
  const canonicalPath = input.url.pathname.split('/').map(seg => rfc3986(seg)).join('/') || '/';
  const pairs: [string, string][] = [];
  input.url.searchParams.forEach((v, k) => { pairs.push([k, v]); });
  const query = pairs
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`).join('&');
  const canonicalRequest = [
    input.method.toUpperCase(), canonicalPath, query, canonicalHeaders, signedHeaders, await sha256Hex(input.body),
  ].join('\n');

  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');
  const kDate = await hmac(enc.encode(`AWS4${input.secretAccessKey}`), day);
  const kRegion = await hmac(kDate, input.region);
  const kService = await hmac(kRegion, input.service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = hex(await hmac(kSigning, stringToSign));

  const out: Record<string, string> = { ...headers };
  delete out.host;   // fetch sets Host itself; it was signed with the same value
  out.authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return out;
}
