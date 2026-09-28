import assert from 'node:assert/strict';
import { calculateFinancialHorizon, FINANCIAL_HORIZON_CONTRACT } from '../src/financial-horizon.js';

const result = calculateFinancialHorizon({
  annualRecoverableValue: 3120000,
  upfrontInvestment: 1500000,
  annualOpex: 120000,
  valueGrowthRate: 0.05,
  opexEscalationRate: 0.03,
  discountRate: 0.15,
  years: 5,
});

assert.equal(result.contractVersion, FINANCIAL_HORIZON_CONTRACT);
assert.equal(result.cashFlows.length, 5);
assert.equal(result.cashFlows[0].recoverableValue, 3120000);
assert.equal(result.cashFlows[1].recoverableValue, 3276000);
assert.equal(result.cashFlows[0].opex, 120000);
assert.ok(result.totals.npv > 0);
assert.ok(result.totals.fiveYearRoiPercent > 0);
assert.equal(result.totals.discountedPaybackYear, 1);

assert.throws(() => calculateFinancialHorizon({
  annualRecoverableValue: 100,
  discountRate: -1,
}), /discountRate/);

assert.throws(() => calculateFinancialHorizon({
  annualRecoverableValue: -1,
}), /annualRecoverableValue/);

console.log('financial-horizon: PASS');
