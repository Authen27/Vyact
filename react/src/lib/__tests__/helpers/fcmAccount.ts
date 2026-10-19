// A Firebase service account with a fresh RSA key, as the Firebase console gives it (JSON with "\n" in the
// key), for the FCM tests (T4d). The public key verifies what the sender signed.
import { parseServiceAccount, GOOGLE_TOKEN_URL, type ServiceAccount } from '../../../../../supabase/functions/_shared/fcm';

export async function testServiceAccount(): Promise<{ sa: ServiceAccount; json: string; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'],
  ) as CryptoKeyPair;
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
  const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, '$1\n');
  const account = { type: 'service_account', project_id: 'vyact-app', private_key_id: 'k1',
    private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`, // secret-scan: allow (generated at runtime; a test fixture, never a real key)
    client_email: 'fcm-sender@vyact-app.iam.gserviceaccount.com', client_id: '1', token_uri: GOOGLE_TOKEN_URL };
  return { sa: parseServiceAccount(JSON.stringify(account))!, json: JSON.stringify(account), publicKey: pair.publicKey };
}

/** Google's token endpoint answering with an access token. */
export const tokenReply = () => new Response(JSON.stringify({ access_token: 'ya29.test-token', expires_in: 3599, token_type: 'Bearer' }), { status: 200 });
