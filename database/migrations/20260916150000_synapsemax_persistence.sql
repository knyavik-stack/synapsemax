-- SynapseMax PostgreSQL persistence baseline for Neon.
-- This file is the provider-neutral replacement for the historical Supabase migration.
-- APPLY ONLY to a dedicated SynapseMax database/project.
-- No client-facing grants are defined here; runtime identity and grants are a separate gate.

create extension if not exists pgcrypto;

create table if not exists public.retention_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint retention_policies_policy_object check (jsonb_typeof(policy) = 'object')
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  retention_policy_id uuid references public.retention_policies(id),
  created_at timestamptz not null default now(),
  constraint tenants_status_check check (status in ('active', 'suspended', 'archived'))
);

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  principal_id text not null,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (tenant_id, principal_id),
  constraint tenant_memberships_role_check check (role in ('tenant_user', 'tenant_admin', 'operator', 'service', 'auditor')),
  constraint tenant_memberships_status_check check (status in ('active', 'suspended', 'revoked'))
);

create table if not exists public.tenant_legal_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  scope text not null default 'tenant',
  reason_code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint tenant_legal_holds_scope_check check (scope in ('tenant', 'evidence', 'session', 'result', 'audit')),
  constraint tenant_legal_holds_release_check check (released_at is null or released_at >= created_at)
);

create table if not exists public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  status text not null default 'created',
  created_by text not null,
  calculation_contract_version text not null,
  input_snapshot_id uuid,
  evidence_set_id text,
  created_at timestamptz not null default now(),
  constraint diagnostic_sessions_status_check check (status in ('created', 'calculating', 'completed', 'failed', 'archived')),
  unique (tenant_id, id)
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  supersedes_evidence_id uuid,
  source_type text not null,
  source_ref text not null,
  observed_at timestamptz not null,
  collected_at timestamptz not null,
  metric text not null,
  value jsonb not null,
  unit text not null,
  quality text not null,
  provenance_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint evidence_items_quality_check check (quality in ('low', 'medium', 'high')),
  constraint evidence_items_value_check check (jsonb_typeof(value) in ('number', 'string', 'boolean', 'object', 'array')),
  constraint evidence_items_metadata_check check (jsonb_typeof(metadata) = 'object'),
  unique (tenant_id, id)
);

alter table public.evidence_items
  add constraint evidence_items_supersedes_same_tenant_fk
  foreign key (tenant_id, supersedes_evidence_id)
  references public.evidence_items(tenant_id, id);

create table if not exists public.diagnostic_input_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  session_id uuid not null,
  schema_version text not null,
  payload_hash text not null,
  normalized_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint diagnostic_input_snapshots_payload_check check (jsonb_typeof(normalized_payload) = 'object'),
  unique (tenant_id, id),
  foreign key (tenant_id, session_id) references public.diagnostic_sessions(tenant_id, id)
);

create table if not exists public.calculation_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  session_id uuid not null,
  calculation_contract_version text not null,
  scenario text not null,
  gross_recoverable_monthly numeric(20,2) not null,
  overlap_adjustment_monthly numeric(20,2) not null default 0,
  net_recoverable_monthly numeric(20,2) not null,
  annual_net_value numeric(20,2) not null,
  upfront_investment numeric(20,2) not null default 0,
  annual_opex numeric(20,2) not null default 0,
  roi_percent numeric(20,6),
  payback_months numeric(20,6),
  margin_uplift_points numeric(20,6),
  evidence_quality text not null,
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint calculation_results_scenario_check check (scenario in ('conservative', 'base', 'optimistic')),
  constraint calculation_results_evidence_quality_check check (evidence_quality in ('low', 'medium', 'high')),
  constraint calculation_results_assumptions_check check (jsonb_typeof(assumptions) = 'object'),
  constraint calculation_results_numeric_check check (
    gross_recoverable_monthly >= 0
    and overlap_adjustment_monthly >= 0
    and net_recoverable_monthly >= 0
    and annual_net_value >= 0
    and upfront_investment >= 0
    and annual_opex >= 0
  ),
  unique (tenant_id, id),
  foreign key (tenant_id, session_id) references public.diagnostic_sessions(tenant_id, id)
);

create table if not exists public.calculation_result_lineage (
  result_id uuid not null,
  tenant_id uuid not null references public.tenants(id),
  evidence_item_id uuid,
  input_snapshot_id uuid not null,
  scenario text not null,
  created_at timestamptz not null default now(),
  primary key (result_id, evidence_item_id, input_snapshot_id),
  constraint calculation_result_lineage_scenario_check check (scenario in ('conservative', 'base', 'optimistic')),
  foreign key (tenant_id, result_id) references public.calculation_results(tenant_id, id),
  foreign key (tenant_id, evidence_item_id) references public.evidence_items(tenant_id, id),
  foreign key (tenant_id, input_snapshot_id) references public.diagnostic_input_snapshots(tenant_id, id)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  actor_type text not null,
  actor_id text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  occurred_at timestamptz not null default now(),
  request_id text not null,
  result text not null,
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  constraint audit_events_actor_type_check check (actor_type in ('user', 'service', 'connector', 'system')),
  constraint audit_events_result_check check (result in ('success', 'denied', 'failed')),
  constraint audit_events_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.idempotency_keys (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id text not null,
  operation text not null,
  resource_id uuid,
  response_hash text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, request_id, operation)
);

