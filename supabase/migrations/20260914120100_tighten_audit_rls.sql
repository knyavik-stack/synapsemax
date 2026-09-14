-- System-level audit events must use an explicitly privileged server path.
-- They must not become visible to tenant roles merely because tenant_id is null.
drop policy if exists audit_events_isolation on public.audit_events;

create policy audit_events_isolation on public.audit_events
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

comment on policy audit_events_isolation on public.audit_events is
  'Tenant roles may access only tenant-scoped audit events. Tenantless system events require an explicit privileged server path.';
