begin;
select no_plan();
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.profiles(id,is_18_plus,consent_active) values
 ('11111111-1111-4111-8111-111111111111',true,true),('22222222-2222-4222-8222-222222222222',true,true);
insert into public.catalog_variants(variant_gid,product_gid,formula_key,formula_version,shade_name,vendor,observed_at)
 values('gid://shopify/ProductVariant/1','gid://shopify/Product/1','formula','1','Shade','Synthetic',now());
insert into public.catalog_tone_labels(id,formula_key,formula_version,shade_key,revision,status,depth_band,base_undertone,depth_confidence,undertone_confidence,depth_source,undertone_source,source_url,source_market,source_as_of,parser_version,reviewer_count,reviewer_ids,approved_at)
 values('00000000-0000-4000-8000-000000000001','formula','1','Shade',1,'approved',5,'neutral','B','B','brand','brand','https://example.com/shades','US',current_date,'1',1,array['reviewer'],now());
insert into public.catalog_label_bindings(variant_gid,label_id) values('gid://shopify/ProductVariant/1','00000000-0000-4000-8000-000000000001');
insert into public.consent_log(user_id,action,policy_version,policy_doc_key)
select '11111111-1111-4111-8111-111111111111','consented',version,doc_key from public.policy_versions where doc_key='biometric' and is_current;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"launch_country":"US"}}';
select throws_ok($$select public.set_shade_feedback_consent('consented')$$,'P0001',null,'disabled without counsel release');
-- Transaction-only test override. The committed function always returns false.
create or replace function public.shade_feedback_enabled() returns boolean language sql immutable as $$select true$$;
select throws_ok($$select public.set_shade_feedback_consent('consented')$$,'P0001',null,'no approved notice fails closed');
insert into public.policy_versions(version,doc_key,is_current) values('test-only','shade_feedback',true);
select lives_ok($$select public.set_shade_feedback_consent('consented')$$,'separate consent after gates');
select is((public.record_consent()).policy_doc_key,'biometric','biometric receipt never confused with feedback');
create function pg_temp.payload(p_patch jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('consent_receipt_id',(select id from public.consent_log where user_id=auth.uid() and policy_doc_key='shade_feedback' order by created_at desc,id desc limit 1),
 'recommendation_id',gen_random_uuid(),'engine_version','test-v1','catalog_as_of',now(),'estimated_variant_gid','gid://shopify/ProductVariant/1',
 'estimated_label_id','00000000-0000-4000-8000-000000000001','estimated_label_revision',1,'estimated_formula_version','1',
 'tried_variant_gid','gid://shopify/ProductVariant/1','depth_correction','too_light','undertone_correction','as_expected','outcome',null,'displayed_at',now(),
 'candidates',jsonb_build_array(jsonb_build_object('position',1,'variant_gid','gid://shopify/ProductVariant/1','label_id','00000000-0000-4000-8000-000000000001',
 'label_revision',1,'formula_version','1','available_at_display',true))) || p_patch;
$$;
select lives_ok($$select public.record_shade_feedback(pg_temp.payload())$$,'valid directional feedback');
select is((select count(*)::int from public.shade_feedback_candidates),1,'only shown candidate stored');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload(jsonb_build_object('recommendation_id',(select recommendation_id from public.shade_feedback_events limit 1))))$$,'P0001',null,'repeated submission is not another event or person');
select ok((select bool_and(expires_at=submitted_at+interval '12 months') from public.shade_feedback_events),'expiry fixed by server');
select ok((select relrowsecurity from pg_class where oid='public.shade_feedback_events'::regclass),'events RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.shade_feedback_candidates'::regclass),'candidates RLS enabled');
select ok(not has_table_privilege('anon','public.shade_feedback_events','SELECT'),'anon denied');
select ok(not has_table_privilege('authenticated','public.shade_feedback_events','INSERT'),'direct insert denied');
select ok(not has_table_privilege('authenticated','public.shade_feedback_events','UPDATE'),'direct update denied');
select ok(not has_function_privilege('authenticated','public.purge_shade_feedback_for_user(uuid)','EXECUTE'),'cross-user purge denied');
select ok(not exists(select 1 from information_schema.columns where table_name in ('shade_feedback_events','shade_feedback_candidates') and
 column_name not in ('id','user_id','consent_receipt_id','recommendation_id','engine_version','catalog_as_of','estimated_variant_gid','estimated_label_id','estimated_label_revision','estimated_formula_version','tried_variant_gid','depth_correction','undertone_correction','outcome','displayed_at','submitted_at','outcome_at','expires_at','purpose_closed_at','feedback_id','position','variant_gid','label_id','label_revision','formula_version','available_at_display')),'exact column allowlist');
