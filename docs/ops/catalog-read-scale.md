# Catalogue read path

## Bounded reads

Home and Shop use one page of 30 reviewed shades. The query orders by `variant_gid` and requests 31 rows. The extra row indicates whether another page exists. Next and Previous replace the visible page instead of accumulating the whole catalogue. Home states that suggestions cover a page, not every reviewed shade.

Product details resolve an off-page variant with an equality query against `catalog_recommendable`. Shopify details resolve the product identity, then fetch approved options for that product in pages of 30. They do not list the global catalogue. Up to five empty sold-out pages are skipped per action. If more remain, the real product metadata and cursor survive so the next action can continue.

Adding to the bag checks only the selected variant against `catalog_recommendable`, then checks that variant's current Shopify availability and USD prices before the existing cart mutation. A removed or unapproved variant cannot be added. In a non-demo build, bag reads and checkout refreshes revalidate every stored line. Invalid lines are flagged and block checkout; read errors fail closed. Quantity increases also revalidate, while removal and decreases remain possible. An incomplete cart or non-USD cart cannot pass validation. No new permissions, credentials, or external services are introduced.

## Revision checks and expiry

Migration `0041_catalog_read_scale.sql` adds `catalog_read_revision()`. Authenticated clients receive an opaque revision, server time, and the earliest upcoming 26-hour freshness expiry. The backing table is private. Catalogue variants, inventory, labels, and bindings invalidate the revision after each write statement.

The existing 60-second and foreground refreshes check this metadata first. An unchanged revision reuses the current page until its freshness deadline. A changed revision or expired page fetches the first page again and resets navigation. Before publishing a downloaded page, a second metadata read must confirm the same revision. A mismatch restarts from the first page once; continued writes show a refresh notice instead of mixed rows. This is revision-based invalidation, not a row-change feed. A changed catalogue downloads only the visible page.

The client derives a duration from server timestamps and uses a monotonic local clock. A slow download cannot extend the server's freshness deadline. Freshness expiry and revision churn show “Shades need refreshing,” separately from connection errors. Both hide unverified products and offer retry. Point-loaded details are hidden when the catalogue becomes offline or stale. Concurrent refresh calls share one pending request. Shop shows the current shade range, scrolls to its heading after a successful range change, restores accessibility focus, and announces the new range.

## Preserved boundaries

- USD-only mapping and selected-variant validation remain mandatory.
- Demo recommendations stay synthetic and make no Supabase calls, including revision, page, and point reads. Demo can browse the live Shopify Storefront after the existing Shop privacy notice. Camera-offline makes no network calls at all.
- Shop retry refreshes both the catalogue and Storefront data. Empty and offline states remain distinct.
- Swatches and measured Lab values are not invented. The existing recommendation filters operate on the current visible page.
- Migration 0041 is independent of the sync changes in 0040. Old clients continue their old full reads until updated.

## Verification

Run `npx tsc --noEmit`, `npm test -- --runInBand --coverage`, `npm run test:catalog`, `npm run test:scripts`, `npm run check:catalog`, `npm run check:compliance`, and `npm run check:no-egress`.

For local database tests, run `supabase db reset --local` followed by `supabase test db --local`. Coordinate first: worktrees with project ID `TrueTone` share the same containers. Do not apply this migration to a hosted project without separate approval.

Load scripts and raw local results are in the task's `research/truetone-scale/k6/` and `fixes/` research folders. They do not contact Shopify. Device visual review and hosted capacity remain unverified.
