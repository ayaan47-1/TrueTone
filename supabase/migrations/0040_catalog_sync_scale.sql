-- Durable, service-only reconciliation. No customer or scan data.
create table public.catalog_reconcile_jobs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  status text not null default 'pending' check(status in ('pending','running','complete','failed')),
  cursor text,
  visited_cursors text[] not null default '{}',
  product_ids text[] not null default '{}',
  lease_token uuid,
  lease_until timestamptz,
  failures integer not null default 0,
  next_attempt_at timestamptz not null default now()
);
create unique index catalog_one_live_reconcile on public.catalog_reconcile_jobs((true)) where status in ('pending','running');
alter table public.catalog_reconcile_jobs enable row level security;
revoke all on public.catalog_reconcile_jobs from public,anon,authenticated;
grant select on public.catalog_reconcile_jobs to service_role;

create function public.catalog_claim_reconcile(p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.catalog_reconcile_jobs;
begin
  perform pg_advisory_xact_lock(hashtext('truetone-reconcile-claim'),0);
  if p_job_id is not null then
    select * into job from public.catalog_reconcile_jobs where id=p_job_id for update;
    if not found or job.status in ('complete','failed') then return null; end if;
  else
    select * into job from public.catalog_reconcile_jobs where status in ('pending','running') for update;
    if not found then
      insert into public.catalog_reconcile_jobs default values returning * into job;
      perform public.catalog_begin_reconcile(job.started_at);
    end if;
  end if;
  if job.next_attempt_at>clock_timestamp() or (job.status='running' and job.lease_until>clock_timestamp()) then return null; end if;
  update public.catalog_reconcile_jobs set status='running',lease_token=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '130 seconds',updated_at=clock_timestamp()
    where id=job.id returning * into job;
  return jsonb_build_object('id',job.id,'lease_token',job.lease_token,'cursor',job.cursor,'started_at',job.started_at);
end;
$$;

create function public.catalog_checkpoint_reconcile(p_job_id uuid,p_lease_token uuid,p_products jsonb,p_next_cursor text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.catalog_reconcile_jobs; product jsonb; ids text[];
begin
  select * into job from public.catalog_reconcile_jobs where id=p_job_id for update;
  if not found or job.status<>'running' or job.lease_token is distinct from p_lease_token or job.lease_until<clock_timestamp() then
    raise exception using errcode='55000',message='reconcile lease expired';
  end if;
  if jsonb_typeof(p_products) is distinct from 'array' or jsonb_array_length(p_products)>100 then
    raise exception using errcode='22023',message='invalid reconcile page';
  end if;
  if p_next_cursor is not null and (length(p_next_cursor)=0 or p_next_cursor=job.cursor or p_next_cursor=any(job.visited_cursors)) then
    raise exception using errcode='22023',message='reconcile cursor did not advance';
  end if;
  ids:=job.product_ids;
  for product in select value from jsonb_array_elements(p_products) loop
    if product->>'product_gid' is null or product->>'product_gid'=any(ids) then
      raise exception using errcode='22023',message='duplicate or invalid reconcile product';
    end if;
    perform public.catalog_apply_product(product,job.started_at);
    ids:=array_append(ids,product->>'product_gid');
  end loop;
  if cardinality(ids)>50000 then raise exception using errcode='22023',message='reconcile product limit'; end if;
  -- Applying the page and advancing its cursor are one transaction, fenced by the lease.
  update public.catalog_reconcile_jobs set product_ids=ids,cursor=p_next_cursor,
    visited_cursors=case when p_next_cursor is null then visited_cursors else array_append(visited_cursors,p_next_cursor) end,
    updated_at=clock_timestamp(),lease_until=clock_timestamp()+interval '130 seconds',
    status=case when p_next_cursor is null then 'complete' else 'running' end
    where id=job.id;
  if p_next_cursor is null then perform public.catalog_finish_reconcile(ids,job.started_at); end if;
end;
$$;

create function public.catalog_retry_reconcile(p_job_id uuid,p_lease_token uuid,p_failed boolean default true)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare job public.catalog_reconcile_jobs;
begin
  select * into job from public.catalog_reconcile_jobs where id=p_job_id for update;
  if not found or job.status<>'running' or job.lease_token is distinct from p_lease_token then return; end if;
  update public.catalog_reconcile_jobs set status='pending',lease_token=null,lease_until=null,
    failures=failures+case when p_failed then 1 else 0 end,
    next_attempt_at=clock_timestamp()+case when p_failed then interval '1 minute' else interval '0 seconds' end,updated_at=clock_timestamp()
    where id=job.id;
end;
$$;

create function public.catalog_sync_health(p_now timestamptz default now())
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'stale',not exists(select 1 from public.catalog_sync_runs where status='complete' and completed_at>p_now-interval '26 hours'),
    'stuck',exists(select 1 from public.catalog_sync_runs r left join public.catalog_reconcile_jobs j on j.started_at=r.started_at
      where r.status='running' and coalesce(j.updated_at,r.started_at)<p_now-interval '5 minutes'),
    'rising_failures',(select count(*) from public.catalog_sync_runs where status in ('failed','blocked') and started_at>=p_now-interval '1 hour')>=3
      and (select count(*) from public.catalog_sync_runs where status in ('failed','blocked') and started_at>=p_now-interval '1 hour')>
          (select count(*) from public.catalog_sync_runs where status in ('failed','blocked') and started_at>=p_now-interval '2 hours' and started_at<p_now-interval '1 hour'),
    'retrying',exists(select 1 from public.catalog_reconcile_jobs where status='pending' and failures>=3)
  );
$$;

create function public.catalog_request_continuation()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare endpoint text; token text; job record;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='catalog_reconcile_url' limit 1;
  select decrypted_secret into token from vault.decrypted_secrets where name='catalog_reconcile_token' limit 1;
  if endpoint is null or token is null or endpoint !~ '^https://[^/]+/functions/v1/catalog-reconcile$' then return; end if;
  for job in select id from public.catalog_reconcile_jobs where next_attempt_at<=clock_timestamp()
    and (status='pending' or (status='running' and lease_until<clock_timestamp())) loop
    perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
      body:=jsonb_build_object('job_id',job.id),timeout_milliseconds:=120000);
  end loop;
end;
$$;
revoke all on function public.catalog_claim_reconcile(uuid),public.catalog_checkpoint_reconcile(uuid,uuid,jsonb,text),
  public.catalog_retry_reconcile(uuid,uuid,boolean),public.catalog_sync_health(timestamptz),public.catalog_request_continuation() from public,anon,authenticated;
grant execute on function public.catalog_claim_reconcile(uuid),public.catalog_checkpoint_reconcile(uuid,uuid,jsonb,text),
  public.catalog_retry_reconcile(uuid,uuid,boolean),public.catalog_sync_health(timestamptz),public.catalog_request_continuation() to service_role;
select cron.schedule('truetone-catalog-continuation','* * * * *',$$select public.catalog_request_continuation();$$);
