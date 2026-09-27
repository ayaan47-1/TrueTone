# Allergen intake + ingredient-flag recommendations — Phase-0 design

> **Status:** design only (2026-09-27). No code, dependency, migration or config changes ship with
> this doc. Written against `origin/main` @ `88382a6` (R1 unified release: Shop · For You ·
> Community · Account). Brief: `hive/research/truetone-allergen/brief.md`.
>
> **Compliance input:** Dwight's `hive/research/truetone-allergen/compliance.md` (2026-09-27) is
> the rule set this design follows. §10 lists every point where it changed this design. Where the
> two ever disagree, compliance.md wins.
>
> **Hard rule (founder):** the app never gives medical advice. An allergen match is
> *ingredient-label information the user asked us to flag*. A clash note is *informational*
> ("these are commonly not used in the same step"). Neither is ever a safety, suitability or
> clinical statement. §5 turns this into a testable copy rule.

---

## 0. Summary

1. **The user's flagged ingredients stay on the phone.** They are consumer health data (WA MHMDA,
   FTC Health Breach Notification Rule). The catalog, the ingredient data and the matching all run
   on-device already, so nothing about the user needs to go to Supabase. Only a consent receipt
   goes to the server.
2. **Ingredient data is non-personal reference data.** It ships as versioned static data next to
   the catalog (`src/features/match/product-catalog.ts`). It can move to a world-readable Supabase
   table later, when the catalog does.
3. **One normalizer + one alias table** turns every ingredient string (INCI, Latin, common or trade
   name) into a canonical ingredient id. Allergen groups and clash rules are written against ids,
   never raw strings.
4. **Every product gets one of three states:** *has a flagged ingredient*, *no ingredient list we
   can read*, or *none of your flagged ingredients are on its listed ingredients*. We never say
   "safe". The fit % is untouched by any of this.
5. **The blocker is data, not code.** The 30 catalog products are invented. Real ingredient lists
   cannot attach to invented products. Shipping this feature to users needs real SKUs with sourced
   ingredient lists (§7 compares sources; decision D1).

---

## 1. What exists today (verified in the repo)

| Fact | Where | Why it matters |
|---|---|---|
| Catalog = 30 synthetic, brand-neutral products; **no ingredient field** | `src/features/match/product-catalog.ts`, `Product` in `match-types.ts` | Formulations must be added, keyed by `Product.id` |
| One catalog serves Shop, For You, Community tags and My Daily Routine | `COFOUNDER_HANDOFF.md` §4 | One formulation table covers every surface; no second product list |
| Setup is structured: goals / coverage / skips | `app/setup/{goals,coverage,skips}.tsx`, `src/features/preferences/` | The allergen step fits as a 4th Setup screen |
| A `'fragrance'` **skip already exists but does nothing**; the scoring code says it is "filters only", and no filter can run without ingredient data | `src/content/makeup-vocab.ts:45-51`, `src/features/match/scoring.ts:57` | Today a user can tick "skip fragrance" and still see fragranced products. This design gives it a real effect (§3.4) |
| `preferencesStore` defaults to an **in-memory** backend | `src/features/preferences/preferences-store.ts` | Setup answers do not survive a restart. The allergen store must not copy this; it must persist |
| On-device, per-user AsyncStorage pattern with a Data Rights purge | `src/features/routine/routine-storage.ts`, `DataRights.tsx:30-32` | Same pattern for the allergen profile, plus encryption (§2.2) |
| `consent_log.policy_doc_key` references `policy_versions`, whose `doc_key` `CHECK` only allows `privacy, terms, biometric, retention, wa_health` | `0001_schema.sql:14,31` | compliance.md §1.2(4) requires a **separate** `'health'` doc key, so P1 needs a small migration to widen the check and seed the new policy version |
| Two "routines": `recommend/` (category-level skincare engine) and `routine/` (AM/PM logger of catalog products) | `ARCHITECTURE.md` | Clash checks apply differently to each (§3.6) |
| Cosmetic post-filter + disease blocklist | `src/lib/cosmetic-filter.ts`, `src/content/cosmetic-vocab.ts` | All new copy runs through it, plus a feature-specific banned-phrase list (§5.3) |
| No E2E framework (no Maestro/Detox); route-level flows are Jest tests in `app/__tests__/` | `package.json`, `app/__tests__/` | "E2E" in this plan = route-level Jest journeys + a written device script (decision D6) |
| Existing copy says "patch-test new products" | `src/features/recommend/skincare/library.ts:87` | The brief bans patch-test instructions framed as guidance. Pre-existing and out of this doc's scope, but flagged (D7) |

---

## 2. Question 1 — Data model

### 2.1 Where each kind of data lives, and why

| Data | Personal? | Lives | Why |
|---|---|---|---|
| Ingredient dictionary (canonical ids, INCI names, aliases, trade names) | No | Static, versioned TS data in the app bundle (`src/content/ingredients/`) | Deterministic, offline, reviewable in PRs, testable like `cosmetic-vocab.ts`. Size is a few hundred entries. |
| Allergen groups (e.g. "Fragrance", "Formaldehyde-releasers") | No | Same bundle | Same |
| Clash rules | No | Same bundle | Same, and each rule's wording must pass copy review in a PR |
| Product formulations (ingredient list per product) | No | Static data keyed by `Product.id`, next to the catalog (`src/features/ingredients/formulations.ts`, generated from `data/ingredients/*.csv`) | The catalog is static today. When the catalog moves to Supabase, formulations move with it into a **world-readable, read-only** table (like `policy_versions`), because they describe products, not people |
| **User's flagged ingredients** | **Yes: consumer health data** | **On-device only**: encrypted local store, per-user key | Matching already runs on-device, so the server never needs this list. Keeping it off the server keeps it out of backups and breach scope and away from any vendor. It also means the LLM chat never sees it |
| Consent receipt for health data | Yes (minimal) | Supabase `consent_log`, new `policy_doc_key = 'health'` | Needs an append-only legal record. The receipt says "consented to the ingredient-flag feature". It does not contain the ingredients |

