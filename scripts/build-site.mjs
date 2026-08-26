#!/usr/bin/env node

/**
 * SynapseMax H1 build. Immediate is the current product experience;
 * historical DEX files remain available for visual regression.
 *
 * Only runtime assets are copied to dist. Large brand/reference images stay
 * in the repository for design/QA work and must never inflate production.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const runtimeAssets = ['synapsemax-symbol.png', 'synapsemax-wordmark.png'];
const required = ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html', 'dex-immediate.html', 'assets'];
const missing = required.filter((entry) => !existsSync(resolve(root, entry)));
const missingAssets = runtimeAssets.filter((entry) => !existsSync(resolve(root, 'assets', entry)));
if (missing.length || missingAssets.length) {
  console.error('SynapseMax build: FAILED');
  if (missing.length) console.error('Missing: ' + missing.join(', '));
  if (missingAssets.length) console.error('Missing runtime assets: ' + missingAssets.join(', '));
  process.exit(1);
}

const footer = `
<footer class="sm-footer">
  <div class="sm-footer-grid">
    <div class="sm-footer-brand">
      <div class="sm-footer-logo"><img src="/assets/synapsemax-symbol.png" alt=""><img src="/assets/synapsemax-wordmark.png" alt="SynapseMax"></div>
      <p>Цифровая трансформация бизнеса через ИИ, данные и автоматизацию.</p>
      <span class="sm-footer-status"><i></i>ТРАНСФОРМАЦИЯ // ГОТОВА</span>
    </div>
    <div>
      <div class="sm-footer-label">Платформа</div>
      <a href="#assessment">Диагностика</a>
      <a href="#approach">Подход</a>
      <a href="#architecture">Архитектура</a>
      <a href="#contact">Начать трансформацию</a>
    </div>
    <div>
      <div class="sm-footer-label">Фокус</div>
      <span>Бизнес-процессы</span>
      <span>ИИ и автоматизация</span>
      <span>Данные и интеграции</span>
      <span>Governance и безопасность</span>
    </div>
    <div>
      <div class="sm-footer-label">Контакты</div>
      <a href="mailto:hello@synapsemax.ru">hello@synapsemax.ru</a>
      <span>Российские компании</span>
      <span>Интеллект трансформации</span>
    </div>
  </div>
  <div class="sm-footer-bottom">
    <span>© 2026 SynapseMax. Интеллектуальная платформа трансформации бизнеса.</span>
    <span>Данные → интеллект → действие → результат.</span>
  </div>
</footer>
<style>
/* Production brand normalization: canonical assets remain untouched; only their layout box is normalized. */
header .brand img:last-child{width:190px!important;height:auto!important;display:block!important;object-fit:contain!important}
.sm-footer{max-width:1240px;margin:0 auto;padding:0 0 34px;color:#74839a;font-size:12px}
.sm-footer-grid{border-top:1px solid rgba(111,167,255,.14);padding:38px 0 30px;display:grid;grid-template-columns:1.6fr 1fr 1.15fr 1fr;gap:34px}
.sm-footer-logo{display:flex;align-items:center;gap:10px;margin-bottom:16px}.sm-footer-logo img:first-child{width:30px;height:30px;flex:0 0 auto}.sm-footer-logo img:last-child{width:190px;height:auto;display:block;flex:0 0 auto;object-fit:contain}
.sm-footer-brand p{max-width:330px;color:#8d9bb0;line-height:1.7;margin:0 0 16px}.sm-footer-status{font:600 9px/1.4 Orbitron,sans-serif;letter-spacing:.08em;color:#63738a}.sm-footer-status i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#55f5c0;box-shadow:0 0 10px rgba(85,245,192,.7);margin-right:7px}
.sm-footer-label{font:700 10px/1.4 Orbitron,sans-serif;letter-spacing:.14em;color:#b8c6d9;text-transform:uppercase;margin-bottom:13px}.sm-footer a,.sm-footer-grid span{display:block;color:#7d8ca1;margin:0 0 10px}.sm-footer a:hover{color:#e9f5ff}.sm-footer-bottom{border-top:1px solid rgba(111,167,255,.09);padding-top:17px;display:flex;justify-content:space-between;gap:20px;color:#617087;font-size:10px;line-height:1.5}
@media(max-width:760px){header .brand img:last-child{width:175px!important}.sm-footer{width:calc(100% - 30px)}.sm-footer-grid{grid-template-columns:1fr 1fr;gap:28px}.sm-footer-brand{grid-column:1/-1}.sm-footer-logo img:last-child{width:175px}.sm-footer-bottom{flex-direction:column;gap:6px}}
@media(max-width:480px){header .brand img:last-child{width:165px!important}.sm-footer-grid{grid-template-columns:1fr}.sm-footer-brand{grid-column:auto}.sm-footer{padding-bottom:24px}.sm-footer-logo img:first-child{width:28px;height:28px}.sm-footer-logo img:last-child{width:165px}.sm-footer-bottom{line-height:1.6}}
</style>
<script>
(() => {
  const cursor = document.querySelector('.cursor-dot');
  if (!cursor || !window.matchMedia('(pointer:fine)').matches || window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const interactive = 'a,button,input';
  document.addEventListener('pointerover', e => { if (e.target.closest(interactive)) cursor.classList.add('is-hover'); }, { passive: true });
  document.addEventListener('pointerout', e => { if (e.target.closest(interactive) && !e.relatedTarget?.closest?.(interactive)) cursor.classList.remove('is-hover'); }, { passive: true });
})();
</script>`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(resolve(dist, 'assets'), { recursive: true });
for (const file of ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html']) {
  cpSync(resolve(root, file), resolve(dist, file));
}

const immediateSource = readFileSync(resolve(root, 'dex-immediate.html'), 'utf8');
const immediate = immediateSource.replace(/<footer[\s\S]*?<\/footer>/i, footer);
if (immediate === immediateSource) {
  console.error('SynapseMax build: FAILED');
  console.error('dex-immediate.html does not contain a footer placeholder');
  process.exit(1);
}
writeFileSync(resolve(dist, 'dex-immediate.html'), immediate);

for (const file of runtimeAssets) {
  cpSync(resolve(root, 'assets', file), resolve(dist, 'assets', file));
}
console.log('SynapseMax build: PASS');
console.log('Current experience: dist/dex-immediate.html');
console.log('Immediate footer: materialized');
console.log('Runtime assets: ' + runtimeAssets.join(', '));
