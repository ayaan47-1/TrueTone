import fs from 'node:fs';
import path from 'node:path';

describe('Shopify media boundary', () => {
  it('keeps remote Shopify media on Shop and product detail only', () => {
    const uiRoot = path.resolve(__dirname, '../ui');
    const bagSource = fs.readFileSync(path.join(uiRoot, 'ShopifyBagScreen.tsx'), 'utf8');

    expect(bagSource).not.toMatch(/<Image|source=\{\{\s*uri:/);
    expect(bagSource).toContain('<ProductArt');
    expect(fs.readFileSync(path.join(uiRoot, 'ShopifyShopScreen.tsx'), 'utf8')).toMatch(/<Image/);
    expect(fs.readFileSync(path.join(uiRoot, 'ShopifyProductScreen.tsx'), 'utf8')).toMatch(/<Image/);
  });
});