**Cross-device sync is not in P1–P3.** If founders want it later (D3), §2.5 sketches the table and
what it needs.

### 2.2 User allergen profile (on-device)

```ts
// src/features/allergens/allergen-types.ts   (design sketch, not shipped code)
export interface AllergenProfile {
  readonly version: 1;
  /** User answered the question: 'yes' | 'no' | 'skipped'. Never inferred. */
  readonly answer: 'yes' | 'no' | 'skipped';
  /** Selected allergen GROUP ids, e.g. 'fragrance', 'formaldehyde_releasers'. */
  readonly groups: readonly AllergenGroupId[];
  /** Individually selected canonical ingredient ids (from search). */
  readonly ingredients: readonly IngredientId[];
  /** Free-text entries that did not resolve to a known id. Matched by normalized string only.
   *  Validated as an ingredient-name shape (§3.2); rejected if it hits the disease or medical-claim lists. */
  readonly unresolved: readonly string[];      // each ≤ 60 chars, max 20 entries
  /** How matches show on the shelf. Default 'hide'. */
  readonly display: 'hide' | 'flag';
  /** Show or hide products with no readable ingredient list. Default 'show'. */
  readonly unknownDisplay: 'show' | 'hide';
  readonly taxonomyVersion: string;             // dictionary version this was saved against
  readonly updatedAt: string;                   // ISO; device clock
}
```

- **Storage:** `truetone.allergens.<userId>.v1`, same key shape as `routine-storage.ts`.
  **Encrypted at rest** (CLAUDE.md §1 "MUST encrypt at rest"). AsyncStorage is not encrypted. The
  profile is small (ids only, well under 2 KB), so the iOS Keychain via `expo-secure-store` fits.
  That is a **new dependency**, so it is decision D4 and not added here.
- **Deletion:** `clearAllergenProfile(userId)` is called from `DataRights.tsx` delete-everything
  and delete-account, next to `clearAllRoutines()`. Withdrawing health-data consent (§2.4) also
  clears it.
- **Retention:** on-device only. It is gone on delete, on consent withdrawal and on app uninstall.
  The server-side 3-year sweep does not need to cover it because nothing is on the server. The
  retention policy text must still say so (compliance.md §1.2(5)).
- **Purpose limit (compliance.md §1.2(2)):** used only "to flag ingredients you listed when we
  show you products and build routines". No aggregate counts of popular allergens, no model
  training, no marketing use. Any of those would need its own separate consent.
- **Never sent:** not to Supabase, not to the `routine-chat` Edge Function, not in share cards,
  not in Community posts. A new CI guard (§4, WS-B) checks that `allergen-store` is not imported
  by `supabase.ts`, `routine-chat.ts`, `community/` or `shade/ScanShareCard.tsx`.

### 2.3 Ingredient dictionary, groups, formulations, clash rules (static)

```ts
// src/content/ingredients/ingredient-types.ts   (design sketch)
export type IngredientId = string;   // stable slug, e.g. 'linalool', 'methylisothiazolinone'

export interface Ingredient {
  readonly id: IngredientId;
  readonly inci: string;                       // canonical INCI name, e.g. 'Prunus Amygdalus Dulcis Oil'
  readonly aliases: readonly string[];         // common + Latin + older INCI + other languages
  readonly tradeNames: readonly string[];      // e.g. 'Kathon CG' → MCI/MI blend
  readonly casNumbers?: readonly string[];     // optional, for data-import matching only
  readonly classes: readonly ActiveClass[];    // for clash rules, e.g. 'retinoid', 'aha'
  readonly source: SourceRef;                  // where the name/alias came from (CosIng, Annex III…)
}

export interface AllergenGroup {
  readonly id: AllergenGroupId;                // 'fragrance', 'mit', 'formaldehyde_releasers', …
  readonly label: string;                      // user-facing, copy-reviewed
  readonly members: readonly IngredientId[];   // explicit list
  /** Label tokens that mean "this group, contents undisclosed", e.g. 'parfum', 'fragrance', 'aroma'. */
  readonly umbrellaTokens: readonly string[];
  readonly source: SourceRef;
}

export interface ProductFormulation {
  readonly productId: string;                  // FK → Product.id
  readonly status: 'listed' | 'missing' | 'unparseable';
  readonly ingredients: readonly IngredientId[];      // resolved, in label order
  readonly unresolvedTokens: readonly string[];       // label tokens with no dictionary match
  readonly rawText?: string;                          // as captured, for audit/re-parse
  readonly source: SourceRef;                         // brand-supplied / licensed / curated + URL
  readonly capturedAt: string;                        // ISO date the list was captured
  readonly shadeScoped?: boolean;                     // true if the list varies by shade (§4 edge)
}

export interface ClashRule {
  readonly id: string;
  readonly a: ActiveClass;
  readonly b: ActiveClass;                     // may equal a ("stacked": two products with the same class)
  readonly scope: 'same_slot' | 'same_day';
  readonly note: string;                       // informational copy; passes §5.3
  readonly source: SourceRef;
}

export interface SourceRef { readonly kind: 'cosing' | 'eu_annex_iii' | 'mocra' | 'brand' | 'licensed' | 'curated'; readonly ref: string; }
```

