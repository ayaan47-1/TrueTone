// Keyed hash for user/IP keys (gap-9 §3.4, §4). The secret lives only in the function's secrets,
// never in the event store; rotating it rotates every key.
export async function hmacSha256Hex(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}
