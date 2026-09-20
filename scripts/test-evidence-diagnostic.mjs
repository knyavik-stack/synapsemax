import assert from 'node:assert/strict';
import { runEvidenceBackedDiagnostic, calibrateScenarios, FINANCIAL_DIAGNOSTIC_CONTRACT } from '../src/evidence-diagnostic.js';

const diagnostic = runEvidenceBackedDiagnostic({
  evidence: [
    { metric: 'monthlyLaborCost', sourceType: 'erp', sourceRef: 'erp://payroll/2026-08', value: 1000000, unit: 'RUB/month', quality: 'high', provenanceHash: 'a' },
    { metric: 'monthlyErrorCost', sourceType: 'erp', sourceRef: 'erp://quality/2026-08', value: 100000, unit: 'RUB/month', quality: 'medium', provenanceHash: 'b' },
    { metric: 'monthlyDelayCost', sourceType: 'crm', sourceRef: 'crm://sla/2026-08', value: 50000, unit: 'RUB/month', quality: 'medium', provenanceHash: 'c' },
    { metric: 'monthlyRevenue', sourceType: 'erp', sourceRef: 'erp://revenue/2026-08', value: 5000000, unit: 'RUB/month', quality: 'high', provenanceHash: 'd' },
    { metric: 'baselineMarginPercent', sourceType: 'erp', sourceRef: 'erp://margin/2026-08', value: 20, unit: '%', quality: 'high', provenanceHash: 'e' },
  ],
  calculationInput: {
    recoverableManualShare: 0.4,
    recoverableErrorShare: 0.5,
    recoverableDelayShare: 0.2,
    implementationCost: 1500000,
  },
});

assert.equal(diagnostic.contractVersion, FINANCIAL_DIAGNOSTIC_CONTRACT);
assert.equal(diagnostic.evidenceModel.evidenceCount, 5);
assert.ok(diagnostic.evidenceModel.evidenceQuality >= 80);
assert.ok(diagnostic.result.recoverableMonthlyValue > 0);
assert.equal(diagnostic.decision.contractVersion, 'financial-decision-v1');
assert.ok(diagnostic.decision.economics.totalTco >= diagnostic.decision.facts.upfrontInvestment);
assert.ok(diagnostic.decision.economics.npv > 0);
assert.equal(diagnostic.fiveYear.base.horizonYears, 5);
assert.equal(diagnostic.lineage.noDoubleCounting.method, 'explicit-overlap-only');
assert.ok(diagnostic.scenarios.base.annualValue >= diagnostic.scenarios.conservative.annualValue);
assert.ok(diagnostic.scenarios.optimistic.annualValue >= diagnostic.scenarios.base.annualValue);
const low = calibrateScenarios({}, 0);
const high = calibrateScenarios({}, 100);
assert.ok(low.conservative < high.conservative);
assert.ok(low.optimistic > high.optimistic);
console.log('Evidence-backed diagnostic: PASS');
