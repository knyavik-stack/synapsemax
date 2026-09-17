#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'auth.html');
const dist = resolve(root, 'dist');
if (!existsSync(source)) throw new Error('Auth build: auth.html is missing');
mkdirSync(dist, { recursive: true });
copyFileSync(source, resolve(dist, 'auth.html'));
console.log('[SynapseMax] auth.html -> dist/auth.html');
