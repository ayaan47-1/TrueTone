begin;
select plan(12);

select ok(not public.catalog_reviewers_valid(array['alice',' alice '],2),'whitespace aliases are one reviewer');
select ok(not public.catalog_reviewers_valid(array['Alice','alice'],2),'case aliases are one reviewer');
select ok(not public.catalog_reviewers_valid(array[' alice '],1),'noncanonical whitespace ID rejected');
select ok(not public.catalog_reviewers_valid(array['Alice'],1),'noncanonical case ID rejected');
select ok(not public.catalog_reviewers_valid(array['alice',null],1),'null reviewer ID rejected');
select ok(public.catalog_reviewers_valid(array['alice','bob'],2),'two canonical identities qualify');

select throws_ok($$insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,reviewer_ids)
  values ('reviewer-regression','1','draft-space',1,array[' alice '])$$,'23514',null,'draft writes reject noncanonical whitespace');
select throws_ok($$insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,reviewer_ids)
  values ('reviewer-regression','1','draft-case',1,array['Alice'])$$,'23514',null,'draft writes reject noncanonical case');

insert into public.catalog_variants(variant_gid,product_gid,inventory_item_gid,formula_key,formula_version,shade_name,vendor,published,observed_at)
values ('v-review-space','p-review','i-review','reviewer-regression','1','v-review-space','Synthetic',true,now()),
       ('v-review-case','p-review','i-review','reviewer-regression','1','v-review-case','Synthetic',true,now());
insert into public.catalog_inventory_levels(inventory_item_gid,location_gid,available,online,observed_at)
values ('i-review','l-review',2,true,now());

create function pg_temp.approve_reviewers(p_shade text,p_reviewers text[])
returns void language plpgsql as $$
declare label_uuid uuid;
begin
  insert into public.catalog_tone_labels(formula_key,formula_version,shade_key,revision,status,depth_band,base_undertone,
    depth_confidence,undertone_confidence,depth_source,undertone_source,source_url,source_market,source_as_of,
    parser_version,reviewer_count,reviewer_ids,approved_at)
  values ('reviewer-regression','1',p_shade,1,'approved',5,'neutral','C','C','brand','brand',
    'https://example.com/shades','US',current_date,'1',2,p_reviewers,now()) returning id into label_uuid;
  insert into public.catalog_label_bindings(variant_gid,label_id) values(p_shade,label_uuid);
end;
$$;

select throws_ok($$select pg_temp.approve_reviewers('v-review-space',array['alice',' alice '])$$,
  '23514',null,'C approval rejects whitespace aliases');
select is((select count(*)::int from public.catalog_recommendable where variant_gid='v-review-space'),0,
  'whitespace-alias C label never enters recommendations');
select throws_ok($$select pg_temp.approve_reviewers('v-review-case',array['Alice','alice'])$$,
  '23514',null,'C approval rejects case aliases');
select is((select count(*)::int from public.catalog_recommendable where variant_gid='v-review-case'),0,
  'case-alias C label never enters recommendations');

select * from finish();
rollback;
