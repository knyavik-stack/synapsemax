-- SynapseMax commercial funnel events
-- Append-only, tenant-scoped telemetry for ROI-first commercial analytics.

create table if not exists public.commercial_funnel_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  actor_type text not null,
  actor_id text not null,
  event_name text not null,
  occurred_at timestamptz not null default now(),
  request_id text not null,
  resource_type text not null,
  resource_id text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_commercial_funnel_tenant_occurred
  on public.commercial_funnel_events (tenant_id, occurred_at desc);

alter table public.commercial_funnel_events enable row level security;
alter table public.commercial_funnel_events force row level security;

create policy commercial_funnel_tenant_select
  on public.commercial_funnel_events
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy commercial_funnel_tenant_insert
  on public.commercial_funnel_events
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

create trigger commercial_funnel_append_only
  before update or delete on public.commercial_funnel_events
  for each row execute function public.enforce_append_only();
