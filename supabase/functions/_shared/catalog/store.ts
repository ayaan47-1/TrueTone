import { z } from 'zod';
import type { CatalogueStore, InventorySnapshot, ProductSnapshot } from './contracts.ts';

export class SupabaseCatalogueStore implements CatalogueStore {
  private readonly config: { url: string; serviceKey: string; fetcher?: typeof fetch };
  constructor(config: SupabaseCatalogueStore['config']) {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','kong'].includes(url.hostname))) {
      throw new Error('secure persistence URL required');
    }
    if (url.username || url.password || url.search || url.hash) throw new Error('invalid persistence URL');
    this.config = { ...config, url: config.url.replace(/\/$/,'') };
  }

  private async rpc(name: string, parameters: Record<string, unknown>): Promise<unknown> {
    const response = await (this.config.fetcher ?? fetch)(`${this.config.url}/rest/v1/rpc/${name}`, {
      method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${this.config.serviceKey}`, apikey: this.config.serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('catalogue persistence failed');
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }

  async claim(id: string, topic: string): Promise<'claimed' | 'done' | 'busy'> {
    return z.enum(['claimed','done','busy']).parse(await this.rpc('catalog_claim_event', { p_event_id: id, p_topic: topic }));
  }
  async complete(id: string): Promise<void> { await this.rpc('catalog_finish_event', { p_event_id: id, p_success: true }); }
  async fail(id: string): Promise<void> { await this.rpc('catalog_finish_event', { p_event_id: id, p_success: false }); }
  async applyProduct(product: ProductSnapshot, observedAt: string): Promise<void> {
    await this.rpc('catalog_apply_product', { p_snapshot: product, p_observed_at: observedAt });
  }
  async deleteProduct(id: string, observedAt: string): Promise<void> {
    await this.rpc('catalog_delete_product', { p_product_gid: id, p_observed_at: observedAt });
  }
  async applyInventory(inventory: InventorySnapshot, observedAt: string): Promise<void> {
    await this.rpc('catalog_apply_inventory', { p_snapshot: inventory, p_observed_at: observedAt });
  }
  async beginReconcile(startedAt: string): Promise<void> { await this.rpc('catalog_begin_reconcile', { p_started_at: startedAt }); }
  async failReconcile(startedAt: string): Promise<void> { await this.rpc('catalog_fail_reconcile', { p_started_at: startedAt }); }
  async finishReconcile(productIds: string[], startedAt: string): Promise<void> {
    await this.rpc('catalog_finish_reconcile', { p_product_ids: productIds, p_started_at: startedAt });
  }
}
