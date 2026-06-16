-- supabase/tests/scans.test.sql
begin;
select plan(6);

select has_table('public', 'scans', 'scans table exists');
select col_is_pk('public', 'scans', 'id', 'scans.id is PK');

-- two users; RLS must isolate them
insert into auth.users(id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into public.profiles(id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into public.scans(user_id, score_hydration, score_oiliness, score_texture, score_pores,
  score_dark_spots, score_redness, score_fine_lines, score_dark_circles, skin_type_feel, model_version)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,'combination','stub-1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is((select count(*) from public.scans)::int, 0, 'user B cannot see user A scans (RLS)');

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select is((select count(*) from public.scans)::int, 1, 'user A sees own scan');

-- append-only: no update / no delete policy for clients
select throws_ok($$ update public.scans set score_pores = 0.9 $$, '42501',
  NULL, 'clients cannot update scans');
select throws_ok($$ delete from public.scans $$, '42501',
  NULL, 'clients cannot delete scans');

select * from finish();
rollback;
