begin;
select plan(1);

select results_eq(
  $$
    select
      grantee::text collate "C",
      table_name::text collate "C",
      privilege_type::text collate "C"
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
    order by grantee, table_name, privilege_type
  $$,
  $$
    select
      grantee collate "C",
      table_name collate "C",
      privilege_type collate "C"
    from (
      values
        ('anon'::text, 'consent_log'::text, 'SELECT'::text),
        ('anon'::text, 'policy_versions'::text, 'SELECT'::text),
        ('anon'::text, 'profiles'::text, 'SELECT'::text),
        ('anon'::text, 'scans'::text, 'SELECT'::text),
        ('authenticated'::text, 'consent_log'::text, 'SELECT'::text),
        ('authenticated'::text, 'orders'::text, 'SELECT'::text),
        ('authenticated'::text, 'policy_versions'::text, 'SELECT'::text),
        ('authenticated'::text, 'profiles'::text, 'SELECT'::text),
        ('authenticated'::text, 'scans'::text, 'SELECT'::text)
    ) as allowed(grantee, table_name, privilege_type)
    order by grantee, table_name, privilege_type
  $$,
  'anon and authenticated table grants match the explicit public-table allowlist'
);

select * from finish();
rollback;
