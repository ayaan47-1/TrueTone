begin;
select plan(12);
select ok(not public.catalog_modifiers_valid(array['olive'],'{"olive":null}'),'modifier null is not evidence');
select ok(not public.catalog_modifiers_valid(array['olive'],'{"olive":"B","extra":"B"}'),'unexpected modifier keys rejected');
select ok(not public.catalog_reviewers_valid(array['same','same'],2),'two reviewers means distinct identities');
select ok(not public.catalog_reviewers_valid(array['',' '],1),'blank reviewer identities rejected');

create temporary table snapshot(value jsonb);
insert into snapshot values ('{"product_gid":"p-audit","variants":[{"variant_gid":"v-audit","inventory_item_gid":"i-audit","formula_key":"synthetic:review","formula_version":"1","shade_name":"Neutral 5","vendor":"Synthetic","sku":"reimport-sku","barcode":null,"published":true,"price":20,"currency":"USD","levels":[{"location_gid":"l-audit","available":2,"online":true}]}]}');
select public.catalog_apply_product((select value from snapshot),now());
update public.catalog_tone_labels set status='approved',depth_band=5,base_undertone='neutral',depth_confidence='B',
  undertone_confidence='B',depth_source='brand',undertone_source='brand',source_url='https://example.com',source_market='US',
  source_as_of=current_date,parser_version='1',reviewer_count=1,reviewer_ids=array['reviewer'],approved_at=now()
where formula_key='synthetic:review';
select is((select count(*)::int from public.catalog_recommendable where variant_gid='v-audit'),1,'reviewed shade is available');
update public.catalog_inventory_levels set observed_at=now()-interval '27 hours' where inventory_item_gid='i-audit';
select is((select count(*)::int from public.catalog_recommendable where variant_gid='v-audit'),0,'old stock cannot be shown as current');
update public.catalog_inventory_levels set observed_at=now(),online=false where inventory_item_gid='i-audit';
select is((select count(*)::int from public.catalog_recommendable where variant_gid='v-audit'),0,'offline-only stock excluded');
select public.catalog_delete_product('p-audit',now());
select public.catalog_apply_product(jsonb_set(jsonb_set((select value from snapshot),'{product_gid}','"p-import"'),'{variants,0,variant_gid}','"v-import"'),now());
select ok((select candidate_label_id is not null from public.catalog_label_bindings where variant_gid='v-import'),'exact durable identity offers prior evidence');
select is((select l.status from public.catalog_label_bindings b join public.catalog_tone_labels l on l.id=b.label_id where b.variant_gid='v-import'),'unverified','reimport is never automatically approved');
select is((select count(*)::int from public.catalog_recommendable where variant_gid='v-import'),0,'reimport waits for approval');

-- Local transactional fixture: the missing-config branch must never queue an HTTP request.
delete from vault.secrets where name in ('catalog_reconcile_url','catalog_reconcile_token');
create temporary table queued_before as select count(*)::int as count from net.http_request_queue;
select public.catalog_request_reconcile();
select is((select count(*)::int from net.http_request_queue),(select count from queued_before),'missing Vault settings queue no HTTP request');
select ok(exists(select 1 from public.catalog_sync_runs where status='blocked' and failure_code='configuration_missing'),'missing config is visible to operator');
select * from finish();
rollback;
