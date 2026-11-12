-- Separate, optional recommendation answers. Collection is disabled until a reviewed release.
alter table public.policy_versions drop constraint policy_versions_doc_key_check;
alter table public.policy_versions add constraint policy_versions_doc_key_check
  check (doc_key in ('privacy','terms','biometric','retention','wa_health','shade_feedback'));
-- No policy is seeded or made current by this migration.
create function public.shade_feedback_enabled() returns boolean language sql immutable as $$select false$$;

create table public.shade_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_receipt_id uuid not null references public.consent_log(id),
  recommendation_id uuid not null check (recommendation_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  engine_version text not null check (engine_version ~ '^[A-Za-z0-9._:-]{1,64}$'),
  catalog_as_of timestamptz not null,
  estimated_variant_gid text not null check (estimated_variant_gid ~ '^gid://shopify/ProductVariant/[0-9]{1,64}$'),
  estimated_label_id uuid not null references public.catalog_tone_labels(id),
  estimated_label_revision integer not null check (estimated_label_revision>0),
  estimated_formula_version text not null check (estimated_formula_version ~ '^[A-Za-z0-9._:-]{1,64}$'),
  tried_variant_gid text not null check (tried_variant_gid ~ '^gid://shopify/ProductVariant/[0-9]{1,64}$'),
  depth_correction text not null check (depth_correction in ('as_expected','too_light','too_dark','not_sure')),
  undertone_correction text not null check (undertone_correction in ('as_expected','too_warm','too_cool','not_sure')),
  outcome text check (outcome in ('kept','returned_color','returned_other','still_deciding')),
  displayed_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  outcome_at timestamptz,
  expires_at timestamptz not null default (now()+interval '12 months'),
  purpose_closed_at timestamptz,
  unique(id,user_id), unique(user_id,recommendation_id),
  check (depth_correction<>'not_sure' or undertone_correction<>'not_sure'),
  check (expires_at=submitted_at+interval '12 months'),
  check (catalog_as_of<=displayed_at and displayed_at<=submitted_at+interval '5 minutes')
);
create table public.shade_feedback_candidates (
  feedback_id uuid not null,
  user_id uuid not null,
  position integer not null check (position between 1 and 3),
  variant_gid text not null check (variant_gid ~ '^gid://shopify/ProductVariant/[0-9]{1,64}$'),
  label_id uuid not null references public.catalog_tone_labels(id),
  label_revision integer not null check (label_revision>0),
  formula_version text not null check (formula_version ~ '^[A-Za-z0-9._:-]{1,64}$'),
  available_at_display boolean not null,
  primary key(feedback_id,position), unique(feedback_id,variant_gid),
  foreign key(feedback_id,user_id) references public.shade_feedback_events(id,user_id) on delete cascade
);
alter table public.shade_feedback_events enable row level security;
alter table public.shade_feedback_candidates enable row level security;
create policy shade_feedback_events_own on public.shade_feedback_events for select to authenticated using (user_id=auth.uid());
create policy shade_feedback_candidates_own on public.shade_feedback_candidates for select to authenticated using (user_id=auth.uid());
revoke all on public.shade_feedback_events,public.shade_feedback_candidates from public,anon,authenticated,service_role;
grant select on public.shade_feedback_events,public.shade_feedback_candidates to authenticated;

create function public.shade_feedback_keys(value jsonb,keys text[]) returns boolean
language sql immutable set search_path=public,pg_temp as $$
  select case when jsonb_typeof(value)='object' then value-keys='{}'::jsonb
    and (select count(*) from jsonb_object_keys(value))=cardinality(keys) else false end;
$$;

create function public.shade_feedback_assert_access() returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); p public.profiles;
begin
  if uid is null then raise exception 'feedback unavailable' using errcode='P0001'; end if;
  select * into p from public.profiles where id=uid for update;
  if not found or not p.is_18_plus or not p.consent_active or
    not public.shade_feedback_enabled() or coalesce(auth.jwt()->'app_metadata'->>'launch_country','')<>'US' then
    raise exception 'feedback unavailable' using errcode='P0001';
  end if;
  return uid;
end; $$;

create function public.set_shade_feedback_consent(p_action text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); v text; receipt uuid;
begin
  if uid is null or p_action not in ('consented','withdrawn') or p_action is null then
    raise exception 'feedback unavailable' using errcode='P0001';
  end if;
  perform 1 from public.profiles where id=uid for update;
  if not found then raise exception 'feedback unavailable' using errcode='P0001'; end if;
  if p_action='consented' then
    perform public.shade_feedback_assert_access();
    select version into v from public.policy_versions where doc_key='shade_feedback' and is_current and effective_at<=now();
    if v is null then raise exception 'approved notice required' using errcode='P0001'; end if;
    select id into receipt from public.consent_log where user_id=uid and policy_doc_key='shade_feedback'
      and action='consented' and policy_version=v and id=(select id from public.consent_log where user_id=uid and policy_doc_key='shade_feedback' order by created_at desc,id desc limit 1);
    if receipt is not null then return receipt; end if;
  else
    select policy_version into v from public.consent_log where user_id=uid and policy_doc_key='shade_feedback' order by created_at desc,id desc limit 1;
    perform public.purge_shade_feedback_for_user(uid);
  end if;
  if v is not null then
    insert into public.consent_log(user_id,action,policy_version,policy_doc_key,created_at)
      values(uid,p_action::public.consent_action,v,'shade_feedback',clock_timestamp()) returning id into receipt;
  end if;
  return receipt;
