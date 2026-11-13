# Staff shade labelling

Run this operator-only Node tool from the repository root with Node 22 or newer. It has no UI and adds no dependencies. The database must have migrations 0034–0037 applied by the operator.

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the trusted operator shell using your secret manager. The tool does not load `.env` files. Never use an `EXPO_PUBLIC_` variable for the service key or put it in the app. Credentials are sent only in request headers; redirects are refused. Local Supabase HTTP on loopback is supported; other connections require HTTPS.

```sh
node scripts/catalog-label.mjs --help
node scripts/catalog-label.mjs queue 50 0
node scripts/catalog-label.mjs show 'gid://shopify/ProductVariant/123' > /tmp/shade-review.json
```

`queue` returns up to 1,000 rows, ordered by variant ID, with an optional offset. Process one shade at a time. Queue membership changes during labelling, so refresh from offset zero after each batch. `show` exports the exact formula/version/shade identity, current binding token, and editable evidence. Candidate label IDs in the queue are suggestions for separate human review; this tool never reattaches them automatically.

Edit `/tmp/shade-review.json` in a text editor. Keep the top-level identity and `expected_label_id` unchanged. In `label`, fill in the evidence:

- `native_depth`, `native_undertone`, `native_shade_code`, `native_richness`, and `original_brand_description` preserve original brand wording. `depth_confidence` and `undertone_confidence` describe the depth and undertone evidence; the schema has no separate native-transcription confidence columns.
- `depth_band`: integer 1–10. `brand_depth_rank`: optional 0–100 ordinal within this formula/version. Use `rank_confidence` for the rank; it is never cross-brand measured lightness.
- `base_undertone`: `cool`, `neutral`, `warm`, or `unknown`. Its tier is `undertone_confidence`.
- `undertone_modifiers`: any of `olive`, `golden/yellow`, `peach`, `pink/rosy`, `red`. `modifier_confidence` must have exactly one tier per selected modifier, for example `{"olive":"C","golden/yellow":"B"}`. Empty modifiers mean no recorded modifier evidence.
- Confidence: `B` for explicit brand evidence plus parser/human agreement; `C` for corroborated evidence; `D` for inference; `X` for conflict or unknown. D/X can be saved as drafts. This tool does not enter measured Lab or M-tier evidence; that requires the complete instrument protocol and separate engine validation workflow.
- `reviewer_ids`: actual staff identities, for example `["alice.smith","bob.jones"]`. Lowercasing and removing all whitespace happens before duplicate removal and counting, on both CLI and server. Staff must record actual independent review; entering a second name is not proof that the person reviewed it.
- Approval requires `depth_source`, `undertone_source`, `source_url`, `source_market`, `source_as_of` (`YYYY-MM-DD`), `parser_version`, known depth/undertone, and eligible B/C tiers on all populated matching fields. Any C tier (including a modifier or rank) requires two distinct normalized reviewers; otherwise one suffices. Include `mapping_version`, `source_licence`, and `source_attribution` where applicable; retain source rights and change notices.

Save or approve explicitly:

```sh
node scripts/catalog-label.mjs draft /tmp/shade-review.json
# Export again after saving: each save changes the binding token.
node scripts/catalog-label.mjs show 'gid://shopify/ProductVariant/123' > /tmp/shade-review.json
node scripts/catalog-label.mjs approve /tmp/shade-review.json
```

Both commands return the new label UUID. Each save creates a revision and updates the binding in one transaction, preserving previous evidence. Approval removes the shade from the needs-label queue when it is eligible as verified evidence. Stock, freshness and publication still govern whether it is recommendable. Approved and retired evidence cannot be edited through this tool.

If a reviewer or sync changes the binding or shade identity, submission fails. Re-export and review the current evidence rather than changing the token manually. Network failures are not automatically retried: first re-export to see whether the write committed. HTTP failures exit nonzero and omit remote response bodies. Keep review files outside the repository and remove them when finished.

Verification:

```sh
node --test --experimental-test-coverage scripts/__tests__/catalog-label.test.mjs
npm run test:catalog
supabase db reset --local && supabase test db --local
```

The database suite covers grants, normalized reviewer aliases, failed-write rollback, stale identity/binding rejection, and revision/binding changes. Run it against local Supabase only.
