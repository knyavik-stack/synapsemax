#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The H1 runtime is materialized by scripts/build-site.mjs.
 * This step is intentionally validation-only: it must never replace the
 * build-owned handler with a second implementation.
 */
const file = resolve(process.cwd(), 'dist', 'dex-immediate.html');
if (!existsSync(file)) throw new Error('dist/dex-immediate.html is missing');

const html = readFileSync(file, 'utf8');
const required = [
  'window.__SYNAPSEMAX_RUNTIME__ = true;',
  "document.querySelector('#assessment .form')",
  "fetch('/api/v1/assessment'",
  "fetch('/api/v1/roi'",
  'const fields = [\'complexity\', \'manualWork\', \'dataFragmentation\', \'errorRate\'];',
  'id="complexity"',
  'id="manualWork"',
  'id="dataFragmentation"',
  'id="errorRate"',
];

const missing = required.filter((token) => !html.includes(token));
if (missing.length) {
  throw new Error(`Authoritative H1 runtime validation failed; missing: ${missing.join(' | ')}`);
}

const marker = 'window.__SYNAPSEMAX_RUNTIME__ = true;';
const markerCount = html.split(marker).length - 1;
if (markerCount !== 1) {
  throw new Error(`Expected exactly one authoritative runtime assignment, found ${markerCount}`);
}

const assessmentEndpointCount = (html.match(/fetch\('\/api\/v1\/assessment'/g) || []).length;
const roiEndpointCount = (html.match(/fetch\('\/api\/v1\/roi'/g) || []).length;
if (assessmentEndpointCount !== 1 || roiEndpointCount !== 1) {
  throw new Error(`Expected one assessment and one ROI client endpoint; found assessment=${assessmentEndpointCount}, roi=${roiEndpointCount}`);
}

console.log('Immediate runtime validation: PASS');
console.log('Runtime owner: scripts/build-site.mjs');
console.log('No post-build runtime mutation performed.');