**Versioning:** one `TAXONOMY_VERSION` (format `YYYY-MM-DD.N`, same as `POLICY_VERSION`) covers
the dictionary, groups and clash rules. The profile stores the version it was saved against. When
a group gains members, saved group selections pick them up automatically, because the user chose
the group, not a frozen list.

### 2.4 Consent (server, minimal)

- A **separate** consent from the biometric one (compliance.md §1.2(1), §1.2(4)). New doc key
  `'health'`: a migration widens the `policy_versions.doc_key` check, seeds a `health` policy
  version, and `src/content/manifest.ts` (`DocKey`, `POLICY_DOCS`) + `bodies.ts` + a new
  `src/content/health.md` mirror it. The consent-immutability trigger (`0003`) is unchanged and
  covers the new rows.
- New `SECURITY DEFINER` RPCs `record_health_data_consent()` / `withdraw_health_data_consent()`
  insert into `consent_log` with `policy_doc_key = 'health'`, pinned to the current `health`
  version. Withdrawing purges the on-device profile even if the user keeps their account.
- The new `health.md` names: category (cosmetic ingredients the user asks us to flag), purpose
  (flag them in products and routines), source (the user), sharing (**no one**), storage (this
  phone only), and how to view, edit and delete. Counsel drafts and approves it (D2).
- A receipt for data that never leaves the device may not be strictly required. This design logs
  it anyway: low cost, and it gives an audit trail.

### 2.5 If sync is ever approved (D3, not planned)

`public.user_ingredient_flags (user_id uuid pk → profiles, groups text[], ingredients text[],
unresolved text[], taxonomy_version text, updated_at timestamptz)`. RLS owner-only. Writes only
through a `SECURITY DEFINER` RPC. Wiped by `delete_my_data()`. Covered by the retention sweep and
the backup/PITR purge (`0007`). Separate consent. pgTAP tests like `rpc_delete.test.sql`. This is a
new store of health data on the server, so it is an escalation under CLAUDE.md §6.

---

## 3. Matching, filtering and clash scoring (pure, on-device)

### 3.1 Normalizer (`src/features/ingredients/normalize.ts`)

Input: one raw label string. Output: `{ ingredients: IngredientId[], unresolvedTokens: string[],
status }`.

1. Unicode NFKC, lowercase, collapse whitespace, strip trailing `.`.
2. Cut off anything after "may contain", "+/-" or "[+/-" into a separate *may-contain* list. It
   still matches (§4 edge case E7).
3. Split on `,` and `;`. Do not split inside parentheses. Also split on a top-level `/`
   (e.g. `aqua/water/eau`, `parfum/fragrance`) and treat the parts as aliases of one token.
4. Per token, remove: `*` and `†` markers, `(nano)`, percentages, "organic"/"certified" footnote
   markers. Keep the parenthetical common name as an extra alias to try:
   `prunus amygdalus dulcis (sweet almond) oil` → try the full string, then `prunus amygdalus
   dulcis oil`, then `sweet almond oil`.
5. Look up each form in the alias index (INCI + aliases + trade names, all normalized the same
   way). First hit wins. No fuzzy matching in P2. Fuzzy search is for the **user's search box
   only**, where a person confirms the pick (§3.2).
6. Colorants: `CI 77491` etc. map by CI number.
7. Status: `missing` when there is no text, and `unparseable` when more than 30% of tokens are
   unresolved or the text fails basic shape checks (no commas, over 4 KB, looks like marketing
   copy). The 30% threshold is a starting value to tune on real data.

### 3.2 User search (settings + Setup)

Prefix and substring search over INCI, aliases and trade names, with typo tolerance limited to
edit distance 1 for queries of 5 or more characters. The user **picks a result**; we store the id.
If the user types something with no match, we store the normalized text in `unresolved`, and it is
matched only by exact normalized token. The UI says so: "We'll look for this exact name on
ingredient lists."

Free text is still health data and can pull in medical detail (compliance.md §4 Q5). So an
unresolved entry is accepted only if it looks like an ingredient name: letters, digits, spaces,
`-`, `(`, `)`, `/`, `,`; at most 60 characters; at most 6 words. It is rejected if it contains a
`DISEASE_BLOCKLIST` term or a `MEDICAL_CLAIM_BLOCKLIST` phrase. On rejection the field shows C16
and nothing is stored.

### 3.3 Product flag state (`src/features/ingredients/flag-product.ts`)

```ts
type FlagState =
  | { kind: 'flagged'; matches: readonly { ingredientId?: IngredientId; groupId?: AllergenGroupId; token: string }[] }
  | { kind: 'no_list' }          // formulation status missing | unparseable
  | { kind: 'none_listed' };     // listed, and none of the user's flags appear
```

- Match when: an ingredient id is in `profile.ingredients`, **or** it is a member of a selected
  group, **or** a token equals an `umbrellaToken` of a selected group (e.g. the user flags
  "Fragrance" and the label says `parfum`), **or** a normalized token equals an `unresolved` entry.
- A product with `unresolvedTokens` and no match is still `none_listed`. The detail sheet shows
  "Some listed ingredients weren't recognized" (copy C9).
- Shade-scoped formulations (`shadeScoped`) check the list for the shade we would show. If that
  list is unknown, the state is `no_list`.
- Pure function, no I/O, fully unit-tested.

### 3.4 Shelf filtering and ranking

