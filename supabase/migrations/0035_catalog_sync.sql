create table public.catalog_product_state (
  product_gid text primary key,
  observed_at timestamptz not null,
  deleted boolean not null default false
);
alter table public.catalog_product_state enable row level security;
revoke all on public.catalog_product_state from public,anon,authenticated;
grant all on public.catalog_product_state to service_role;
create unique index catalog_sync_runs_start_idx on public.catalog_sync_runs(started_at);

create function public.catalog_claim_event(p_event_id text,p_topic text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare event public.shopify_webhook_events;
begin
  if length(p_event_id) not between 1 and 200 then raise exception 'invalid event id'; end if;
  insert into public.shopify_webhook_events(event_id,topic,status,lease_until)
  values(p_event_id,p_topic,'processing',now()+interval '5 minutes') on conflict do nothing;
  if found then return 'claimed'; end if;
  select * into event from public.shopify_webhook_events where event_id=p_event_id for update;
  if event.topic<>p_topic then raise exception 'event topic conflict'; end if;
  if event.status='complete' then return 'done'; end if;
  if event.status='processing' and event.lease_until>now() then return 'busy'; end if;
  update public.shopify_webhook_events set status='processing',lease_until=now()+interval '5 minutes',
    attempts=attempts+1,updated_at=now() where event_id=p_event_id;
  return 'claimed';
end;
$$;

create function public.catalog_finish_event(p_event_id text,p_success boolean)
returns void language sql security definer set search_path=public,pg_temp as $$
  update public.shopify_webhook_events set status=case when p_success then 'complete' else 'failed' end,
    updated_at=now(),lease_until=now() where event_id=p_event_id;
$$;

create function public.catalog_apply_inventory(p_snapshot jsonb,p_observed_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare item_id text:=p_snapshot->>'inventory_item_gid'; level jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('truetone-catalog-sync',0));
  if item_id is null or jsonb_typeof(p_snapshot->'levels') is distinct from 'array' or p_observed_at is null then
    raise exception 'invalid inventory snapshot';
  end if;
  for level in select value from jsonb_array_elements(p_snapshot->'levels') loop
    insert into public.catalog_inventory_levels(inventory_item_gid,location_gid,available,online,observed_at)
    values(item_id,level->>'location_gid',(level->>'available')::integer,(level->>'online')::boolean,p_observed_at)
    on conflict(inventory_item_gid,location_gid) do update set available=excluded.available,
      online=excluded.online,observed_at=excluded.observed_at
    where catalog_inventory_levels.observed_at<=excluded.observed_at;
  end loop;
  -- A full inventory snapshot also invalidates locations no longer returned by Shopify.
  update public.catalog_inventory_levels set available=0,online=false,observed_at=p_observed_at
  where inventory_item_gid=item_id and observed_at<=p_observed_at
    and location_gid not in(select value->>'location_gid' from jsonb_array_elements(p_snapshot->'levels'));
end;
$$;

create function public.catalog_apply_product(p_snapshot jsonb,p_observed_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare product_id text:=p_snapshot->>'product_gid'; row_data jsonb;
  old_variant public.catalog_variants; label_uuid uuid; proposed_uuid uuid; proposed_count integer;
  identity_key text; next_revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('truetone-catalog-sync',0));
  if product_id is null or jsonb_typeof(p_snapshot->'variants') is distinct from 'array' or p_observed_at is null then
    raise exception 'invalid product snapshot';
  end if;
  if exists(select 1 from public.catalog_product_state where product_gid=product_id and observed_at>p_observed_at) then return; end if;
  insert into public.catalog_product_state(product_gid,observed_at,deleted) values(product_id,p_observed_at,false)
    on conflict(product_gid) do update set observed_at=excluded.observed_at,deleted=false;
  for row_data in select value from jsonb_array_elements(p_snapshot->'variants') loop
    select * into old_variant from public.catalog_variants where variant_gid=row_data->>'variant_gid';
    identity_key:=lower(trim(row_data->>'vendor'))||':'||case
      when nullif(trim(row_data->>'sku'),'') is not null then 'sku:'||trim(row_data->>'sku')
      when nullif(trim(row_data->>'barcode'),'') is not null then 'barcode:'||trim(row_data->>'barcode')
      else 'shade:'||lower(trim(row_data->>'formula_key'))||':'||lower(trim(row_data->>'shade_name')) end;
    insert into public.catalog_variants(variant_gid,product_gid,inventory_item_gid,formula_key,formula_version,shade_name,
      vendor,sku,barcode,reattach_key,published,deleted,price,currency,observed_at)
    values(row_data->>'variant_gid',product_id,row_data->>'inventory_item_gid',row_data->>'formula_key',row_data->>'formula_version',
      row_data->>'shade_name',row_data->>'vendor',row_data->>'sku',row_data->>'barcode',identity_key,
      (row_data->>'published')::boolean,false,(row_data->>'price')::numeric,row_data->>'currency',p_observed_at)
    on conflict(variant_gid) do update set product_gid=excluded.product_gid,inventory_item_gid=excluded.inventory_item_gid,
      formula_key=excluded.formula_key,formula_version=excluded.formula_version,shade_name=excluded.shade_name,vendor=excluded.vendor,
      sku=excluded.sku,barcode=excluded.barcode,reattach_key=excluded.reattach_key,published=excluded.published,
      deleted=false,price=excluded.price,currency=excluded.currency,observed_at=excluded.observed_at;
    if old_variant.variant_gid is null or old_variant.deleted
      or old_variant.formula_key is distinct from row_data->>'formula_key'
      or old_variant.formula_version is distinct from row_data->>'formula_version'
      or old_variant.shade_name is distinct from row_data->>'shade_name' then
      select coalesce(max(revision),0)+1 into next_revision from public.catalog_tone_labels
        where formula_key=row_data->>'formula_key' and formula_version=row_data->>'formula_version' and shade_key=row_data->>'shade_name';
      insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision)
      values(row_data->>'formula_key',row_data->>'formula_version',row_data->>'shade_name',next_revision) returning id into label_uuid;
      select count(distinct l.id),min(l.id::text)::uuid into proposed_count,proposed_uuid
      from public.catalog_variants v join public.catalog_label_bindings b using(variant_gid)
      join public.catalog_tone_labels l on l.id=b.label_id
      where v.reattach_key=identity_key and (v.deleted or v.variant_gid=row_data->>'variant_gid')
        and l.status='approved' and l.formula_key=row_data->>'formula_key' and l.formula_version=row_data->>'formula_version';
      insert into public.catalog_label_bindings(variant_gid,label_id,candidate_label_id)
      values(row_data->>'variant_gid',label_uuid,case when proposed_count=1 then proposed_uuid end)
      on conflict(variant_gid) do update set label_id=excluded.label_id,candidate_label_id=excluded.candidate_label_id,bound_at=now();
    end if;
    perform public.catalog_apply_inventory(jsonb_build_object('inventory_item_gid',row_data->>'inventory_item_gid','levels',row_data->'levels'),p_observed_at);
  end loop;
  update public.catalog_variants set deleted=true,published=false,observed_at=p_observed_at
    where product_gid=product_id and observed_at<=p_observed_at
      and variant_gid not in(select value->>'variant_gid' from jsonb_array_elements(p_snapshot->'variants'));
