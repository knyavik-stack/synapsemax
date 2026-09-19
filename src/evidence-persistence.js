const DATA_API_URL = 'https://ep-lively-bread-b1ewktwx.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1';
import { runEvidenceBackedDiagnostic, FINANCIAL_DIAGNOSTIC_CONTRACT } from './evidence-diagnostic.js';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function apiWrite(path, body, authorization) {
  const response = await fetch(DATA_API_URL + path, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
    cf: { cacheTtl: 0 },
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error('Data API write failed (' + response.status + '): ' + text.slice(0, 500));
  return Array.isArray(data) ? data[0] : data;
}

function qualityLabel(value) {
  if (value >= 80) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

export async function persistEvidenceDiagnostic({ request, tenantContext, input }) {
  const authorization = request.headers.get('authorization');
  if (!authorization) throw new Error('Authentication required');

  const diagnostic = runEvidenceBackedDiagnostic(input);
  const sessionId = crypto.randomUUID();
  const snapshotId = crypto.randomUUID();
  const now = new Date().toISOString();
  const normalizedPayload = {
    contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT,
    calculationInput: input.calculationInput ?? {},
    evidence: input.evidence ?? [],
    discountRate: input.discountRate ?? 0.12,
  };
  const payloadHash = await sha256(JSON.stringify(normalizedPayload));

  await apiWrite('/diagnostic_sessions', {
    id: sessionId,
    tenant_id: tenantContext.tenantId,
    status: 'created',
    created_by: tenantContext.principalId ?? 'authenticated-principal',
    calculation_contract_version: FINANCIAL_DIAGNOSTIC_CONTRACT,
    evidence_set_id: payloadHash,
  }, authorization);

  await apiWrite('/diagnostic_input_snapshots', {
    id: snapshotId,
    tenant_id: tenantContext.tenantId,
    session_id: sessionId,
    schema_version: FINANCIAL_DIAGNOSTIC_CONTRACT,
    payload_hash: payloadHash,
    normalized_payload: normalizedPayload,
  }, authorization);

  const evidenceRows = [];
  for (const item of diagnostic.evidenceModel.evidence) {
    const row = await apiWrite('/evidence_items', {
      id: crypto.randomUUID(),
      tenant_id: tenantContext.tenantId,
      source_type: item.sourceType,
      source_ref: item.sourceRef,
      observed_at: item.observedAt,
      collected_at: item.collectedAt,
      metric: item.metric,
      value: item.value,
      unit: item.unit,
      quality: item.quality,
      provenance_hash: item.provenanceHash || await sha256(JSON.stringify(item.value)),
      metadata: item.metadata,
    }, authorization);
    evidenceRows.push({ id: row?.id, metric: item.metric });
  }

  const resultIds = [];
  for (const scenario of ['conservative', 'base', 'optimistic']) {
    const s = diagnostic.scenarios[scenario];
    const row = await apiWrite('/calculation_results', {
      id: crypto.randomUUID(),
      tenant_id: tenantContext.tenantId,
      session_id: sessionId,
      calculation_contract_version: FINANCIAL_DIAGNOSTIC_CONTRACT,
      scenario,
      gross_recoverable_monthly: diagnostic.result.grossRecoverableMonthlyValue,
      overlap_adjustment_monthly: diagnostic.result.overlapAdjustment,
      net_recoverable_monthly: s.monthlyValue,
      annual_net_value: s.annualValue,
      upfront_investment: diagnostic.result.upfrontInvestment,
      annual_opex: Number(input.calculationInput?.annualOpex ?? 0),
      roi_percent: s.roiPercent,
      payback_months: s.paybackMonths,
      margin_uplift_points: diagnostic.result.marginUpliftPoints,
      evidence_quality: qualityLabel(diagnostic.evidenceModel.evidenceQuality),
      assumptions: {
        contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT,
        factor: s.factor,
        fiveYear: diagnostic.fiveYear[scenario],
        noDoubleCounting: diagnostic.lineage.noDoubleCounting,
      },
    }, authorization);
    resultIds.push({ id: row?.id, scenario });
  }

  for (const resultRow of resultIds) {
    for (const evidenceRow of evidenceRows) {
      await apiWrite('/calculation_result_lineage', {
        result_id: resultRow.id,
        tenant_id: tenantContext.tenantId,
        evidence_item_id: evidenceRow.id,
        input_snapshot_id: snapshotId,
        scenario: resultRow.scenario,
      }, authorization);
    }
  }

  return {
    sessionId,
    inputSnapshotId: snapshotId,
    evidenceItemIds: evidenceRows.map((row) => row.id),
    calculationResultIds: resultIds.map((row) => row.id),
    diagnostic,
  };
}
