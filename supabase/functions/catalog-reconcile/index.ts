/// <reference path="../_shared/catalog/edge.d.ts" />
import { catalogueRuntime } from '../_shared/catalog/runtime.ts';
import { createReconcileHandler } from '../_shared/catalog/sync.ts';

Deno.serve(async request => {
  try {
    const secret = Deno.env.get('CATALOG_RECONCILE_SECRET');
    if (!secret) return new Response('catalogue not configured', { status: 503 });
    return await createReconcileHandler({ ...catalogueRuntime(name => Deno.env.get(name)), secret })(request);
  } catch { return new Response('catalogue unavailable', { status: 503 }); }
});