select ok(not exists(select 1 from pg_constraint where conrelid in ('public.shade_feedback_events'::regclass,'public.shade_feedback_candidates'::regclass) and confrelid='public.scans'::regclass),'no prohibited relationship');
select throws_ok($$update public.shade_feedback_events set engine_version='rewrite'$$,'55000',null,'estimate provenance immutable');
select throws_ok($$update public.shade_feedback_candidates set position=2$$,'55000',null,'display order immutable');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload('{"extra":"hidden"}'))$$,'P0001',null,'unknown properties rejected');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload('{"user_id":"22222222-2222-4222-8222-222222222222"}'))$$,'P0001',null,'caller cannot set owner');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload('{"depth_correction":"gold"}'))$$,'P0001',null,'closed enum');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload('{"depth_correction":"not_sure","undertone_correction":"not_sure"}'))$$,'P0001',null,'must supply a direction');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload(jsonb_build_object('engine_version',repeat('x',5000))))$$,'P0001',null,'oversized strings rejected');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload('{"estimated_label_revision":2}'))$$,'P0001',null,'wrong label revision rejected');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload('{"tried_variant_gid":"gid://shopify/ProductVariant/99"}'))$$,'P0001',null,'unshown shade rejected');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload('{"consent_receipt_id":"00000000-0000-4000-8000-000000000999"}'))$$,'P0001',null,'wrong receipt rejected');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload(jsonb_build_object('candidates',(pg_temp.payload()->'candidates') || (pg_temp.payload()->'candidates') || (pg_temp.payload()->'candidates') || (pg_temp.payload()->'candidates'))))$$,'P0001',null,'maximum three shown candidates');
select throws_ok($$select public.update_shade_feedback((select id from public.shade_feedback_events limit 1),'{"depth_correction":"too_dark","undertone_correction":"as_expected","outcome":null,"engine_version":"rewrite"}')$$,'P0001',null,'update cannot rewrite provenance');
select lives_ok($$select public.update_shade_feedback((select id from public.shade_feedback_events limit 1),'{"depth_correction":"too_dark","undertone_correction":"as_expected","outcome":"returned_other"}')$$,'bounded update');
set local role authenticated;
select is((select count(*)::int from public.shade_feedback_events),1,'owner reads own row');
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{"launch_country":"US"}}';
select is((select count(*)::int from public.shade_feedback_events),0,'other user sees no events');
select is((select count(*)::int from public.shade_feedback_candidates),0,'other user sees no candidates');
select is(jsonb_array_length(public.list_shade_feedback()->'events'),0,'export is owner-scoped');
select is(public.delete_shade_feedback(),0,'other user deletes no events');
reset role;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"launch_country":"US"}}';
update public.profiles set is_18_plus=false where id=auth.uid();
select is((select count(*)::int from public.shade_feedback_events),0,'lost age gate purges');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload())$$,'P0001',null,'underage rejected');
update public.profiles set is_18_plus=true where id=auth.uid();
select public.set_shade_feedback_consent('consented');
select public.record_shade_feedback(pg_temp.payload());
select public.set_shade_feedback_consent('withdrawn');
select is((select count(*)::int from public.shade_feedback_events),0,'feedback withdrawal purges');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload())$$,'P0001',null,'withdrawn consent rejected');
select public.set_shade_feedback_consent('consented');
select public.record_shade_feedback(pg_temp.payload());
select public.withdraw_consent();
select is((select count(*)::int from public.shade_feedback_events),0,'biometric withdrawal purges');
select is((select count(*)::int from public.shade_feedback_candidates),0,'candidates cascade on withdrawal');
select throws_ok($$select public.record_shade_feedback(pg_temp.payload())$$,'P0001',null,'inactive biometric consent rejected');
select public.record_consent();
select throws_ok($$select public.record_shade_feedback(pg_temp.payload())$$,'P0001',null,'biometric re-consent cannot restore optional consent');
select public.set_shade_feedback_consent('consented');
select public.record_shade_feedback(pg_temp.payload());
select is(public.delete_shade_feedback(),1,'independent deletion returns count');
select public.record_shade_feedback(pg_temp.payload());
alter table public.shade_feedback_events disable trigger feedback_immutable;
update public.shade_feedback_events set submitted_at=now()-interval '13 months',expires_at=now()-interval '1 month',displayed_at=now()-interval '13 months',catalog_as_of=now()-interval '13 months';
alter table public.shade_feedback_events enable trigger feedback_immutable;
select public.shade_feedback_retention_sweep();
select is((select count(*)::int from public.shade_feedback_events),0,'12-month expiry purges');
select public.record_shade_feedback(pg_temp.payload());
update public.shade_feedback_events set purpose_closed_at=now();
select public.shade_feedback_retention_sweep();
select is((select count(*)::int from public.shade_feedback_events),0,'purpose-met purges');
select public.record_shade_feedback(pg_temp.payload());
select public.delete_my_data();
select is((select count(*)::int from public.shade_feedback_events),0,'delete data purges');
select ok(exists(select 1 from public.consent_log where policy_doc_key='shade_feedback' and action='deleted' and user_id is null),'deleted receipt retained de-identified');
select ok(exists(select 1 from public.deletion_audit where table_name='shade_feedback'),'minimal deletion audit');
update public.profiles set is_18_plus=true,consent_active=true where id=auth.uid();
select public.set_shade_feedback_consent('consented');
select public.record_shade_feedback(pg_temp.payload());
select public.close_shade_feedback_purpose((select id from public.shade_feedback_events limit 1));
select is((select count(*)::int from public.shade_feedback_events),0,'closing purpose deletes immediately');
select public.record_shade_feedback(pg_temp.payload());
update public.profiles set last_interaction_at=now()-interval '4 years' where id=auth.uid();
select public.truetone_retention_sweep();
select is((select count(*)::int from public.shade_feedback_events),0,'three-year backstop cascades');
select is((select count(*)::int from public.shade_feedback_candidates),0,'backstop removes candidates');
-- A separate owner proves account deletion too, without restoring the retained first profile.
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{"launch_country":"US"}}';
select public.set_shade_feedback_consent('consented');
select public.record_shade_feedback(pg_temp.payload());
select public.delete_account();
select is((select count(*)::int from public.shade_feedback_events),0,'account deletion purges');
select * from finish();
rollback;
