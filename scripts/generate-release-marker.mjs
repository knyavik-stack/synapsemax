import { writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

function detectCommit() {
  return process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || (() => {
    try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { return 'local'; }
  })();
}

const commit = detectCommit();
await writeFile('src/release.generated.js', `export const RELEASE = ${JSON.stringify(commit)};\n`);
console.log(`SynapseMax release marker: ${commit}`);
