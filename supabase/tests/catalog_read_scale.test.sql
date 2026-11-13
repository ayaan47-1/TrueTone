begin;
select plan(6);
select has_function('public','catalog_read_revision',array[]::text[],'small revision read exists');
select ok((public.catalog_read_revision()->>'revision') is not null,'revision is present');
create temporary table previous as select public.catalog_read_revision()->>'revision' value;
insert into catalog_variants(variant_gid,product_gid,formula_key,formula_version,shade_name,vendor,observed_at)
values('read-scale','read-product','synthetic','1','synthetic','Synthetic',now());
select isnt(public.catalog_read_revision()->>'revision',(select value from previous),'commerce write invalidates revision');
set local role authenticated;
select lives_ok('select public.catalog_read_revision()','authenticated app may read metadata');
select throws_ok('select * from public.catalog_read_epoch','42501',null,'epoch state is private');
reset role;
set local role anon;
select throws_ok('select public.catalog_read_revision()','42501',null,'anonymous unauthenticated caller denied');
reset role;
select * from finish();
rollback;
