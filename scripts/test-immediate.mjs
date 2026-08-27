import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assess, calculateRoi } from '../src/immediate-logic.js';

const root = process.cwd();

// Domain smoke tests.
const assessment = assess({ complexity: 80, manualWork: 70, dataFragmentation: 60, errorRate: 30 });
assert.equal(assessment.score, 60);
assert.ok(assessment.automationPotential >= 60);

// Boundary behavior: user-entered scores must stay deterministic and bounded.
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

// ROI boundaries: clamp user inputs and avoid division-by-zero failures.
const roiBounded = calculateRoi({ monthlyCost: -1, automationShare: 200, expectedEfficiency: 200, implementationCost: 0 });
assert.deepEqual(roiBounded, { monthlySaving: 0, annualSaving: 0, roiPercent: 0, paybackMonths: null });

const roiZeroSaving = calculateRoi({ monthlyCost: 100000, automationShare: 0, expectedEfficiency: 25, implementationCost: 500000 });
assert.equal(roiZeroSaving.monthlySaving, 0);
assert.equal(roiZeroSaving.annualSaving, 0);
assert.equal(roiZeroSaving.roiPercent, -100);
// No savings means payback is undefined, not zero months.
assert.equal(roiZeroSaving.paybackMonths, null);

// Production artifact contract. Build first, then validate the actual dist output.
const artifact = resolve(root, 'dist/dex-immediate.html');
assert.ok(existsSync(artifact), 'dist/dex-immediate.html must exist; run npm run build first');
const html = readFileSync(artifact, 'utf8');

for (const id of ['assessment', 'approach', 'architecture', 'contact', 'top']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Missing anchor #${id}`);
}
for (const text of [
  'Диагностика',
  'Получить карту трансформации',
  'ИИ-консультант',
  'hello@synapsemax.ru',
  'Данные → интеллект → действие → результат.',
  'ТРАНСФОРМАЦИЯ // ГОТОВА'
]) {
  assert.ok(html.includes(text), `Missing production content: ${text}`);
}

// Static UX/accessibility contract: cheap checks that belong in every CI run.
assert.match(html, /<html[^>]+lang=["']ru["']/i, 'Document language must be Russian');
assert.match(html, /:focus-visible\s*\{/i, 'Keyboard focus-visible contract missing');
assert.match(html, /prefers-reduced-motion\s*:\s*reduce/i, 'Reduced-motion contract missing');

// Accept both valid native label associations: explicit for/id or a wrapping label.
for (const field of ['complexity', 'manualWork', 'dataFragmentation', 'errorRate']) {
  const explicit = new RegExp(`<label[^>]*for=["']${field}["']`, 'i');
  const wrapped = new RegExp(`<label[^>]*>[\\s\\S]{0,1200}<input[^>]*id=["']${field}["']`, 'i');
  assert.ok(explicit.test(html) || wrapped.test(html), `Missing accessible label association for ${field}`);
}
assert.match(html, /@media\s*\(\s*pointer\s*:\s*fine\s*\)/i, 'Fine-pointer boundary missing for pointer enhancement');
assert.match(html, /aria-(?:label|describedby|live|atomic)\s*=/i, 'No ARIA attribute found in production artifact');

assert.match(html, /sm-footer/);
assert.match(html, /synapsemax-symbol\.png/);
assert.match(html, /synapsemax-wordmark\.png/);
assert.match(html, /Asset boundary: PASS|synapsemax-wordmark\.png/);

console.log('Immediate smoke + artifact + static UX contract: PASS');
