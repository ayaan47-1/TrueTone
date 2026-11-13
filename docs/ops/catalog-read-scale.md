# Catalogue read path

## Bounded reads

Home and Shop use one page of 30 reviewed shades. The query orders by `variant_gid` and requests 31 rows. The extra row indicates whether another page exists. Next and Previous replace the visible page instead of accumulating the whole catalogue. Home states that suggestions cover a page, not every reviewed shade.

Product details resolve an off-page variant with an equality query against `catalog_recommendable`. Shopify details resolve the product identity, then fetch approved options for that product in pages of 30. They do not list the global catalogue. More options remain available through an explicit action.

Adding to the bag checks only the selected variant against `catalog_recommendable`, then checks that variant's current Shopify availability and USD prices before the existing cart mutation. A removed or unapproved variant cannot be added. No new permissions, credentials, or external services are introduced.

## Revision checks and expiry

Migration `0041_catalog_read_scale.sql` adds `catalog_read_revision()`. Authenticated clients receive an opaque revision, server time, and the earliest upcoming 26-hour freshness expiry. The backing table is private. Catalogue variants, inventory, labels, and bindings invalidate the revision after each write statement.

The existing 60-second and foreground refreshes check this metadata first. An unchanged revision reuses the current page until its freshness deadline. A changed revision or expired page fetches the first page again and resets navigation. This is revision-based invalidation, not a row-change feed. A changed catalogue downloads only the visible page.

The client derives a duration from server timestamps and uses a monotonic local clock. A slow download cannot extend the server's freshness deadline. An unverified or failed refresh hides the products and offers retry. Point-loaded details are hidden when the catalogue becomes offline. Concurrent refresh calls share one pending request.

## Preserved boundaries

- USD-only mapping and selected-variant validation remain mandatory.
- Demo data stays synthetic. Camera-offline and demo paths do not call these catalogue or Shopify endpoints.
- Shop retry refreshes both the catalogue and Storefront data. Empty and offline states remain distinct.
- Swatches and measured Lab values are not invented. The existing recommendation filters operate on the current visible page.
- Migration 0041 is independent of the sync changes in 0040. Old clients continue their old full reads until updated.

## Verification

Run `npx tsc --noEmit`, `npm test -- --runInBand --coverage`, `npm run test:catalog`, `npm run test:scripts`, `npm run check:catalog`, `npm run check:compliance`, and `npm run check:no-egress`.

For local database tests, run `supabase db reset --local` followed by `supabase test db --local`. Coordinate first: worktrees with project ID `TrueTone` share the same containers. Do not apply this migration to a hosted project without separate approval.

Load scripts and raw local results are in the task's `research/truetone-scale/k6/` and `fixes/` research folders. They do not contact Shopify. Device visual review and hosted capacity remain unverified.
