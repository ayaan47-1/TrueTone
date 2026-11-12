/// <reference path="../_shared/catalog/edge.d.ts" />
import { catalogueRuntime } from '../_shared/catalog/runtime.ts';
import { createWebhookHandler } from '../_shared/catalog/sync.ts';

Deno.serve(async request => {
  try {
    const secret = Deno.env.get('SHOPIFY_CATALOG_WEBHOOK_SECRET');
    if (!secret) return new Response('catalogue not configured', { status: 503 });
    return await createWebhookHandler({ ...catalogueRuntime(name => Deno.env.get(name)), secret })(request);
  } catch { return new Response('catalogue unavailable', { status: 503 }); }
});
