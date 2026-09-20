const GOVERNANCE_RETENTION_CONTRACT = 'governance-retention-v1';

function assertNonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new Error(name + ' must be a non-negative integer');
}

function normalizePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new Error('Retention policy is required');
  assertNonNegativeInteger(policy.retentionDays, 'retentionDays');
  return {
    retentionDays: policy.retentionDays,
    deleteEligibleStatuses: Array.isArray(policy.deleteEligibleStatuses) && policy.deleteEligibleStatuses.length
      ? [...new Set(policy.deleteEligibleStatuses.map(String))]
      : ['completed', 'failed'],
  };
}

function normalizeHolds(holds) {
  if (!Array.isArray(holds)) throw new Error('legalHolds must be an array');
  return holds
    .filter((hold) => hold && hold.active !== false)
    .map((hold) => ({
      scope: String(hold.scope ?? 'tenant'),
      reasonCode: hold.reasonCode ? String(hold.reasonCode) : 'unspecified',
      active: hold.active !== false,
    }));
}

export function evaluateRetention({ policy, legalHolds, resource }) {
  if (!resource || typeof resource !== 'object') throw new Error('resource is required');
  if (!resource.createdAt) throw new Error('resource.createdAt is required');

  const normalizedPolicy = normalizePolicy(policy);
  const holds = normalizeHolds(legalHolds);
  const createdAt = new Date(resource.createdAt);
  if (Number.isNaN(createdAt.getTime())) throw new Error('resource.createdAt must be a valid date');

  const now = resource.now ? new Date(resource.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('resource.now must be a valid date');

  const dueAt = new Date(createdAt.getTime() + normalizedPolicy.retentionDays * 86400000);
  const status = String(resource.status ?? '');
  const statusEligible = normalizedPolicy.deleteEligibleStatuses.includes(status);
  const holdBlocked = holds.length > 0;
  const retentionDue = now >= dueAt;

  let decision = 'retain';
  let reason = 'retention_period_not_reached';
  if (holdBlocked) {
    decision = 'retain';
    reason = 'legal_hold_active';
  } else if (!statusEligible) {
    decision = 'retain';
    reason = 'status_not_eligible';
  } else if (!retentionDue) {
    decision = 'retain';
    reason = 'retention_period_not_reached';
  } else {
    decision = 'eligible_for_review';
    reason = 'retention_due_without_active_hold';
  }

  return {
    contractVersion: GOVERNANCE_RETENTION_CONTRACT,
    decision,
    reason,
    destructiveAction: 'none',
    reviewRequired: decision === 'eligible_for_review',
    policy: normalizedPolicy,
    legalHold: holdBlocked
      ? { blocked: true, count: holds.length, reasons: holds.map((hold) => hold.reasonCode) }
      : { blocked: false, count: 0, reasons: [] },
    resource: {
      id: resource.id ?? null,
      type: resource.type ?? null,
      status,
      createdAt: createdAt.toISOString(),
      dueAt: dueAt.toISOString(),
    },
  };
}

export { GOVERNANCE_RETENTION_CONTRACT };
