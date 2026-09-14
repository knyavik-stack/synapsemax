import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assess, calculateRoi, diagnoseProfitLeakage } from '../src/immediate-logic.js';

const root = process.cwd();

const assessment = assess({ complexity: 80, manualWork: 70, dataFragmentation: 60, errorRate: 30 });
assert.equal(assessment.score, 60);
assert.ok(assessment.automationPotential >= 60);

const bounded = assess({ complexity: -20, manualWork: 140, dataFragmentation: 'not-a-number', errorRate: 50 });
assert.deepEqual(bounded.profile, { complexity: 0, manualWork: 100, dataFragmentation: 0, errorRate: 50 });
assert.equal(bounded.score, 38);
assert.equal(bounded.priority, 'Средний');

const defaults = assess({});
assert.deepEqual(defaults.profile, { complexity: 58, manualWork: 52, dataFragmentation: 61, errorRate: 28 });
assert.ok(defaults.aiReadiness >= 0 && defaults.aiReadiness <= 100);
assert.ok(defaults.automationPotential >= 0 && defaults.automationPotential <= 100);

const roi = calculateRoi({ monthlyCost: 1000000, automationShare: 35, expectedEfficiency: 25, implementationCost: 1500000 });
assert.equal(roi.monthlySaving, 87500);
assert.equal(roi.annualSaving, 1050000);
assert.equal(roi.roiPercent, -30);
assert.equal(roi.paybackMonths, 17.1);

const roiBounded = calculateRoi({ monthlyCost: -1, automationShare: 200, expectedEfficiency: 200, implementationCost: 0 });
assert.deepEqual(roiBounded, { monthlySaving: 0, annualSaving: 0, roiPercent: 0, paybackMonths: null });

const roiZeroSaving = calculateRoi({ monthlyCost: 100000, automationShare: 0, expectedEfficiency: 25, implementationCost: 500000 });
assert.equal(roiZeroSaving.monthlySaving, 0);
assert.equal(roiZeroSaving.annualSaving, 0);
assert.equal(roiZeroSaving.roiPercent, -100);
assert.equal(roiZeroSaving.paybackMonths, null);

// Financial model: recoverability must be evidence-driven, not assumed.
const leakage = diagnoseProfitLeakage({ monthlyLaborCost: 1000000, manualWorkShare: 50, recoverableManualShare: 40, monthlyErrorCost: 100000, recoverableErrorShare: 50, monthlyDelayCost: 50000, recoverableDelayShare: 20, implementationCost: 1500000, monthlyRevenue: 5000000, baselineMarginPercent: 20 });
assert.equal(leakage.manualLeakage, 500000);
assert.equal(leakage.recoverableManualLeakage, 200000);
assert.equal(leakage.recoverableErrorLeakage, 50000);
assert.equal(leakage.recoverableDelayLeakage, 10000);
assert.equal(leakage.totalMonthlyLeakage, 650000);
assert.equal(leakage.recoverableMonthlyValue, 260000);
assert.equal(leakage.annualRecoverableValue, 3120000);
assert.equal(leakage.annualNetValue, 3120000);
assert.equal(leakage.upfrontInvestment, 1500000);
assert.equal(leakage.monthlyOngoingCost, 0);
assert.equal(leakage.roiPercent, 108);
assert.equal(leakage.paybackMonths, 5.8);
assert.equal(leakage.marginUpliftPoints, 5.2);
assert.equal(leakage.projectedMarginPercent, 25.2);
assert.equal(leakage.prioritySource, 'manual');
assert.equal(leakage.actionMap[0].key, 'manual');
assert.equal(leakage.overlapAdjustment, 0);
assert.equal(leakage.dataQuality.evidenceQuality, 0);
assert.equal(leakage.dataQuality.label, 'Низкая');
assert.equal(leakage.scenarios.conservative.monthlyValue, 182000);
assert.equal(leakage.scenarios.base.monthlyValue, 260000);
assert.equal(leakage.scenarios.optimistic.monthlyValue, 299000);

const overlap = diagnoseProfitLeakage({ monthlyLaborCost: 1000000, manualWorkShare: 50, recoverableManualShare: 40, monthlyErrorCost: 100000, recoverableErrorShare: 50, monthlyDelayCost: 50000, recoverableDelayShare: 20, errorOverlapShare: 100, delayOverlapShare: 50, evidenceQuality: 80 });
assert.equal(overlap.grossRecoverableMonthlyValue, 260000);
assert.equal(overlap.recoverableMonthlyValue, 205000);
assert.equal(overlap.overlapAdjustment, 55000);
assert.equal(overlap.dataQuality.label, 'Высокая');

