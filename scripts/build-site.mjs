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
/* Native accessible labels materialized for controls whose source markup has no stable association. */
.sm-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.sm-footer{max-width:1240px;margin:0 auto;padding:0 0 34px;color:#74839a;font-size:12px}
.sm-footer-grid{border-top:1px solid rgba(111,167,255,.14);padding:38px 0 30px;display:grid;grid-template-columns:1.6fr 1fr 1.15fr 1fr;gap:34px}
.sm-footer-logo{display:flex;align-items:center;gap:10px;margin-bottom:16px}.sm-footer-logo img:first-child{width:30px;height:30px;flex:0 0 auto}.sm-footer-logo img:last-child{width:190px;height:auto;display:block;flex:0 0 auto;object-fit:contain}
.sm-footer-brand p{max-width:330px;color:#8d9bb0;line-height:1.7;margin:0 0 16px}.sm-footer-status{font:600 9px/1.4 Orbitron,sans-serif;letter-spacing:.08em;color:#63738a}.sm-footer-status i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#55f5c0;box-shadow:0 0 10px rgba(85,245,192,.7);margin-right:7px}
.sm-footer-label{font:700 10px/1.4 Orbitron,sans-serif;letter-spacing:.14em;color:#b8c6d9;text-transform:uppercase;margin-bottom:13px}.sm-footer a,.sm-footer-grid span{display:block;color:#7d8ca1;margin:0 0 10px}.sm-footer a:hover{color:#e9f5ff}.sm-footer-bottom{border-top:1px solid rgba(111,167,255,.09);padding-top:17px;display:flex;justify-content:space-between;gap:20px;color:#617087;font-size:10px;line-height:1.5}
@media(max-width:1100px){.wrap{width:min(1160px,calc(100% - 36px))}.navlinks{gap:20px;font-size:14px}.hero{padding-bottom:44px}section{padding-top:54px}.section-head{gap:28px}.solution{min-height:250px}.layer{min-height:150px}}
@media(max-width:760px){header .brand img:last-child{width:175px!important}.navlinks{font-size:14px;gap:18px}.navlinks a{padding:11px 0}.sm-footer{width:calc(100% - 30px)}.sm-footer-grid{grid-template-columns:1fr 1fr;gap:28px}.sm-footer-brand{grid-column:1/-1}.sm-footer-logo img:last-child{width:175px}.sm-footer-bottom{flex-direction:column;gap:6px}section{padding-top:46px}.section-head{margin-bottom:16px}.copy,.assess-copy,.form,.report,.roi-box,.process{padding:24px}.solution{padding:22px}.layer{padding:18px;min-height:0}.layer p{font-size:13px;line-height:1.55}.field label{font-size:11px}.field input{min-height:46px}.form button,.roi-box .btn{margin-top:24px;min-height:46px}}
@media(max-width:560px){header .brand img:last-child{width:165px!important}.wrap{width:calc(100% - 30px)}.form-grid,.flow,.architecture,.report-grid{grid-template-columns:1fr}.process-row{grid-template-columns:1fr}.connector{transform:rotate(90deg);margin:2px 0}.tele{display:none}.hero{min-height:auto;padding-top:105px;padding-bottom:24px}.hero-visual{height:310px}.hero-visual img{width:245px}.orb{width:300px;height:300px}.halo{width:290px;height:290px}section{padding:34px 0 0}.section-head{gap:10px;margin-bottom:14px}.section-head h2{font-size:30px}.section-head p{font-size:14px;line-height:1.6}.lead{font-size:16px;line-height:1.6}.actions{margin:20px 0}.brand img:first-child{width:28px;height:28px}.brand img:last-child{width:154px}.form button,.roi-box .btn{width:100%;margin-top:26px}.assessment .assess-copy,.assessment .form,.assessment .report,.roi-box{padding:22px}.architecture .layer{min-height:0;padding:18px}.architecture .layer b{font-size:13px}.architecture .layer p{font-size:13px;line-height:1.55}.solutions .solution{padding:20px;min-height:0}.stage{min-height:0;padding:18px}.stage h3{font-size:17px}.stage p{font-size:13px}.cta{margin:42px 0 18px;padding:30px 22px}.sm-footer-grid{grid-template-columns:1fr;gap:22px}.sm-footer-brand{grid-column:auto}.sm-footer{padding-bottom:24px}.sm-footer-logo img:first-child{width:28px;height:28px}.sm-footer-logo img:last-child{width:165px}.sm-footer-bottom{line-height:1.6}.navlinks{font-size:14px}}
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

const assessmentRuntime = `
<script>
(() => {
  const boot = () => {
    if (window.__SYNAPSEMAX_RUNTIME__) return;
    const assessmentForm = document.querySelector('#assessment .form');
    const report = document.querySelector('#assessment-report');
    const roiBox = document.querySelector('.roi-box');
    if (!assessmentForm && !roiBox) return;
    window.__SYNAPSEMAX_RUNTIME__ = true;

    if (assessmentForm && report) {
      const fields = ['complexity', 'manualWork', 'dataFragmentation', 'errorRate'];
      fields.forEach((id) => {
        const input = assessmentForm.querySelector('[name="' + id + '"]');
        if (input) { input.id = id; const label = input.closest('.field')?.querySelector('label'); if (label) label.htmlFor = id; }
      });
      const button = assessmentForm.querySelector('button[type="submit"], button');
      const getInput = () => Object.fromEntries(fields.map((id) => [id, Number(document.getElementById(id)?.value)]));
      const show = (node) => {
        report.hidden = false;
        report.removeAttribute('hidden');
        report.style.removeProperty('display');
        report.style.display = 'block';
        report.classList.add('show');
        report.setAttribute('aria-live', 'polite');
        report.replaceChildren(node);
      };
      // Keep the native form as the single interaction owner. The explicit keyboard
      // path makes the release journey deterministic when a focused submit button
      // receives Enter in real-browser automation.
      button?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        assessmentForm.requestSubmit();
      });
      // The browser release journey focuses the submit control and sends Enter.
      // Capture it at the form level as well so delegated or rebuilt controls
      // cannot bypass the authoritative submit handler.
      assessmentForm.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        const target = event.target;
        if (target && (target.matches?.('button[type="submit"], button') || target.closest?.('button[type="submit"], button'))) {
          event.preventDefault();
          assessmentForm.requestSubmit();
        }
      });
      assessmentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = getInput();
        if (fields.some((id) => !Number.isFinite(input[id]) || input[id] < 0 || input[id] > 100)) {
          const p = document.createElement('p'); p.textContent = 'Введите значения от 0 до 100 для всех показателей.'; show(p); return;
        }
        const original = button?.textContent || 'Рассчитать профиль';
        if (button) { button.disabled = true; button.textContent = 'Расчёт…'; }
        try {
          const response = await fetch('/api/v1/assessment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
          if (!response.ok) throw new Error('assessment_failed');
          const payload = await response.json();
          if (!payload.ok || !payload.result) throw new Error('invalid_result');
          const r = payload.result;
          const fragment = document.createDocumentFragment();
          const title = document.createElement('h3'); title.textContent = 'Результат диагностики'; fragment.append(title);
          const grid = document.createElement('div'); grid.className = 'report-grid';
          [['score', r.score, 'Индекс сложности'], ['automation', r.automationPotential, 'Потенциал автоматизации'], ['ai', r.aiReadiness, 'Готовность к ИИ'], ['priority', r.priority, 'Приоритет']].forEach(([key, value, label]) => {
            const card = document.createElement('div'); card.className = 'metric'; card.dataset.metric = key;
            const b = document.createElement('b'); b.textContent = typeof value === 'number' ? String(Math.round(value)) : value;
            const s = document.createElement('span'); s.textContent = label; card.append(b, s); grid.append(card);
          });
          fragment.append(grid);
          const p = document.createElement('p');
          p.textContent = r.priority === 'Высокий' ? 'Есть заметный потенциал снижения операционной нагрузки. Следующий шаг — разобрать процессы и уточнить экономический эффект.' : r.priority === 'Средний' ? 'Есть измеримый потенциал улучшения. Следующий шаг — определить процессы с наибольшей стоимостью ручной работы и ошибок.' : 'Потенциал трансформации пока умеренный. Следующий шаг — уточнить структуру процессов и точки потерь.';
          fragment.append(p);
          const actions = document.createElement('div'); actions.className = 'actions';
          const cta = document.createElement('a'); cta.className = 'btn primary'; cta.href = '#contact'; cta.textContent = 'Обсудить результат'; actions.append(cta); fragment.append(actions);
          show(fragment);
          report.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
        } catch {
          const wrap = document.createElement('div'); const h = document.createElement('h3'); h.textContent = 'Диагностика временно недоступна'; const p = document.createElement('p'); p.textContent = 'Не удалось получить расчёт. Повторите попытку.'; wrap.append(h, p); show(wrap);
        } finally { if (button) { button.disabled = false; button.textContent = original; } }
      });
    }

    if (roiBox) {
      const ids = ['monthlyCost', 'automationShare', 'expectedEfficiency', 'implementationCost'];
      const button = roiBox.querySelector('button, .btn');
      const result = roiBox.querySelector('.roi-result');
      const getInput = () => Object.fromEntries(ids.map((id) => [id, Number(document.getElementById(id)?.value)]));
      const render = (r) => {
        if (!result) return;
        const values = [
          ['monthlySaving', r.monthlySaving, 'Экономия в месяц'],
          ['annualSaving', r.annualSaving, 'Экономия в год'],
          ['roiPercent', r.roiPercent, 'ROI'],
          ['paybackMonths', r.paybackMonths, 'Окупаемость, мес.'],
        ];
        result.replaceChildren(...values.map(([key, value, label]) => {
          const card = document.createElement('div'); card.className = 'metric'; card.dataset.metric = key;
          const b = document.createElement('b'); b.textContent = value == null ? '—' : String(value);
          const s = document.createElement('span'); s.textContent = label; card.append(b, s); return card;
        }));
      };
      const run = async (event) => {
        event?.preventDefault();
        const input = getInput();
        if (ids.some((id) => !Number.isFinite(input[id]) || input[id] < 0)) return;
        const original = button?.textContent || 'Рассчитать ROI';
        if (button) { button.disabled = true; button.textContent = 'Расчёт…'; }
        try {
          const response = await fetch('/api/v1/roi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
          if (!response.ok) throw new Error('roi_failed');
          const payload = await response.json();
          if (!payload.ok || !payload.result) throw new Error('invalid_roi');
          render(payload.result);
        } finally { if (button) { button.disabled = false; button.textContent = original; } }
      };
      button?.addEventListener('click', run);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
</script>`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(resolve(dist, 'assets'), { recursive: true });
for (const file of ['index.html', 'dex-v1.html', 'dex-v2.html', 'dex-v3.html']) cpSync(resolve(root, file), resolve(dist, file));

let immediate = readFileSync(resolve(root, 'dex-immediate.html'), 'utf8')
  .replaceAll('Transformation Assessment', 'Диагностика трансформации')
  .replaceAll('AI Consultant', 'ИИ-консультант')
  .replaceAll('Transformation Intelligence', 'Интеллект трансформации')
  .replaceAll('TRANSFORMATION SYSTEM // READY', 'ТРАНСФОРМАЦИЯ // ГОТОВА')
  .replaceAll('separable система', 'архитектура, которую можно развивать по слоям');

// Remove any legacy Assessment/ROI runtime from the source page. The build owns
// one authoritative client handler so Worker injection and source-page handlers cannot race.
immediate = immediate.replace(/<script\b[^>]*>[\s\S]*?\/api\/v1\/(?:assessment|roi)[\s\S]*?<\/script>/gi, '');

const assessmentLabels = { complexity: 'Сложность процессов', manualWork: 'Доля ручной работы', dataFragmentation: 'Фрагментация данных', errorRate: 'Уровень ошибок' };
for (const [name] of Object.entries(assessmentLabels)) {
  const pattern = new RegExp(`<input\\b(?![^>]*\\bid=["']${name}["'])([^>]*\\bname=["']${name}["'][^>]*)>`, 'i');
  immediate = immediate.replace(pattern, `<input id="${name}"$1>`);
}

const materialized = immediate.replace(/<footer[\s\S]*?<\/footer>/i, footer).replace(/<\/body>/i, `${assessmentRuntime}\n</body>`);
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
console.log('Assessment + ROI runtime: authoritative build-owned handler');
console.log('Asset boundary: PASS');
