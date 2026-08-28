#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const buildScript = resolve(root, 'scripts', 'build-site.mjs');
const target = resolve(root, 'dist', 'dex-immediate.html');

if (!existsSync(buildScript) || !existsSync(target)) throw new Error('Immediate build inputs are missing');

const buildSource = readFileSync(buildScript, 'utf8');
const targetHtml = readFileSync(target, 'utf8');

// build-site.mjs owns the authoritative runtime. Extract the template by the
// declaration boundary rather than depending on whitespace or line endings.
const marker = 'const assessmentRuntime = `';
const start = buildSource.indexOf(marker);
const nextDeclaration = buildSource.indexOf('const injectRuntime', start + marker.length);
if (start < 0 || nextDeclaration < 0) throw new Error('Authoritative Immediate runtime source not found');
const bodyStart = start + marker.length;
const end = buildSource.lastIndexOf('`', nextDeclaration);
if (end < bodyStart) throw new Error('Authoritative Immediate runtime source terminator not found');
const runtime = buildSource.slice(bodyStart, end);

const ownerMarker = 'window.__SYNAPSEMAX_RUNTIME__ = true;';
if (!runtime.includes(ownerMarker)) throw new Error('Authoritative Immediate runtime marker missing');

const cleaned = targetHtml.replace(/<script>[\s\S]*?window\.__SYNAPSEMAX_RUNTIME__\s*=\s*true;[\s\S]*?<\/script>/gi, '');
const materialized = cleaned.replace(/<\/body>/i, `${runtime}\n</body>`);
const ownerCount = materialized.split(ownerMarker).length - 1;
if (ownerCount !== 1) throw new Error(`Immediate runtime materialization invariant failed: ${ownerCount} runtime owners`);
if (!materialized.includes("document.querySelector('#assessment .form')")) throw new Error('Assessment selector invariant failed');
if (!materialized.includes("fetch('/api/v1/assessment'")) throw new Error('Assessment endpoint invariant failed');
if (!materialized.includes("fetch('/api/v1/roi'")) throw new Error('ROI endpoint invariant failed');
if (!materialized.includes('report.hidden = false') || !materialized.includes("report.removeAttribute('hidden')")) throw new Error('Result visibility invariant failed');

writeFileSync(target, materialized);
console.log('Immediate runtime materialization: PASS');