- `profile.display === 'hide'` (default): `flagged` products are removed from Shop, For You rails
  and Community product-tag drawers. A row at the end of the list reads "N hidden because of your
  ingredient flags · Show".
- `'flag'`: they stay in place with a badge and the matched names.
- `no_list` products are shown with a badge by default. `unknownDisplay = 'hide'` removes them.
- **The fit % never changes.** Ingredient state is a filter and a badge, never a score input.
  Boosting `none_listed` products would imply they are better or safer for the user, which is the
  claim we are not allowed to make.
- `isBestMatch` is recomputed after filtering, so a hidden product is never "Best match".
- **Existing `'fragrance'` skip:** powered by the same matcher, as the `fragrance` group with
  `display: 'hide'`. It stays a *preference* in Setup, separate from the allergen question, so a
  user who just dislikes scent is not recorded as having health data. If both are set, the
  allergen profile wins.
- Integration point: one pure step `applyIngredientFlags(scored, profile, formulations)` between
  `match/sort.ts` and the UI, called from `app/(tabs)/shop.tsx`, `foryou/for-you-profile.ts` and
  the Community tag drawer. `scoring.ts` is not modified.

### 3.5 Clash taxonomy (v1 rule set, informational only)

Active classes: `retinoid` (retinol, retinal, retinyl palmitate…), `aha` (glycolic, lactic,
mandelic acid), `bha` (salicylic acid), `pha` (gluconolactone, lactobionic acid),
`l_ascorbic_acid`, `physical_exfoliant` (flagged at product level, since it is not an INCI
property).

| Rule | Scope | Note (copy, passes §5.3) |
|---|---|---|
| retinoid + aha/bha/pha | same slot | "Retinoid-type and exfoliating-acid products are commonly not used in the same step. Check each product's directions." |
| aha/bha/pha stacked (2+ products) | same slot | "This routine has more than one exfoliating-acid product in the same step. Many routines use one at a time. Check each product's directions." |
| retinoid stacked (2+ products) | same day | "More than one retinoid-type product is logged today. Check each product's directions." |
| l_ascorbic_acid + aha/bha | same slot | "Vitamin C (ascorbic acid) and exfoliating-acid products are often used at different times of day. Check each product's directions." |
| physical_exfoliant + aha/bha/pha or retinoid | same slot | "A scrub-type product and an acid or retinoid-type product are commonly not used in the same step. Check each product's directions." |

Deliberately **excluded:** OTC drug actives (benzoyl peroxide, hydroquinone, etc.). They are drugs,
not cosmetics, and naming why people use them pulls in blocked vocabulary. Each rule has a
`source` (a published formulation or dermatology-education reference, curated) and needs founder +
counsel sign-off before it ships (D5). The rules state what is *commonly done*; they never predict
an effect on the user's skin.

### 3.6 Where clash checks run

| Surface | What is checked | Behaviour |
|---|---|---|
| **My Daily Routine logger** (`src/features/routine/`) | Products logged in the same AM/PM slot, or the same day, resolved through formulations → classes | Info banner under the slot, with a dismiss option. Never blocks logging. No banner if a product has `no_list` |
| **Skincare routine engine** (`src/features/recommend/`) | `CategoryKey`s tagged with classes (e.g. `gentle_exfoliant` → `aha/bha`) | **Build-time guarantee, not a runtime warning**: a test asserts `routine-engine` never outputs two categories that trip a `same_slot` rule. No user-facing change |
| Routine publish to Community | The day being published | Same banner in the publish sheet. Publishing is not blocked |
| Shop bag | Not checked in P3 | A bag is not a routine. Revisit if users ask |

---

## 4. Question 3 — Edge cases

| # | Case | Handling |
|---|---|---|
| E1 | Latin vs common name (`Prunus Amygdalus Dulcis Oil` = sweet almond oil) | Both in `aliases`. The parenthetical common name is tried as an alias (§3.1 step 4) |
| E2 | Renamed INCI (`Butyrospermum Parkii` → `Vitellaria Paradoxa` shea butter) | Old name kept as an alias. Dictionary review each taxonomy version |
| E3 | Trade names (`Kathon CG` → methylchloroisothiazolinone + methylisothiazolinone; `Germall 115` → imidazolidinyl urea; `Germall II` → diazolidinyl urea; `Glydant` → DMDM hydantoin; `Bronopol` → 2-bromo-2-nitropropane-1,3-diol) | `tradeNames` on the ingredient. A blend trade name maps to **several** ids. Mainly used for user search; labels use INCI |
| E4 | Umbrella terms (`parfum`, `fragrance`, `aroma`, `flavor`) | `umbrellaTokens` on the `fragrance` group. Matches when the user flagged the group. If the user flagged **only** a single fragrance component (e.g. linalool) and the label says `parfum`, the state is `flagged` with the note "Lists fragrance. Individual fragrance components aren't always listed." (C6). We cannot rule it out, so we must not show `none_listed` |
| E5 | Group membership is open-ended ("botanical extracts / essential oils") | The group is an **explicit curated list** plus a pattern rule (`* leaf/flower/peel/seed oil`, `* extract` whose genus is in a curated botanical-genus list). Pattern hits are flagged with "matched as a plant extract or oil" so the reason is visible. Recall is imperfect, so the group's label says "commonly listed plant extracts and oils" |
| E6 | Latex / non-INCI allergens (latex in applicators, PPD in hair dye) | Latex: a product-level attribute `containsLatexComponent` (e.g. sponges), not an ingredient. PPD: in the dictionary even though the catalog has no hair dye today, so the Setup option is honest when it matches nothing |
| E7 | "May contain (+/-)" colourant ranges | Parsed into the formulation. A match inside it is `flagged` with "may contain" wording (C5) |
| E8 | Missing list | `no_list` badge + C3 copy. Never counts as clear |
| E9 | Unparseable list (over 30% unresolved, marketing text, wrong language) | `no_list` + C3. Raw text kept for re-parse when the dictionary grows. Unresolved tokens are logged **in dev tooling only** for curation, with no user data attached |
| E10 | List differs by shade | `shadeScoped` formulations per shade. If the user's shade list is unknown → `no_list` |
| E11 | Reformulation (brand changes the list) | `capturedAt` shown in the detail sheet ("Ingredient list as of Sep 2026"). Formulations older than a set age (D1) are downgraded to `no_list` until re-verified |
| E12 | User types something we don't know ("tea tree" typo, a brand name) | Search offers the closest ids. If none is picked, it is stored as `unresolved` (exact-token match only) and the UI says so |
| E13 | Taxonomy update renames or removes an id | Migrations map old → new ids inside the app bundle. Removed ids move to `unresolved` so a user's flag is never silently dropped |
| E14 | User answers "No", then later adds flags | Settings entry is always available. Answer becomes `yes` |
| E15 | User withdraws health-data consent | Profile cleared on device, shelf returns to unfiltered, `'fragrance'` skip (a preference) keeps working |
| E16 | Chat asks "is this safe for my allergy?" | The existing `refusal.ts` path is extended: allergy-safety questions get C10 and the LLM is not called. The allergen profile is never in the chat prompt either way |
| E17 | Offline / storage read fails | Fail **closed for display**: if the profile cannot be read, show a banner "Your ingredient flags couldn't be loaded" (C11) and do not claim `none_listed` anywhere |