end; $$;

create function public.record_shade_feedback(p_event jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; receipt public.consent_log; current_version text; event_id uuid; c jsonb; n integer:=0; k text;
begin
  uid:=public.shade_feedback_assert_access();
  if octet_length(p_event::text)>4096 or not public.shade_feedback_keys(p_event,array[
    'consent_receipt_id','recommendation_id','engine_version','catalog_as_of','estimated_variant_gid','estimated_label_id',
    'estimated_label_revision','estimated_formula_version','tried_variant_gid','depth_correction','undertone_correction','outcome','displayed_at','candidates']) then
    raise exception 'invalid feedback' using errcode='P0001';
  end if;
  foreach k in array array['consent_receipt_id','recommendation_id','engine_version','catalog_as_of','estimated_variant_gid','estimated_label_id',
    'estimated_formula_version','tried_variant_gid','depth_correction','undertone_correction','displayed_at'] loop
    if jsonb_typeof(p_event->k) is distinct from 'string' then raise exception 'invalid feedback' using errcode='P0001'; end if;
  end loop;
  if jsonb_typeof(p_event->'estimated_label_revision') is distinct from 'number' or
    jsonb_typeof(p_event->'outcome') not in ('string','null') then raise exception 'invalid feedback' using errcode='P0001'; end if;
  select * into receipt from public.consent_log where user_id=uid and policy_doc_key='shade_feedback'
    order by created_at desc,id desc limit 1;
  select version into current_version from public.policy_versions where doc_key='shade_feedback' and is_current and effective_at<=now();
  if receipt.id is null or receipt.action<>'consented' or receipt.id is distinct from (p_event->>'consent_receipt_id')::uuid
    or current_version is null or receipt.policy_version<>current_version then
    raise exception 'separate consent required' using errcode='P0001';
  end if;
  if jsonb_typeof(p_event->'candidates') is distinct from 'array' then raise exception 'invalid feedback' using errcode='P0001'; end if;
  if jsonb_array_length(p_event->'candidates') not between 1 and 3 then raise exception 'invalid feedback' using errcode='P0001'; end if;
  if not exists(select 1 from public.catalog_verified_shades v join public.catalog_tone_labels l on l.id=v.label_id
    where v.variant_gid=p_event->>'estimated_variant_gid' and l.id=(p_event->>'estimated_label_id')::uuid
      and l.revision=(p_event->>'estimated_label_revision')::integer and l.formula_version=p_event->>'estimated_formula_version') then
    raise exception 'invalid catalogue reference' using errcode='P0001';
  end if;
  if (p_event->>'tried_variant_gid') is distinct from (p_event->>'estimated_variant_gid') and
    not exists(select 1 from jsonb_array_elements(p_event->'candidates') x where x->>'variant_gid'=p_event->>'tried_variant_gid') then
    raise exception 'tried shade was not shown' using errcode='P0001';
  end if;
  -- Only constructors below supply server-owned identifiers and timestamps.
  insert into public.shade_feedback_events(user_id,consent_receipt_id,recommendation_id,engine_version,catalog_as_of,
    estimated_variant_gid,estimated_label_id,estimated_label_revision,estimated_formula_version,tried_variant_gid,
    depth_correction,undertone_correction,outcome,displayed_at,outcome_at)
  values(uid,receipt.id,(p_event->>'recommendation_id')::uuid,p_event->>'engine_version',(p_event->>'catalog_as_of')::timestamptz,
    p_event->>'estimated_variant_gid',(p_event->>'estimated_label_id')::uuid,(p_event->>'estimated_label_revision')::integer,
    p_event->>'estimated_formula_version',p_event->>'tried_variant_gid',p_event->>'depth_correction',p_event->>'undertone_correction',
    p_event->>'outcome',(p_event->>'displayed_at')::timestamptz,case when p_event->>'outcome' is not null then now() end)
  returning id into event_id;
  for c in select * from jsonb_array_elements(p_event->'candidates') loop
    n:=n+1;
    if not public.shade_feedback_keys(c,array['position','variant_gid','label_id','label_revision','formula_version','available_at_display'])
      or jsonb_typeof(c->'available_at_display') is distinct from 'boolean'
      or jsonb_typeof(c->'variant_gid') is distinct from 'string' or jsonb_typeof(c->'label_id') is distinct from 'string'
      or jsonb_typeof(c->'formula_version') is distinct from 'string' or jsonb_typeof(c->'label_revision') is distinct from 'number'
      or jsonb_typeof(c->'position') is distinct from 'number' or (c->>'position')::integer<>n then
      raise exception 'invalid candidate' using errcode='P0001';
    end if;
    if not exists(select 1 from public.catalog_verified_shades v join public.catalog_tone_labels l on l.id=v.label_id
      where v.variant_gid=c->>'variant_gid' and l.id=(c->>'label_id')::uuid and l.revision=(c->>'label_revision')::integer
        and l.formula_version=c->>'formula_version') then raise exception 'invalid catalogue reference' using errcode='P0001'; end if;
    insert into public.shade_feedback_candidates values(event_id,uid,n,c->>'variant_gid',(c->>'label_id')::uuid,
      (c->>'label_revision')::integer,c->>'formula_version',(c->>'available_at_display')::boolean);
  end loop;
  return event_id;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or check_violation or not_null_violation or unique_violation then
  raise exception 'invalid feedback' using errcode='P0001';
end; $$;

create function public.update_shade_feedback(p_id uuid,p_correction jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid;
begin
  uid:=public.shade_feedback_assert_access();
  if not public.shade_feedback_keys(p_correction,array['depth_correction','undertone_correction','outcome']) then
    raise exception 'invalid correction' using errcode='P0001';
  end if;
  if not exists(select 1 from public.consent_log c join public.shade_feedback_events e on e.consent_receipt_id=c.id
    join public.policy_versions p on p.doc_key='shade_feedback' and p.is_current and p.version=c.policy_version
    where e.id=p_id and e.user_id=uid and e.expires_at>now() and e.purpose_closed_at is null
    and c.id=(select id from public.consent_log where user_id=uid and policy_doc_key='shade_feedback' order by created_at desc,id desc limit 1)
    and c.action='consented') then raise exception 'feedback unavailable' using errcode='P0001'; end if;
  update public.shade_feedback_events set depth_correction=p_correction->>'depth_correction',undertone_correction=p_correction->>'undertone_correction',
    outcome=p_correction->>'outcome',outcome_at=case when outcome is distinct from p_correction->>'outcome' then now() else outcome_at end
    where id=p_id and user_id=uid;
exception when check_violation or not_null_violation then raise exception 'invalid correction' using errcode='P0001';
end; $$;

create function public.purge_shade_feedback_for_user(p_uid uuid) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare count_deleted integer;
begin
  delete from public.shade_feedback_events where user_id=p_uid;
  get diagnostics count_deleted=row_count;
  if count_deleted>0 then perform public.audit_deletion('shade_feedback',p_uid); end if;
  return count_deleted;
end; $$;

create function public.shade_feedback_keep_provenance() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_table_name='shade_feedback_candidates' or
    (to_jsonb(new)-array['depth_correction','undertone_correction','outcome','outcome_at','purpose_closed_at']) is distinct from
    (to_jsonb(old)-array['depth_correction','undertone_correction','outcome','outcome_at','purpose_closed_at']) then
    raise exception 'feedback provenance is immutable' using errcode='55000';
  end if;
  return new;
end; $$;
create trigger feedback_immutable before update on public.shade_feedback_events
for each row execute function public.shade_feedback_keep_provenance();
create trigger feedback_candidate_immutable before update on public.shade_feedback_candidates
for each row execute function public.shade_feedback_keep_provenance();
create function public.delete_shade_feedback() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  return public.purge_shade_feedback_for_user(auth.uid());
end; $$;

create function public.list_shade_feedback(p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
  if uid is null or p_offset<0 then raise exception 'not available' using errcode='P0001'; end if;
  with page as (select * from public.shade_feedback_events where user_id=uid order by submitted_at desc,id offset p_offset limit 50)
  select jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e)) from page e),'[]'::jsonb),
    'candidates',coalesce((select jsonb_agg(to_jsonb(c) order by c.feedback_id,c.position) from public.shade_feedback_candidates c
      where c.user_id=uid and c.feedback_id in (select id from page)),'[]'::jsonb)) into result;
  return result;
