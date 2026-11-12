begin;
select plan(23);
select has_table('public', 'catalog_tone_labels', 'versioned product labels exist');
select has_view('public', 'catalog_needs_label', 'unverified queue exists');
select has_view('public', 'catalog_recommendable', 'recommendation view exists');

insert into public.catalog_variants(variant_gid, product_gid, formula_key, formula_version, shade_name, vendor, published, observed_at)
values ('v1','p1','formula','1','Shade 1','Synthetic',true,now()),
       ('v2','p1','formula','1','Shade 2','Synthetic',true,now());
select is((select count(*)::int from public.catalog_needs_label),2,'new variants need labels');
select is((select count(*)::int from public.catalog_recommendable),0,'new variants are never recommended');
insert into public.catalog_tone_labels(id,formula_key,formula_version,shade_key,revision,status,depth_band,base_undertone,depth_confidence,undertone_confidence,depth_source,undertone_source,source_url,source_market,source_as_of,parser_version,reviewer_count,reviewer_ids,approved_at)
values ('00000000-0000-0000-0000-000000000001','formula','1','Shade 1',1,'approved',5,'neutral','B','B','brand','brand','https://example.com/shades','US',current_date,'1',1,array['reviewer'],now());
insert into public.catalog_label_bindings(variant_gid,label_id) values ('v1','00000000-0000-0000-0000-000000000001');
insert into public.catalog_inventory_levels(inventory_item_gid,location_gid,available,online,observed_at) values ('i1','l1',2,true,now());
update public.catalog_variants set inventory_item_gid='i1' where variant_gid='v1';
select is((select count(*)::int from public.catalog_recommendable),1,'approved in-stock variant is recommendable');
update public.catalog_inventory_levels set available=0;
select is((select count(*)::int from public.catalog_recommendable),0,'stock is filtered at read time');
update public.catalog_inventory_levels set available=2;
update public.catalog_variants set published=false where variant_gid='v1';
select is((select count(*)::int from public.catalog_recommendable),0,'unpublished excluded');
update public.catalog_variants set published=true,formula_version='2' where variant_gid='v1';
select is((select count(*)::int from public.catalog_recommendable),0,'reformulation cannot inherit approval');
select is((select count(*)::int from public.catalog_needs_label),2,'reformulation re-enters queue');
select throws_ok($$update public.catalog_tone_labels set depth_confidence='D' where id='00000000-0000-0000-0000-000000000001'$$, '55000', null, 'approved evidence is immutable');
select throws_ok($$insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,depth_band) values ('x','1','x',1,11)$$,'23514',null,'depth bounded');
select throws_ok($$insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,brand_depth_rank) values ('x','1','x',1,101)$$,'23514',null,'rank bounded');
select throws_ok($$insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,lab_l) values ('x','1','x',1,50)$$,'23514',null,'partial or unmeasured Lab rejected');
select throws_ok($$insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,status,depth_band,base_undertone,depth_confidence,undertone_confidence) values ('x','1','x',1,'approved',5,'neutral','D','B')$$,'23514',null,'draft confidence cannot be approved');
select throws_ok($$insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,depth_confidence) values ('x','1','x',1,'Z')$$,'23514',null,'unknown tier rejected');
set local role authenticated;
select lives_ok('select * from public.catalog_recommendable','mobile can read safe view');
select throws_ok('select * from public.catalog_tone_labels','42501',null,'mobile cannot read label audit');
select throws_ok('select * from public.catalog_needs_label','42501',null,'mobile cannot read admin queue');
select throws_ok($$update public.catalog_variants set published=true$$,'42501',null,'mobile cannot write commerce');
select throws_ok($$select public.catalog_apply_product('{}',now())$$,'42501',null,'mobile cannot invoke sync');
reset role;
select ok(not exists(select 1 from information_schema.columns where table_name like 'catalog_%' and column_name ~ '(user_id|scan|face|biometric|fitzpatrick)'),'catalogue has no user or biometric columns');
select ok(exists(select 1 from pg_class where relname='catalog_variants' and relrowsecurity),'commerce RLS enabled');
select * from finish();
rollback;
