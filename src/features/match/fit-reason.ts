// src/features/match/fit-reason.ts
// Builds the short "why it fits" line for a product. Describes SHADE MATCH + look/feel
// ONLY — never skin improvement, never structure/function verbs (boosts/repairs/heals).
import type { Product, MatchProfile } from './match-types';
import { UNDERTONE_LABELS } from '../../content/makeup-vocab';

/** Static cosmetic-only fragments, gathered for the compliance test. */
export const FIT_REASON_FRAGMENTS: readonly string[] = [
  'close to your shade',
  'a touch deeper than your shade',
  'a touch lighter than your shade',
  'sheer, the way you like it',
  'the full-glam finish you wanted',
  'a dewy finish, not drying',
];

function undertoneClause(product: Product, profile: MatchProfile): string {
  const mine = UNDERTONE_LABELS[profile.undertone].toLowerCase();
  if (product.undertone === profile.undertone) return 'matches your ' + mine + ' undertone';
  return 'a ' + UNDERTONE_LABELS[product.undertone].toLowerCase() + ' lean on your ' + mine + ' undertone';
}

function shadeClause(product: Product, profile: MatchProfile): string {
  const diff = product.shade - profile.shade;
  if (Math.abs(diff) <= 1) return 'close to your shade';
  return diff > 0 ? 'a touch deeper than your shade' : 'a touch lighter than your shade';
}

function finishClause(product: Product, profile: MatchProfile): string | null {
  if (profile.coverage === 'glam' && product.finish === 'glam') return 'the full-glam finish you wanted';
  if (profile.coverage === 'light' && product.finish === 'sheer') return 'sheer, the way you like it';
  if (profile.skips.includes('drying_matte') && product.finish === 'dewy') return 'a dewy finish, not drying';
  return null;
}

/** Assemble a short, cosmetic-only reason for why a product fits the user's shade + prefs. */
export function fitReason(product: Product, profile: MatchProfile): string {
  const parts: string[] = [undertoneClause(product, profile), shadeClause(product, profile)];
  const finish = finishClause(product, profile);
  if (finish) parts.push(finish);
  return parts.join(' \u00b7 ');
}
