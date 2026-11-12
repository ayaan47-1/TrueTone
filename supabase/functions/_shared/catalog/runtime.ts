import { z } from 'zod';
import { ShopifyCatalogue } from './shopify.ts';
import { SupabaseCatalogueStore } from './store.ts';

export function catalogueRuntime(get: (name: string) => string | undefined) {
  const required = (name: string) => z.string().min(1).parse(get(name));
  return {
    shop: required('SHOPIFY_STORE_DOMAIN'),
    store: new SupabaseCatalogueStore({ url: required('SUPABASE_URL'), serviceKey: required('SUPABASE_SERVICE_ROLE_KEY') }),
    shopify: new ShopifyCatalogue({ shop: required('SHOPIFY_STORE_DOMAIN'), accessToken: required('SHOPIFY_ADMIN_ACCESS_TOKEN'),
      publicationId: required('SHOPIFY_PUBLICATION_ID'),
      onlineLocationIds: z.array(z.string().regex(/^gid:\/\/shopify\/Location\/\d+$/)).min(1).parse(JSON.parse(required('SHOPIFY_ONLINE_LOCATION_IDS'))) }),
  };
}