end; $$;

create function public.shade_feedback_profile_lifecycle() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt public.consent_log;
begin
  if tg_op='DELETE' or (old.consent_active and not new.consent_active) or (old.is_18_plus and not new.is_18_plus) then
    select * into receipt from public.consent_log where user_id=old.id and policy_doc_key='shade_feedback' order by created_at desc,id desc limit 1;
    if receipt.id is not null and receipt.action='consented' then
      insert into public.consent_log(user_id,action,policy_version,policy_doc_key,created_at)
        values(old.id,case when tg_op='DELETE' then 'deleted'::public.consent_action else 'withdrawn'::public.consent_action end,receipt.policy_version,'shade_feedback',clock_timestamp());
    end if;
    perform public.purge_shade_feedback_for_user(old.id);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
create trigger feedback_profile_lifecycle before update or delete on public.profiles
for each row execute function public.shade_feedback_profile_lifecycle();

create function public.shade_feedback_receipt_deleted() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.user_id is not null and new.user_id is null and old.policy_doc_key='shade_feedback' then
    perform public.purge_shade_feedback_for_user(old.user_id);
  end if;
  return new;
end; $$;
create trigger feedback_receipt_deleted after update on public.consent_log
for each row execute function public.shade_feedback_receipt_deleted();

create function public.shade_feedback_retention_sweep() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid;
begin
  for uid in select distinct user_id from public.shade_feedback_events where expires_at<=now() or purpose_closed_at is not null loop
    perform 1 from public.profiles where id=uid for update;
    delete from public.shade_feedback_events where user_id=uid and (expires_at<=now() or purpose_closed_at is not null);
    if found then perform public.audit_deletion('shade_feedback',uid); end if;
  end loop;
