-- Secrets are installed by the operator, never committed or copied into application tables.
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create function public.catalog_request_reconcile()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare endpoint text; token text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='catalog_reconcile_url' limit 1;
  select decrypted_secret into token from vault.decrypted_secrets where name='catalog_reconcile_token' limit 1;
  if endpoint is null or token is null or endpoint !~ '^https://[^/]+/functions/v1/catalog-reconcile$' then
    insert into public.catalog_sync_runs(started_at,status,failure_code)
      values(clock_timestamp(),'blocked','configuration_missing');
    return;
  end if;
  perform net.http_post(url:=endpoint,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
    body:='{}'::jsonb,timeout_milliseconds:=120000);
end;
$$;
revoke all on function public.catalog_request_reconcile() from public,anon,authenticated;
grant execute on function public.catalog_request_reconcile() to service_role;
select cron.schedule('truetone-catalog-reconcile','0 4 * * *',$$select public.catalog_request_reconcile();$$);
