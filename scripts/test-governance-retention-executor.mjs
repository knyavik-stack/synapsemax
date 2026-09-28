import assert from 'node:assert/strict';
import {
  prepareRetentionExecution,
  GOVERNANCE_RETENTION_EXECUTOR_CONTRACT,
} from '../src/governance-retention-executor.js';

const base = {
  policy: { retentionDays: 30, deleteEligibleStatuses: ['completed', 'failed'] },
  legalHolds: [],
  resource: {
    id: 's-1',
    type: 'diagnostic_session',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00Z',
    now: '2026-02-01T00:00:00Z',
  },
  requestId: 'req-retention-001',
};

const due = prepareRetentionExecution(base);
assert.equal(due.contractVersion, GOVERNANCE_RETENTION_EXECUTOR_CONTRACT);
assert.equal(due.action, 'review_required');
assert.equal(due.reviewRequired, true);
assert.equal(due.destructiveAction, 'none');
assert.equal(due.auditEvent.action, 'retention_review');
assert.equal(due.auditEvent.result, 'success');
assert.equal(due.auditEvent.requestId, base.requestId);

const held = prepareRetentionExecution({
  ...base,
  legalHolds: [{ active: true, scope: 'tenant', reasonCode: 'legal_hold_1' }],
});
assert.equal(held.action, 'retain');
assert.equal(held.reason, 'legal_hold_active');
assert.equal(held.reviewRequired, false);
assert.equal(held.destructiveAction, 'none');

assert.throws(
  () => prepareRetentionExecution({ ...base, executionMode: 'live' }),
  /Only dry-run retention execution/,
);

assert.throws(
  () => prepareRetentionExecution({ ...base, requestId: '' }),
  /requestId is required/,
);

console.log('governance-retention-executor: PASS');
