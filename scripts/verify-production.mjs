#!/usr/bin/env node

const base = (process.env.SYNAPSEMAX_PRODUCTION_URL || 'https://synapsemax.ru').replace(/\/$/, '');
const expectedRelease = process.env.SYNAPSEMAX_EXPECTED_RELEASE || null;

async function check(path, init = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', ...init });
  const text = await response.text();
  return { response, text };
}

function require(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForProductionRelease() {
  if (!expectedRelease) return;

  const maxAttempts = 40;
  const intervalMs = 15000;
  let lastRelease = 'unavailable';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const version = await check('/__synapsemax/version');
    if (version.response.status === 200) {
      try {
        const versionJson = JSON.parse(version.text);
        lastRelease = versionJson.release || 'missing';
        if (lastRelease === expectedRelease) {
          console.log(`Production release converged: ${expectedRelease} (attempt ${attempt}/${maxAttempts})`);
          return;
        }
      } catch {
        lastRelease = 'invalid-json';
      }
    } else {
      lastRelease = `HTTP ${version.response.status}`;
    }

    if (attempt < maxAttempts) {
      console.log(`Waiting for production release ${expectedRelease}; observed ${lastRelease} (attempt ${attempt}/${maxAttempts})`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Production release did not converge to ${expectedRelease} within 10 minutes; last observed release: ${lastRelease}`);
}

await waitForProductionRelease();

const root = await check('/');
require(root.response.status === 200, `Root status ${root.response.status}, expected 200`);
require(root.response.headers.get('content-type')?.includes('text/html'), 'Root must return HTML');
require(root.response.headers.get('location') === null, 'Root must not redirect');
require(root.response.headers.get('x-synapsemax-experience') === 'immediate', 'Root must be served by Immediate Worker experience');
require(root.response.headers.get('cache-control') === 'no-store', 'Root must use no-store');
for (const marker of ['Диагностика', 'hello@synapsemax.ru', 'sm-footer', 'Данные → интеллект → действие → результат']) {
  require(root.text.includes(marker), `Root missing production marker: ${marker}`);
}

const portal = await check('/portal.html');
require(portal.response.status === 200, `Portal status ${portal.response.status}`);
require(portal.response.headers.get('content-type')?.includes('text/html'), 'Portal must return HTML');
require(portal.text.includes('Финансовый контур'), 'Portal marker missing');

const auth = await check('/auth.html');
require(auth.response.status === 200, `Auth status ${auth.response.status}`);
require(auth.response.headers.get('content-type')?.includes('text/html'), 'Auth must return HTML');
require(auth.text.includes('Neon Auth / production smoke test'), 'Auth marker missing');

const health = await check('/api/v1/health');
require(health.response.status === 200, `Health status ${health.response.status}`);
const healthJson = JSON.parse(health.text);
if (expectedRelease) require(healthJson.release === expectedRelease, `Health release ${healthJson.release}, expected ${expectedRelease}`);

const version = await check('/__synapsemax/version');
require(version.response.status === 200, `Version status ${version.response.status}`);
const versionJson = JSON.parse(version.text);
require(versionJson.ok === true && versionJson.release && versionJson.rlsSmoke === versionJson.release, 'Version contract mismatch');

const rlsSmoke = await check('/rls-smoke.html');
require(rlsSmoke.response.status === 200, `RLS smoke status ${rlsSmoke.response.status}`);
require(rlsSmoke.response.headers.get('cache-control')?.includes('no-store'), 'RLS smoke must use no-store');
require(rlsSmoke.response.headers.get('x-synapsemax-rls-smoke') === versionJson.release, 'RLS smoke revision header mismatch');
require(rlsSmoke.text.includes(versionJson.release), 'RLS smoke asset revision mismatch');
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
console.log('Root + health + version + RLS smoke delivery + assessment + ROI + security headers verified.');
