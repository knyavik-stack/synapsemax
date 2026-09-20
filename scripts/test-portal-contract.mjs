import fs from 'node:fs';

const index = fs.readFileSync('src/index.js', 'utf8');
const portal = fs.readFileSync('portal.html', 'utf8');

const requiredIndex = [
  "const NEON_DATA_API_URL = 'https://ep-lively-bread-b1ewktwx.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1';",
  "if (!authorization ||",
  "Bearer\\s+\\S+$",
  "Prefer: 'count=exact'",
  'scenario=eq.base',
  'annual_net_value',
  'margin_uplift_points',
  'evidence_quality',
  '/api/v1/portal/funnel',
  'commercial_funnel_events',
];

for (const fragment of requiredIndex) {
  if (!index.includes(fragment)) throw new Error(`portal API contract missing: ${fragment}`);
}

for (const fragment of ['annualNetValue', 'marginUpliftPoints', 'evidenceQuality', 'tenant-scoped diagnostic results', "track('portal_view')"]) {
  if (!portal.includes(fragment)) throw new Error(`portal UI contract missing: ${fragment}`);
}

console.log('PORTAL CONTRACT: PASS');
