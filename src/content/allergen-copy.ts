// src/content/allergen-copy.ts
// Every user-facing allergen string (design §5.1), one source like makeup-vocab.ts.
// PLACEHOLDER — COUNSEL REVIEW REQUIRED (design D2): the disclaimer (C2), the health-data consent
// (C15) and the referral note are drafts pending counsel. Tested against the disease filter and the
// shared MEDICAL_CLAIM_BLOCKLIST (allergen-copy.test.ts) and scanned by check-no-medical-claims.
// Rules (design §5.2): describe what a label lists, never what a product does to the user; never
// "safe"; refer to "a doctor or dermatologist"; never tell the user what to do about an allergy.
import { ALLERGEN_DISCLAIMER } from './medical-claims';

export const ALLERGEN_COPY = {
  disclaimer: ALLERGEN_DISCLAIMER, // C2
  setup: {
    title: 'Any cosmetic ingredients you want us to flag?', // C1
    subtitle:
      'Optional. For example, ingredients you prefer not to use or were advised to avoid. We check ' +
      'product ingredient lists for them. You can change this anytime in Account.', // C1b
    yes: 'Yes, choose ingredients', // C1c
    no: 'No',
    skip: 'Skip for now',
    save: 'Save my flags',
  },
  groupsHeading: 'Common ingredient groups',
  searchLabel: 'Search for an ingredient',
  searchPlaceholder: 'e.g. linalool or sweet almond oil',
  addTyped: 'Add this name',
  searchNoMatch: "We'll look for this exact name on ingredient lists.", // C13
  freeTextRejected: 'Please enter an ingredient name as it appears on product labels.', // C16
  removeItem: (name: string) => `Remove ${name}`,
  referralNote: (group: string) =>
    `We don't flag ${group} in products. Please talk to a doctor or dermatologist about it.`,
  consent: {
    title: 'Your ingredient flags',
    body:
      'Your ingredient flags are stored only on this phone and used only to flag those ingredients ' +
      'when we show you products and build routines. We never share or sell them. You can delete ' +
      'them anytime.', // C15
    policyLink: 'Read the Consumer Health Data Policy',
    agree: 'I agree',
    confirm: 'Agree and save',
    decline: 'Decline',
    failed: "We couldn't record your consent, so your flags weren't saved. Please try again.",
  },
  editor: {
    title: 'Ingredient flags',
    empty: "You haven't flagged any ingredients.",
    save: 'Save changes',
    saved: 'Saved on this phone.',
    clearAll: 'Remove all flags',
    withdraw: 'Withdraw consent and delete flags',
    withdrawFailed: "We couldn't delete your flags on this phone. Please try again.",
    withdrawPending: "Your choice is saved on this phone. We'll confirm it when you're back online.",
  },
  settingsRow: {
    title: 'Ingredient flags', // C12
    sub: (n: number) => (n > 0 ? `${n} flagged` : 'None'),
  },
  saveFailed: "We couldn't save your flags on this phone. Please try again.",
  loadFailed:
    "Your ingredient flags couldn't be loaded, so products aren't being checked right now.", // C11
  // P2 strings (no filtering ships in P1); kept here so the copy test covers them from day one.
  badgeNoList: 'No ingredient list', // C3
  detailNoList:
    "We don't have a readable ingredient list for this product, so we can't check it against " +
    'your flags. Check the product label.',
  badgeFlagged: 'Contains a flagged ingredient', // C4
  detailFlagged: (ingredient: string, group: string) =>
    `Lists ${ingredient} (${group}), which is on your flag list.`,
  mayContain: (ingredient: string) =>
    `May contain ${ingredient}, which is on your flag list. Check the label for your shade.`, // C5
  umbrellaFragrance: (ingredient: string) =>
    "Lists fragrance. Individual fragrance components aren't always listed, so " +
    `${ingredient} may be included.`, // C6
  noneListed: (date: string) =>
    "None of your flagged ingredients appear on this product's listed ingredients " +
    `(as of ${date}). Lists can change, so check the label.`, // C7
  hiddenCount: (n: number) => `${n} hidden because of your ingredient flags · Show`, // C8
  unrecognized:
    "Some listed ingredients weren't recognized, so we couldn't check them all.", // C9
  clashHeader: 'Heads-up on this routine', // C14
} as const;

const SAMPLE = 'Linalool';

/** Every string, with templates filled from sample values, for the copy test and CI scan. */
export function allCopyStrings(): string[] {
  const out: string[] = [];
  const visit = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') out.push(String(v(SAMPLE, 'Fragrance', 3)), String(v(0)));
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(ALLERGEN_COPY);
  return out;
}
