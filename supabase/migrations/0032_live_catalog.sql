-- Product evidence only. No shopper, image, scan, or feedback data belongs here.
create domain public.catalog_evidence_tier as text check (value in ('M','B','C','D','X'));

create function public.catalog_modifiers_valid(modifiers text[], confidence jsonb)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select coalesce(
    modifiers <@ array['olive','golden/yellow','peach','pink/rosy','red']::text[]
    and cardinality(modifiers) = (select count(distinct m) from unnest(modifiers) m)
    and jsonb_typeof(confidence) = 'object'
    and (select count(*) from jsonb_object_keys(confidence)) = cardinality(modifiers)
    and not exists(select 1 from unnest(modifiers) m
      where not coalesce(confidence->>m in ('M','B','C','D','X'),false)), false);
$$;

create function public.catalog_reviewers_valid(reviewers text[],required_count integer)
returns boolean language sql immutable set search_path=public,pg_temp as $$
  select required_count >= 0 and (select count(distinct r) from unnest(reviewers) r where length(trim(r))>0) >= required_count;
$$;

create table public.catalog_variants (
  variant_gid text primary key,
  product_gid text not null,
  inventory_item_gid text,
  formula_key text not null,
  formula_version text not null,
  shade_name text not null,
  vendor text not null,
  sku text,
  barcode text,
  reattach_key text,
  published boolean not null default false,
  deleted boolean not null default false,
  price numeric check (price >= 0),
  currency text check (length(currency) = 3),
  observed_at timestamptz not null,
  check (length(formula_key)>0 and length(formula_version)>0 and length(shade_name)>0)
);
create index catalog_variants_product_idx on public.catalog_variants(product_gid);
create index catalog_variants_inventory_idx on public.catalog_variants(inventory_item_gid);
create index catalog_variants_reattach_idx on public.catalog_variants(reattach_key);

create table public.catalog_inventory_levels (
  inventory_item_gid text not null,
  location_gid text not null,
  available integer not null,
  online boolean not null default false,
  observed_at timestamptz not null,
  primary key (inventory_item_gid, location_gid)
);

create table public.catalog_tone_labels (
  id uuid primary key default gen_random_uuid(),
  formula_key text not null,
  formula_version text not null,
  shade_key text not null,
  revision integer not null check (revision > 0),
  status text not null default 'unverified' check (status in ('unverified','draft','approved','retired')),
  depth_band integer check (depth_band between 1 and 10),
  brand_depth_rank numeric check (brand_depth_rank between 0 and 100),
  base_undertone text not null default 'unknown' check (base_undertone in ('cool','neutral','warm','unknown')),
  normalized_base_undertone text generated always as (base_undertone) stored,
  undertone_modifiers text[] not null default '{}',
  depth_confidence public.catalog_evidence_tier not null default 'X',
  rank_confidence public.catalog_evidence_tier not null default 'X',
  undertone_confidence public.catalog_evidence_tier not null default 'X',
  modifier_confidence jsonb not null default '{}',
  lab_confidence public.catalog_evidence_tier not null default 'X',
  native_depth text,
  native_undertone text,
  native_shade_code text,
  native_richness text,
  original_brand_description text,
  depth_source text,
  undertone_source text,
  source_url text,
  source_market text,
  source_as_of date,
  source_licence text,
  source_attribution text,
  parser_version text,
  mapping_version text,
  model_version text,
  reviewer_count integer not null default 0 check (reviewer_count >= 0),
  reviewer_ids text[] not null default '{}',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  lab_status text not null default 'unmeasured' check (lab_status in ('unmeasured','measured')),
  lab_l double precision check (lab_l >= 0 and lab_l <= 100),
  lab_a double precision check (lab_a between -128 and 127),
  lab_b double precision check (lab_b between -128 and 127),
  measurement_protocol_version text,
  measurement_substrate text,
  measurement_thickness text,
  measurement_dry_time text,
  measurement_illuminant text,
  measurement_geometry text,
  lab_validated boolean not null default false,
  finish text,
  coverage text,
  unique (formula_key,formula_version,shade_key,revision),
  check (public.catalog_modifiers_valid(undertone_modifiers, modifier_confidence)),
  check ((lab_status='unmeasured' and lab_l is null and lab_a is null and lab_b is null and not lab_validated)
    or (lab_status='measured' and lab_l is not null and lab_a is not null and lab_b is not null
      and measurement_protocol_version is not null and measurement_substrate is not null
      and measurement_thickness is not null and measurement_dry_time is not null
      and measurement_illuminant is not null and measurement_geometry is not null and lab_confidence='M')),
  check ((depth_confidence<>'M' and rank_confidence<>'M' and undertone_confidence<>'M'
      and not jsonb_path_exists(modifier_confidence, '$.* ? (@ == "M")')) or lab_status='measured'),
  check (status<>'approved' or coalesce(
    depth_band is not null and base_undertone<>'unknown'
    and depth_confidence in ('M','B','C') and undertone_confidence in ('M','B','C')
    and (brand_depth_rank is null or rank_confidence in ('M','B','C'))
    and not jsonb_path_exists(modifier_confidence, '$.* ? (@ == "D" || @ == "X")')
    and depth_source is not null and undertone_source is not null and source_url is not null
    and source_market is not null and source_as_of is not null and parser_version is not null
    and reviewer_count >= case when depth_confidence='C' or undertone_confidence='C'
      or rank_confidence='C' or jsonb_path_exists(modifier_confidence, '$.* ? (@ == "C")') then 2 else 1 end
    and public.catalog_reviewers_valid(reviewer_ids,reviewer_count) and approved_at is not null, false))
);

