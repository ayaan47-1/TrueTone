import { z } from 'zod';
import { productSchema, queryCostsSchema, type QueryCosts, type ProductPage, type CatalogueSource, type InventorySnapshot, type ProductSnapshot } from './contracts.ts';
import { CatalogFailure } from './diagnostics.ts';

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
const inventoryFields = `id inventoryLevels(first:20, after:$levelsAfter) {
  nodes { location { id } quantities(names:["available"]) { name quantity } }
  pageInfo { hasNextPage endCursor }
}`;
const productFields = `id title vendor status publishedOnPublication(publicationId:$publication) formula:metafield(namespace:"truetone",key:"formula_version"){value}
  variants(first:20,after:$variantsAfter){nodes{id title sku barcode price inventoryItem{${inventoryFields.replace('first:20','first:1')}}} pageInfo{hasNextPage endCursor}}`;

export class ShopifyCatalogue implements CatalogueSource {
  private available=1000;
  private maximum=1000;
  private restoreRate=50;
  private budgetAt=Date.now();
  private reserved=0;
  private costs:QueryCosts={};
  private readonly deadline=Date.now()+95_000;
  private readonly stop=new AbortController();
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

  restoreCosts(costs:QueryCosts):void { this.costs=queryCostsSchema.parse(costs); }
  queryCosts():QueryCosts { return {...this.costs}; }

  private async query(shape:keyof QueryCosts,query: string, variables: Record<string, unknown>): Promise<unknown> {
    // Shopify caps a single query at 1000 requested points. Do not guess before calibration.
    let cost=0;
    while(true) {
      cost=this.costs[shape]??Math.min(1000,this.maximum);
      if(cost>this.maximum) throw new CatalogFailure('shopify_throttled');
      const now=Date.now();
      this.available=Math.min(this.maximum,this.available+(now-this.budgetAt)*this.restoreRate/1000);
      this.budgetAt=now;
      if(this.stop.signal.aborted || now>=this.deadline) throw new CatalogFailure('deadline');
      if(this.available>=cost) { this.available-=cost; this.reserved+=cost; break; }
      await new Promise(resolve=>setTimeout(resolve,Math.min(1000,Math.ceil((cost-this.available)/this.restoreRate*1000))));
    }
    const response = await (this.config.fetcher ?? fetch)(`https://${this.config.shop}/admin/api/2026-10/graphql.json`, {
      method: 'POST', redirect:'error', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': this.config.accessToken },
      body: JSON.stringify({ query, variables }), signal: AbortSignal.any([this.stop.signal,AbortSignal.timeout(Math.max(1,Math.min(15_000,this.deadline-Date.now())))]),
    });
    if (!response.ok) throw new CatalogFailure(response.status===429?'shopify_throttled':'shopify_failed');
    const envelope = z.object({ data: z.unknown().optional(), errors: z.array(z.object({extensions:z.object({code:z.string().optional()}).optional()}).passthrough()).optional(),
      extensions:z.object({cost:z.object({requestedQueryCost:z.number().nonnegative(),actualQueryCost:z.number().nonnegative().nullable(),throttleStatus:z.object({maximumAvailable:z.number().positive(),currentlyAvailable:z.number().nonnegative(),restoreRate:z.number().positive()})})}).optional(),
    }).parse(await response.json());
    if(envelope.extensions) {
      const bill=envelope.extensions.cost;
      this.maximum=bill.throttleStatus.maximumAvailable;
      this.restoreRate=bill.throttleStatus.restoreRate;
      if(bill.requestedQueryCost>0 && bill.requestedQueryCost<=1000) this.costs[shape]=bill.requestedQueryCost;
      this.reserved-=cost;
      // A remote balance may predate other in-flight reservations. Only reduce against it.
      this.available=Math.max(0,Math.min(this.maximum,
        this.available+cost-(bill.actualQueryCost??bill.requestedQueryCost),
        bill.throttleStatus.currentlyAvailable-this.reserved));
    } else {
      this.reserved-=cost;
    }
    if (envelope.errors?.length || !envelope.data) throw new CatalogFailure(envelope.errors?.some(e=>e.extensions?.code==='THROTTLED')?'shopify_throttled':'shopify_failed');
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
      const data = z.object({ inventoryItem: itemSchema }).parse(await this.query('inventory',
        `query($id:ID!,$levelsAfter:String){inventoryItem(id:$id){${inventoryFields}}}`, { id: item.id, levelsAfter: cursor }));
      levels.push(...this.mapLevels(data.inventoryItem.inventoryLevels));
      page = data.inventoryItem.inventoryLevels.pageInfo;
    }
    return levels;
  }

  async inventory(id: string): Promise<InventorySnapshot> {
    const data = z.object({ inventoryItem: itemSchema }).parse(await this.query('inventory',
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
      const data = z.object({ product: productInfo.nullable(), shop: z.object({ currencyCode: z.string().length(3) }) }).parse(await this.query('product',
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

  async page(cursor:string|null):Promise<ProductPage> {
    try {
      const data = z.object({ products: z.object({ nodes: z.array(z.object({ id: gid })).max(100), pageInfo }) }).parse(await this.query('products',
        'query($after:String){products(first:100,after:$after){nodes{id} pageInfo{hasNextPage endCursor}}}', { after: cursor }));
      const products:ProductSnapshot[]=[];
      for(let from=0;from<data.products.nodes.length;from+=8) {
        const batch=await Promise.all(data.products.nodes.slice(from,from+8).map(async row=>{
          const product=await this.product(row.id);
          if(!product) throw new Error('Shopify catalogue changed during reconciliation');
          return product;
        }));
        products.push(...batch);
      }
      const next=data.products.pageInfo.hasNextPage?nextCursor(data.products.pageInfo,new Set(cursor?[cursor]:[])):null;
      return {products,nextCursor:next};
    } catch(error) { this.stop.abort(); throw error; }
  }

  async *products(): AsyncIterable<ProductSnapshot> {
    let cursor: string | null = null;
    const seen = new Set<string>();
    do {
      const page=await this.page(cursor);
      for(const product of page.products) yield product;
      cursor=page.nextCursor;
      if(cursor && seen.has(cursor)) throw new Error('Shopify pagination did not advance');
      if(cursor) seen.add(cursor);
    } while (cursor !== null);
  }
}

function nextCursor(page: z.infer<typeof pageInfo>, seen: Set<string>): string {
  if (!page.endCursor || seen.has(page.endCursor)) throw new Error('Shopify pagination did not advance');
  seen.add(page.endCursor);
  return page.endCursor;
}

function normalize(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
