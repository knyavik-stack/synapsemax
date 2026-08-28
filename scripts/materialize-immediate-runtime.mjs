#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const buildScript = resolve(root, 'scripts', 'build-site.mjs');
const target = resolve(root, 'dist', 'dex-immediate.html');

if (!existsSync(buildScript) || !existsSync(target)) {
  throw new Error('Immediate build inputs are missing');
}

const buildSource = readFileSync(buildScript, 'utf8');
const targetHtml = readFileSync(target, 'utf8');

// build-site.mjs is the single source of truth for the Immediate runtime.
// Read that exact template instead of trying to infer it from another page's
// output. This keeps /dex-immediate on the same runtime as the canonical build.
const marker = 'const assessmentRuntime = `';
const start = buildSource.indexOf(marker);
if (start < 0) throw new Error('Authoritative Immediate runtime source not found');
const bodyStart = start + marker.length;
const end = buildSource.indexOf('`;\n\nconst injectRuntime', bodyStart);
if (end < 0) throw new Error('Authoritative Immediate runtime source terminator not found');
const runtime = buildSource.slice(bodyStart, end);

if (!runtime.includes('window.__SYNAPSEMAX_RUNTIME__ = true;')) {
  throw new Error('Authoritative Immediate runtime marker missing');
}

// Remove any previously materialized owner and install exactly one copy.
const cleaned = targetHtml.replace(/<script>[\s\S]*?window\.__SYNAPSEMAX_RUNTIME__\s*=\s*true;[\s\S]*?<\/script>/gi, '');
const materialized = cleaned.replace(/<\/body>/i, `${runtime}\n</body>`);

const ownerMarker = 'window.__SYNAPSEMAX_RUNTIME__ = true;';
const ownerCount = materialized.split(ownerMarker).length - 1;
if (ownerCount !== 1) throw new Error(`Immediate runtime materialization invariant failed: ${ownerCount} runtime owners`);
if (!materialized.includes("document.querySelector('#assessment .form')")) throw new Error('Assessment selector invariant failed');
if (!materialized.includes("fetch('/api/v1/assessment'")) throw new Error('Assessment endpoint invariant failed');
if (!materialized.includes("fetch('/api/v1/roi'")) throw new Error('ROI endpoint invariant failed');
if (!materialized.includes('report.hidden = false') || !materialized.includes("report.removeAttribute('hidden')")) throw new Error('Result visibility invariant failed');

writeFileSync(target, materialized);
console.log('Immediate runtime materialization: PASS');
