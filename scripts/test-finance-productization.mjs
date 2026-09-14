#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'dist/dex-immediate.html');
if (!existsSync(file)) throw new Error('Finance productization test: artifact missing');
const html = readFileSync(file, 'utf8');
for (const marker of ['SYNAPSEMAX_FINANCE_PRODUCTIZATION_V2','impact-error-recovery','impact-delay-recovery','impact-error-overlap','impact-delay-overlap','impact-error-delay-overlap','impact-evidence','impact-revenue','impact-margin','impact-capex','impact-opex','impact-annual-opex','finance-impact-button','finance-impact-scenarios','Action Map','marginUpliftPoints','recoverableErrorShare','recoverableDelayShare','oneTimeCapex','monthlyOpex','annualOpex']) {
  if (!html.includes(marker)) throw new Error('Finance productization test: missing ' + marker);
}
const scenarioMarkers = ['conservative', 'base', 'optimistic'].map((name) => `data-scenario="${name}"`);
for (const marker of scenarioMarkers) {
  if (!html.includes(marker)) throw new Error('Finance productization test: missing ' + marker);
}
if (!html.includes("fetch('/api/v1/profit-leakage'")) throw new Error('Finance productization test: API route missing');
console.log('Finance productization test: PASS');
