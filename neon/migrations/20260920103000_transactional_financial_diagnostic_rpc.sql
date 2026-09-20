-- SynapseMax transactional diagnostic persistence
-- Prerequisite: production Neon Auth/RLS baseline is already deployed.
-- This function is intentionally SECURITY INVOKER: Data API role/RLS remain the authorization boundary.
-- Apply only through reviewed Neon migration workflow; do not execute directly on production.

create or replace function public.persist_financial_diagnostic(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_session_id uuid;
  v_snapshot_id uuid;
  v_request_id text;
  v_operation text;
  v_response_hash text;
  v_existing_hash text;
  v_existing_resource_id uuid;
  v_inserted_count integer;
begin
  if v_tenant_id is null then
    raise exception 'FINANCIAL_DIAGNOSTIC_TENANT_CONTEXT_REQUIRED';
  end if;

  v_session_id := (p_payload->'session'->>'id')::uuid;
  v_snapshot_id := (p_payload->'snapshot'->>'id')::uuid;
  v_request_id := p_payload->'idempotency'->>'request_id';
  v_operation := p_payload->'idempotency'->>'operation';
  v_response_hash := p_payload->'idempotency'->>'response_hash';

  if v_session_id is null or v_snapshot_id is null or v_request_id is null or v_operation is null or v_response_hash is null then
    raise exception 'FINANCIAL_DIAGNOSTIC_PAYLOAD_INVALID';
  end if;

  if (p_payload->'session'->>'tenant_id')::uuid <> v_tenant_id
     or (p_payload->'snapshot'->>'tenant_id')::uuid <> v_tenant_id then
    raise exception 'FINANCIAL_DIAGNOSTIC_TENANT_MISMATCH';
  end if;

  insert into public.idempotency_keys (
    tenant_id, request_id, operation, resource_id, response_hash
  )
  values (
    v_tenant_id, v_request_id, v_operation, v_session_id, v_response_hash
  )
  on conflict (tenant_id, request_id, operation) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    select resource_id, response_hash
      into v_existing_resource_id, v_existing_hash
      from public.idempotency_keys
     where tenant_id = v_tenant_id
       and request_id = v_request_id
       and operation = v_operation;

    if v_existing_hash is distinct from v_response_hash then
      raise exception 'FINANCIAL_DIAGNOSTIC_IDEMPOTENCY_PAYLOAD_CONFLICT';
    end if;

    return jsonb_build_object(
      'idempotentReplay', true,
      'sessionId', v_existing_resource_id,
      'requestId', v_request_id
    );
  end if;

  insert into public.diagnostic_sessions (
    id, tenant_id, status, created_by, calculation_contract_version, input_snapshot_id, evidence_set_id
  )
  select
    (p_payload->'session'->>'id')::uuid,
    v_tenant_id,
    p_payload->'session'->>'status',
    p_payload->'session'->>'created_by',
    p_payload->'session'->>'calculation_contract_version',
    v_snapshot_id,
    p_payload->'session'->>'evidence_set_id';

  insert into public.diagnostic_input_snapshots (
    id, tenant_id, session_id, schema_version, payload_hash, normalized_payload
  )
  select
    (p_payload->'snapshot'->>'id')::uuid,
    v_tenant_id,
    (p_payload->'snapshot'->>'session_id')::uuid,
    p_payload->'snapshot'->>'schema_version',
    p_payload->'snapshot'->>'payload_hash',
    p_payload->'snapshot'->'normalized_payload';

  insert into public.evidence_items (
    id, tenant_id, supersedes_evidence_id, source_type, source_ref, observed_at,
    collected_at, metric, value, unit, quality, provenance_hash, metadata
  )
  select
    x.id, v_tenant_id, x.supersedes_evidence_id, x.source_type, x.source_ref,
    x.observed_at, x.collected_at, x.metric, x.value, x.unit, x.quality,
    x.provenance_hash, x.metadata
  from jsonb_to_recordset(coalesce(p_payload->'evidence_rows', '[]'::jsonb)) as x(
    id uuid,
    supersedes_evidence_id uuid,
    source_type text,
    source_ref text,
    observed_at timestamptz,
    collected_at timestamptz,
    metric text,
    value jsonb,
    unit text,
    quality text,
    provenance_hash text,
    metadata jsonb
  );

  insert into public.calculation_results (
    id, tenant_id, session_id, calculation_contract_version, scenario,
    gross_recoverable_monthly, overlap_adjustment_monthly, net_recoverable_monthly,
    annual_net_value, upfront_investment, annual_opex, roi_percent, payback_months,
    margin_uplift_points, evidence_quality, assumptions
  )
  select
    x.id, v_tenant_id, v_session_id, x.calculation_contract_version, x.scenario,
    x.gross_recoverable_monthly, x.overlap_adjustment_monthly, x.net_recoverable_monthly,
    x.annual_net_value, x.upfront_investment, x.annual_opex, x.roi_percent, x.payback_months,
    x.margin_uplift_points, x.evidence_quality, x.assumptions
  from jsonb_to_recordset(coalesce(p_payload->'result_rows', '[]'::jsonb)) as x(
    id uuid,
    calculation_contract_version text,
    scenario text,
    gross_recoverable_monthly numeric,
    overlap_adjustment_monthly numeric,
    net_recoverable_monthly numeric,
    annual_net_value numeric,
    upfront_investment numeric,
    annual_opex numeric,
    roi_percent numeric,
    payback_months numeric,
    margin_uplift_points numeric,
    evidence_quality text,
    assumptions jsonb
  );

  insert into public.calculation_result_lineage (
    result_id, tenant_id, evidence_item_id, input_snapshot_id, scenario
  )
  select
    x.result_id, v_tenant_id, x.evidence_item_id, v_snapshot_id, x.scenario
  from jsonb_to_recordset(coalesce(p_payload->'lineage_rows', '[]'::jsonb)) as x(
    result_id uuid,
    evidence_item_id uuid,
    scenario text
  );

  insert into public.audit_events (
    id, tenant_id, actor_type, actor_id, action, resource_type, resource_id,
    occurred_at, request_id, result, reason_code, metadata
  )
  select
    x.id, v_tenant_id, x.actor_type, x.actor_id, x.action, x.resource_type, x.resource_id,
    x.occurred_at, v_request_id, x.result, x.reason_code, x.metadata
  from jsonb_to_recordset(coalesce(p_payload->'audit_events', '[]'::jsonb)) as x(
    id uuid,
    actor_type text,
    actor_id text,
    action text,
    resource_type text,
    resource_id text,
    occurred_at timestamptz,
    result text,
    reason_code text,
    metadata jsonb
  );

  update public.diagnostic_sessions
     set status = 'completed'
   where id = v_session_id
     and tenant_id = v_tenant_id;

  return jsonb_build_object(
    'idempotentReplay', false,
    'sessionId', v_session_id,
    'inputSnapshotId', v_snapshot_id,
    'requestId', v_request_id,
    'evidenceItemIds', coalesce((select jsonb_agg(x->>'id') from jsonb_array_elements(coalesce(p_payload->'evidence_rows','[]'::jsonb)) x), '[]'::jsonb),
    'calculationResultIds', coalesce((select jsonb_agg(x->>'id') from jsonb_array_elements(coalesce(p_payload->'result_rows','[]'::jsonb)) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.persist_financial_diagnostic(jsonb) from public;
grant execute on function public.persist_financial_diagnostic(jsonb) to authenticated;

notify pgrst, 'reload schema';
