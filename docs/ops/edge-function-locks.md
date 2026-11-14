# Edge Function dependency lock gate

Deployment lock enforcement is unresolved. Supabase CLI 2.116.0's API deployment
path shows no explicit `deno.lock` enforcement. Do not treat the committed lockfiles
or passing pin checks as proof that a deployment enforces dependency integrity.

The inspected [CLI source at v2.116.0](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/shared/functions/deploy.ts)
builds an API source upload without explicit lockfile handling. Its Docker path
delegates bundling to edge-runtime without an explicit frozen-lock flag. This does
not establish what the remote bundler enforces. The [Supabase dependency guide](https://supabase.com/docs/guides/functions/dependencies)
recommends function-specific `deno.json` files but gives no lock-enforcement guarantee.

Before a future Edge Function deployment, a separate reviewed preflight must prove
that the exact CLI and bundler reject a missing, changed or integrity-mismatched
dependency against the committed lockfile. Record the tool versions, commands and
results. Until then, the deployment gate remains open. HAG-240 does not implement
that preflight or authorize deployment.

The existing 0043 profile-avatar migration rollout hold is unchanged. This work
neither applies migrations nor changes hosted configuration.
