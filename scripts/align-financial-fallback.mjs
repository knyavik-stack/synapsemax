#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const artifact = resolve(process.cwd(), 'dist/dex-immediate.html');
const html = readFileSync(artifact, 'utf8');

const legacy = `const manualLeakage = input.monthlyLaborCost * input.manualWorkShare / 100;\n        const recoverableManualLeakage = manualLeakage * input.recoverableManualShare / 100;\n        const fallback = {\n          totalMonthlyLeakage: Math.round(manualLeakage + input.monthlyErrorCost + input.monthlyDelayCost),\n          recoverableMonthlyValue: Math.round(recoverableManualLeakage + input.monthlyErrorCost + input.monthlyDelayCost),\n          annualRecoverableValue: Math.round((recoverableManualLeakage + input.monthlyErrorCost + input.monthlyDelayCost) * 12)\n        };`;

const aligned = `const manualLeakage = input.monthlyLaborCost * input.manualWorkShare / 100;\n        const recoverableManualLeakage = manualLeakage * input.recoverableManualShare / 100;\n        // The public UI does not collect evidence for error/delay recoverability.\n        // Keep the fallback conservative and identical to the domain defaults: 0%.\n        const recoverableErrorShare = 0;\n        const recoverableDelayShare = 0;\n        const recoverableErrorLeakage = input.monthlyErrorCost * recoverableErrorShare / 100;\n        const recoverableDelayLeakage = input.monthlyDelayCost * recoverableDelayShare / 100;\n        const fallback = {\n          totalMonthlyLeakage: Math.round(manualLeakage + input.monthlyErrorCost + input.monthlyDelayCost),\n          recoverableMonthlyValue: Math.round(recoverableManualLeakage + recoverableErrorLeakage + recoverableDelayLeakage),\n          annualRecoverableValue: Math.round((recoverableManualLeakage + recoverableErrorLeakage + recoverableDelayLeakage) * 12)\n        };`;

if (!html.includes(legacy)) {
  if (html.includes('const recoverableErrorShare = 0;') && html.includes('const recoverableDelayShare = 0;')) {
    console.log('Financial fallback contract: already aligned');
    process.exit(0);
  }
  console.error('Financial fallback contract: legacy block not found');
  process.exit(1);
}

writeFileSync(artifact, html.replace(legacy, aligned));
console.log('Financial fallback contract: aligned');
