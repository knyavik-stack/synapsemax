#!/usr/bin/env node

/**
 * SynapseMax static-site build guard.
 *
 * Cloudflare Workers Builds runs this command before Wrangler deployment.
 * The current site is intentionally deployed from the repository root with
 * `.assetsignore` defining the public boundary, so this script does not copy
 * files into a temporary `public/` directory.
 *
 * Its job is to fail early when the deployable frontend is incomplete.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const required = [
  'index.html',
  'assets',
];

const missing = required.filter((entry) => !existsSync(resolve(root, entry)));

if (missing.length > 0) {
  console.error('SynapseMax static build: FAILED');
  console.error(`Missing required deployment entries: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('SynapseMax static build: PASS');
console.log('- entry: ./index.html');
console.log('- assets: ./assets/');
console.log('- deployment boundary: .assetsignore');
