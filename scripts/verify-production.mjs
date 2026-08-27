#!/usr/bin/env node

const base = (process.env.SYNAPSEMAX_PRODUCTION_URL || 'https://synapsemax.ru').replace(/\/$/, '');

async function check(path, init = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...init });
  const text = await response.text();
  return { response, text };
}

function require(condition, message) {
  if (!condition) throw new Error(message);
}

const root = await check('/');
require(root.response.status === 200, `Root status ${root.response.status}, expected 200`);
require(root.response.headers.get('content-type')?.includes('text/html'), 'Root must return HTML');
require(root.response.headers.get('location') === null, 'Root must not redirect');
require(root.response.headers.get('x-synapsemax-experience') === 'immediate', 'Root must be served by Immediate Worker experience');
require(root.response.headers.get('cache-control') === 'no-store', 'Root must use no-store');
for (const marker of ['Диагностика', 'hello@synapsemax.ru', 'sm-footer', 'Данные → интеллект → действие → результат']) {
  require(root.text.includes(marker), `Root missing production marker: ${marker}`);
}

const health = await check('/api/v1/health');
require(health.response.status === 200, `Health status ${health.response.status}`);
const healthJson = JSON.parse(health.text);
require(healthJson.ok === true && healthJson.service === 'synapsemax-immediate' && healthJson.version === 'h1', 'Health contract mismatch');

const assessment = await check('/api/v1/assessment', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ complexity: 80, manualWork: 70, dataFragmentation: 60, errorRate: 30 }),
});
require(assessment.response.status === 200, `Assessment status ${assessment.response.status}`);
const assessmentJson = JSON.parse(assessment.text);
require(assessmentJson.ok === true && assessmentJson.result?.score === 60, 'Assessment contract mismatch');

const roi = await check('/api/v1/roi', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ monthlyCost: 1000000, automationShare: 35, expectedEfficiency: 25, implementationCost: 1500000 }),
});
require(roi.response.status === 200, `ROI status ${roi.response.status}`);
const roiJson = JSON.parse(roi.text);
require(roiJson.ok === true && roiJson.result?.monthlySaving === 87500, 'ROI contract mismatch');

for (const [name, expected] of [
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
]) {
  require(root.response.headers.get(name) === expected, `Missing/incorrect ${name} security header`);
}

console.log(`Production smoke: PASS — ${base}`);
console.log('Root + health + assessment + ROI + security headers verified.');
