import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

function detectCommit() {
  return process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || (() => {
    try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { return 'local'; }
  })();
}

const commit = detectCommit();
const target = 'src/release.generated.js';
const content = `export const RELEASE = ${JSON.stringify(commit)};\n`;

let current = null;
try {
  current = await readFile(target, 'utf8');
} catch {
  // The generated marker may not exist on a clean checkout.
}

if (current !== content) {
  await writeFile(target, content);
}

console.log(`SynapseMax release marker: ${commit}`);