create function public.catalog_keep_approved_evidence()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status in ('approved','retired') then
    if tg_op='DELETE' then raise exception using errcode='55000', message='approved label history is immutable'; end if;
    if new.status not in ('approved','retired') or
       (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
      raise exception using errcode='55000', message='create a new label revision';
    end if;
    if old.status='retired' and new.status<>'retired' then
      raise exception using errcode='55000', message='retired evidence cannot be restored';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger catalog_label_immutable before update or delete on public.catalog_tone_labels
for each row execute function public.catalog_keep_approved_evidence();

create table public.catalog_label_bindings (
  variant_gid text primary key references public.catalog_variants(variant_gid),
  label_id uuid references public.catalog_tone_labels(id),
  candidate_label_id uuid references public.catalog_tone_labels(id),
  bound_at timestamptz not null default now()
);

create table public.shopify_webhook_events (
  event_id text primary key,
  topic text not null check (topic in ('products/create','products/update','products/delete','inventory_levels/update')),
  status text not null check (status in ('processing','complete','failed')),
  lease_until timestamptz not null,
  attempts integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('running','complete','failed','blocked')),
  product_count integer,
  failure_code text check (failure_code in ('configuration_missing','sync_failed'))
);

-- Deliberate owner-executed, security-barrier projection. Clients receive no base-table grants.
create view public.catalog_verified_shades with (security_barrier=true) as
select v.*, l.id as label_id, l.depth_band, l.brand_depth_rank, l.base_undertone,
  l.undertone_modifiers, l.depth_confidence, l.rank_confidence, l.undertone_confidence,
  l.modifier_confidence, l.finish, l.coverage, l.lab_status,
  case when l.lab_validated then l.lab_l end as lab_l,
  case when l.lab_validated then l.lab_a end as lab_a,
  case when l.lab_validated then l.lab_b end as lab_b
from public.catalog_variants v
join public.catalog_label_bindings b using (variant_gid)
join public.catalog_tone_labels l on l.id=b.label_id
where l.status='approved' and l.formula_key=v.formula_key and l.formula_version=v.formula_version
  and l.shade_key=v.shade_name
  and ((l.depth_confidence<>'M' and l.undertone_confidence<>'M' and l.rank_confidence<>'M'
    and not jsonb_path_exists(l.modifier_confidence, '$.* ? (@ == "M")')) or l.lab_validated);

create view public.catalog_needs_label with (security_barrier=true) as
select v.variant_gid,v.product_gid,v.vendor,v.formula_key,v.formula_version,v.shade_name,
  coalesce(l.status,'unverified') as status,b.candidate_label_id
from public.catalog_variants v
left join public.catalog_label_bindings b using (variant_gid)
left join public.catalog_tone_labels l on l.id=b.label_id
where not v.deleted and not exists(select 1 from public.catalog_verified_shades s where s.variant_gid=v.variant_gid);

create view public.catalog_recommendable with (security_barrier=true) as
select s.variant_gid,s.product_gid,s.vendor,s.shade_name,s.formula_key,s.formula_version,
  s.price,s.currency,s.label_id,s.depth_band,s.brand_depth_rank,s.base_undertone,
  s.undertone_modifiers,s.depth_confidence,s.rank_confidence,s.undertone_confidence,
  s.modifier_confidence,s.finish,s.coverage,s.lab_status,s.lab_l,s.lab_a,s.lab_b
from public.catalog_verified_shades s
where s.published and not s.deleted and s.observed_at > now()-interval '26 hours'
and exists(select 1 from public.catalog_inventory_levels i where i.inventory_item_gid=s.inventory_item_gid
  and i.online and i.available>0 and i.observed_at>now()-interval '26 hours');

alter table public.catalog_variants enable row level security;
alter table public.catalog_inventory_levels enable row level security;
alter table public.catalog_tone_labels enable row level security;
alter table public.catalog_label_bindings enable row level security;
alter table public.shopify_webhook_events enable row level security;
alter table public.catalog_sync_runs enable row level security;

revoke all on public.catalog_variants,public.catalog_inventory_levels,public.catalog_tone_labels,
  public.catalog_label_bindings,public.shopify_webhook_events,public.catalog_sync_runs,
  public.catalog_verified_shades,public.catalog_needs_label,public.catalog_recommendable from public,anon,authenticated;
grant select on public.catalog_recommendable to authenticated;
grant all on public.catalog_variants,public.catalog_inventory_levels,public.catalog_tone_labels,
  public.catalog_label_bindings,public.shopify_webhook_events,public.catalog_sync_runs to service_role;
grant select on public.catalog_verified_shades,public.catalog_needs_label,public.catalog_recommendable to service_role;
revoke all on function public.catalog_modifiers_valid(text[],jsonb),public.catalog_reviewers_valid(text[],integer),public.catalog_keep_approved_evidence() from public,anon,authenticated;
grant execute on function public.catalog_modifiers_valid(text[],jsonb),public.catalog_reviewers_valid(text[],integer) to service_role;
