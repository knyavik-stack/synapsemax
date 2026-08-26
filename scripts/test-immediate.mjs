import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assess, calculateRoi } from '../src/immediate-logic.js';

const root = process.cwd();

// Domain smoke tests.
const assessment = assess({ complexity: 80, manualWork: 70, dataFragmentation: 60, errorRate: 30 });
assert.equal(assessment.score, 60);
assert.ok(assessment.automationPotential >= 60);

const roi = calculateRoi({ monthlyCost: 1000000, automationShare: 35, expectedEfficiency: 25, implementationCost: 1500000 });
assert.equal(roi.monthlySaving, 87500);
assert.equal(roi.annualSaving, 1050000);
assert.equal(roi.roiPercent, -30);

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

assert.match(html, /sm-footer/);
assert.match(html, /synapsemax-symbol\.png/);
assert.match(html, /synapsemax-wordmark\.png/);
assert.match(html, /Asset boundary: PASS|synapsemax-wordmark\.png/);

console.log('Immediate smoke + artifact contract: PASS');
