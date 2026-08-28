#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'dist', 'index.html');
const target = resolve(root, 'dist', 'dex-immediate.html');

if (!existsSync(source) || !existsSync(target)) throw new Error('Immediate build inputs are missing');

const sourceHtml = readFileSync(source, 'utf8');
const targetHtml = readFileSync(target, 'utf8');

// Extract the complete authoritative runtime by its unique ownership marker.
// Do not depend on formatting around the boot function: the served artifact
// must remain stable if harmless source formatting changes.
const runtimeMatch = sourceHtml.match(/<script>[\s\S]*?window\.__SYNAPSEMAX_RUNTIME__\s*=\s*true;[\s\S]*?<\/script>/i);
if (!runtimeMatch) throw new Error('Authoritative Immediate runtime not found in build output');
const runtime = runtimeMatch[0];

// Remove any existing authoritative runtime from the served page, then append
// exactly the runtime produced by the authoritative build owner.
const cleaned = targetHtml.replace(/<script>[\s\S]*?window\.__SYNAPSEMAX_RUNTIME__\s*=\s*true;[\s\S]*?<\/script>/gi, '');
const materialized = cleaned.replace(/<\/body>/i, `${runtime}\n</body>`);

const marker = 'window.__SYNAPSEMAX_RUNTIME__ = true;';
const markerCount = materialized.split(marker).length - 1;
if (markerCount !== 1) throw new Error(`Immediate runtime materialization invariant failed: ${markerCount} runtime owners`);

if (!materialized.includes("document.querySelector('#assessment .form')")) {
  throw new Error('Immediate runtime materialization invariant failed: assessment form selector missing');
}
if (!materialized.includes("fetch('/api/v1/assessment'")) {
  throw new Error('Immediate runtime materialization invariant failed: assessment endpoint missing');
}
if (!materialized.includes("fetch('/api/v1/roi'")) {
  throw new Error('Immediate runtime materialization invariant failed: ROI endpoint missing');
}
if (!materialized.includes('report.hidden = false') || !materialized.includes("report.removeAttribute('hidden')")) {
  throw new Error('Immediate runtime materialization invariant failed: result visibility contract missing');
}

writeFileSync(target, materialized);
console.log('Immediate runtime materialization: PASS');
