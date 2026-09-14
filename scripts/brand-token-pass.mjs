import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('dist/index.html');
if (!fs.existsSync(file)) throw new Error('BRAND_TOKEN_PASS: dist/index.html missing');

let html = fs.readFileSync(file, 'utf8');
const replacements = new Map([
  ['#02040b', '#0D1117'],
  ['#050916', '#1C2128'],
  ['#00d7ff', '#00D4FF'],
  ['#1970ff', '#0066FF'],
  ['#8a2cff', '#8A2BFF'],
  ['#d744ff', '#D100FF'],
  ['#8a2cff', '#8A2BFF'],
]);
for (const [from, to] of replacements) html = html.split(from).join(to);

// Make the Master Spec palette explicit without forcing a source rewrite during this transitional build phase.
html = html.replace(
  /:root\{\n  --bg:/,
  ':root{\n  --void-1:#0D1117; --void-2:#1C2128; --purple:#8A2BFF;\n  --bg:'
);

fs.writeFileSync(file, html);
console.log('BRAND_TOKEN_PASS: canonical Master Spec palette applied to production artifact');
