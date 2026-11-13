# Optional shade feedback

Directional answers work on-device by default. From a reviewed shade's product page, choose **How did this shade look?**, select depth/undertone directions after trying it, and explicitly save on this phone. The form collects no written explanation. It does not change rankings or catalogue evidence.

Local answers use the existing encrypted storage under a separate managed prefix, scoped to the signed-in owner. There is no upload queue. Reads remove answers older than 365 days. Local history is bounded to 50 answers, with one current answer per product. Your Data offers readable, selectable text and independent deletion. Withdrawing biometric consent clears local feedback; Delete My Data and Delete Account include this prefix in crypto-erasure.

## Server collection remains off

`SERVER_FEEDBACK_ENABLED` is false. Migration0039's `shade_feedback_enabled()` also returns false. Neither is controlled by a public environment variable. The boundary check enforces both. There is no seeded/current shade-feedback notice, and the standalone unchecked consent component is dormant. Local saves never call the server sender, including after a network failure. Errors never log answer contents.

The strict server sender and normalized database contract are built for review, not enabled collection. The sender requires separate permission, an immutable consent receipt and the exact displayed recommendation provenance. No display/provenance upload is wired into the current recommendation UI. A reviewed enabling change must connect the actual displayed top-three IDs/order and exact label revisions, generate a new random recommendation UUID at display time, and mount the separate consent flow. It must not reconstruct candidates later or reuse another record's identifier.

Before any enabling release, the founder and counsel must approve/version the Privacy Policy, Washington policy, Biometric Data Policy, retention schedule, standalone notice and Apple disclosures. Insert an approved `shade_feedback` policy version only then. Server submission also requires authenticated adulthood, active biometric consent and a server-owned `app_metadata.launch_country=US` claim. Supabase distinguishes administrator-controlled app metadata from user-editable metadata in its [authorization guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). Provision/verify the approved US rollout before enabling; absent claim fails closed. Claims reflect the issued token, so approval changes require token refresh and must not be treated as live physical location.

Do not simply flip either flag. Collection stays blocked until the reviewed notice, client provenance integration, gates, deletion tests and CI evidence are complete. Matching and shopping do not depend on optional consent.

## Data and lifecycle

The two tables contain only the compliance specification's event/candidate allowlist. No personal measurements, pictures, other record identifiers, written comments, device/network attributes or commerce events belong here. Product identifiers and label versions remain sensitive. They are not anonymous data.

Only owner-scoped reads are granted to authenticated clients. Writes use narrow functions deriving the owner from the session. Submission locks the profile and checks current optional-consent receipt, exact catalogue identities, one-to-three shown candidates and tried product membership. Only bounded directions/outcome may change. Duplicate recommendation submissions cannot create another event for that owner. There is no general admin export, model training, per-person correction or colour-error aggregate. Missing outcomes and non-colour returns are not used as colour-error evidence.

Your Data provides explicit first-party reads in pages of 50, readable copy and one-tap deletion. These deletion/read controls remain available even when collection is disabled. `delete_shade_feedback()` returns the deleted count. Optional or biometric withdrawal, delete-everything, account deletion and the inactivity backstop purge parents and cascading candidates. Immutable receipts are preserved and de-identified on account/data deletion.

`shade_feedback_retention_sweep()` runs at 03:15 UTC daily for expiry/purpose-closed rows. Expiry is fixed at submission plus twelve months and cannot be extended through the update RPC. The service-only `close_shade_feedback_purpose()` removes a purpose-complete event immediately. Every actual purge adds the existing minimal `audit_deletion('shade_feedback', owner)` receipt, never answer contents.

The existing deletion audit defaults to seven days for backup reconciliation. The actual hosted point-in-time-recovery window has not been inspected in this task. An operator must verify that window against the approved retention policy, monitor unreconciled audit rows and let deleted backup copies age out on that documented cycle before enabling collection.

## Verification and release gate

```sh
node scripts/check-shade-feedback-boundary.mjs
npm run check:no-egress
npm run check:compliance
npm run test:scripts
npm run test:catalog
npm test -- --runInBand
npx tsc --noEmit
npm run check:catalog
supabase db reset --local
supabase test db --local
```

Use local containers only. Reset destroys local development data. No hosted migration, webhook registration, policy activation or deployment is part of this branch.

The compliance workflow runs the static guard, existing app/script checks and local-container database tests on pull requests. CI configuration follows the [Supabase database-testing guide](https://supabase.com/docs/guides/local-development/testing/overview). A green GitHub Actions run cannot be recorded before the authorized operator pushes this no-push branch. After review/push, record `gh run list` and `gh run view` evidence for the exact reviewed commit. Local checks alone do not make server collection ready to enable.
