/// <reference path="../_shared/catalog/edge.d.ts" />
import { catalogueRuntime } from '../_shared/catalog/runtime.ts';
import { createReconcileHandler } from '../_shared/catalog/sync.ts';
import { catalogLog, failureCode } from '../_shared/catalog/diagnostics.ts';

Deno.serve(async request => {
  try {
    const secret = Deno.env.get('CATALOG_RECONCILE_SECRET');
    if (!secret) { catalogLog({event:'catalog_reconcile_configuration',code:'configuration_missing'}); return new Response('catalogue not configured', { status: 503 }); }
    return await createReconcileHandler({ ...catalogueRuntime(name => Deno.env.get(name)), secret })(request);
  } catch(error) { catalogLog({event:'catalog_reconcile_entry_failed',code:failureCode(error)}); return new Response('catalogue unavailable', { status: 503 }); }
});
