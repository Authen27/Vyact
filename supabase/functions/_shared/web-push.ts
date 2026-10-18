// Web Push, sent from the server (v10.48.0, TD-22).
//
// A message to a browser's push service, encrypted for that one browser:
//   • RFC 8291 message encryption (aes128gcm content coding, RFC 8188), keyed by the
//     subscription's p256dh public key and auth secret. The push service (Google,
//     Apple, Mozilla) relays ciphertext it cannot read.
//   • RFC 8292 VAPID: an ES256-signed JWT naming this server, so the push service
//     knows who is sending and a stolen endpoint is useless without our key.
//
// WebCrypto only (no npm, no Node APIs), so this exact code runs in the Edge
// Function (Deno) and in the vitest suite (Node), which decrypts what it encrypts.

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** The server's VAPID identity. The private key never leaves the server (Vault). */
export interface VapidKeys {
  /** Uncompressed P-256 public key (65 bytes), base64url: the browser's applicationServerKey. */
  publicKey: string;
  privateJwk: JsonWebKey;
  /** Contact for the push services: a mailto: or https: URL. */
  subject: string;
}

export async function generateVapidKeys(subject: string): Promise<VapidKeys> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { publicKey: b64url(raw), privateJwk, subject };
}

/** `Authorization: vapid t=<jwt>, k=<public key>` for one push-service origin (RFC 8292 §3). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  // 12 h: the RFC allows up to 24 h; shorter limits a leaked token.
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: keys.subject })));
  const { key_ops: _ops, ext: _ext, ...jwk } = keys.privateJwk;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto returns the raw r‖s signature, which is exactly JOSE's ES256 form.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

/** One record is the whole message; the payload must fit in it. */
export const RECORD_SIZE = 4096;
export const MAX_PAYLOAD_BYTES = 3000;

export interface EncryptOptions {
  /** Test hooks only: fixed salt / sender key pair. Production draws fresh ones per message. */
  salt?: Uint8Array;
  senderKeys?: CryptoKeyPair;
}

/**
 * RFC 8291 §3.4 / RFC 8188 §2: header (salt ‖ rs ‖ idlen ‖ sender public key) followed
 * by one AES-128-GCM record whose plaintext ends with the 0x02 last-record delimiter.
 */
export async function encryptPayload(plaintext: Uint8Array, p256dh: string, auth: string, opts: EncryptOptions = {}): Promise<Uint8Array> {
  if (plaintext.length > MAX_PAYLOAD_BYTES) throw new Error('payload_too_large');
  const uaPublic = fromB64url(p256dh);
  const authSecret = fromB64url(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('bad_p256dh');
  if (authSecret.length !== 16) throw new Error('bad_auth');

  const sender = opts.senderKeys
    ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, sender.privateKey, 256));

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" ‖ 0x00 ‖ ua_public ‖ as_public, 32)
  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode('WebPush: info\u0000'), uaPublic, asPublic), 32);
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\u0000'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\u0000'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const record = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, record);
}

export interface PushTarget { endpoint: string; p256dh: string; auth: string }

export interface PushOutcome {
  status: number;
  /** 201 (or any 2xx): the push service accepted it for delivery. */
  ok: boolean;
  /** 404 / 410: the subscription no longer exists; stop sending to it. */
  gone: boolean;
  error?: string;
}

/**
 * Push services we send to. Anything else is refused before a request is made: the
 * endpoint is user-supplied, and the server must never POST to an arbitrary URL.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/,
  // v10.116.0 (T2b-2, BE-FN-07): Apple's web push host, and Windows' WNS hosts. The old wildcards
  // (*.push.apple.com, *.notify.windows.com) let anyone register a host that never answers.
  // Same list as register_push_subscription's check.
  /^web\.push\.apple\.com$/,
  /^wns2-[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export async function sendWebPush(
  target: PushTarget, payload: unknown, keys: VapidKeys,
  opts: { ttlSeconds?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; timeoutMs?: number } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<PushOutcome> {
  if (!isPushEndpoint(target.endpoint)) return { status: 0, ok: false, gone: true, error: 'endpoint_not_allowed' };
  let body: Uint8Array;
  try {
    body = await encryptPayload(enc.encode(JSON.stringify(payload)), target.p256dh, target.auth);
  } catch (e) {
    return { status: 0, ok: false, gone: false, error: (e as Error).message };
  }
  // W0 (audit 2026-10-04, BE-FN-07) — a network failure or a push service that never
  // answers is a failed delivery for THIS device, not an exception: one unreachable
  // endpoint used to abort the whole dispatch, so nothing after it was sent and nothing
  // was marked pushed (the next run re-sent everything and died at the same place).
  let res: Response;
  try {
    res = await fetchImpl(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: String(opts.ttlSeconds ?? 24 * 3600),
        Urgency: opts.urgency ?? 'normal',
        Authorization: await vapidAuthorization(target.endpoint, keys),
      },
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
  } catch (e) {
    return { status: 0, ok: false, gone: false, error: `network: ${(e as Error)?.message ?? String(e)}`.slice(0, 300) };
  }
  const ok = res.status >= 200 && res.status < 300;
  const gone = res.status === 404 || res.status === 410;
  let error: string | undefined;
  if (!ok) { try { error = (await res.text()).slice(0, 300); } catch { error = undefined; } }
  return { status: res.status, ok, gone, ...(error ? { error } : {}) };
}