---

## 5. User-facing copy (all strings, reviewed against the no-medical-advice rule)

### 5.1 Strings

| Id | Where | String |
|---|---|---|
| C1 | Setup step title | "Any cosmetic ingredients you want us to flag?" |
| C1b | Setup subtitle | "Optional. For example, ingredients you prefer not to use or were advised to avoid. We check product ingredient lists for them. You can change this anytime in Account." |
| C1c | Setup buttons | "Yes, choose ingredients" · "No" · "Skip for now" |
| C2 | Standing disclaimer: the canonical string from compliance.md §2.3 (counsel finalizes). Shown on the intake screen above the consent action, on every flagged card and the hidden-count explanation, on the settings page, and injected into chat when allergens or clashes come up | "TrueTone flags ingredients from the product's label against the list you gave us. This is information, not medical or allergy advice. Ingredient lists can change — always check the current label, and talk to a doctor or dermatologist about allergies or reactions." |
| C3 | Badge + detail, `no_list` | Badge "No ingredient list" · Detail "We don't have a readable ingredient list for this product, so we can't check it against your flags. Check the product label." |
| C4 | Badge + detail, `flagged` | Badge "Contains a flagged ingredient" · Detail "Lists {ingredient} ({group}), which is on your flag list." |
| C5 | `flagged` inside may-contain | "May contain {ingredient}, which is on your flag list. Check the label for your shade." |
| C6 | Umbrella fragrance vs a single flagged component | "Lists fragrance. Individual fragrance components aren't always listed, so {ingredient} may be included." |
| C7 | `none_listed` detail (no badge on the card) | "None of your flagged ingredients appear on this product's listed ingredients (as of {date}). Lists can change, so check the label." |
| C8 | Hidden-count row | "{n} hidden because of your ingredient flags · Show" |
| C9 | Unresolved tokens present | "Some listed ingredients weren't recognized, so we couldn't check them all." |
| C10 | Chat refusal for allergy-safety questions | "I can't give advice about allergies. I can show which of your flagged ingredients a product lists. Check the current label, and talk to a doctor or dermatologist about allergy questions." |
| C11 | Profile failed to load | "Your ingredient flags couldn't be loaded, so products aren't being checked right now." |
| C12 | Settings row | "Ingredient flags" · sub "{n} flagged" / "None" |
| C13 | Search no-match | "We'll look for this exact name on ingredient lists." |
| C14 | Clash banner header | "Heads-up on this routine" (the body is the rule `note`, §3.5) |
| C15 | Health-data consent (own screen, before first save, never bundled with biometric consent) | "Your ingredient flags are stored only on this phone and used only to flag those ingredients when we show you products and build routines. We never share or sell them. You can delete them anytime." + link to the `health` policy + unticked checkbox "I agree" |
| C16 | Free-text entry rejected | "Please enter an ingredient name as it appears on product labels." |

C1b avoids "you're allergic to", which compliance.md §2.1 bans as a statement about the user's
body. The Setup question never names the user's health; it asks which ingredients to flag.

### 5.2 Rules every string above follows

- Describes **what a label lists**, never what a product will do to the user.
- Never: *safe/safer/safest, hypoallergenic, allergen-free, non-allergenic, suitable/right/OK for
  you, won't react, reaction (except inside the canonical disclaimer C2), irritating/irritation, sensitizing, gentle on allergies,
  dermatologist-approved/tested, clinically, guaranteed*, or any instruction to test a product on
  skin.
- Every "we checked" statement carries its limit (list date, "check the label").
- Referral is to "a doctor or dermatologist" (compliance.md wording). We never tell the user
  what to do about an allergy.
- The full banned and allowed lists are compliance.md §2.1 and §2.2. This section adds nothing
  looser.

### 5.3 Enforcement

