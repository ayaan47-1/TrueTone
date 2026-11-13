-- Opaque catalogue revision only. No user, image or scan data.
create table public.catalog_read_epoch (
  singleton boolean primary key default true check(singleton),
  revision bigint not null default 1
);
insert into public.catalog_read_epoch default values;
alter table public.catalog_read_epoch enable row level security;
revoke all on public.catalog_read_epoch from public,anon,authenticated;
grant select on public.catalog_read_epoch to service_role;

create function public.catalog_bump_read_epoch()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.catalog_read_epoch set revision=revision+1 where singleton;
  return null;
end;
$$;
create trigger catalog_variants_revision after insert or update or delete on public.catalog_variants
  for each statement execute function public.catalog_bump_read_epoch();
create trigger catalog_inventory_revision after insert or update or delete on public.catalog_inventory_levels
  for each statement execute function public.catalog_bump_read_epoch();
create trigger catalog_labels_revision after insert or update or delete on public.catalog_tone_labels
  for each statement execute function public.catalog_bump_read_epoch();
create trigger catalog_bindings_revision after insert or update or delete on public.catalog_label_bindings
  for each statement execute function public.catalog_bump_read_epoch();

create index catalog_variants_freshness_idx on public.catalog_variants(observed_at);
create index catalog_inventory_freshness_idx on public.catalog_inventory_levels(observed_at);
create function public.catalog_read_revision()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('revision',revision::text,'server_now',now(),
    'expires_at',least(
      (select min(observed_at)+interval '26 hours' from public.catalog_variants where observed_at>now()-interval '26 hours'),
      (select min(observed_at)+interval '26 hours' from public.catalog_inventory_levels where observed_at>now()-interval '26 hours')))
  from public.catalog_read_epoch where singleton;
$$;
revoke all on function public.catalog_bump_read_epoch(),public.catalog_read_revision() from public,anon,authenticated;
grant execute on function public.catalog_read_revision() to authenticated,service_role;
