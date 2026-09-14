begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in (
       'retention_policies','tenants','tenant_memberships','tenant_legal_holds',
       'diagnostic_sessions','evidence_items','diagnostic_input_snapshots',
       'calculation_results','calculation_result_lineage','audit_events','idempotency_keys'
     )),
  11::bigint,
  'all persistence contract tables exist'
);

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity
     and c.relname in (
       'tenants','tenant_memberships','tenant_legal_holds','diagnostic_sessions',
       'evidence_items','diagnostic_input_snapshots','calculation_results',
       'calculation_result_lineage','audit_events','idempotency_keys'
     )),
  10::bigint,
  'all tenant-scoped runtime tables have RLS enabled'
);

select is(
  (select count(*) from pg_policies
   where schemaname = 'public'
     and tablename in (
       'tenants','tenant_memberships','tenant_legal_holds','diagnostic_sessions',
       'evidence_items','diagnostic_input_snapshots','calculation_results',
       'calculation_result_lineage','audit_events','idempotency_keys'
     )),
  10::bigint,
  'each tenant-scoped table has an RLS policy'
);

select is(
  (select count(*) from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal
     and n.nspname = 'public'
     and t.tgname in (
       'calculation_results_append_only','audit_events_append_only',
       'input_snapshots_append_only','result_lineage_append_only','evidence_items_append_only'
     )),
  5::bigint,
  'immutable resources have append-only triggers'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'tenants','tenant_memberships','tenant_legal_holds','diagnostic_sessions',
        'evidence_items','diagnostic_input_snapshots','calculation_results',
        'calculation_result_lineage','audit_events','idempotency_keys'
      )
      and grantee in ('anon','authenticated')
  ),
  'client roles have no implicit table grants before application identity path is approved'
);

select ok(
  not has_function_privilege('public', 'public.current_tenant_id()', 'EXECUTE'),
  'tenant context helper is not publicly executable'
);

select ok(
  not has_function_privilege('public', 'public.enforce_append_only()', 'EXECUTE'),
  'append-only trigger helper is not publicly executable'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_calculation_results_tenant_session'
  ),
  'calculation result tenant/session index exists'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_audit_events_tenant_occurred'
  ),
  'audit event tenant/time index exists'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'calculation_results_numeric_check'
  ),
  'financial result non-negative value constraint exists'
);

select * from finish();
rollback;
