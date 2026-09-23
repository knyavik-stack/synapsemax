const DATA_API_URL = 'https://ep-lively-bread-b1ewktwx.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1';
import { runEvidenceBackedDiagnostic, FINANCIAL_DIAGNOSTIC_CONTRACT } from './evidence-diagnostic.js';

class DataApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DataApiError';
    this.status = status;
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function apiRequest(path, { method = 'POST', body, authorization, prefer = 'return=representation' } = {}) {
  const response = await fetch(DATA_API_URL + path, {
    method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cf: { cacheTtl: 0 },
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) throw new DataApiError(response.status, 'Data API request failed (' + response.status + '): ' + text.slice(0, 500));
  return data;
}

async function apiWrite(path, body, authorization) {
  const data = await apiRequest(path, { body, authorization });
  return Array.isArray(data) ? data[0] : data;
}

async function apiRead(path, authorization) {
  return apiRequest(path, { method: 'GET', authorization, prefer: 'return=representation' });
}

function qualityLabel(value) {
  if (value >= 80) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

function requestIdFrom(input, request) {
  const supplied = request.headers.get('x-idempotency-key') || input.idempotencyKey;
  if (!supplied) return crypto.randomUUID();
  const value = String(supplied).trim();
  if (!value || value.length > 200) throw new Error('x-idempotency-key must contain 1..200 characters');
  return value;
}

function buildPersistencePayload({ diagnostic, tenantContext, input, sessionId, snapshotId, requestId, payloadHash, now }) {
  const evidenceRows = diagnostic.evidenceModel.evidence.map((item) => ({
    id: crypto.randomUUID(),
    supersedes_evidence_id: null,
    source_type: item.sourceType,
    source_ref: item.sourceRef,
    observed_at: item.observedAt,
    collected_at: item.collectedAt,
    metric: item.metric,
    value: item.value,
    unit: item.unit,
    quality: item.quality,
    provenance_hash: item.provenanceHash,
    metadata: item.metadata,
  }));

  const resultRows = ['conservative', 'base', 'optimistic'].map((scenario) => {
    const s = diagnostic.scenarios[scenario];
    return {
      id: crypto.randomUUID(),
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
        decisionEngine: diagnostic.decision,
        noDoubleCounting: diagnostic.lineage.noDoubleCounting,
      },
    };
  });

  return {
    idempotency: {
      request_id: requestId,
      operation: 'financial-diagnostic',
      response_hash: payloadHash,
    },
    session: {
      id: sessionId,
      tenant_id: tenantContext.tenantId,
      status: 'persisting',
      created_by: tenantContext.principalId ?? 'authenticated-principal',
      calculation_contract_version: FINANCIAL_DIAGNOSTIC_CONTRACT,
      evidence_set_id: payloadHash,
    },
    snapshot: {
      id: snapshotId,
      tenant_id: tenantContext.tenantId,
      session_id: sessionId,
      schema_version: FINANCIAL_DIAGNOSTIC_CONTRACT,
      payload_hash: payloadHash,
      normalized_payload: {
        contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT,
        calculationInput: input.calculationInput ?? {},
        evidence: input.evidence ?? [],
        discountRate: input.discountRate ?? 0.12,
        horizonYears: input.horizonYears ?? 5,
      },
    },
    evidence_rows: evidenceRows,
    result_rows: resultRows,
    lineage_rows: resultRows.flatMap((resultRow) => evidenceRows.map((evidenceRow) => ({
      result_id: resultRow.id,
      evidence_item_id: evidenceRow.id,
      scenario: resultRow.scenario,
    }))),
    audit_events: [
      {
        id: crypto.randomUUID(),
        actor_type: 'user',
        actor_id: tenantContext.principalId ?? 'authenticated-principal',
        action: 'financial_diagnostic.started',
        resource_type: 'diagnostic_session',
        resource_id: sessionId,
        occurred_at: now,
        result: 'started',
        reason_code: null,
        metadata: { contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT, evidenceCount: diagnostic.evidenceModel.evidenceCount },
      },
      {
        id: crypto.randomUUID(),
        actor_type: 'user',
        actor_id: tenantContext.principalId ?? 'authenticated-principal',
        action: 'financial_diagnostic.completed',
        resource_type: 'diagnostic_session',
        resource_id: sessionId,
        occurred_at: new Date().toISOString(),
        result: 'success',
        reason_code: null,
        metadata: { resultCount: resultRows.length, evidenceCount: evidenceRows.length, decisionContract: diagnostic.decision.contractVersion },
      },
    ],
  };
}

function atomicResult(data, diagnostic, requestId) {
  return {
    idempotentReplay: Boolean(data?.idempotentReplay),
    sessionId: data?.sessionId,
    inputSnapshotId: data?.inputSnapshotId,
    requestId,
    evidenceItemIds: data?.evidenceItemIds ?? [],
    calculationResultIds: data?.calculationResultIds ?? [],
    diagnostic,
  };
}

async function persistLegacy({ authorization, tenantContext, input, diagnostic, sessionId, snapshotId, requestId, payloadHash, now }) {
  const idem = await apiRequest('/idempotency_keys', {
    body: { tenant_id: tenantContext.tenantId, request_id: requestId, operation: 'financial-diagnostic', resource_id: sessionId, response_hash: payloadHash },
    authorization,
    prefer: 'resolution=ignore-duplicates,return=representation',
  });

  if (!Array.isArray(idem) || idem.length === 0) {
    const existing = await apiRead(
      '/idempotency_keys?tenant_id=eq.' + encodeURIComponent(tenantContext.tenantId) +
      '&request_id=eq.' + encodeURIComponent(requestId) +
      '&operation=eq.financial-diagnostic&select=resource_id,response_hash,created_at',
      authorization,
    );
    const row = Array.isArray(existing) ? existing[0] : null;
    if (!row) throw new Error('Idempotency conflict detected but existing request could not be resolved');
    if (row.response_hash !== payloadHash) throw new Error('Idempotency payload conflict');
    return { idempotentReplay: true, sessionId: row.resource_id, requestId, payloadHash };
  }

  try {
    await apiWrite('/diagnostic_sessions', {
      id: sessionId, tenant_id: tenantContext.tenantId, status: 'persisting',
      created_by: tenantContext.principalId ?? 'authenticated-principal',
      calculation_contract_version: FINANCIAL_DIAGNOSTIC_CONTRACT, input_snapshot_id: snapshotId, evidence_set_id: payloadHash,
    }, authorization);

    await apiWrite('/audit_events', {
      id: crypto.randomUUID(), tenant_id: tenantContext.tenantId, actor_type: 'user',
      actor_id: tenantContext.principalId ?? 'authenticated-principal', action: 'financial_diagnostic.started',
      resource_type: 'diagnostic_session', resource_id: sessionId, occurred_at: now,
      request_id: requestId, result: 'started',
      metadata: { contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT, evidenceCount: diagnostic.evidenceModel.evidenceCount },
    }, authorization);

    await apiWrite('/diagnostic_input_snapshots', {
      id: snapshotId, tenant_id: tenantContext.tenantId, session_id: sessionId,
      schema_version: FINANCIAL_DIAGNOSTIC_CONTRACT, payload_hash: payloadHash,
      normalized_payload: { contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT, calculationInput: input.calculationInput ?? {}, evidence: input.evidence ?? [], discountRate: input.discountRate ?? 0.12, horizonYears: input.horizonYears ?? 5 },
    }, authorization);

    const evidenceRows = [];
    for (const item of diagnostic.evidenceModel.evidence) {
      const row = await apiWrite('/evidence_items', {
        id: crypto.randomUUID(), tenant_id: tenantContext.tenantId, source_type: item.sourceType,
        source_ref: item.sourceRef, observed_at: item.observedAt, collected_at: item.collectedAt,
        metric: item.metric, value: item.value, unit: item.unit, quality: item.quality,
        provenance_hash: item.provenanceHash || await sha256(JSON.stringify(item.value)), metadata: item.metadata,
      }, authorization);
      evidenceRows.push({ id: row?.id, metric: item.metric });
    }

    const resultIds = [];
    for (const scenario of ['conservative', 'base', 'optimistic']) {
      const s = diagnostic.scenarios[scenario];
      const row = await apiWrite('/calculation_results', {
        id: crypto.randomUUID(), tenant_id: tenantContext.tenantId, session_id: sessionId,
        calculation_contract_version: FINANCIAL_DIAGNOSTIC_CONTRACT, scenario,
        gross_recoverable_monthly: diagnostic.result.grossRecoverableMonthlyValue,
        overlap_adjustment_monthly: diagnostic.result.overlapAdjustment, net_recoverable_monthly: s.monthlyValue,
        annual_net_value: s.annualValue, upfront_investment: diagnostic.result.upfrontInvestment,
        annual_opex: Number(input.calculationInput?.annualOpex ?? 0), roi_percent: s.roiPercent,
        payback_months: s.paybackMonths, margin_uplift_points: diagnostic.result.marginUpliftPoints,
        evidence_quality: qualityLabel(diagnostic.evidenceModel.evidenceQuality),
        assumptions: { contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT, factor: s.factor, fiveYear: diagnostic.fiveYear[scenario], decisionEngine: diagnostic.decision, noDoubleCounting: diagnostic.lineage.noDoubleCounting },
      }, authorization);
      resultIds.push({ id: row?.id, scenario });
    }

    for (const resultRow of resultIds) {
      for (const evidenceRow of evidenceRows) {
        await apiWrite('/calculation_result_lineage', {
          result_id: resultRow.id, tenant_id: tenantContext.tenantId, evidence_item_id: evidenceRow.id,
          input_snapshot_id: snapshotId, scenario: resultRow.scenario,
        }, authorization);
      }
    }

    await apiRequest('/diagnostic_sessions?id=eq.' + encodeURIComponent(sessionId), { method: 'PATCH', body: { status: 'completed' }, authorization });
    await apiWrite('/audit_events', {
      id: crypto.randomUUID(), tenant_id: tenantContext.tenantId, actor_type: 'user',
      actor_id: tenantContext.principalId ?? 'authenticated-principal', action: 'financial_diagnostic.completed',
      resource_type: 'diagnostic_session', resource_id: sessionId, occurred_at: new Date().toISOString(),
      request_id: requestId, result: 'success',
      metadata: { resultCount: resultIds.length, evidenceCount: evidenceRows.length, decisionContract: diagnostic.decision.contractVersion },
    }, authorization);

    return { idempotentReplay: false, sessionId, inputSnapshotId: snapshotId, requestId, evidenceItemIds: evidenceRows.map((row) => row.id), calculationResultIds: resultIds.map((row) => row.id), diagnostic };
  } catch (error) {
    try {
      await apiRequest('/diagnostic_sessions?id=eq.' + encodeURIComponent(sessionId), { method: 'PATCH', body: { status: 'failed' }, authorization });
      await apiWrite('/audit_events', {
        id: crypto.randomUUID(), tenant_id: tenantContext.tenantId, actor_type: 'user',
        actor_id: tenantContext.principalId ?? 'authenticated-principal', action: 'financial_diagnostic.failed',
        resource_type: 'diagnostic_session', resource_id: sessionId, occurred_at: new Date().toISOString(),
        request_id: requestId, result: 'failure', reason_code: error instanceof Error ? error.constructor.name : 'UnknownError',
        metadata: { message: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error' },
      }, authorization);
    } catch {}
    throw error;
  }
}

export async function persistEvidenceDiagnostic({ request, tenantContext, input }) {
  const authorization = request.headers.get('authorization');
  if (!authorization) throw new Error('Authentication required');

  const diagnostic = runEvidenceBackedDiagnostic(input);
  const sessionId = crypto.randomUUID();
  const snapshotId = crypto.randomUUID();
  const requestId = requestIdFrom(input, request);
  const now = new Date().toISOString();
  const normalizedPayload = {
    contractVersion: FINANCIAL_DIAGNOSTIC_CONTRACT,
    calculationInput: input.calculationInput ?? {},
    evidence: input.evidence ?? [],
    discountRate: input.discountRate ?? 0.12,
    horizonYears: input.horizonYears ?? 5,
  };
  const payloadHash = await sha256(JSON.stringify(normalizedPayload));
  const persistencePayload = buildPersistencePayload({ diagnostic, tenantContext, input, sessionId, snapshotId, requestId, payloadHash, now });

  try {
    const atomic = await apiRequest('/rpc/persist_financial_diagnostic', {
      body: { p_payload: persistencePayload },
      authorization,
      prefer: 'return=representation',
    });
    const data = Array.isArray(atomic) ? atomic[0] : atomic;
    return atomicResult(data, diagnostic, requestId);
  } catch (error) {
    if (!(error instanceof DataApiError) || error.status !== 404) throw error;
    return persistLegacy({ authorization, tenantContext, input, diagnostic, sessionId, snapshotId, requestId, payloadHash, now });
  }
}
