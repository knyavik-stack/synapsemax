import assert from 'node:assert/strict';
import { evaluateRetention, GOVERNANCE_RETENTION_CONTRACT } from '../src/governance-retention.js';

const base = {
  policy: { retentionDays: 30, deleteEligibleStatuses: ['completed', 'failed'] },
  legalHolds: [],
  resource: {
    id: 's-1', type: 'diagnostic_session', status: 'completed',
    createdAt: '2026-01-01T00:00:00Z', now: '2026-02-01T00:00:00Z',
  },
};

const due = evaluateRetention(base);
assert.equal(due.contractVersion, GOVERNANCE_RETENTION_CONTRACT);
assert.equal(due.decision, 'eligible_for_review');
assert.equal(due.reviewRequired, true);
assert.equal(due.destructiveAction, 'none');

const held = evaluateRetention({
  ...base,
  legalHolds: [{ active: true, scope: 'tenant', reasonCode: 'legal_hold_1' }],
});
assert.equal(held.decision, 'retain');
assert.equal(held.reason, 'legal_hold_active');
assert.equal(held.legalHold.blocked, true);

const young = evaluateRetention({
  ...base,
  resource: { ...base.resource, now: '2026-01-15T00:00:00Z' },
});
assert.equal(young.reason, 'retention_period_not_reached');

const wrongStatus = evaluateRetention({
  ...base,
  resource: { ...base.resource, status: 'persisting' },
});
assert.equal(wrongStatus.reason, 'status_not_eligible');

assert.throws(() => evaluateRetention({
  ...base,
  policy: { retentionDays: -1 },
}), /retentionDays/);

console.log('governance-retention: PASS');
