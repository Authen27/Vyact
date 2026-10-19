// Firebase Cloud Messaging (HTTP v1) for the Vyact Android app (v10.127.0, T4d).
//
// The Play Store app is the web app inside an Android WebView, which has no Web Push. Its phones register an
// FCM token instead (`push_subscriptions` kind 'fcm', register_native_push), and the web-push dispatcher sends
// the SAME payload (payloadFor: the device's "Show details on the lock screen" applies) through this module.
//
//   • Credentials: the Firebase project's service account, as JSON in the Edge Function secret
//     FCM_SERVICE_ACCOUNT_JSON. Its private key signs a short-lived JWT (RS256, WebCrypto), exchanged at
//     Google's token endpoint for an access token, kept per isolate until a minute before it expires.
//   • Message: a NOTIFICATION message (owner: "a tap opens the app"), so Android shows it with the app
//     closed; `data.url` is where a tap lands. One Android channel ('vyact_alerts', created by the app) and the
//     notification's tag (the dedupe key) so a repeat replaces, never stacks.
//   • Outcome: like a Web Push answer. A token FCM says is gone (UNREGISTERED, SENDER_ID_MISMATCH, or a
//     malformed registration token) retires the device. A fault of OURS (credentials, quota, FCM down, no
//     answer) never counts against the phone: `deviceFault: false`, so five bad runs cannot retire every phone.
// Never throws for a provider condition.
import { b64url } from './web-push.ts';
import type { PushPayload } from './web-push-rules.ts';

export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const ANDROID_CHANNEL_ID = 'vyact_alerts';
const BRAND_COLOR = '#E26D5C';
const PROJECT_ID = /^[a-z0-9][a-z0-9-]{3,62}$/;

export interface ServiceAccount { project_id: string; client_email: string; private_key: string }

/** The service account from the secret, or null when it is missing or not one (FCM is then off). */
export function parseServiceAccount(raw: string | null | undefined): ServiceAccount | null {
  if (!raw) return null;
  let v: Record<string, unknown>;
  try { v = JSON.parse(raw); } catch { return null; }
  const { project_id, client_email, private_key } = v ?? {};
  if (typeof project_id !== 'string' || !PROJECT_ID.test(project_id)) return null;
  if (typeof client_email !== 'string' || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(client_email)) return null;
  if (typeof private_key !== 'string' || !private_key.includes('PRIVATE KEY')) return null;
  return { project_id, client_email, private_key };
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const enc = new TextEncoder();
const part = (o: unknown) => b64url(enc.encode(JSON.stringify(o)));

/** The signed assertion Google exchanges for an access token (RFC 7523, RS256). */
export async function signAssertion(sa: ServiceAccount, nowSec: number): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({
    iss: sa.client_email, scope: FCM_SCOPE, aud: GOOGLE_TOKEN_URL, iat: nowSec, exp: nowSec + 3600,
  })}`;
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned)));
  return `${unsigned}.${b64url(sig)}`;
}

let cached: { email: string; token: string; until: number } | null = null;
/** Tests only: forget the isolate's access token. */
export function resetFcmTokenCache(): void { cached = null; }

/** An access token for FCM, reused until a minute before it expires; throws (as `fcm_auth: …`) when refused. */
export async function fcmAccessToken(sa: ServiceAccount, opts: { fetchImpl?: typeof fetch; now?: () => number } = {}): Promise<string> {
  const now = opts.now ?? Date.now;
  if (cached && cached.email === sa.client_email && cached.until > now()) return cached.token;
  const assertion = await signAssertion(sa, Math.floor(now() / 1000));
  const res = await (opts.fetchImpl ?? fetch)(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
    signal: AbortSignal.timeout(10_000),
  });
  const body = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`fcm_auth: ${res.status} ${body.error ?? ''}`.trim());
  cached = { email: sa.client_email, token: body.access_token, until: now() + Math.max(60, (body.expires_in ?? 3600) - 60) * 1000 };
  return body.access_token;
}

/** The FCM v1 message for one phone. Every data value is a string (FCM's rule). */
export function fcmMessage(token: string, p: PushPayload): Record<string, unknown> {
  return {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      data: { url: p.url, tag: p.tag, type: p.type },
      android: {
        priority: 'HIGH',
        ttl: '86400s',
        notification: { tag: p.tag, channel_id: ANDROID_CHANNEL_ID, color: BRAND_COLOR },
      },
    },
  };
}

export interface FcmOutcome { status: number; ok: boolean; gone: boolean; deviceFault: boolean; error?: string }

/** Is this refusal about the phone's token (retire it), not about us? */
export function fcmOutcome(status: number, body: unknown): FcmOutcome {
  if (status >= 200 && status < 300) return { status, ok: true, gone: false, deviceFault: false };
  const err = (body as { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } })?.error ?? {};
  const code = err.details?.find((d) => d?.errorCode)?.errorCode ?? err.status ?? '';
  const message = String(err.message ?? '').slice(0, 200);
  const tokenGone = code === 'UNREGISTERED' || code === 'SENDER_ID_MISMATCH' || status === 404
    || (code === 'INVALID_ARGUMENT' && /registration token/i.test(message));
  return { status, ok: false, gone: tokenGone, deviceFault: tokenGone, error: `${code || 'error'}: ${message}`.slice(0, 300) };
}

/** Sends one notification to one phone. Never throws: a network fault is status 0, ours, not the phone's. */
export async function sendFcm(
  sa: ServiceAccount, token: string, payload: PushPayload,
  opts: { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number } = {},
): Promise<FcmOutcome> {
  let access: string;
  try { access = await fcmAccessToken(sa, opts); }
  catch (e) { return { status: 0, ok: false, gone: false, deviceFault: false, error: String((e as Error)?.message ?? e).slice(0, 300) }; }
  try {
    const res = await (opts.fetchImpl ?? fetch)(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fcmMessage(token, payload)),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) cached = null;            // a stale access token: fetch a new one next time
    return fcmOutcome(res.status, body);
  } catch (e) {
    return { status: 0, ok: false, gone: false, deviceFault: false, error: `network: ${String((e as Error)?.message ?? e).slice(0, 200)}` };
  }
}