- All strings live in `src/content/allergen-copy.ts` (one source, like `makeup-vocab.ts`).
- A test runs every string, every group `label` and every clash `note` through
  `findDiseaseTerms` / the cosmetic post-filter **and** compliance.md's shared
  `MEDICAL_CLAIM_BLOCKLIST` (`src/content/medical-claims.ts`). Any hit fails CI. The same test
  covers any product-detail string built from templates, using sample values.
- compliance.md §3.1's CI guard `scripts/check-no-medical-claims.mjs` scans the same files. The
  canonical disclaimer (C2) and negations are on its allow list. If the guard fires on copy,
  rewrite the copy; never weaken the guard.

---

## 6. Question 2 — Workstreams (file-level scope)

Three workstreams. WS-B has no UI and unblocks the other two, so it starts first.

### WS-A — Onboarding + settings UI

| File | Change |
|---|---|
| `app/setup/allergens.tsx` (new) | Thin route (props-free convention) → `AllergenSetup` |
| `app/setup/skips.tsx` | "Next" goes to `/setup/allergens` instead of finishing |
| `app/allergens.tsx` (new, root route) | Settings editor, reached from Account |
| `app/(tabs)/you.tsx` | `ListRow` "Ingredient flags" (C12) |
| `src/features/allergens/AllergenSetup.tsx`, `AllergenEditor.tsx`, `AllergenSearch.tsx`, `GroupChecklist.tsx` (new) | Yes/No/Skip → group checklist (brief's 10 groups) + search. Uses `GlassCard`, `Button`, `TextField`, `ListRow`. 48pt tap targets |
| `src/features/allergens/HealthDataConsent.tsx` (new) | C15 sheet before the first save. Calls the consent RPC. Nothing is stored if the user declines |
| `src/features/allergens/allergen-store.ts`, `allergen-types.ts` (new) | Encrypted per-user store (§2.2), immutable updates |
| `src/features/data-rights/DataRights.tsx` | Call `clearAllergenProfile()` in both delete paths |
| `src/content/allergen-copy.ts` (new) | All strings from §5 |
| `src/content/health.md` (new), `manifest.ts`, `bodies.ts`, `privacy.md`, `retention.md` | New `health` policy doc (§2.4) + "on-device only" in retention |
| `src/content/medical-claims.ts` (new) + `scripts/check-no-medical-claims.mjs` (new) + `.github/workflows/compliance.yml` | compliance.md §3.1 shared blocklist + CI guard |
| `supabase/migrations/00xx_health_data_consent.sql` + `supabase/tests/health_consent.test.sql` (new, P1) | Widen `doc_key` check to add `'health'`, seed its policy version, the two consent RPCs, pgTAP. No table for the flags themselves |

### WS-B — Ingredient taxonomy + clash matrix (data + pure logic)

| File | Change |
|---|---|
| `src/content/ingredients/ingredient-types.ts` (new) | Types from §2.3 |
| `src/content/ingredients/dictionary.ts` (new) | Canonical ingredients + aliases + trade names. Seed: brief's 10 groups, EU Annex III fragrance allergens, the clash active classes |
| `src/content/ingredients/groups.ts` (new) | `AllergenGroup` list + `umbrellaTokens` + botanical pattern rule |
| `src/content/ingredients/clash-rules.ts` (new) | §3.5 rules |
| `src/content/ingredients/version.ts` (new) | `TAXONOMY_VERSION` + id migration map (E13) |
| `data/ingredients/` (new, repo data dir) | Curated CSV sources with a `source` column. Never user data |
| `scripts/build-ingredient-data.mjs` (new) | CSV → TS generator + validation (unique ids, no alias claimed by two ids, every group member exists) |
| `scripts/check-allergen-isolation.mjs` (new) | CI guard from §2.2: `allergen-store` is not imported by network, chat, share or community modules. Add to `npm run check:compliance` |

### WS-C — Matching, filtering, routine clash scoring

| File | Change |
|---|---|
| `src/features/ingredients/normalize.ts`, `alias-index.ts`, `search.ts` (new) | §3.1, §3.2 |
| `src/features/ingredients/formulations.ts` (new, generated) | `ProductFormulation` per catalog id |
| `src/features/ingredients/flag-product.ts`, `apply-flags.ts` (new) | §3.3, §3.4. Recompute `isBestMatch` after filtering |
| `app/(tabs)/shop.tsx`, `src/features/shop/ShopList.tsx` | Call `applyIngredientFlags`. Badges. Hidden-count row |
| `src/features/foryou/for-you-profile.ts`, `ProductRail.tsx` | Same filter on both rails |
| `src/features/community/components/ProductTagDrawer.tsx` | Same filter + badges |
| `src/features/ingredients/ProductIngredientsSheet.tsx` (new) | Detail: list, matches highlighted, date, C2/C7/C9 |
| `src/features/ingredients/clash-check.ts` (new) | `(slotProducts, formulations, rules) → Clash[]` |
| `src/features/routine/components/RoutineLogger.tsx`, `routine-publish.ts` UI | Clash banner (C14) |
| `src/features/recommend/skincare/library.ts` + a new test | Tag `CategoryKey` → classes. Test: the engine never outputs a `same_slot` clash pair |
| `src/features/recommend/chat/{refusal,prompt,guard}.ts` (+ `_shared` copies, drift test) | compliance.md §3.2: refusal triggers (`am i allergic`, `is this safe for me`, `will i react`, `hypoallergenic`, `patch test`, …) → C10 before the LLM; system-prompt rules; output guard also checks `MEDICAL_CLAIM_BLOCKLIST`. The prompt may carry an already-computed match result ("product lists parfum, which the user flagged"), never the profile |
| `src/features/match/scoring.ts` | **Not changed** (fit % is independent) |

---

## 7. Real ingredient data: source comparison

The feature is only honest if the ingredient lists belong to real products the user can buy. The
current catalog is invented, so **any source below also implies moving the Shop to real SKUs**
(D1). Showing made-up ingredient lists to users would be a deceptive-practice problem (FTC §5 /
Illinois ICFA), so synthetic formulations are **dev/test fixtures only** and are tagged so they
cannot reach a production build.

Prices below are **not verified**. They are the questions to put to vendors, not quotes.

| | A. Licensed product database | B. Brand / retailer sites | C. Hand-curated (with brand partners) |
|---|---|---|---|
| **What it is** | Commercial product-content feeds that carry INCI lists per SKU (product-data syndication vendors, beauty-specific ingredient databases). Free open data (Open Beauty Facts) sits here too, with caveats | Scraping or copying INCI lists from brand and retailer product pages | A small team enters or verifies INCI lists per SKU, from brand-supplied sheets (under the partnership agreement) or the physical label, with source + date |
| **Cost** | Enterprise licence, usually annual and priced per SKU or seat. Unknown until quoted. Open Beauty Facts is free | Low cash cost, high engineering + maintenance (site changes break scrapers) | Labour: roughly 5–15 min per SKU to enter and verify, plus re-verification. Cheap at 100–300 SKUs, expensive at 10k |
| **Licensing** | Clear if licensed. Check that the terms allow display in a consumer app and cache on-device. **Open Beauty Facts is ODbL (share-alike)**, so mixing it into our data may force us to publish the combined dataset. Needs counsel | **Worst.** Most site terms forbid scraping. Ingredient lists are facts, but the compiled pages are not ours. Retailer data is often a copy of the brand's, with errors. Not recommended as a primary source | Clean when brands supply it under contract (they warrant accuracy). Label transcription by us is factual data we collected |
| **Coverage** | Broad for big Western brands. Thinner for indie and Asia/Africa brands, which the partnership pitch is targeting. Open Beauty Facts is patchy for US makeup | Whatever is online. Many indie brands post partial lists or images of labels | Exactly the SKUs we sell. Nothing more |
| **Accuracy / freshness** | Vendor-dependent. Reformulations lag | Mixed. Shade-specific lists are often missing | Highest for our shelf, if re-verified on a schedule (E11) |
| **Effort to integrate** | Medium: an import job, id mapping to our catalog, normalizer tuning | High and never finished | Low engineering (the CSV → TS pipeline in WS-B). Ongoing ops time |
| **Fit with compliance** | Adds a vendor, but it only receives our catalog ids, never user data. Fine | ToS / legal risk | Best: brand warranties + our own audit trail (`source`, `capturedAt`) |

**Ingredient *names* (the dictionary, not product lists)** come from free, authoritative sources
in every option: the EU **CosIng** database (INCI names and functions), **EU Cosmetics Regulation
Annex III** (labelled fragrance allergens, including the expanded list from Regulation (EU)
2023/1545), and US **MoCRA** fragrance-allergen labelling once FDA finalizes its list. These cover
the taxonomy, not per-product formulations.

**Recommendation: C now, A later.** Hand-curate the formulations for the launch shelf, sourced
from brand partners' ingredient sheets with a contractual accuracy warranty and cross-checked
against the physical label. Use CosIng + Annex III for the dictionary. Revisit a licensed database
when the shelf passes a few hundred SKUs or partner-supplied data stops scaling. Do not scrape
(B). Do not mix in ODbL data without counsel sign-off.

---

## 8. Question 4 — Acceptance criteria + phased sprint plan

Label OCR (reading a product label with the camera) is **out of scope** for all phases. The camera
reads skin tone only, and pointing it at labels would be a separate capture flow needing its own
design.

### P1 — Signup question + profile (≈1 sprint; WS-A + the start of WS-B)

Scope: Setup step, settings editor, encrypted on-device store, consent sheet + RPCs, Data Rights
purge, copy file + copy test, the 10 groups + search over a starter dictionary. **No filtering
yet**, so no product claims can appear.

Acceptance:
- [ ] Setup shows the allergen step after Skips. "No" and "Skip for now" store nothing except the
      answer. "Yes" leads to the consent sheet (C15) before anything is saved.
- [ ] Declining consent saves no flags and returns to Setup with the answer `skipped`.
- [ ] Flags persist across app restarts (unlike today's in-memory `preferencesStore`), are stored
      encrypted, and are keyed per user.
- [ ] Account → Ingredient flags edits the same profile. Changes survive restart.
- [ ] Delete-everything, delete-account and consent withdrawal each remove the profile. A test
      asserts the key is gone.
- [ ] `consent_log` gets a `health` receipt, separate from the biometric one. pgTAP: RPC scoped to the caller, append-only
      holds, withdraw logs a row.
- [ ] Copy test: every string in `allergen-copy.ts` passes the disease filter + banned phrases.
- [ ] `check-allergen-isolation` passes in `npm run check:compliance`.
- [ ] Route-level Jest journey: Setup → allergens → consent → Account shows "{n} flagged".

### P2 — Ingredient data + allergen filter (≈2 sprints; the rest of WS-B + WS-C filter)

Scope: dictionary + groups built out, normalizer, formulations pipeline, flag states, Shop / For
You / Community filtering, detail sheet, the `'fragrance'` skip made real, chat refusal pattern.
Gated on **D1** for real data. Until then it runs on dev fixtures behind a flag that is off in
every EAS profile except `development`.

Acceptance:
- [ ] Normalizer golden tests: at least 40 real-world label strings (parentheticals, slashes,
      may-contain, CI numbers, asterisks, trade names, Latin/common pairs from §4) resolve to the
      expected ids.
- [ ] `flag-product` unit tests cover every row of §3.3 and E4–E10, E17.
- [ ] A product with a flagged ingredient never appears in Shop, For You or the tag drawer when
      `display = 'hide'`, and is never `isBestMatch`.
- [ ] `no_list` products are never shown as clear. With `unknownDisplay = 'hide'` they disappear.
- [ ] Fit % for every product is identical with and without an allergen profile (snapshot test).
- [ ] Ticking the `'fragrance'` skip hides products that list fragrance or a fragrance-group member.
- [ ] Chat: an "is X safe with my allergy" style question returns C10 and never calls the LLM
      (the existing refusal test pattern). The `_shared` drift test passes.
- [ ] Data build fails on a duplicate alias, a missing group member or a formulation for an
      unknown product id.
- [ ] Production-build guard: fixture formulations cannot be bundled with `EXPO_PUBLIC_*`
      production settings.
- [ ] Route-level Jest journey: set flags → Shop hides the product → "Show" reveals it with the
      badge → the detail sheet shows the matched ingredient and the date.

### P3 — Routine clash check (≈1 sprint; WS-C clash)

Scope: clash rules signed off (D5), `clash-check`, logger + publish banners, the
recommend-engine guarantee test.

Acceptance:
- [ ] Each §3.5 rule has a positive and a negative unit test. `same_slot` vs `same_day` scope is
      respected. Products with `no_list` never trigger a clash.
- [ ] The logger shows at most one banner per slot. It can be dismissed per day and never blocks
      logging or publishing.
- [ ] `routine-engine` test: no generated routine contains a `same_slot` clash pair, across the
      full score/skin-type fixture grid.
- [ ] Copy test covers every rule `note`.
- [ ] Route-level Jest journey: log two clashing products in AM → banner appears → move one to PM
      → banner clears.

### Across all phases

- Every phase follows the repo's TDD rule: a failing test first.
- Written device script (iPhone dev build) per phase for the flows above, until an E2E runner is
  chosen (D6).
- No new analytics, no new vendor that can see flags, and no server table of flags (CLAUDE.md §7
  definition of done).

---

## 9. Founder decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Move the Shop to real SKUs, and choose the formulation source | Real SKUs from brand partners. Hand-curated, brand-warranted lists (§7 option C). Licensed database later. No scraping. **P2 cannot ship to users without this** |
| D2 | Who drafts and approves the new `health` policy doc, the consent screen (C15) and the disclaimer (C2) | Counsel, before P1 ships (compliance.md §4 Q4, Q7) |
| D3 | Cross-device sync of flags | Not now. It would be new server-side health data (§2.5) |
| D4 | Add `expo-secure-store` for encrypted-at-rest storage | Yes. It is a first-party Expo module with no network access |
| D5 | Sign-off on clash rules and their wording | Founder + counsel review of §3.5 before P3 |
| D6 | Adopt an E2E runner (e.g. Maestro) or keep route-level Jest + device scripts | Keep Jest journeys for P1–P3. Decide on a runner separately |
| D7 | The existing "patch-test new products" note in `recommend/skincare/library.ts:87` | Reword to remove the test instruction (separate small task) |
| D8 | Latex and other serious-allergy groups: offer them as flags, or show only a "please talk to a doctor" note (compliance.md §4 Q6) | Offer them as flags **with** C2 shown inline on that option. Removing them hides a label fact users want. Founder + counsel call |
| D10 | Confirm no secondary use of flags (analytics, training, marketing) and treat MHMDA as the baseline for all US users (compliance.md §4 Q3, Q8) | Yes to both |
| D9 | Default display mode | `hide` flagged + `show` no-list with a badge |

---

## 10. Reconciliation with compliance.md (Dwight, 2026-09-27)

| compliance.md rule | Change in this design |
|---|---|
| §1.2(1) separate opt-in consent before collection | C15 is its own screen, before first save, never bundled with the biometric consent |
| §1.2(2) purpose limitation | Stated in §2.2. No analytics, training or marketing use (D10) |
| §1.2(3), §1.2(4) own policy doc + own `consent_log` doc key | Switched from reusing `wa_health` to a new `'health'` doc key + `health.md` (§2.4). Needs a small migration |
| §1.2(5) deletion, edit, withdrawal purge | Already in §2.2. Withdrawal clears the profile |
| §1.2(6) no sale, no SDK, encrypted at rest | On-device encrypted store (D4) + `check-allergen-isolation` guard |
| §1.3 on-device default; chat gets only the computed match result | Already on-device. Chat may get a match result, never the profile |
| §2.1 banned phrases | C1b reworded (dropped "you're allergic to"). C10 reworded. All copy tested against the shared list |
| §2.3 canonical disclaimer + four placements | C2 is now the canonical string, placed at all four points |
| §3.1 `check-no-medical-claims.mjs` + shared `MEDICAL_CLAIM_BLOCKLIST` | Added to WS-A and §5.3 |
| §3.2 chat prompt, refusal and output guard | Added to WS-C |
| §4 Q5 free-text scope | Free text validated to an ingredient-name shape and checked against both blocklists (§3.2, C16) |
| §4 Q1–Q8 founder questions | Folded into §9 (D1, D2, D3, D8, D10) |
