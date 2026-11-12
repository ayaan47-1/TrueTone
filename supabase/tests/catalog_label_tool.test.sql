begin;
select plan(29);

insert into public.catalog_variants(variant_gid,product_gid,formula_key,formula_version,shade_name,vendor,observed_at)
values ('label-tool-v','label-tool-p','label-tool-formula','1','Tan','Test',now());

create function pg_temp.review(p_ids jsonb default '[" Alice Smith ","BOB"]', p_tier text default 'C')
returns jsonb language sql as $$
select jsonb_build_object('variant_gid','label-tool-v','expected_label_id',null,
  'formula_key','label-tool-formula','formula_version','1','shade_name','Tan',
  'label',jsonb_build_object('depth_band',5,'base_undertone','warm','depth_confidence',p_tier,
    'undertone_confidence','B','native_depth','Tan','native_undertone','Golden',
    'undertone_modifiers',jsonb_build_array('olive'),'modifier_confidence','{"olive":"C"}'::jsonb,
    'reviewer_ids',p_ids,'depth_source','brand','undertone_source','brand',
    'source_url','https://example.com/chart','source_market','US','source_as_of','2026-11-01',
    'parser_version','manual-1'));
$$;

select ok(not has_function_privilege('anon','public.catalog_submit_label(jsonb,text)','EXECUTE'), 'anon cannot submit');
select ok(not has_function_privilege('authenticated','public.catalog_submit_label(jsonb,text)','EXECUTE'), 'mobile cannot submit');
select ok(has_function_privilege('service_role','public.catalog_submit_label(jsonb,text)','EXECUTE'), 'operator can submit');
select throws_ok($$select public.catalog_submit_label(pg_temp.review(),'delete')$$, '22023', null, 'unknown action rejected');
select throws_ok($$select public.catalog_submit_label(pg_temp.review()-'expected_label_id','draft')$$, '22023', null, 'missing concurrency token rejected');
select throws_ok($$select public.catalog_submit_label(jsonb_set(pg_temp.review(),'{formula_version}','"stale"'),'draft')$$, '40001', null, 'stale formula rejected');
select throws_ok($$select public.catalog_submit_label(jsonb_set(pg_temp.review(),'{label,status}','"approved"'),'draft')$$, '22023', null, 'server-owned fields rejected');
select throws_ok($$select public.catalog_submit_label(pg_temp.review('["Alice Smith","ALICESMITH"]'),'approve')$$, '23514', null, 'normalized aliases cannot approve C');
select is((select count(*)::int from public.catalog_tone_labels where formula_key='label-tool-formula'),0,'failed approval leaves no orphan revision');

-- Exercise the service-role RPC directly, bypassing CLI validation. Each case
-- gets its own queue entry so an unexpected approval cannot mask later failures.
create temp table invalid_provenance as
select field, bad_value, 'label-tool-' || field || '-' || kind as variant_gid
from unnest(array['depth_source','undertone_source','source_url','source_market','parser_version']) field
cross join (values ('blank',''),('whitespace',E' \t\n\r\f ')) blanks(kind,bad_value);
insert into public.catalog_variants(variant_gid,product_gid,formula_key,formula_version,shade_name,vendor,observed_at)
select variant_gid,'label-tool-p','label-tool-provenance','1',variant_gid,'Test',now()
from invalid_provenance;

grant select on invalid_provenance to service_role;
set local role service_role;
select throws_ok(format('select public.catalog_submit_label(%L::jsonb,%L)',
  jsonb_set(pg_temp.review('["alice","bob"]','B') || jsonb_build_object(
    'variant_gid',variant_gid,'formula_key','label-tool-provenance','shade_name',variant_gid),
    array['label',field],to_jsonb(bad_value)), 'approve'),
  '22023',null,field || ' rejects ' || case when bad_value='' then 'blank' else 'whitespace-only' end || ' provenance')
from invalid_provenance;
reset role;
select is((select count(*)::int from public.catalog_tone_labels where formula_key='label-tool-provenance'),0,
  'rejected provenance leaves no orphan revisions');
select is((select count(*)::int from public.catalog_label_bindings where variant_gid in
  (select variant_gid from invalid_provenance)),0,'rejected provenance leaves no bindings');

create temp table saved(id uuid);
insert into saved select public.catalog_submit_label(pg_temp.review(),'draft');
select is((select reviewer_ids from public.catalog_tone_labels where id=(select id from saved)),array['alicesmith','bob'],'IDs normalized');
select is((select reviewer_count from public.catalog_tone_labels where id=(select id from saved)),2,'count derived from unique IDs');
select is((select label_id from public.catalog_label_bindings where variant_gid='label-tool-v'),(select id from saved),'draft bound atomically');
select throws_ok($$select public.catalog_submit_label(pg_temp.review(),'draft')$$,'40001',null,'stale binding rejected');

create temp table approved(id uuid);
insert into approved select public.catalog_submit_label(jsonb_set(pg_temp.review(),'{expected_label_id}',to_jsonb((select id from saved))),'approve');
select is((select status from public.catalog_tone_labels where id=(select id from approved)),'approved','complete C approval succeeds');
select is((select revision from public.catalog_tone_labels where id=(select id from approved)),2,'new revision preserves draft');
select is((select native_undertone from public.catalog_tone_labels where id=(select id from approved)),'Golden','native brand wording retained');
select throws_ok($$select public.catalog_submit_label(jsonb_set(pg_temp.review(),'{expected_label_id}',to_jsonb((select id from approved))),'approve')$$,'40001',null,'approved shade no longer in queue');

select * from finish();
rollback;
