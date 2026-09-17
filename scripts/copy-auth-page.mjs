#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
mkdirSync(dist, { recursive: true });

for (const file of ['auth.html', 'rls-smoke.html']) {
  const source = resolve(root, file);
  if (!existsSync(source)) throw new Error(`Auth build: ${file} is missing`);
  copyFileSync(source, resolve(dist, file));
  console.log(`[SynapseMax] ${file} -> dist/${file}`);
}