create index if not exists idx_tenant_memberships_principal on public.tenant_memberships(principal_id, status);
create index if not exists idx_diagnostic_sessions_tenant_created on public.diagnostic_sessions(tenant_id, created_at desc);
create index if not exists idx_evidence_items_tenant_observed on public.evidence_items(tenant_id, observed_at desc);
create index if not exists idx_evidence_items_tenant_metric on public.evidence_items(tenant_id, metric);
create index if not exists idx_input_snapshots_tenant_session on public.diagnostic_input_snapshots(tenant_id, session_id, created_at desc);
create index if not exists idx_calculation_results_tenant_session on public.calculation_results(tenant_id, session_id, created_at desc);
create index if not exists idx_lineage_tenant_result on public.calculation_result_lineage(tenant_id, result_id);
create index if not exists idx_audit_events_tenant_occurred on public.audit_events(tenant_id, occurred_at desc);
create index if not exists idx_idempotency_keys_created on public.idempotency_keys(tenant_id, created_at desc);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function public.enforce_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'APPEND_ONLY_RESOURCE: % cannot be updated or deleted', TG_TABLE_NAME using errcode = '55000';
end;
$$;

drop trigger if exists calculation_results_append_only on public.calculation_results;
create trigger calculation_results_append_only before update or delete on public.calculation_results
for each row execute function public.enforce_append_only();

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only before update or delete on public.audit_events
for each row execute function public.enforce_append_only();

drop trigger if exists input_snapshots_append_only on public.diagnostic_input_snapshots;
create trigger input_snapshots_append_only before update or delete on public.diagnostic_input_snapshots
for each row execute function public.enforce_append_only();

drop trigger if exists result_lineage_append_only on public.calculation_result_lineage;
create trigger result_lineage_append_only before update or delete on public.calculation_result_lineage
for each row execute function public.enforce_append_only();

drop trigger if exists evidence_items_append_only on public.evidence_items;
create trigger evidence_items_append_only before update or delete on public.evidence_items
for each row execute function public.enforce_append_only();

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_legal_holds enable row level security;
alter table public.diagnostic_sessions enable row level security;
alter table public.evidence_items enable row level security;
alter table public.diagnostic_input_snapshots enable row level security;
alter table public.calculation_results enable row level security;
alter table public.calculation_result_lineage enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_keys enable row level security;

-- FORCE RLS prevents the table owner from silently bypassing policies on the runtime path.
alter table public.tenants force row level security;
alter table public.tenant_memberships force row level security;
alter table public.tenant_legal_holds force row level security;
alter table public.diagnostic_sessions force row level security;
alter table public.evidence_items force row level security;
alter table public.diagnostic_input_snapshots force row level security;
alter table public.calculation_results force row level security;
alter table public.calculation_result_lineage force row level security;
alter table public.audit_events force row level security;
alter table public.idempotency_keys force row level security;

create policy tenants_isolation on public.tenants for all
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());
create policy memberships_isolation on public.tenant_memberships for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy legal_holds_isolation on public.tenant_legal_holds for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy diagnostic_sessions_isolation on public.diagnostic_sessions for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy evidence_items_isolation on public.evidence_items for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy input_snapshots_isolation on public.diagnostic_input_snapshots for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy calculation_results_isolation on public.calculation_results for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy result_lineage_isolation on public.calculation_result_lineage for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy audit_events_isolation on public.audit_events for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy idempotency_keys_isolation on public.idempotency_keys for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

revoke all on table
  public.tenants,
  public.tenant_memberships,
  public.tenant_legal_holds,
  public.diagnostic_sessions,
  public.evidence_items,
  public.diagnostic_input_snapshots,
  public.calculation_results,
  public.calculation_result_lineage,
  public.audit_events,
  public.idempotency_keys
from anon, authenticated;

revoke all on function public.current_tenant_id() from public;
revoke all on function public.enforce_append_only() from public;

comment on function public.current_tenant_id() is
  'Reads transaction-local app.tenant_id. Application must derive tenant from authenticated principal; client input is never authoritative.';
comment on table public.calculation_results is
  'Immutable financial result history. Updates/deletes are rejected by trigger.';
comment on table public.audit_events is
  'Tenant-scoped immutable audit history. Tenantless system events require a separate privileged server path and are not visible to tenant context.';