const tco = diagnoseProfitLeakage({ monthlyLaborCost: 1000000, manualWorkShare: 50, recoverableManualShare: 40, implementationCost: 1000000, oneTimeCapex: 500000, monthlyOpex: 10000, annualOpex: 60000 });
assert.equal(tco.upfrontInvestment, 1500000);
assert.equal(tco.monthlyOngoingCost, 15000);
assert.equal(tco.annualNetValue, 2220000);
assert.equal(tco.roiPercent, 48);
assert.equal(tco.paybackMonths, 8.1);

const conservative = diagnoseProfitLeakage({ monthlyErrorCost: 100000, monthlyDelayCost: 100000 });
assert.equal(conservative.recoverableMonthlyValue, 0);
assert.equal(conservative.roiPercent, null);
assert.equal(conservative.paybackMonths, null);

const artifact = resolve(root, 'dist/dex-immediate.html');
assert.ok(existsSync(artifact), 'dist/dex-immediate.html must exist; run npm run build first');
const html = readFileSync(artifact, 'utf8');
const workerSource = readFileSync(resolve(root, 'src/index.js'), 'utf8');

for (const id of ['assessment', 'approach', 'architecture', 'contact', 'top']) assert.match(html, new RegExp(`id=["']${id}["']`));
for (const text of ['Диагностика', 'Получить карту трансформации', 'ИИ-консультант', 'hello@synapsemax.ru', 'Данные → интеллект → действие → результат.', 'ТРАНСФОРМАЦИЯ // ГОТОВА']) assert.ok(html.includes(text), `Missing production content: ${text}`);
for (const snippet of ['input.manualWork * .42 + input.dataFragmentation * .18 + input.errorRate * .22 + input.complexity * .18', '(100 - input.dataFragmentation) * .25 + (100 - input.manualWork) * .2 + (100 - input.errorRate) * .15 + input.complexity * .4', "localAutomationPotential >= 70 ? 'Высокий' : localAutomationPotential >= 45 ? 'Средний' : 'Низкий'"]) assert.ok(html.includes(snippet));
assert.match(html, /<html[^>]+lang=["']ru["']/i);
assert.match(html, /:focus-visible\s*\{/i);
assert.match(html, /prefers-reduced-motion\s*:\s*reduce/i);
for (const field of ['complexity', 'manualWork', 'dataFragmentation', 'errorRate']) {
  const explicit = new RegExp(`<label[^>]*for=["']${field}["']`, 'i');
  const wrapped = new RegExp(`<label[^>]*>[\\s\\S]{0,1200}<input[^>]*id=["']${field}["']`, 'i');
  assert.ok(explicit.test(html) || wrapped.test(html), `Missing accessible label association for ${field}`);
}
const hasFinePointerCss = /@media\s*\(\s*pointer\s*:\s*fine\s*\)/i.test(html);
const hasFinePointerJs = /matchMedia\(\s*['"]\(pointer:fine\)['"]\s*\)/i.test(html);
const hasCoarsePointerCss = /@media\s*\(\s*pointer\s*:\s*coarse\s*\)/i.test(html);
assert.ok(hasFinePointerCss || hasFinePointerJs);
assert.ok(hasCoarsePointerCss || hasFinePointerJs);
assert.match(html, /aria-(?:label|describedby|live|atomic)\s*=/i);
assert.match(html, /sm-footer/);
assert.match(html, /synapsemax-symbol\.png/);
assert.match(html, /synapsemax-wordmark\.png/);
assert.match(html, /Asset boundary: PASS|synapsemax-wordmark\.png/);
assert.ok(html.includes('profit-leakage-btn'));
assert.ok(html.includes('/api/v1/profit-leakage'));
assert.ok(html.includes('Сначала — где теряется прибыль'));
assert.match(workerSource, /request\.method === 'POST' && url\.pathname === '\/api\/v1\/profit-leakage'/);
assert.match(workerSource, /diagnoseProfitLeakage\(await request\.json\(\)\)/);

console.log('Immediate smoke + artifact + financial diagnostic contract: PASS');
