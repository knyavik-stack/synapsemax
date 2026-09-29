import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runEvidenceBackedDiagnostic, calibrateScenarios, FINANCIAL_DIAGNOSTIC_CONTRACT } from '../src/evidence-diagnostic.js';
import { buildNormalizedPayload } from '../src/evidence-persistence.js';

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
assert.equal(diagnostic.decision.economics.npv, diagnostic.fiveYear.base.npv);
assert.equal(diagnostic.fiveYear.base.horizonYears, 5);
assert.equal(diagnostic.fiveYear.base.cashFlows.length, 5);
assert.equal(diagnostic.fiveYear.base.npv, diagnostic.decision.economics.npv);
assert.equal(diagnostic.lineage.noDoubleCounting.method, 'explicit-overlap-only');
assert.ok(diagnostic.scenarios.base.annualValue >= diagnostic.scenarios.conservative.annualValue);
assert.ok(diagnostic.scenarios.optimistic.annualValue >= diagnostic.scenarios.base.annualValue);
const low = calibrateScenarios({}, 0);
const high = calibrateScenarios({}, 100);
assert.ok(low.conservative < high.conservative);
assert.ok(low.optimistic > high.optimistic);
console.log('Evidence-backed diagnostic: PASS');


const persistenceSource = fs.readFileSync('src/evidence-persistence.js', 'utf8');
if (!persistenceSource.includes('provenance_hash: await sha256(JSON.stringify({')) {
  throw new Error('server-side provenance hash derivation missing');
}
if (persistenceSource.includes('provenance_hash: item.provenanceHash,')) {
  throw new Error('client-supplied provenance hash must not be trusted');
}
if (persistenceSource.includes('provenance_hash: item.provenanceHash ||')) {
  throw new Error('legacy fallback must not trust client-supplied provenance hash');
}
if (!persistenceSource.includes('evidence: diagnostic.evidenceModel.evidence.map(({ metric, sourceType, sourceRef')) {
  throw new Error('normalized snapshot must strip client-supplied provenanceHash');
}
console.log('PROVENANCE INTEGRITY: PASS');
const canonicalA = buildNormalizedPayload({ diagnostic, input: { calculationInput: { implementationCost: 1500000 }, evidence: diagnostic.evidenceModel.evidence.map((item) => ({ ...item, provenanceHash: 'client-a' })) } });
const canonicalB = buildNormalizedPayload({ diagnostic, input: { calculationInput: { implementationCost: 1500000 }, evidence: diagnostic.evidenceModel.evidence.map((item) => ({ ...item, provenanceHash: 'client-b' })) } });
assert.deepEqual(canonicalA, canonicalB, 'client provenanceHash must not affect canonical payload');
assert.ok(canonicalA.evidence.every((item) => !Object.hasOwn(item, 'provenanceHash')), 'canonical payload must strip client provenanceHash');
console.log('PAYLOAD CANONICALIZATION: PASS');

