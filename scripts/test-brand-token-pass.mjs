import fs from 'node:fs';

const file = 'dist/index.html';
if (!fs.existsSync(file)) throw new Error('BRAND_TEST: dist/index.html missing');
const html = fs.readFileSync(file, 'utf8');

const required = [
  '--void-1:#0D1117',
  '--void-2:#1C2128',
  '#00D4FF',
  '#0066FF',
  '#8A2BFF',
  '#D100FF',
  'Orbitron',
  'Manrope',
];
for (const token of required) {
  if (!html.includes(token)) throw new Error(`BRAND_TEST: missing canonical token ${token}`);
}

if (html.includes('--violet')) throw new Error('BRAND_TEST: legacy --violet token remains in production artifact');
console.log('BRAND_TEST: canonical palette and typography markers verified');
