#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = resolve(root, 'dist', 'index.html');
const target = resolve(root, 'dist', 'dex-immediate.html');

if (!existsSync(source) || !existsSync(target)) throw new Error('Immediate build inputs are missing');

const sourceHtml = readFileSync(source, 'utf8');
const targetHtml = readFileSync(target, 'utf8');

const runtimeMatch = sourceHtml.match(/<script>\s*\(\(\) => \{\s*const boot = \(\) => \{/i);
if (!runtimeMatch) throw new Error('Authoritative Immediate runtime not found in build output');
const start = runtimeMatch.index;
const end = sourceHtml.indexOf('</script>', start);
if (end < 0) throw new Error('Authoritative Immediate runtime script is incomplete');
const runtime = sourceHtml.slice(start, end + '</script>'.length);

const stripped = targetHtml.replace(/<script>\s*\(\(\) => \{\s*const boot = \(\) => \{/gi, (match, offset, whole) => {
  const scriptEnd = whole.indexOf('</script>', offset);
  return scriptEnd < 0 ? match : '';
});
const cleaned = stripped.replace(/<script>\s*\(\(\) => \{[\s\S]*?window\.__SYNAPSEMAX_RUNTIME__\s*=\s*true;[\s\S]*?<\/script>/gi, '');
const materialized = cleaned.replace(/<\/body>/i, `${runtime}\n</body>`);

if ((materialized.match(/window\.__SYNAPSEMAX_RUNTIME__\s*=\s*true;/g) || []).length !== 1) {
  throw new Error('Immediate runtime materialization invariant failed');
}
writeFileSync(target, materialized);
console.log('Immediate runtime materialization: PASS');
