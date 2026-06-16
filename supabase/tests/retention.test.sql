begin;
select plan(3);
insert into auth.users(id) values ('66666666-6666-6666-6666-666666666666'); -- stale
insert into auth.users(id) values ('77777777-7777-7777-7777-777777777777'); -- active
insert into public.profiles(id, last_interaction_at) values
  ('66666666-6666-6666-6666-666666666666', now() - interval '4 years'),
  ('77777777-7777-7777-7777-777777777777', now());

select public.truetone_retention_sweep();

select is(
  (select count(*) from public.profiles where id='66666666-6666-6666-6666-666666666666')::int,
  0, 'stale user purged');
select is(
  (select count(*) from public.profiles where id='77777777-7777-7777-7777-777777777777')::int,
  1, 'active user kept');
select is((select count(*) from public.retention_runs)::int, 1, 'run logged');
select * from finish();
rollback;
