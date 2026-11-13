# Import Match My Foundation estimates

This operator tool imports the licensed secondary catalogue into private source-label tables. It does not create Shopify variants, infer an exact formula/version, approve a label, or change an existing label or binding. All rows remain unverified and `lab_status=unmeasured`.

The 2026-11-10 dataset contains 410 shades across 13 catalogue lines. It is a curated historical subset, not proof of current availability. Match My Foundation's decimal depth is an estimated native value, not a TrueTone integer depth band. Olive remains the source's native undertone until reviewed into an independent modifier. No illustrative hex, computed match percentage, Lab or accuracy field is imported.

Both imported fields use tier D. The source's own depth estimates and mixed brand/site undertone wording do not meet tier B's current official-chart plus parser/spot-check requirement, or tier C's two-reviewer corroboration. The original basis/method, exact shade wording, line label, source record and formula warning are retained for the reviewer. No source label is directly recommendable.

## Run locally

Use the existing Node dependencies. Supply the publisher JSON as a local file. The importer never downloads or scrapes it.

```sh
node scripts/import-mmf.mjs /absolute/path/to/foundation-shades.json
```

The default is a dry run. It prints accepted/rejected row counts, rejection reasons, dataset version and the file's SHA-256. The checked 2026-11-10 snapshot hash is `cfc4679b288a2ceaaf0344c800e44de1694b037ab0d79dc8bdffa7320ee0dfbc`. Verify that hash against the source package before applying. Invalid rows are reported and skipped, never guessed. Invalid dataset metadata aborts the import. Files larger than 20 MB are rejected before reading.

After local migration0038 is applied, an authorized operator may set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in their shell and opt in explicitly:

```sh
node scripts/import-mmf.mjs /absolute/path/to/foundation-shades.json --apply
```

Never use an Expo public variable for the service key. Do not paste it into commands, logs or source control. Hosted application still requires deployment approval. This delivery performs no hosted writes.

One transactional service-only RPC stores source attribution in `catalog_mmf_batches` and native estimates in `catalog_mmf_source_labels`. Source identity hashes the exact combined line and shade strings. The unique dataset-version/source-key pair makes re-import idempotent. An unreviewed row can receive a corrected estimate; a row associated with `reviewed_label_id` is skipped. The import never writes `catalog_tone_labels` or `catalog_label_bindings`.

A reviewer must verify the exact current product, market and formula against primary brand evidence, then create a new reviewed catalogue label through the admin workflow. Record its ID on the source row to protect that row from re-import. A new dataset version creates separate unverified source rows, not silent changes to reviewed labels. These tables have row-level security and no mobile/anonymous grants.

## Attribution

Match My Foundation (2026). Cross-brand foundation shade dataset: 410 shades across 13 lines, with 4920 computed cross-brand matches. https://matchmyfoundation.com/data/ (CC BY 4.0)

Licence: https://creativecommons.org/licenses/by/4.0/

The batch also stores the change notice from the source package, extended to state that estimates remain unverified tier D and no formula identities or normalized colour coordinates are inferred. Show this credit and licence wherever the adapted dataset is distributed. The importer does not bundle the raw dataset.

## Verification

```sh
node --test --experimental-test-coverage scripts/__tests__/mmf-import.test.mjs
npm run test:scripts
npm run test:catalog
npm test -- --runInBand
npx tsc --noEmit
npm run check:catalog
npm run check:compliance
npm run check:no-egress
supabase db reset --local
supabase test db --local
```

The database reset destroys local development data. Never target a hosted database. Database tests cover permissions, decimal estimates, unmeasured status, attribution, re-import, reviewed-row protection and forbidden measurement fields. Native/device UI is unchanged.
