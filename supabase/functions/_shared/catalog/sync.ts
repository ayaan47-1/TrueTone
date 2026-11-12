import { z } from 'zod';
import type { CatalogueSource, CatalogueStore } from './contracts.ts';

const MAX_BODY_BYTES = 2_000_000;
const idSchema = z.union([z.string().regex(/^\d+$/), z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]);

async function rawBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new RangeError('body too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}

async function authentic(body: Uint8Array<ArrayBuffer>, signature: string, secret: string): Promise<boolean> {
  try {
    if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(signature), char => char.charCodeAt(0)), body);
  } catch { return false; }
}

export function createWebhookHandler({ secret, shop, store, shopify }: {
  secret: string; shop: string; store: CatalogueStore; shopify: CatalogueSource;
}): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    let body: Uint8Array<ArrayBuffer>;
    try { body = await rawBody(request); }
    catch { return new Response('body too large', { status: 413 }); }
    if (request.headers.get('x-shopify-shop-domain') !== shop ||
        !await authentic(body, request.headers.get('x-shopify-hmac-sha256') ?? '', secret)) {
      return new Response('invalid signature or shop', { status: 401 });
    }
    const eventId = request.headers.get('x-shopify-webhook-id');
    const topic = request.headers.get('x-shopify-topic');
    if (!eventId || eventId.length > 200 || !topic ||
        !['products/create', 'products/update', 'products/delete', 'inventory_levels/update'].includes(topic)) {
      return new Response('invalid event', { status: 400 });
    }
    let resourceId: string;
    try {
      const payload: unknown = JSON.parse(new TextDecoder().decode(body));
      const parsed = topic === 'inventory_levels/update'
        ? z.object({ inventory_item_id: idSchema }).parse(payload).inventory_item_id
        : z.object({ id: idSchema }).parse(payload).id;
      resourceId = `gid://shopify/${topic === 'inventory_levels/update' ? 'InventoryItem' : 'Product'}/${parsed}`;
    } catch { return new Response('invalid resource', { status: 400 }); }
    try {
      const claim = await store.claim(eventId, topic);
      if (claim === 'done') return new Response('already processed');
      if (claim === 'busy') return new Response('retry later', { status: 503 });
      const observedAt = new Date().toISOString();
      // Fetch current authoritative state even for delete events. A delayed delete must not
      // remove a product that currently exists; all inventory quantities are fetched too.
      if (topic === 'inventory_levels/update') {
        await store.applyInventory(await shopify.inventory(resourceId), observedAt);
      } else {
        const product = await shopify.product(resourceId);
        if (product) await store.applyProduct(product, observedAt);
        else await store.deleteProduct(resourceId, observedAt);
      }
      await store.complete(eventId);
      return new Response('processed');
    } catch {
      try { await store.fail(eventId); } catch { /* A failed lease expires and remains retryable. */ }
      return new Response('catalogue sync failed', { status: 503 });
    }
  };
}

export async function reconcileCatalogue({ store, shopify }: { store: CatalogueStore; shopify: CatalogueSource }): Promise<void> {
  const startedAt = new Date().toISOString();
  const productIds: string[] = [];
  await store.beginReconcile(startedAt);
  try {
    for await (const product of shopify.products()) {
      await store.applyProduct(product, startedAt);
      productIds.push(product.product_gid);
    }
    // Never mark anything missing after a partial/failed page traversal.
    await store.finishReconcile(productIds, startedAt);
  } catch (error) {
    try { await store.failReconcile(startedAt); } catch { /* A stale running row still signals failure. */ }
    throw error;
  }
}

export function createReconcileHandler({ secret, store, shopify }: {
  secret: string; store: CatalogueStore; shopify: CatalogueSource;
}): (request: Request) => Promise<Response> {
  return async request => {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    const bearer = request.headers.get('authorization') ?? '';
    // Compare digests in fixed work, including different-length input.
    const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const expected = await hash(`Bearer ${secret}`);
    const received = await hash(bearer);
    let difference = 0;
    for (let index = 0; index < expected.length; index++) difference |= expected[index] ^ received[index];
    if (difference !== 0) return new Response('unauthorized', { status: 401 });
    try {
      await reconcileCatalogue({ store, shopify });
      return new Response('reconciled');
    } catch { return new Response('reconcile failed', { status: 503 }); }
  };
}