end; $$;
select cron.schedule('shade-feedback-retention','15 3 * * *',$$select public.shade_feedback_retention_sweep()$$);

create function public.close_shade_feedback_purpose(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid;
begin
  select user_id into uid from public.shade_feedback_events where id=p_id;
  if uid is null then return; end if;
  perform 1 from public.profiles where id=uid for update;
  delete from public.shade_feedback_events where id=p_id;
  if found then perform public.audit_deletion('shade_feedback',uid); end if;
end; $$;

create or replace function public.delete_my_data() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); v text; feedback_version text;
begin
  if uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  perform 1 from public.profiles where id=uid for update;
  select version into v from public.policy_versions where doc_key='biometric' and is_current;
  select policy_version into feedback_version from public.consent_log where user_id=uid and policy_doc_key='shade_feedback' order by created_at desc,id desc limit 1;
  if feedback_version is not null then
    insert into public.consent_log(user_id,action,policy_version,policy_doc_key,created_at) values(uid,'deleted',feedback_version,'shade_feedback',clock_timestamp());
  end if;
  perform public.purge_shade_feedback_for_user(uid);
  insert into public.consent_log(user_id,action,policy_version,policy_doc_key) values(uid,'deleted',v,'biometric');
  update public.consent_log set user_id=null where user_id=uid;
  delete from public.scans where user_id=uid;
  if found then perform public.audit_deletion('scans',uid); end if;
  update public.profiles set is_18_plus=false,age_verified_at=null,consent_active=false,last_interaction_at=now() where id=uid;
end; $$;

-- New receipts must never be returned by the existing biometric idempotent-consent path.
create or replace function public.record_consent() returns public.consent_log
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); v text; receipt public.consent_log;
begin
  if uid is null then raise exception 'not authenticated' using errcode='P0001'; end if;
  perform 1 from public.profiles where id=uid for update;
  if exists(select 1 from public.profiles where id=uid and consent_active) then
    select * into receipt from public.consent_log where user_id=uid and policy_doc_key='biometric' and action='consented' order by created_at desc,id desc limit 1;
    return receipt;
  end if;
  select version into v from public.policy_versions where doc_key='biometric' and is_current;
  insert into public.consent_log(user_id,action,policy_version,policy_doc_key) values(uid,'consented',v,'biometric') returning * into receipt;
  update public.profiles set consent_active=true,last_interaction_at=now() where id=uid;
  return receipt;
end; $$;

revoke all on function public.shade_feedback_keys(jsonb,text[]),public.shade_feedback_assert_access(),
  public.purge_shade_feedback_for_user(uuid),public.shade_feedback_profile_lifecycle(),public.shade_feedback_receipt_deleted(),
  public.shade_feedback_retention_sweep(),public.close_shade_feedback_purpose(uuid),public.shade_feedback_keep_provenance() from public,anon,authenticated,service_role;
revoke all on function public.shade_feedback_enabled(),public.set_shade_feedback_consent(text),public.record_shade_feedback(jsonb),
  public.update_shade_feedback(uuid,jsonb),public.delete_shade_feedback() from public,anon,authenticated,service_role;
revoke all on function public.list_shade_feedback(integer) from public,anon,authenticated,service_role;
grant execute on function public.shade_feedback_enabled(),public.set_shade_feedback_consent(text),public.record_shade_feedback(jsonb),
  public.update_shade_feedback(uuid,jsonb),public.delete_shade_feedback() to authenticated;
grant execute on function public.list_shade_feedback(integer) to authenticated;
grant execute on function public.shade_feedback_retention_sweep(),public.close_shade_feedback_purpose(uuid) to service_role;
