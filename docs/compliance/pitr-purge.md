# Backup / PITR purge cycle (BIPA §15(a)/(e))

**Live deletion** (`delete_my_data`, `delete_account`, retention sweep, consent-withdraw trigger)
removes biometric-derived rows from live tables immediately.

**Backup/PITR copies** age out of Supabase point-in-time recovery on the project's PITR retention
window. We record the default window as **7 days** in `deletion_audit.pitr_window`. If the Supabase
project's configured PITR window differs, update the column default in a follow-up migration to match.

**Verification cycle:** `truetone_reconcile_deletions` runs daily (03:30 UTC). A deletion is marked
`reconciled_at` once `deleted_at + pitr_window <= now()`, i.e. once the live deletion can no longer be
restored from PITR. Open (unreconciled) rows past their window are a monitoring alert.

**Hard gate:** This mechanism must be live and verified (this migration applied, the cron scheduled,
the Supabase PITR window confirmed) before the camera captures face data from anyone beyond internal
dev devices. External/TestFlight + the real model are blocked until counsel signs off.
