-- SynapseMax production Neon persistence + auth/RLS baseline
-- Date: 2026-09-17
-- Neon project: red-bar-72989858 / database: neondb
--
-- This migration is Neon-specific. The older Supabase migration remains as
-- historical contract material and is not the deployment target.
--
-- Security model:
-- 1. Neon Auth is the identity source.
-- 2. Neon Data API validates Neon Auth JWTs and exposes auth.* JWT helpers.
-- 3. authenticated is the only application database role granted access.
-- 4. RLS is restrictive and tenant-scoped.
-- 5. tenant_id supplied by the client is never an authorization source.
-- 6. current_tenant_id() resolves the authenticated principal through
--    tenant_memberships; ambiguous membership fails closed.
-- 7. calculation results, evidence, snapshots, lineage and audit are append-only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retention_policies_policy_object CHECK (jsonb_typeof(policy) = 'object')
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active',
  retention_policy_id uuid REFERENCES public.retention_policies(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_status_check CHECK (status IN ('active','suspended','archived'))
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  principal_id text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, principal_id),
  CONSTRAINT tenant_memberships_role_check CHECK (role IN ('tenant_user','tenant_admin','operator','service','auditor')),
  CONSTRAINT tenant_memberships_status_check CHECK (status IN ('active','suspended','revoked'))
);

CREATE TABLE IF NOT EXISTS public.tenant_legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'tenant',
  reason_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CONSTRAINT tenant_legal_holds_scope_check CHECK (scope IN ('tenant','evidence','session','result','audit')),
  CONSTRAINT tenant_legal_holds_release_check CHECK (released_at IS NULL OR released_at >= created_at)
);

CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  status text NOT NULL DEFAULT 'created',
  created_by text NOT NULL,
  calculation_contract_version text NOT NULL,
  input_snapshot_id uuid,
  evidence_set_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_sessions_status_check CHECK (status IN ('created','calculating','completed','failed','archived'))
);

CREATE TABLE IF NOT EXISTS public.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  supersedes_evidence_id uuid REFERENCES public.evidence_items(id),
  source_type text NOT NULL,
  source_ref text NOT NULL,
  observed_at timestamptz NOT NULL,
  collected_at timestamptz NOT NULL,
  metric text NOT NULL,
  value jsonb NOT NULL,
  unit text NOT NULL,
  quality text NOT NULL,
  provenance_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_items_quality_check CHECK (quality IN ('low','medium','high')),
  CONSTRAINT evidence_items_value_check CHECK (jsonb_typeof(value) IN ('number','string','boolean','object','array')),
  CONSTRAINT evidence_items_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.diagnostic_input_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  session_id uuid NOT NULL REFERENCES public.diagnostic_sessions(id),
  schema_version text NOT NULL,
  payload_hash text NOT NULL,
  normalized_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostic_input_snapshots_payload_check CHECK (jsonb_typeof(normalized_payload) = 'object')
);

CREATE TABLE IF NOT EXISTS public.calculation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  session_id uuid NOT NULL REFERENCES public.diagnostic_sessions(id),
  calculation_contract_version text NOT NULL,
  scenario text NOT NULL,
  gross_recoverable_monthly numeric(20,2) NOT NULL,
  overlap_adjustment_monthly numeric(20,2) NOT NULL DEFAULT 0,
  net_recoverable_monthly numeric(20,2) NOT NULL,
  annual_net_value numeric(20,2) NOT NULL,
  upfront_investment numeric(20,2) NOT NULL DEFAULT 0,
  annual_opex numeric(20,2) NOT NULL DEFAULT 0,
  roi_percent numeric(20,6),
  payback_months numeric(20,6),
  margin_uplift_points numeric(20,6),
  evidence_quality text NOT NULL,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calculation_results_scenario_check CHECK (scenario IN ('conservative','base','optimistic')),
  CONSTRAINT calculation_results_evidence_quality_check CHECK (evidence_quality IN ('low','medium','high')),
  CONSTRAINT calculation_results_assumptions_check CHECK (jsonb_typeof(assumptions) = 'object'),
  CONSTRAINT calculation_results_numeric_check CHECK (gross_recoverable_monthly >= 0 AND overlap_adjustment_monthly >= 0 AND net_recoverable_monthly >= 0 AND annual_net_value >= 0 AND upfront_investment >= 0 AND annual_opex >= 0)
);

CREATE TABLE IF NOT EXISTS public.calculation_result_lineage (
  result_id uuid NOT NULL REFERENCES public.calculation_results(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  evidence_item_id uuid REFERENCES public.evidence_items(id),
  input_snapshot_id uuid NOT NULL REFERENCES public.diagnostic_input_snapshots(id),
  scenario text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (result_id, evidence_item_id, input_snapshot_id),
  CONSTRAINT calculation_result_lineage_scenario_check CHECK (scenario IN ('conservative','base','optimistic'))
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id text NOT NULL,
  result text NOT NULL,
  reason_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_events_actor_type_check CHECK (actor_type IN ('user','service','connector','system')),
  CONSTRAINT audit_events_result_check CHECK (result IN ('success','denied','failed')),
  CONSTRAINT audit_events_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  operation text NOT NULL,
  resource_id uuid,
  response_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, request_id, operation)
);

