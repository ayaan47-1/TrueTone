-- consent_log is an append-only legal record. Updates/deletes are blocked for
-- everyone; the deletion RPCs de-identify rows by temporarily setting
-- session_replication_role = replica inside their SECURITY DEFINER scope.
create or replace function public.block_consent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'consent_log is append-only' using errcode = 'P0001';
end;
$$;

create trigger consent_log_no_update
  before update on public.consent_log
  for each row execute function public.block_consent_mutation();
create trigger consent_log_no_delete
  before delete on public.consent_log
  for each row execute function public.block_consent_mutation();
