#!/usr/bin/env node

/**
 * SynapseMax production build.
 * Immediate is the current experience; historical DEX files remain available
 * for regression work. Runtime output is deliberately kept small.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const runtimeAssets = ['synapsemax-symbol.png', 'synapsemax-wordmark.png'];
const pages = ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html', 'dex-immediate.html'];

const missing = pages.filter((file) => !existsSync(resolve(root, file)));
const missingAssets = runtimeAssets.filter((file) => !existsSync(resolve(root, 'assets', file)));
if (missing.length || missingAssets.length) {
  console.error('SynapseMax build: FAILED');
  if (missing.length) console.error('Missing: ' + missing.join(', '));
  if (missingAssets.length) console.error('Missing runtime assets: ' + missingAssets.join(', '));
  process.exit(1);
}

/*
 * The footer is materialized during build so the production page has one
 * canonical brand/footer implementation. Keep brand assets untouched.
 */
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
/* Brand normalization: never redraw or alter the canonical wordmark asset. */
header .brand img:last-child{width:190px!important;height:auto!important;display:block!important;object-fit:contain!important}
/* H1 accessibility baseline: preserve a visible keyboard focus indicator. */
:where(a,button,input,select,textarea):focus-visible{outline:2px solid #00e1ff;outline-offset:3px}
.sm-footer{max-width:1240px;margin:0 auto;padding:0 0 34px;color:#74839a;font-size:12px}
.sm-footer-grid{border-top:1px solid rgba(111,167,255,.14);padding:38px 0 30px;display:grid;grid-template-columns:1.6fr 1fr 1.15fr 1fr;gap:34px}
.sm-footer-logo{display:flex;align-items:center;gap:10px;margin-bottom:16px}.sm-footer-logo img:first-child{width:30px;height:30px;flex:0 0 auto}.sm-footer-logo img:last-child{width:190px;height:auto;display:block;flex:0 0 auto;object-fit:contain}
.sm-footer-brand p{max-width:330px;color:#8d9bb0;line-height:1.7;margin:0 0 16px}.sm-footer-status{font:600 9px/1.4 Orbitron,sans-serif;letter-spacing:.08em;color:#63738a}.sm-footer-status i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#55f5c0;box-shadow:0 0 10px rgba(85,245,192,.7);margin-right:7px}
.sm-footer-label{font:700 10px/1.4 Orbitron,sans-serif;letter-spacing:.14em;color:#b8c6d9;text-transform:uppercase;margin-bottom:13px}.sm-footer a,.sm-footer-grid span{display:block;color:#7d8ca1;margin:0 0 10px}.sm-footer a:hover{color:#e9f5ff}.sm-footer-bottom{border-top:1px solid rgba(111,167,255,.09);padding-top:17px;display:flex;justify-content:space-between;gap:20px;color:#617087;font-size:10px;line-height:1.5}
/* Responsive density: reduce empty space instead of shrinking content. */
@media(max-width:1100px){.wrap{width:min(1160px,calc(100% - 36px))}.navlinks{gap:20px;font-size:14px}.hero{padding-bottom:44px}section{padding-top:54px}.section-head{gap:28px}.solution{min-height:250px}.layer{min-height:150px}}
@media(max-width:760px){header .brand img:last-child{width:175px!important}.navlinks{font-size:14px;gap:18px}.navlinks a{padding:11px 0}.sm-footer{width:calc(100% - 30px)}.sm-footer-grid{grid-template-columns:1fr 1fr;gap:28px}.sm-footer-brand{grid-column:1/-1}.sm-footer-logo img:last-child{width:175px}.sm-footer-bottom{flex-direction:column;gap:6px}section{padding-top:46px}.section-head{margin-bottom:16px}.copy,.assess-copy,.form,.report,.roi-box,.process{padding:24px}.solution{padding:22px}.layer{padding:18px;min-height:0}.layer p{font-size:13px;line-height:1.55}.field label{font-size:11px}.field input{min-height:46px}.form button,.roi-box .btn{margin-top:24px;min-height:46px}}
@media(max-width:560px){header .brand img:last-child{width:165px!important}.wrap{width:calc(100% - 30px)}.form-grid,.flow,.architecture,.report-grid{grid-template-columns:1fr}.process-row{grid-template-columns:1fr}.connector{transform:rotate(90deg);margin:2px 0}.tele{display:none}.hero{min-height:auto;padding-top:105px;padding-bottom:24px}.hero-visual{height:310px}.hero-visual img{width:245px}.orb{width:300px;height:300px}.halo{width:290px;height:290px}section{padding:34px 0 0}.section-head{gap:10px;margin-bottom:14px}.section-head h2{font-size:30px}.section-head p{font-size:14px;line-height:1.6}.lead{font-size:16px;line-height:1.6}.actions{margin:20px 0}.brand img:first-child{width:28px;height:28px}.brand img:last-child{width:154px}.form button,.roi-box .btn{width:100%;margin-top:26px}.assessment .assess-copy,.assessment .form,.assessment .report,.roi-box{padding:22px}.architecture .layer{min-height:0;padding:18px}.architecture .layer b{font-size:13px}.architecture .layer p{font-size:13px;line-height:1.55}.solutions .solution{padding:20px;min-height:0}.stage{min-height:0;padding:18px}.stage h3{font-size:17px}.stage p{font-size:13px}.cta{margin:42px 0 18px;padding:30px 22px}.sm-footer-grid{grid-template-columns:1fr;gap:22px}.sm-footer-brand{grid-column:auto}.sm-footer{padding-bottom:24px}.sm-footer-logo img:first-child{width:28px;height:28px}.sm-footer-logo img:last-child{width:165px}.sm-footer-bottom{line-height:1.6}.navlinks{font-size:14px}}
/* Cursor state was previously wired in JS but had no visual hover rule. */
.cursor-dot.is-hover{width:26px!important;height:26px!important;border-color:rgba(0,225,255,.95)!important;background:rgba(0,225,255,.04)}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.orb,.core,.map .active{animation:none}.cursor-dot{display:none}body.cursor-ready{cursor:auto}}
@media(pointer:coarse){.cursor-dot{display:none}body.cursor-ready{cursor:auto}}
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

let immediate = readFileSync(resolve(root, 'dex-immediate.html'), 'utf8')
  .replaceAll('Transformation Assessment', 'Диагностика трансформации')
  .replaceAll('AI Consultant', 'ИИ-консультант')
  .replaceAll('Transformation Intelligence', 'Интеллект трансформации')
  .replaceAll('TRANSFORMATION SYSTEM // READY', 'ТРАНСФОРМАЦИЯ // ГОТОВА')
  .replaceAll('separable система', 'архитектура, которую можно развивать по слоям');

const materialized = immediate.replace(/<footer[\s\S]*?<\/footer>/i, footer);
if (materialized === immediate) {
  console.error('SynapseMax build: FAILED');
  console.error('dex-immediate.html does not contain a footer placeholder');
  process.exit(1);
}
writeFileSync(resolve(dist, 'dex-immediate.html'), materialized);

for (const file of runtimeAssets) cpSync(resolve(root, 'assets', file), resolve(dist, 'assets', file));

const deployedAssets = readdirSync(resolve(dist, 'assets')).sort();
const unexpectedAssets = deployedAssets.filter((file) => !runtimeAssets.includes(file));
if (unexpectedAssets.length) {
  console.error('SynapseMax build: FAILED');
  console.error('Unexpected production assets: ' + unexpectedAssets.join(', '));
  process.exit(1);
}

console.log('SynapseMax build: PASS');
console.log('Current experience: dist/dex-immediate.html');
console.log('Immediate footer: materialized');
console.log('Runtime assets: ' + runtimeAssets.join(', '));
console.log('Asset boundary: PASS');
