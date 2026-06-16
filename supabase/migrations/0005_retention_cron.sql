create extension if not exists pg_cron;

-- BIPA §15(a): destroy biometric/derived data within 3 years of last interaction.
-- (The "purpose-met" arm is deferred to P2 when a scan/purpose exists.)
create or replace function public.truetone_retention_sweep()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_count int := 0; v_version text;
begin
  select version into v_version from public.policy_versions where doc_key='biometric' and is_current;
  for v_id in
    select id from public.profiles where last_interaction_at < now() - interval '3 years'
  loop
    insert into public.consent_log(user_id, action, policy_version, policy_doc_key)
      values (v_id, 'deleted', v_version, 'biometric');
    update public.consent_log set user_id = null where user_id = v_id; -- de-identify
    delete from public.profiles where id = v_id;
    delete from auth.users where id = v_id;
    v_count := v_count + 1;
  end loop;
  insert into public.retention_runs(purged_count) values (v_count);
end; $$;

select cron.schedule('truetone-retention', '0 3 * * *',
  $$ select public.truetone_retention_sweep(); $$);
