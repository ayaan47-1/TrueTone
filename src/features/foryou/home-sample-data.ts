// src/features/foryou/home-sample-data.ts
// SAMPLE DATA — NOT THE USER'S REAL DATA. The designer's v3 home shows a daily routine and
// a "Running low" list; we have no routine-plan or refill signal yet, so these cards run on
// this fixed local sample until real data exists. Cosmetic copy only; no numbers claimed.
import { catalog } from '../match/product-catalog';
import type { Product } from '../match/match-types';

export type RoutineSlot = 'AM' | 'PM';

export interface SampleRoutineStep {
  readonly title: string;
  readonly detail: string;
  /** Step-number chip background (theme palette colour). */
  readonly tone: string;
}

export const SAMPLE_ROUTINE: Readonly<Record<RoutineSlot, readonly SampleRoutineStep[]>> = {
  AM: [
    { title: 'Prep', detail: 'Lightweight moisturizer', tone: '#e7f1ea' },
    { title: 'Base', detail: 'Skin tint, pressed in', tone: '#EBE2D3' },
    { title: 'Set', detail: 'Cream blush + brow gel', tone: '#F8EEE7' },
  ],
  PM: [
    { title: 'Remove', detail: 'Cleansing balm', tone: '#e7f1ea' },
    { title: 'Refresh', detail: 'Hydrating mist', tone: '#EBE2D3' },
    { title: 'Rest', detail: 'Overnight lip balm', tone: '#F8EEE7' },
  ],
};

/** Sample starting state: the first AM step ticked, as in the kit. Keys are `${slot}${index}`. */
export const SAMPLE_ROUTINE_DONE: Readonly<Record<string, boolean>> = { AM0: true };

export interface SampleRunningLowItem {
  readonly product: Product;
  readonly note: string;
  /** Tints the note clay when the item is nearly gone. */
  readonly urgent: boolean;
}

function byId(id: string): Product {
  const product = catalog.find((p) => p.id === id);
  if (!product) throw new Error(`home-sample-data: unknown catalog id ${id}`);
  return product;
}

export const SAMPLE_RUNNING_LOW: readonly SampleRunningLowItem[] = [
  { product: byId('lum-tint-01'), note: 'Almost out', urgent: true },
  { product: byId('lum-lip-29'), note: 'About a week left', urgent: false },
];
