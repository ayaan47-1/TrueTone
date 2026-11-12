begin;
select plan(21);
select has_table('public','catalog_mmf_batches','source attribution is retained');
select has_table('public','catalog_mmf_source_labels','native estimates are separate from reviewed labels');
select has_function('public','catalog_import_mmf',array['jsonb','jsonb'],'service-only import RPC exists');
select ok(not has_function_privilege('authenticated','public.catalog_import_mmf(jsonb,jsonb)','EXECUTE'),'client cannot import');
select ok(not has_table_privilege('authenticated','public.catalog_mmf_source_labels','SELECT'),'source drafts are private');
set local role service_role;
select lives_ok($q$select public.catalog_import_mmf(
 '{"dataset_version":"2026-11-10","retrieved_at":"2026-11-12","source_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source_url":"https://matchmyfoundation.com/data/","attribution":"Match My Foundation (2026). Cross-brand foundation shade dataset: 410 shades across 13 lines, with 4920 computed cross-brand matches. https://matchmyfoundation.com/data/ (CC BY 4.0)","licence_url":"https://creativecommons.org/licenses/by/4.0/","change_notice":"Adapted by TrueTone; estimates only."}',
 '[{"source_key":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","source_brand_line":"Maybelline Fit Me","brand":"Maybelline","product_line":"Fit Me","shade_name":"102 Fair Porcelain","native_depth":1.5,"native_undertone":"olive","depth_confidence":"D","undertone_confidence":"D","lab_status":"unmeasured","status":"unverified","depth_basis":"hand-scored","depth_method":"estimated","undertone_basis":"site-assigned","formula_scope":"line, not formula","source_record":"https://matchmyfoundation.com/data/shade-sources/#test"}]')$q$,'imports estimate');
select is((select native_depth from public.catalog_mmf_source_labels),1.5::numeric,'decimal precision retained');
select is((select lab_status from public.catalog_mmf_source_labels),'unmeasured','not measured');
select is((select status from public.catalog_mmf_source_labels),'unverified','never auto-approved');
select is((select count(*) from public.catalog_tone_labels),0::bigint,'no invented formula labels or overwrites');
select is((select count(*) from public.catalog_label_bindings),0::bigint,'no inferred Shopify bindings');
select ok((select source_attribution like 'Match My Foundation%' and source_licence='https://creativecommons.org/licenses/by/4.0/' from public.catalog_mmf_batches),'licence and credit stored');
reset role;
create function pg_temp.reimport(p_patch jsonb) returns jsonb language sql as $$
  select public.catalog_import_mmf(
    (select jsonb_build_object('dataset_version',dataset_version,'retrieved_at',retrieved_at,'source_sha256',source_sha256,
      'source_url',source_url,'attribution',source_attribution,'licence_url',source_licence,'change_notice',change_notice)
     from public.catalog_mmf_batches limit 1),
    (select jsonb_agg((to_jsonb(s)-array['dataset_version','source_sha256','reviewed_label_id']) || p_patch)
     from public.catalog_mmf_source_labels s));
$$;
set local role service_role;
select is((pg_temp.reimport('{}')->>'imported')::integer,1,'re-import updates an unreviewed source once');
select is((select count(*) from public.catalog_mmf_source_labels),1::bigint,'re-import does not duplicate source labels');
select throws_ok($$select pg_temp.reimport('{"lab_l":50}')$$,'22023',null,'RPC rejects measured-colour fields');
select throws_ok($$select pg_temp.reimport('{"depth_confidence":"M"}')$$,'23514',null,'RPC rejects measured tier');
select throws_ok($$select pg_temp.reimport('{"native_depth":"3"}')$$,'22023',null,'RPC rejects numeric strings');
insert into public.catalog_tone_labels(id,formula_key,formula_version,shade_key,revision,status,depth_band,base_undertone,depth_confidence,undertone_confidence,depth_source,undertone_source,source_url,source_market,source_as_of,parser_version,reviewer_count,reviewer_ids,approved_at)
values ('00000000-0000-4000-8000-000000000001','independently-reviewed-formula','1','102 Fair Porcelain',1,'approved',5,'neutral','B','B','brand','brand','https://example.com/shades','US',current_date,'1',1,array['reviewer'],now());
update public.catalog_mmf_source_labels set reviewed_label_id='00000000-0000-4000-8000-000000000001';
select is((pg_temp.reimport('{"native_depth":3}')->>'protected')::integer,1,'re-import skips reviewed source rows');
select is((select native_depth from public.catalog_mmf_source_labels),1.5::numeric,'reviewed source estimate is not overwritten');
select is((select depth_band from public.catalog_tone_labels),5,'approved label remains unchanged');
select ok(not exists(select 1 from information_schema.columns where table_name='catalog_mmf_source_labels' and column_name in ('lab_l','lab_a','lab_b','hex','accuracy','match_percent')),'source table cannot store measurements or accuracy');
reset role;
select * from finish();
rollback;
