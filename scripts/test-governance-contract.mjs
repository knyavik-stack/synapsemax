import assert from 'node:assert/strict';
import {
  assertTenantContext,
  createAuditEvent,
  createCalculationResult,
  createDiagnosticSession,
  createEvidenceItem,
  createInputSnapshot,
  assertLineage,
} from '../src/governance-contract.js';

const context = { tenantId: 'tenant-a', principalId: 'user-1', role: 'tenant_admin' };

assert.deepEqual(assertTenantContext(context), context);
assert.throws(() => assertTenantContext({ ...context, clientTenantId: 'tenant-b' }), /tenant_id_mismatch/);
assert.throws(() => assertTenantContext({ ...context, role: 'unknown' }), /invalid_role/);

const session = createDiagnosticSession({
  context,
  sessionId: 'session-1',
  calculationContractVersion: 'finance-v2',
});
assert.equal(session.tenantId, 'tenant-a');
assert.equal(session.createdBy, 'user-1');

const evidence = createEvidenceItem({
  context,
  evidenceId: 'evidence-1',
  sourceType: 'csv',
  sourceRef: 'finance/export-2026-09',
  observedAt: '2026-09-14T12:00:00Z',
  collectedAt: '2026-09-14T12:05:00Z',
  metric: 'monthly_labor_cost',
  value: 1000000,
  unit: 'RUB/month',
  quality: 'high',
  provenanceHash: 'sha256:test',
});
assert.equal(evidence.tenantId, 'tenant-a');
assert.throws(() => createEvidenceItem({ context, evidenceId: 'bad', sourceType: 'manual', metric: 'x', unit: 'RUB', value: 1, quality: 'high', provenanceHash: 'x', observedAt: 'x', collectedAt: 'x', secret: 'token' }), /secret_not_allowed/);

const snapshot = createInputSnapshot({
  context,
  snapshotId: 'snapshot-1',
  sessionId: session.sessionId,
  schemaVersion: '1',
  payloadHash: 'sha256:payload',
  normalizedPayload: { monthlyLaborCost: 1000000 },
});
assert.equal(snapshot.tenantId, 'tenant-a');

const result = createCalculationResult({
  context,
  resultId: 'result-1',
  sessionId: session.sessionId,
  calculationContractVersion: 'finance-v2',
  scenario: 'base',
  grossRecoverableMonthly: 300000,
  overlapAdjustmentMonthly: 40000,
  netRecoverableMonthly: 260000,
  annualNetValue: 3120000,
  upfrontInvestment: 1500000,
  annualOpex: 0,
  roiPercent: 108,
  paybackMonths: 5.8,
  marginUpliftPoints: 5.2,
  evidenceQuality: 'high',
  assumptions: ['test'],
});
assert.equal(Object.isFrozen(result), true);
assert.throws(() => createCalculationResult({ context, resultId: 'bad', sessionId: 's', calculationContractVersion: 'v', scenario: 'invalid', evidenceQuality: 'low' }), /invalid_scenario/);

const audit = createAuditEvent({
  context,
  eventId: 'audit-1',
  actorType: 'user',
  action: 'financial_result.created',
  resourceType: 'calculation_result',
  resourceId: result.resultId,
  requestId: 'req-1',
});
assert.equal(audit.actorId, 'user-1');
assert.equal(audit.tenantId, 'tenant-a');

assert.deepEqual(assertLineage({
  source: 'csv:finance/export-2026-09',
  evidenceItemId: evidence.evidenceId,
  inputSnapshotId: snapshot.snapshotId,
  calculationResultId: result.resultId,
  scenario: 'base',
}), {
  source: 'csv:finance/export-2026-09',
  evidenceItemId: evidence.evidenceId,
  inputSnapshotId: snapshot.snapshotId,
  calculationResultId: result.resultId,
  scenario: 'base',
});

console.log('governance contract tests: PASS');
