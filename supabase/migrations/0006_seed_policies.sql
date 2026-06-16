-- Seeds the current policy versions. Mirrors src/content/manifest.ts POLICY_VERSION
-- (single source of truth) so the app's consent never blocks on a version mismatch.
insert into public.policy_versions(version, doc_key, is_current) values
  ('2026-06-15.1','privacy', true),
  ('2026-06-15.1','terms', true),
  ('2026-06-15.1','biometric', true),
  ('2026-06-15.1','retention', true),
  ('2026-06-15.1','wa_health', true)
on conflict (version, doc_key) do nothing;
