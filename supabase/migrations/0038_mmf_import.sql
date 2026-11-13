-- Secondary catalogue estimates only. No inferred formula, shopper, scan or measured-colour fields.
create table public.catalog_mmf_batches (
  source_sha256 text primary key check (source_sha256 ~ '^[a-f0-9]{64}$'),
  dataset_version date not null,
  retrieved_at date not null,
  source_url text not null check (source_url='https://matchmyfoundation.com/data/'),
  source_attribution text not null check (source_attribution='Match My Foundation (2026). Cross-brand foundation shade dataset: 410 shades across 13 lines, with 4920 computed cross-brand matches. https://matchmyfoundation.com/data/ (CC BY 4.0)'),
  source_licence text not null check (source_licence='https://creativecommons.org/licenses/by/4.0/'),
  change_notice text not null check (length(btrim(change_notice))>0),
  imported_at timestamptz not null default now()
);

create table public.catalog_mmf_source_labels (
  dataset_version date not null,
  source_key text not null check (source_key ~ '^[a-f0-9]{64}$'),
  source_sha256 text not null references public.catalog_mmf_batches(source_sha256),
  source_brand_line text not null check (length(btrim(source_brand_line))>0),
  brand text not null check (length(btrim(brand))>0),
  product_line text not null check (length(btrim(product_line))>0),
  shade_name text not null check (length(btrim(shade_name))>0),
  native_depth numeric not null check (native_depth between 1 and 10),
  native_undertone text not null check (native_undertone in ('cool','neutral','warm','olive')),
  depth_basis text not null check (length(btrim(depth_basis))>0),
  depth_method text not null check (length(btrim(depth_method))>0),
  undertone_basis text not null check (length(btrim(undertone_basis))>0),
  formula_scope text not null check (length(btrim(formula_scope))>0),
  source_record text not null check (source_record ~ '^https://matchmyfoundation[.]com/'),
  depth_confidence text not null default 'D' check (depth_confidence='D'),
  undertone_confidence text not null default 'D' check (undertone_confidence='D'),
  lab_status text not null default 'unmeasured' check (lab_status='unmeasured'),
  status text not null default 'unverified' check (status='unverified'),
  -- Set only after an operator independently verifies exact formula/identity and creates a label.
  -- The importer cannot set this, change a reviewed source row, or modify that approved label.
  reviewed_label_id uuid references public.catalog_tone_labels(id),
  primary key (dataset_version,source_key)
);

alter table public.catalog_mmf_batches enable row level security;
alter table public.catalog_mmf_source_labels enable row level security;
revoke all on public.catalog_mmf_batches,public.catalog_mmf_source_labels from public,anon,authenticated;
grant select,insert,update on public.catalog_mmf_batches,public.catalog_mmf_source_labels to service_role;

create function public.catalog_import_mmf(p_batch jsonb,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  r jsonb;
  changed integer;
  imported integer := 0;
  protected integer := 0;
  version date;
begin
  if jsonb_typeof(p_batch) is distinct from 'object' or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode='22023',message='invalid MMF payload';
  end if;
  if jsonb_array_length(p_rows)>1000 or p_batch - array['dataset_version','retrieved_at','source_sha256','source_url','attribution','licence_url','change_notice'] <> '{}'::jsonb then
    raise exception using errcode='22023',message='invalid MMF payload';
  end if;
  version := (p_batch->>'dataset_version')::date;
  insert into public.catalog_mmf_batches(source_sha256,dataset_version,retrieved_at,source_url,source_attribution,source_licence,change_notice)
  values(p_batch->>'source_sha256',version,(p_batch->>'retrieved_at')::date,p_batch->>'source_url',p_batch->>'attribution',p_batch->>'licence_url',p_batch->>'change_notice')
  on conflict(source_sha256) do nothing;
  if not exists(select 1 from public.catalog_mmf_batches b where b.source_sha256=p_batch->>'source_sha256'
    and b.dataset_version=version and b.retrieved_at=(p_batch->>'retrieved_at')::date
    and b.source_url=p_batch->>'source_url' and b.source_attribution=p_batch->>'attribution'
    and b.source_licence=p_batch->>'licence_url' and b.change_notice=p_batch->>'change_notice') then
    raise exception using errcode='22023',message='conflicting MMF batch identity';
  end if;
  if (select count(*) from jsonb_array_elements(p_rows)) <> (select count(distinct x->>'source_key') from jsonb_array_elements(p_rows) x) then
    raise exception using errcode='22023',message='duplicate MMF source identity';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r) is distinct from 'object' or
      r - array['source_key','source_brand_line','brand','product_line','shade_name','native_depth','native_undertone','depth_basis','depth_method','undertone_basis','formula_scope','source_record','depth_confidence','undertone_confidence','lab_status','status'] <> '{}'::jsonb
      or jsonb_typeof(r->'native_depth') is distinct from 'number' then
      raise exception using errcode='22023',message='invalid MMF source fields';
    end if;
    insert into public.catalog_mmf_source_labels as existing
      (dataset_version,source_key,source_sha256,source_brand_line,brand,product_line,shade_name,native_depth,native_undertone,
       depth_basis,depth_method,undertone_basis,formula_scope,source_record,depth_confidence,undertone_confidence,lab_status,status)
    values(version,r->>'source_key',p_batch->>'source_sha256',r->>'source_brand_line',r->>'brand',r->>'product_line',r->>'shade_name',(r->>'native_depth')::numeric,r->>'native_undertone',
      r->>'depth_basis',r->>'depth_method',r->>'undertone_basis',r->>'formula_scope',r->>'source_record',r->>'depth_confidence',r->>'undertone_confidence',r->>'lab_status',r->>'status')
    on conflict(dataset_version,source_key) do update set
      source_sha256=excluded.source_sha256,source_brand_line=excluded.source_brand_line,brand=excluded.brand,product_line=excluded.product_line,
      shade_name=excluded.shade_name,native_depth=excluded.native_depth,native_undertone=excluded.native_undertone,
      depth_basis=excluded.depth_basis,depth_method=excluded.depth_method,undertone_basis=excluded.undertone_basis,
      formula_scope=excluded.formula_scope,source_record=excluded.source_record
    where existing.reviewed_label_id is null;
    get diagnostics changed = row_count;
    imported := imported+changed;
    protected := protected+(1-changed);
  end loop;
  return jsonb_build_object('imported',imported,'protected',protected);
end;
$$;
revoke all on function public.catalog_import_mmf(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.catalog_import_mmf(jsonb,jsonb) to service_role;