ALTER TABLE public.diagnostic_sessions
  ADD CONSTRAINT diagnostic_sessions_input_snapshot_fk
  FOREIGN KEY (input_snapshot_id) REFERENCES public.diagnostic_input_snapshots(id);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_principal ON public.tenant_memberships(principal_id, status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_sessions_tenant_created ON public.diagnostic_sessions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_items_tenant_observed ON public.evidence_items(tenant_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_items_tenant_metric ON public.evidence_items(tenant_id, metric);
CREATE INDEX IF NOT EXISTS idx_input_snapshots_tenant_session ON public.diagnostic_input_snapshots(tenant_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calculation_results_tenant_session ON public.calculation_results(tenant_id, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lineage_tenant_result ON public.calculation_result_lineage(tenant_id, result_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_occurred ON public.audit_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON public.idempotency_keys(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS 'SELECT CASE WHEN count(*) = 1 THEN max(tm.tenant_id::text)::uuid ELSE NULL END FROM public.tenant_memberships tm WHERE tm.principal_id = auth.user_id() AND tm.status = ''active'' AND (auth.organization_id() IS NULL OR tm.tenant_id = auth.organization_id())';

CREATE OR REPLACE FUNCTION public.enforce_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS 'BEGIN RAISE EXCEPTION ''APPEND_ONLY_RESOURCE: % cannot be updated or deleted'', TG_TABLE_NAME USING errcode = ''55000''; END';

DROP TRIGGER IF EXISTS calculation_results_append_only ON public.calculation_results;
CREATE TRIGGER calculation_results_append_only BEFORE UPDATE OR DELETE ON public.calculation_results FOR EACH ROW EXECUTE FUNCTION public.enforce_append_only();
DROP TRIGGER IF EXISTS audit_events_append_only ON public.audit_events;
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.enforce_append_only();
DROP TRIGGER IF EXISTS input_snapshots_append_only ON public.diagnostic_input_snapshots;
CREATE TRIGGER input_snapshots_append_only BEFORE UPDATE OR DELETE ON public.diagnostic_input_snapshots FOR EACH ROW EXECUTE FUNCTION public.enforce_append_only();
DROP TRIGGER IF EXISTS result_lineage_append_only ON public.calculation_result_lineage;
CREATE TRIGGER result_lineage_append_only BEFORE UPDATE OR DELETE ON public.calculation_result_lineage FOR EACH ROW EXECUTE FUNCTION public.enforce_append_only();
DROP TRIGGER IF EXISTS evidence_items_append_only ON public.evidence_items;
CREATE TRIGGER evidence_items_append_only BEFORE UPDATE OR DELETE ON public.evidence_items FOR EACH ROW EXECUTE FUNCTION public.enforce_append_only();

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_legal_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_input_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_result_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_legal_holds FORCE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_input_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_result_lineage FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys FORCE ROW LEVEL SECURITY;

CREATE POLICY tenants_isolation ON public.tenants AS RESTRICTIVE FOR ALL TO authenticated USING (id = public.current_tenant_id()) WITH CHECK (id = public.current_tenant_id());
CREATE POLICY memberships_isolation ON public.tenant_memberships AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY legal_holds_isolation ON public.tenant_legal_holds AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY diagnostic_sessions_isolation ON public.diagnostic_sessions AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY evidence_items_isolation ON public.evidence_items AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY input_snapshots_isolation ON public.diagnostic_input_snapshots AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY calculation_results_isolation ON public.calculation_results AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY result_lineage_isolation ON public.calculation_result_lineage AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY audit_events_isolation ON public.audit_events AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id IS NULL OR tenant_id = public.current_tenant_id());
CREATE POLICY idempotency_keys_isolation ON public.idempotency_keys AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

REVOKE ALL ON public.tenants, public.tenant_memberships, public.tenant_legal_holds, public.diagnostic_sessions, public.evidence_items, public.diagnostic_input_snapshots, public.calculation_results, public.calculation_result_lineage, public.audit_events, public.idempotency_keys FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_append_only() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT SELECT, INSERT ON public.tenants TO authenticated;
GRANT SELECT, INSERT ON public.tenant_memberships TO authenticated;
GRANT SELECT, INSERT ON public.tenant_legal_holds TO authenticated;
GRANT SELECT, INSERT ON public.diagnostic_sessions TO authenticated;
GRANT SELECT, INSERT ON public.evidence_items TO authenticated;
GRANT SELECT, INSERT ON public.diagnostic_input_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.calculation_results TO authenticated;
GRANT SELECT, INSERT ON public.calculation_result_lineage TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT SELECT, INSERT ON public.idempotency_keys TO authenticated;
