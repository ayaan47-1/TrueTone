export type FailureCode = 'operation_failed' | 'shopify_throttled' | 'shopify_failed' | 'deadline' | 'configuration_missing';
export class CatalogFailure extends Error {
  readonly code:FailureCode;
  constructor(code: FailureCode) { super(code.startsWith('shopify_')?'Shopify request failed':code); this.code=code; }
}
export type CatalogLog = (record: { event: string; code: FailureCode }) => void;
export const catalogLog: CatalogLog = record => console.error(JSON.stringify(record));
export const failureCode = (error: unknown): FailureCode => error instanceof CatalogFailure ? error.code : 'operation_failed';
