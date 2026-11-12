import { z } from 'zod';
import { productSchema, type CatalogueSource, type InventorySnapshot, type ProductSnapshot } from './contracts.ts';

const pageInfo = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });
const gid = z.string().startsWith('gid://shopify/');
const inventoryPage = z.object({ nodes: z.array(z.object({
  location: z.object({ id: gid }), quantities: z.array(z.object({ name: z.string(), quantity: z.number().int() })),
})), pageInfo });
const itemSchema = z.object({ id: gid, inventoryLevels: inventoryPage });
const variantPage = z.object({ nodes: z.array(z.object({
  id: gid, title: z.string().min(1), sku: z.string().nullable(), barcode: z.string().nullable(),
  price: z.string().regex(/^\d+(\.\d+)?$/), inventoryItem: itemSchema,
})), pageInfo });
const productInfo = z.object({
  id: gid, title: z.string().min(1), vendor: z.string(), publishedOnPublication: z.boolean(), status: z.string(),
  formula: z.object({ value: z.string().min(1) }).nullable(), variants: variantPage,
});
const inventoryFields = `id inventoryLevels(first:100, after:$levelsAfter) {
  nodes { location { id } quantities(names:["available"]) { name quantity } }
  pageInfo { hasNextPage endCursor }
}`;
const productFields = `id title vendor status publishedOnPublication(publicationId:$publication) formula:metafield(namespace:"truetone",key:"formula_version"){value}
  variants(first:100,after:$variantsAfter){nodes{id title sku barcode price inventoryItem{${inventoryFields}}} pageInfo{hasNextPage endCursor}}`;

export class ShopifyCatalogue implements CatalogueSource {
  private readonly config: {
    shop: string; accessToken: string; publicationId: string; onlineLocationIds: string[]; fetcher?: typeof fetch;
  };
  constructor(config: ShopifyCatalogue['config']) {
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.shop)) throw new Error('invalid Shopify domain');
    if (!config.publicationId.startsWith('gid://shopify/Publication/') || !config.onlineLocationIds.length) {
      throw new Error('publication and online locations are required');
    }
    this.config = config;
  }

  private async query(query: string, variables: Record<string, unknown>): Promise<unknown> {
    const response = await (this.config.fetcher ?? fetch)(`https://${this.config.shop}/admin/api/2026-10/graphql.json`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': this.config.accessToken },
      body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Shopify request failed');
    const envelope = z.object({ data: z.unknown().optional(), errors: z.array(z.unknown()).optional() }).parse(await response.json());
    if (envelope.errors?.length || !envelope.data) throw new Error('Shopify GraphQL failed');
    return envelope.data;
  }

  private mapLevels(page: z.infer<typeof inventoryPage>): InventorySnapshot['levels'] {
    return page.nodes.map(level => {
      const quantity = level.quantities.find(row => row.name === 'available');
      if (!quantity) throw new Error('Shopify available quantity missing');
      return { location_gid: level.location.id, available: quantity.quantity, online: this.config.onlineLocationIds.includes(level.location.id) };
    });
  }

  private async remainingLevels(item: z.infer<typeof itemSchema>): Promise<InventorySnapshot['levels']> {
    const levels = this.mapLevels(item.inventoryLevels);
    let page = item.inventoryLevels.pageInfo;
    const seen = new Set<string>();
    while (page.hasNextPage) {
      const cursor = nextCursor(page, seen);
      const data = z.object({ inventoryItem: itemSchema }).parse(await this.query(
        `query($id:ID!,$levelsAfter:String){inventoryItem(id:$id){${inventoryFields}}}`, { id: item.id, levelsAfter: cursor }));
      levels.push(...this.mapLevels(data.inventoryItem.inventoryLevels));
      page = data.inventoryItem.inventoryLevels.pageInfo;
    }
    return levels;
  }

  async inventory(id: string): Promise<InventorySnapshot> {
    const data = z.object({ inventoryItem: itemSchema }).parse(await this.query(
      `query($id:ID!,$levelsAfter:String){inventoryItem(id:$id){${inventoryFields}}}`, { id, levelsAfter: null }));
    return { inventory_item_gid: data.inventoryItem.id, levels: await this.remainingLevels(data.inventoryItem) };
  }

  async product(id: string): Promise<ProductSnapshot | null> {
    const variants: ProductSnapshot['variants'] = [];
    let cursor: string | null = null;
    const seen = new Set<string>();
    let metadata: z.infer<typeof productInfo> | null = null;
    let currency: string | null = null;
    do {
      const data = z.object({ product: productInfo.nullable(), shop: z.object({ currencyCode: z.string().length(3) }) }).parse(await this.query(
        `query($id:ID!,$publication:ID!,$variantsAfter:String,$levelsAfter:String){shop{currencyCode} product(id:$id){${productFields}}}`,
        { id, publication: this.config.publicationId, variantsAfter: cursor, levelsAfter: null }));
      if (!data.product) {
        if (metadata) throw new Error('Shopify product changed during pagination');
        return null;
      }
      if (metadata && (metadata.formula?.value !== data.product.formula?.value || metadata.status !== data.product.status || metadata.publishedOnPublication !== data.product.publishedOnPublication)) {
        throw new Error('Shopify product changed during pagination');
      }
      metadata = data.product;
      currency = data.shop.currencyCode;
      for (const variant of metadata.variants.nodes) {
        variants.push({ variant_gid: variant.id, inventory_item_gid: variant.inventoryItem.id,
          formula_key: `${normalize(metadata.vendor)}:${normalize(metadata.title)}`, formula_version: metadata.formula?.value ?? 'unversioned',
          shade_name: variant.title, vendor: metadata.vendor, sku: variant.sku, barcode: variant.barcode,
          published: metadata.status === 'ACTIVE' && metadata.publishedOnPublication,
          price: Number(variant.price), currency, levels: await this.remainingLevels(variant.inventoryItem) });
      }
      cursor = metadata.variants.pageInfo.hasNextPage ? nextCursor(metadata.variants.pageInfo, seen) : null;
    } while (cursor !== null);
    return productSchema.parse({ product_gid: id, variants });
  }

  async *products(): AsyncIterable<ProductSnapshot> {
    let cursor: string | null = null;
    const seen = new Set<string>();
    do {
      const data = z.object({ products: z.object({ nodes: z.array(z.object({ id: gid })), pageInfo }) }).parse(await this.query(
        'query($after:String){products(first:100,after:$after){nodes{id} pageInfo{hasNextPage endCursor}}}', { after: cursor }));
      for (const row of data.products.nodes) {
        const product = await this.product(row.id);
        if (!product) throw new Error('Shopify catalogue changed during reconciliation');
        yield product;
      }
      cursor = data.products.pageInfo.hasNextPage ? nextCursor(data.products.pageInfo, seen) : null;
    } while (cursor !== null);
  }
}

function nextCursor(page: z.infer<typeof pageInfo>, seen: Set<string>): string {
  if (!page.endCursor || seen.has(page.endCursor)) throw new Error('Shopify pagination did not advance');
  seen.add(page.endCursor);
  return page.endCursor;
}

function normalize(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
