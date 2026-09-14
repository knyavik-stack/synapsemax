#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'dist/dex-immediate.html');
if (!existsSync(file)) throw new Error('Finance pass: dist/dex-immediate.html missing');
let html = readFileSync(file, 'utf8');
const marker = '<!-- SYNAPSEMAX_FINANCE_PRODUCTIZATION_V2 -->';
if (html.includes(marker)) throw new Error('Finance pass: already applied');
const footerMarker = '<footer class="sm-footer">';
if (!html.includes(footerMarker)) throw new Error('Finance pass: footer marker missing');

const section = `${marker}
<section id="finance-impact" aria-labelledby="finance-impact-title">
  <div class="wrap">
    <div class="section-head">
      <div><div class="eyebrow">ФИНАНСОВЫЙ КОНТУР</div><h2 id="finance-impact-title">Не просто потери.<br><span>Экономический эффект.</span></h2></div>
      <p>Сначала считаем потери, затем очищаем достижимый эффект от пересечений и показываем conservative / base / optimistic сценарии. ROI и окупаемость учитывают разовые инвестиции и OPEX.</p>
    </div>
    <div class="panel finance-impact-grid">
      <div class="finance-impact-form">
        <div class="form-grid">
          <div class="field"><label for="impact-error-recovery">Возврат стоимости ошибок, %</label><input id="impact-error-recovery" type="number" min="0" max="100" step="1" value="0"><small>Только подтверждённая или обоснованная доля.</small></div>
          <div class="field"><label for="impact-delay-recovery">Возврат стоимости задержек, %</label><input id="impact-delay-recovery" type="number" min="0" max="100" step="1" value="0"><small>Не предполагаем эффект без evidence.</small></div>
          <div class="field"><label for="impact-error-overlap">Пересечение ошибок с ручными потерями, %</label><input id="impact-error-overlap" type="number" min="0" max="100" step="1" value="0"><small>Часть уже учтена в ручном потоке.</small></div>
          <div class="field"><label for="impact-delay-overlap">Пересечение задержек с ручными потерями, %</label><input id="impact-delay-overlap" type="number" min="0" max="100" step="1" value="0"><small>Убираем двойной счёт только по вашему вводу.</small></div>
          <div class="field"><label for="impact-error-delay-overlap">Пересечение задержек с ошибками, %</label><input id="impact-error-delay-overlap" type="number" min="0" max="100" step="1" value="0"><small>Дополнительный контроль пересечения.</small></div>
          <div class="field"><label for="impact-evidence">Качество evidence, %</label><input id="impact-evidence" type="number" min="0" max="100" step="1" value="0"><small>0% = данные не подтверждены; 80%+ = высокая уверенность.</small></div>
          <div class="field"><label for="impact-revenue">Выручка в месяц, ₽</label><input id="impact-revenue" type="number" min="0" step="1000" placeholder="например, 5000000"><small>Нужна для влияния на маржу.</small></div>
          <div class="field"><label for="impact-margin">Текущая маржа, %</label><input id="impact-margin" type="number" min="0" max="100" step="0.1" placeholder="например, 20"><small>До выявленного эффекта.</small></div>
          <div class="field"><label for="impact-capex">Дополнительный CAPEX, ₽</label><input id="impact-capex" type="number" min="0" step="1000" value="0"><small>Разовые расходы сверх стоимости внедрения.</small></div>
          <div class="field"><label for="impact-opex">OPEX в месяц, ₽</label><input id="impact-opex" type="number" min="0" step="1000" value="0"><small>Постоянные расходы после запуска.</small></div>
          <div class="field"><label for="impact-annual-opex">Дополнительный OPEX в год, ₽</label><input id="impact-annual-opex" type="number" min="0" step="1000" value="0"><small>Годовые расходы сверх monthly OPEX.</small></div>
        </div>
        <button class="btn primary" id="finance-impact-button" type="button">Рассчитать экономический эффект</button>
        <p id="finance-impact-note" class="finance-impact-note" role="status">Сначала заполните и рассчитайте блок «Потери прибыли», затем уточните достижимость эффекта.</p>
      </div>
      <div id="finance-impact-result" class="finance-impact-result" hidden aria-live="polite"></div>
    </div>
  </div>
</section>
<style>
.finance-impact-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:0;overflow:hidden}.finance-impact-form{padding:28px;border-right:1px solid var(--line)}.finance-impact-form small{display:block;color:#64748a;font-size:10px;line-height:1.4}.finance-impact-note{color:#8190a5;font-size:12px;line-height:1.5}.finance-impact-result{padding:28px}.finance-impact-result[hidden]{display:none}.finance-impact-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.finance-impact-scenarios{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.finance-impact-scenario{padding:12px;border:1px solid rgba(111,167,255,.12);border-radius:10px}.finance-impact-scenario b{display:block;font:600 12px/1.4 Orbitron;color:#b9c8db}.finance-impact-scenario strong{display:block;font-size:20px;margin-top:4px}.finance-impact-scenario span{display:block;color:#8795a9;font-size:11px;margin-top:3px}.finance-impact-action{border-top:1px solid rgba(111,167,255,.1);padding:12px 0}.finance-impact-action b{display:block;font:600 12px/1.4 Orbitron;color:#b9c8db}.finance-impact-action span{display:block;color:#8795a9;font-size:12px;margin-top:3px}.finance-impact-evidence{margin-top:16px;padding:12px;border:1px solid rgba(111,167,255,.1);border-radius:10px;color:#7f8da2;font-size:11px;line-height:1.5}.finance-impact-good{color:var(--green)}
@media(max-width:900px){.finance-impact-grid{grid-template-columns:1fr}.finance-impact-form{border-right:0;border-bottom:1px solid var(--line)}}
@media(max-width:560px){.finance-impact-form,.finance-impact-result{padding:22px}.finance-impact-kpis,.finance-impact-scenarios{grid-template-columns:1fr}}
</style>
<script>
(() => {
  const boot = () => {
    const button = document.getElementById('finance-impact-button');
    const result = document.getElementById('finance-impact-result');
    const note = document.getElementById('finance-impact-note');
    if (!button || !result || !note) return;
    const money = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v)) + ' ₽';
    const number = (id) => Number(document.getElementById(id)?.value);
    const existing = (id) => Number(document.getElementById(id)?.value);
    button.addEventListener('click', async () => {
      const monthlyLaborCost = existing('leak-labor');
      const manualWorkShare = existing('leak-manual');
      const recoverableManualShare = existing('leak-recoverable');
      const monthlyErrorCost = existing('leak-errors');
      const monthlyDelayCost = existing('leak-delays');
      const implementationCost = existing('leak-impl');
      const recoverableErrorShare = number('impact-error-recovery');
      const recoverableDelayShare = number('impact-delay-recovery');
      const errorOverlapShare = number('impact-error-overlap');
      const delayOverlapShare = number('impact-delay-overlap');
      const errorDelayOverlapShare = number('impact-error-delay-overlap');
      const evidenceQuality = number('impact-evidence');
      const monthlyRevenue = number('impact-revenue');
      const baselineMarginPercent = number('impact-margin');
      const oneTimeCapex = number('impact-capex');
      const monthlyOpex = number('impact-opex');
      const annualOpex = number('impact-annual-opex');
      const percentages = [manualWorkShare, recoverableManualShare, recoverableErrorShare, recoverableDelayShare, errorOverlapShare, delayOverlapShare, errorDelayOverlapShare, evidenceQuality, baselineMarginPercent];
      const moneyValues = [monthlyLaborCost, monthlyErrorCost, monthlyDelayCost, implementationCost, monthlyRevenue, oneTimeCapex, monthlyOpex, annualOpex];
      if (percentages.some((v) => !Number.isFinite(v) || v < 0 || v > 100) || moneyValues.some((v) => !Number.isFinite(v) || v < 0)) {
        note.textContent = 'Проверьте значения: проценты — от 0 до 100, деньги — неотрицательные.';
        return;
      }
      const input = { monthlyLaborCost, manualWorkShare, recoverableManualShare, monthlyErrorCost, recoverableErrorShare, monthlyDelayCost, recoverableDelayShare, errorOverlapShare, delayOverlapShare, errorDelayOverlapShare, evidenceQuality, implementationCost, oneTimeCapex, monthlyOpex, annualOpex, monthlyRevenue, baselineMarginPercent };
      button.disabled = true; button.textContent = 'Расчёт…';
      try {
        const response = await fetch('/api/v1/profit-leakage', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(input) });
        if (!response.ok) throw new Error('api_failed');
        const payload = await response.json();
        if (!payload.ok || !payload.result) throw new Error('invalid_result');
        const r = payload.result;
        const cards = [
          ['leakage', money(r.totalMonthlyLeakage), 'Потери / месяц'],
          ['recoverable', money(r.recoverableMonthlyValue), 'Возврат / месяц'],
          ['annual', money(r.annualNetValue), 'Чистый годовой эффект'],
          ['roi', r.roiPercent == null ? '—' : r.roiPercent + '%', 'ROI'],
          ['payback', r.paybackMonths == null ? '—' : r.paybackMonths + ' мес.', 'Окупаемость'],
          ['margin', r.marginUpliftPoints == null ? '—' : '+' + r.marginUpliftPoints + ' п.п.', 'Влияние на маржу']
        ];
        const scenarios = ['conservative','base','optimistic'].map((name) => { const s = r.scenarios[name]; return '<div class="finance-impact-scenario" data-scenario="'+name+'"><b>'+name+'</b><strong>'+money(s.annualValue)+'</strong><span>ROI '+(s.roiPercent == null ? '—' : s.roiPercent+'%')+' · '+(s.paybackMonths == null ? '—' : s.paybackMonths+' мес.')+'</span></div>'; }).join('');
        const overlap = r.overlapAdjustment ? ' Учтённый overlap: <strong>'+money(r.overlapAdjustment)+'</strong> / мес.' : ' Явно заданного overlap нет.';
        result.innerHTML = '<h3>Экономический эффект</h3><div class="finance-impact-kpis">' + cards.map(([key,value,label]) => '<div class="metric" data-impact="'+key+'"><b>'+value+'</b><span>'+label+'</span></div>').join('') + '</div><h3 style="margin-top:24px">Сценарии</h3><div class="finance-impact-scenarios">'+scenarios+'</div><h3 style="margin-top:24px">Action Map</h3>' + r.actionMap.map((a,i) => '<div class="finance-impact-action"><b>'+(i+1)+'. '+a.key+'</b><span>Потери: '+money(a.leakage)+' / мес. · достижимый эффект: '+money(a.recoverable)+' / мес. · '+a.action+'</span></div>').join('') + '<div class="finance-impact-evidence">Качество evidence: <strong>'+r.dataQuality.label+'</strong> ('+r.dataQuality.evidenceQuality+'%).'+overlap+' ROI и окупаемость — сценарная оценка, не гарантия результата до проверки исходных данных.</div>';
        result.hidden = false;
        note.textContent = 'Расчёт выполнен. Для инвестиционного решения подтвердите источники потерь, достижимость эффекта и пересечения между bucket.';
      } catch (error) {
        note.textContent = 'API недоступен. Финансовый эффект не подменяем упрощённой формулой.';
      } finally { button.disabled = false; button.textContent = 'Рассчитать экономический эффект'; }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
</script>`;

html = html.replace(footerMarker, section + '\n' + footerMarker);
writeFileSync(file, html);
console.log('Finance productization pass: applied to dist/dex-immediate.html');
