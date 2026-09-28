import { evaluateRetention, GOVERNANCE_RETENTION_CONTRACT } from './governance-retention.js';

const GOVERNANCE_RETENTION_EXECUTOR_CONTRACT = 'governance-retention-executor-v1';
const SUPPORTED_EXECUTION_MODES = new Set(['dry-run']);

export function prepareRetentionExecution({ policy, legalHolds, resource, executionMode = 'dry-run', requestId }) {
  if (!requestId || typeof requestId !== 'string') throw new Error('requestId is required');
  if (!SUPPORTED_EXECUTION_MODES.has(executionMode)) {
    throw new Error('Only dry-run retention execution is supported until a reviewed destructive executor is deployed');
  }

  const decision = evaluateRetention({ policy, legalHolds, resource });

  const plan = {
    contractVersion: GOVERNANCE_RETENTION_EXECUTOR_CONTRACT,
    retentionContractVersion: GOVERNANCE_RETENTION_CONTRACT,
    executionMode,
    requestId,
    action: decision.decision === 'eligible_for_review' ? 'review_required' : 'retain',
    destructiveAction: 'none',
    reviewRequired: decision.reviewRequired,
    reason: decision.reason,
    resource: decision.resource,
    legalHold: decision.legalHold,
    auditEvent: {
      action: 'retention_review',
      resourceType: decision.resource.type,
      resourceId: decision.resource.id,
      result: 'success',
      reasonCode: decision.reason,
      requestId,
      metadata: {
        executorContractVersion: GOVERNANCE_RETENTION_EXECUTOR_CONTRACT,
        executionMode,
        destructiveAction: 'none',
      },
    },
  };

  return plan;
}

export { GOVERNANCE_RETENTION_EXECUTOR_CONTRACT };
