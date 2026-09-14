const REQUIRED_SCENARIOS = new Set(['conservative', 'base', 'optimistic']);
const REQUIRED_EVIDENCE_QUALITY = new Set(['low', 'medium', 'high']);

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value.trim();
}

export function assertTenantContext(context = {}) {
  const tenantId = nonEmptyString(context.tenantId, 'tenantId');
  const principalId = nonEmptyString(context.principalId, 'principalId');
  const role = nonEmptyString(context.role, 'role');
  if (context.clientTenantId != null && context.clientTenantId !== tenantId) {
    throw new Error('tenant_id_mismatch');
  }
  if (!['tenant_user', 'tenant_admin', 'operator', 'service', 'auditor'].includes(role)) {
    throw new Error('invalid_role');
  }
  return Object.freeze({ tenantId, principalId, role });
}

export function createDiagnosticSession(input = {}) {
  const tenant = assertTenantContext(input.context);
  const sessionId = nonEmptyString(input.sessionId, 'sessionId');
  const calculationContractVersion = nonEmptyString(input.calculationContractVersion, 'calculationContractVersion');
  return Object.freeze({
    sessionId,
    tenantId: tenant.tenantId,
    createdBy: tenant.principalId,
    calculationContractVersion,
    status: input.status ?? 'created',
    inputSnapshotId: input.inputSnapshotId ?? null,
    evidenceSetId: input.evidenceSetId ?? null,
  });
}

export function createEvidenceItem(input = {}) {
  const tenant = assertTenantContext(input.context);
  const evidenceId = nonEmptyString(input.evidenceId, 'evidenceId');
  const sourceType = nonEmptyString(input.sourceType, 'sourceType');
  const metric = nonEmptyString(input.metric, 'metric');
  const unit = nonEmptyString(input.unit, 'unit');
  const quality = String(input.quality ?? '').toLowerCase();
  if (!REQUIRED_EVIDENCE_QUALITY.has(quality)) throw new Error('invalid_evidence_quality');
  if (input.value === undefined || input.value === null) throw new Error('value is required');
  if (input.secret != null) throw new Error('secret_not_allowed');
  return Object.freeze({
    evidenceId,
    tenantId: tenant.tenantId,
    sourceType,
    sourceRef: input.sourceRef ?? null,
    observedAt: nonEmptyString(input.observedAt, 'observedAt'),
    collectedAt: nonEmptyString(input.collectedAt, 'collectedAt'),
    metric,
    value: input.value,
    unit,
    quality,
    provenanceHash: nonEmptyString(input.provenanceHash, 'provenanceHash'),
    metadata: input.metadata ?? {},
    revision: Number(input.revision ?? 1),
  });
}

export function createInputSnapshot(input = {}) {
  const tenant = assertTenantContext(input.context);
  return Object.freeze({
    snapshotId: nonEmptyString(input.snapshotId, 'snapshotId'),
    tenantId: tenant.tenantId,
    sessionId: nonEmptyString(input.sessionId, 'sessionId'),
    schemaVersion: nonEmptyString(input.schemaVersion, 'schemaVersion'),
    payloadHash: nonEmptyString(input.payloadHash, 'payloadHash'),
    normalizedPayload: structuredClone(input.normalizedPayload ?? {}),
  });
}

export function createCalculationResult(input = {}) {
  const tenant = assertTenantContext(input.context);
  const scenario = nonEmptyString(input.scenario, 'scenario');
  if (!REQUIRED_SCENARIOS.has(scenario)) throw new Error('invalid_scenario');
  const result = {
    resultId: nonEmptyString(input.resultId, 'resultId'),
    tenantId: tenant.tenantId,
    sessionId: nonEmptyString(input.sessionId, 'sessionId'),
    calculationContractVersion: nonEmptyString(input.calculationContractVersion, 'calculationContractVersion'),
    scenario,
    grossRecoverableMonthly: Number(input.grossRecoverableMonthly ?? 0),
    overlapAdjustmentMonthly: Number(input.overlapAdjustmentMonthly ?? 0),
    netRecoverableMonthly: Number(input.netRecoverableMonthly ?? 0),
    annualNetValue: Number(input.annualNetValue ?? 0),
    upfrontInvestment: Number(input.upfrontInvestment ?? 0),
    annualOpex: Number(input.annualOpex ?? 0),
    roiPercent: input.roiPercent == null ? null : Number(input.roiPercent),
    paybackMonths: input.paybackMonths == null ? null : Number(input.paybackMonths),
    marginUpliftPoints: input.marginUpliftPoints == null ? null : Number(input.marginUpliftPoints),
    evidenceQuality: String(input.evidenceQuality ?? 'low').toLowerCase(),
    assumptions: Array.isArray(input.assumptions) ? [...input.assumptions] : [],
  };
  if (!REQUIRED_EVIDENCE_QUALITY.has(result.evidenceQuality)) throw new Error('invalid_evidence_quality');
  return Object.freeze(result);
}

export function createAuditEvent(input = {}) {
  const tenant = assertTenantContext(input.context);
  return Object.freeze({
    eventId: nonEmptyString(input.eventId, 'eventId'),
    tenantId: tenant.tenantId,
    actorType: nonEmptyString(input.actorType, 'actorType'),
    actorId: tenant.principalId,
    action: nonEmptyString(input.action, 'action'),
    resourceType: nonEmptyString(input.resourceType, 'resourceType'),
    resourceId: nonEmptyString(input.resourceId, 'resourceId'),
    requestId: nonEmptyString(input.requestId, 'requestId'),
    result: input.result ?? 'success',
    reasonCode: input.reasonCode ?? null,
    metadata: input.metadata ?? {},
  });
}

export function assertLineage(lineage = {}) {
  const required = ['source', 'evidenceItemId', 'inputSnapshotId', 'calculationResultId', 'scenario'];
  for (const field of required) nonEmptyString(lineage[field], field);
  if (!REQUIRED_SCENARIOS.has(lineage.scenario)) throw new Error('invalid_scenario');
  return Object.freeze({ ...lineage });
}
