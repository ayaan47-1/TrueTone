-- Operator-only, atomic queue submission. Uses the same lock as commerce sync.
create function public.catalog_submit_label(p_review jsonb,p_action text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v public.catalog_variants;
  current_label uuid;
  new_label public.catalog_tone_labels;
  evidence jsonb := p_review->'label';
  reviewers text[];
  next_revision integer;
begin
  if p_action is null or p_action not in ('draft','approve')
    or jsonb_typeof(p_review) is distinct from 'object'
    or not (p_review ? 'expected_label_id')
    or jsonb_typeof(evidence) is distinct from 'object' then
    raise exception using errcode='22023',message='invalid review';
  end if;
  if exists(select 1 from jsonb_object_keys(evidence) k where k <> all(array[
    'depth_band','brand_depth_rank','base_undertone','undertone_modifiers',
    'depth_confidence','rank_confidence','undertone_confidence','modifier_confidence',
    'native_depth','native_undertone','native_shade_code','native_richness','original_brand_description',
    'depth_source','undertone_source','source_url','source_market','source_as_of','source_licence',
    'source_attribution','parser_version','mapping_version','model_version','reviewer_ids','finish','coverage'])) then
    raise exception using errcode='22023',message='unsupported evidence field';
  end if;
  if jsonb_typeof(evidence->'reviewer_ids') is distinct from 'array' then
    raise exception using errcode='22023',message='reviewer IDs required';
  end if;
  if exists(select 1 from jsonb_array_elements(evidence->'reviewer_ids') r
    where jsonb_typeof(r) is distinct from 'string') then
    raise exception using errcode='22023',message='reviewer IDs must be strings';
  end if;
  select array_agg(id order by id) into reviewers from
    (select distinct lower(regexp_replace(value,'[[:space:]]','','g')) id
      from jsonb_array_elements_text(evidence->'reviewer_ids')) ids;
  if not public.catalog_reviewers_valid(reviewers,1) then
    raise exception using errcode='22023',message='reviewer IDs required';
  end if;

  -- Approval must enforce provenance even when callers bypass the CLI.
  -- Trim ASCII whitespace as well as spaces (btrim's default).
  if p_action='approve' and exists (
    select 1 from unnest(array['depth_source','undertone_source','source_url','source_market','parser_version']) field
    where nullif(btrim(evidence->>field,E' \t\n\r\f' || chr(11)),'') is null
  ) then
    raise exception using errcode='22023',message='approval requires nonblank provenance';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('truetone-catalog-sync',0));
  select * into v from public.catalog_variants where variant_gid=p_review->>'variant_gid' for update;
  select label_id into current_label from public.catalog_label_bindings where variant_gid=v.variant_gid;
  if v.variant_gid is null or v.deleted
    or v.formula_key is distinct from p_review->>'formula_key'
    or v.formula_version is distinct from p_review->>'formula_version'
    or v.shade_name is distinct from p_review->>'shade_name'
    or current_label is distinct from (p_review->>'expected_label_id')::uuid
    or not exists(select 1 from public.catalog_needs_label where variant_gid=v.variant_gid) then
    raise exception using errcode='40001',message='stale review; export the queue entry again';
  end if;
  -- This tool handles label-based evidence only; immutable measured labels use a separate workflow.
  if exists(select 1 from public.catalog_tone_labels where id=current_label and status in ('approved','retired')) then
    raise exception using errcode='22023',message='immutable evidence requires a separate revision workflow';
  end if;
  select coalesce(max(revision),0)+1 into next_revision from public.catalog_tone_labels
    where formula_key=v.formula_key and formula_version=v.formula_version and shade_key=v.shade_name;
  insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision)
    values(v.formula_key,v.formula_version,v.shade_name,next_revision) returning * into new_label;
  new_label := jsonb_populate_record(new_label,evidence);
  update public.catalog_tone_labels set
    status=case when p_action='approve' then 'approved' else 'draft' end,
    approved_at=case when p_action='approve' then now() else null end,
    reviewer_ids=reviewers,reviewer_count=cardinality(reviewers),
    depth_band=new_label.depth_band,brand_depth_rank=new_label.brand_depth_rank,
    base_undertone=new_label.base_undertone,undertone_modifiers=new_label.undertone_modifiers,
    depth_confidence=new_label.depth_confidence,rank_confidence=new_label.rank_confidence,
    undertone_confidence=new_label.undertone_confidence,modifier_confidence=new_label.modifier_confidence,
    native_depth=new_label.native_depth,native_undertone=new_label.native_undertone,
    native_shade_code=new_label.native_shade_code,native_richness=new_label.native_richness,
    original_brand_description=new_label.original_brand_description,
    depth_source=new_label.depth_source,undertone_source=new_label.undertone_source,
    source_url=new_label.source_url,source_market=new_label.source_market,source_as_of=new_label.source_as_of,
    source_licence=new_label.source_licence,source_attribution=new_label.source_attribution,
    parser_version=new_label.parser_version,mapping_version=new_label.mapping_version,
    model_version=new_label.model_version,finish=new_label.finish,coverage=new_label.coverage
  where id=new_label.id;
  insert into public.catalog_label_bindings(variant_gid,label_id)
    values(v.variant_gid,new_label.id)
    on conflict(variant_gid) do update set label_id=excluded.label_id,candidate_label_id=null,bound_at=now();
  return new_label.id;
end;
$$;
revoke all on function public.catalog_submit_label(jsonb,text) from public,anon,authenticated;
grant execute on function public.catalog_submit_label(jsonb,text) to service_role;
