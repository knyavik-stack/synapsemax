#!/usr/bin/env node

/**
 * SynapseMax static-site build.
 * DEX v3 is the current experience prototype. Older versions remain
 * available for visual regression comparison.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const required = ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html', 'assets'];
const missing = required.filter((entry) => !existsSync(resolve(root, entry)));

if (missing.length) {
  console.error('SynapseMax static build: FAILED');
  console.error('Missing required source entries: ' + missing.join(', '));
  process.exit(1);
}

// Always rebuild dist from scratch so stale deployment files cannot survive.
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const file of ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html']) {
  cpSync(resolve(root, file), resolve(dist, file));
}
cpSync(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true });

console.log('SynapseMax static build: PASS');
console.log('Current experience: dist/dex-v3.html');
console.log('Accepted baseline: dist/index.html');
console.log('Previous DEX versions retained for comparison.');
