#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'dist/dex-immediate.html');
let html = readFileSync(file, 'utf8');

const bridge = `<script data-synapsemax="assessment-submit-bridge">
(() => {
  const boot = () => {
    const container = document.querySelector('#assessment .form');
    if (!container || container instanceof HTMLFormElement) return;
    const button = container.querySelector('button[type="submit"], button');
    if (!button || button.dataset.smSubmitBridge === '1') return;
    button.dataset.smSubmitBridge = '1';
    const submit = () => {
      if (button.disabled) return;
      container.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    };
    button.addEventListener('click', submit);
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        submit();
      }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
</script>`;

if (html.includes('data-synapsemax="assessment-submit-bridge"')) process.exit(0);
if (!html.includes('window.__SYNAPSEMAX_RUNTIME__')) {
  console.error('Assessment bridge: FAILED — authoritative runtime missing');
  process.exit(1);
}
if (!html.includes('<form class="form" id="assessment-form">')) {
  console.error('Assessment bridge: FAILED — assessment container missing');
  process.exit(1);
}
html = html.replace(/<\/body>/i, `${bridge}\n</body>`);
writeFileSync(file, html);
console.log('Assessment submit bridge: PASS');
