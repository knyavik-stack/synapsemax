#!/usr/bin/env node

/**
 * SynapseMax static-site build.
 *
 * Immediate is the current product-experience prototype. DEX v1-v3 and
 * index.html remain preserved as historical/regression baselines.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const required = ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html', 'dex-immediate.html', 'assets'];
const missing = required.filter((entry) => !existsSync(resolve(root, entry)));

if (missing.length) {
  console.error('SynapseMax static build: FAILED');
  console.error('Missing required source entries: ' + missing.join(', '));
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const file of ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html', 'dex-immediate.html']) {
  cpSync(resolve(root, file), resolve(dist, file));
}
cpSync(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true });

console.log('SynapseMax static build: PASS');
console.log('Current experience: dist/dex-immediate.html');
console.log('Historical baselines: dist/index.html, dist/dex-v1.html, dist/dex-v2.html, dist/dex-v3.html');
