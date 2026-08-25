#!/usr/bin/env node

/**
 * SynapseMax static-site build.
 *
 * Cloudflare Workers Builds executes this command before Wrangler deployment.
 * We create a clean `dist/` deployment artifact so Wrangler always receives
 * an explicit, real assets directory instead of relying on the repository root.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const required = ['index.html', 'assets'];
const missing = required.filter((entry) => !existsSync(resolve(root, entry)));

if (missing.length > 0) {
  console.error('SynapseMax static build: FAILED');
  console.error(`Missing required source entries: ${missing.join(', ')}`);
  process.exit(1);
}

// Rebuild the deployment artifact from scratch to prevent stale files.
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'));
cpSync(resolve(root, 'assets'), resolve(dist, 'assets'), { recursive: true });

console.log('SynapseMax static build: PASS');
console.log('- output: ./dist');
console.log('- entry: ./dist/index.html');
console.log('- assets: ./dist/assets/');
