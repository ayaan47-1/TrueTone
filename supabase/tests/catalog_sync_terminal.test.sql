begin;
select plan(13);
insert into catalog_variants(variant_gid,product_gid,formula_key,formula_version,shade_name,vendor,published,observed_at)
values('terminal-keep','terminal-product','synthetic','1','Synthetic','Synthetic',true,now());
create temporary table original_job as select catalog_claim_reconcile(null) value;
do $$
declare job jsonb;
begin
  select value into job from original_job;
  for attempt in 1..3 loop
    perform catalog_retry_reconcile((job->>'id')::uuid,(job->>'lease_token')::uuid,true);
    if attempt<3 then
      update catalog_reconcile_jobs set next_attempt_at=now()-interval '1 second' where id=(job->>'id')::uuid;
      job:=catalog_claim_reconcile((job->>'id')::uuid);
    end if;
  end loop;
end;
$$;
select is((select status from catalog_reconcile_jobs where id=(select (value->>'id')::uuid from original_job)),'failed','three permanently bad page attempts terminate the job');
select is((select status from catalog_sync_runs order by started_at desc limit 1),'failed','terminal job marks sync run failed');
select ok(coalesce((catalog_sync_health()->>'terminal_failure')::boolean,false),'health surfaces terminal failure');
select is(catalog_sync_health()->>'last_failure_code','operation_failed','health reports safe failure class');
select is(catalog_claim_reconcile((value->>'id')::uuid),null::jsonb,'terminal job cannot be reclaimed') from original_job;
create temporary table next_job as select catalog_claim_reconcile(null) value;
select ok((select value->>'id' from next_job) is not null and (select value->>'id' from next_job)<>(select value->>'id' from original_job),'failed job releases slot for next nightly run');
select ok(not (select deleted from catalog_variants where variant_gid='terminal-keep'),'terminal failure never sweeps missing products');
select catalog_retry_reconcile((value->>'id')::uuid,(value->>'lease_token')::uuid,true,'shopify_throttled','{"product":250}') from next_job;
select is((select query_costs->>'product' from catalog_reconcile_jobs where id=(select (value->>'id')::uuid from next_job)),'250','requested cost persists on failed page');
update catalog_reconcile_jobs set next_attempt_at=now()-interval '1 second' where id=(select (value->>'id')::uuid from next_job);
create temporary table resumed as select catalog_claim_reconcile((value->>'id')::uuid) value from next_job;
select is((select value->'query_costs'->>'product' from resumed),'250','new invocation receives learned requested costs');
select catalog_retry_reconcile((value->>'id')::uuid,(value->>'lease_token')::uuid,true,'shopify_failed','{"product":999}') from next_job;
select is((select query_costs->>'product' from catalog_reconcile_jobs where id=(select (value->>'id')::uuid from next_job)),'250','old lease cannot corrupt learned costs');
select catalog_checkpoint_reconcile((value->>'id')::uuid,(value->>'lease_token')::uuid,'[]','next','{"product":250}') from resumed;
select is((select page_failures from catalog_reconcile_jobs where id=(select (value->>'id')::uuid from next_job)),0,'successful page resets the per-page attempt budget');
select throws_ok(format('select catalog_retry_reconcile(%L,%L,true,%L,%L)',value->>'id',value->>'lease_token','operation_failed','{"product":0}'),'23514',null,'invalid costs cannot enter durable state') from resumed;
select throws_ok(format('select catalog_retry_reconcile(%L,%L,true,%L)',value->>'id',value->>'lease_token','arbitrary exception contents'),'22023',null,'failure class cannot store arbitrary payloads') from resumed;
select * from finish();
rollback;
