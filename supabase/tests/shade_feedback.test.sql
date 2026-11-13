begin;
select plan(5);
select has_table('public','shade_feedback_events','separate user-owned events');
select has_table('public','shade_feedback_candidates','ordered shown candidates');
select has_function('public','record_shade_feedback',array['jsonb'],'strict submission RPC');
select has_function('public','delete_shade_feedback',array[]::text[],'independent deletion RPC');
select is(public.shade_feedback_enabled(),false,'server logging ships disabled');
select * from finish();
rollback;
