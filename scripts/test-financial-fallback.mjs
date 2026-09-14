import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diagnoseProfitLeakage } from '../src/immediate-logic.js';

const artifact = resolve(process.cwd(), 'dist/dex-immediate.html');
assert.ok(existsSync(artifact), 'production artifact must exist; run npm run build first');
const html = readFileSync(artifact, 'utf8');

// The public financial UI currently collects no evidence for error/delay recovery.
// Therefore its offline fallback must match the domain defaults of 0% for both.
const conservative = diagnoseProfitLeakage({ monthlyLaborCost: 1000000, manualWorkShare: 50, recoverableManualShare: 40, monthlyErrorCost: 100000, monthlyDelayCost: 50000 });
assert.equal(conservative.recoverableMonthlyValue, 200000);
assert.equal(conservative.annualRecoverableValue, 2400000);

assert.match(html, /const recoverableErrorShare = 0;/);
assert.match(html, /const recoverableDelayShare = 0;/);
assert.match(html, /recoverableManualLeakage \+ recoverableErrorLeakage \+ recoverableDelayLeakage/);
assert.doesNotMatch(html, /recoverableMonthlyValue:\s*Math\.round\(recoverableManualLeakage \+ input\.monthlyErrorCost \+ input\.monthlyDelayCost\)/);
assert.doesNotMatch(html, /annualRecoverableValue:\s*Math\.round\(\(recoverableManualLeakage \+ input\.monthlyErrorCost \+ input\.monthlyDelayCost\) \* 12\)/);

console.log('Financial fallback contract: PASS');
