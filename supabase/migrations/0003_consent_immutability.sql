-- consent_log is an append-only legal record. DELETEs are always blocked.
-- UPDATEs are blocked EXCEPT the single de-identification operation the deletion
-- RPCs need (setting user_id -> null). This avoids session_replication_role
-- (which needs superuser and is fragile on hosted Supabase): the RPCs do a plain UPDATE.
create or replace function public.block_consent_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'consent_log is append-only' using errcode = 'P0001';
  end if;
  -- the only permitted mutation is de-identification: user_id -> null, nothing else changes
  if new.user_id is not null
     or new.id is distinct from old.id
     or new.consent_id is distinct from old.consent_id
     or new.action is distinct from old.action
     or new.policy_version is distinct from old.policy_version
     or new.policy_doc_key is distinct from old.policy_doc_key
     or new.created_at is distinct from old.created_at then
    raise exception 'consent_log is append-only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger consent_log_no_update
  before update on public.consent_log
  for each row execute function public.block_consent_mutation();
create trigger consent_log_no_delete
  before delete on public.consent_log
  for each row execute function public.block_consent_mutation();