end;
$$;

create function public.catalog_delete_product(p_product_gid text,p_observed_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('truetone-catalog-sync',0));
  if exists(select 1 from public.catalog_product_state where product_gid=p_product_gid and observed_at>p_observed_at) then return; end if;
  insert into public.catalog_product_state(product_gid,observed_at,deleted) values(p_product_gid,p_observed_at,true)
    on conflict(product_gid) do update set observed_at=excluded.observed_at,deleted=true;
  update public.catalog_variants set deleted=true,published=false,observed_at=p_observed_at
    where product_gid=p_product_gid and observed_at<=p_observed_at;
end;
$$;

create function public.catalog_begin_reconcile(p_started_at timestamptz)
returns void language sql security definer set search_path=public,pg_temp as $$
  insert into public.catalog_sync_runs(started_at,status) values(p_started_at,'running');
$$;
create function public.catalog_fail_reconcile(p_started_at timestamptz)
returns void language sql security definer set search_path=public,pg_temp as $$
  update public.catalog_sync_runs set status='failed',failure_code='sync_failed',completed_at=now()
    where started_at=p_started_at and status='running';
$$;
create function public.catalog_finish_reconcile(p_product_ids text[],p_started_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_product_ids is null or p_started_at is null then raise exception 'invalid reconciliation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('truetone-catalog-sync',0));
  if not exists(select 1 from public.catalog_sync_runs where started_at=p_started_at and status='running') then
    raise exception 'reconciliation not running';
  end if;
  update public.catalog_variants set deleted=true,published=false,observed_at=p_started_at
    where observed_at<=p_started_at and not(product_gid=any(p_product_ids));
  update public.catalog_product_state set deleted=true,observed_at=p_started_at
    where observed_at<=p_started_at and not(product_gid=any(p_product_ids));
  update public.catalog_sync_runs set status='complete',completed_at=now(),product_count=cardinality(p_product_ids)
    where started_at=p_started_at;
end;
$$;

revoke all on function public.catalog_claim_event(text,text),public.catalog_finish_event(text,boolean),
  public.catalog_apply_inventory(jsonb,timestamptz),public.catalog_apply_product(jsonb,timestamptz),
  public.catalog_delete_product(text,timestamptz),public.catalog_begin_reconcile(timestamptz),
  public.catalog_fail_reconcile(timestamptz),public.catalog_finish_reconcile(text[],timestamptz) from public,anon,authenticated;
grant execute on function public.catalog_claim_event(text,text),public.catalog_finish_event(text,boolean),
  public.catalog_apply_inventory(jsonb,timestamptz),public.catalog_apply_product(jsonb,timestamptz),
  public.catalog_delete_product(text,timestamptz),public.catalog_begin_reconcile(timestamptz),
  public.catalog_fail_reconcile(timestamptz),public.catalog_finish_reconcile(text[],timestamptz) to service_role;
