#!/usr/bin/env node

/**
 * SynapseMax H1 build. Immediate is the current product experience;
 * historical DEX files remain available for visual regression.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const dist = resolve(root, 'dist');
const required = ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html', 'dex-immediate.html', 'assets'];
const missing = required.filter((entry) => !existsSync(resolve(root, entry)));
if (missing.length) { console.error('SynapseMax build: FAILED'); console.error('Missing: ' + missing.join(', ')); process.exit(1); }
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const file of ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html', 'dex-immediate.html']) cpSync(resolve(root, file), resolve(dist, file));
cpSync(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true });
console.log('SynapseMax build: PASS');
console.log('Current experience: dist/dex-immediate.html');
