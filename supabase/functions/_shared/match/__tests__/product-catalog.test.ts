// supabase/functions/_shared/match/__tests__/product-catalog.test.ts
// TrueTone rule: no remote image URLs. This catalog previously built thumbnails from
// https://placehold.co/..., fetching a third-party host for display-only data that is
// never consumed by any current UI (see product-catalog.ts's own header comment).
import { catalog } from '../product-catalog';

describe('shared match product catalog: no remote image URLs', () => {
  it('has no entry whose image field is a remote http(s) URL', () => {
    for (const product of catalog) {
      if ('image' in product && product.image !== undefined) {
        expect(product.image).not.toMatch(/^https?:\/\//);
      }
    }
  });
});
