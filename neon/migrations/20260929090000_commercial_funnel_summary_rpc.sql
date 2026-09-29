-- SynapseMax commercial funnel aggregation
-- SQL-side aggregation keeps raw event volume out of the Worker response path.

create or replace function public.summarize_commercial_funnel()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'portal_view', count(*) filter (where event_name = 'portal_view'),
    'diagnostic_start', count(*) filter (where event_name = 'diagnostic_start'),
    'diagnostic_complete', count(*) filter (where event_name = 'diagnostic_complete'),
    'cta_click', count(*) filter (where event_name = 'cta_click'),
    'conversion', count(*) filter (where event_name = 'conversion')
  )
  from public.commercial_funnel_events
  where tenant_id = public.current_tenant_id();
$$;

grant execute on function public.summarize_commercial_funnel() to authenticated;
