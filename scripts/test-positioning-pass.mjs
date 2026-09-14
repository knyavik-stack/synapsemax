import assert from 'node:assert/strict';
import { applyPositioning } from './master-spec-positioning.mjs';

const fixture = `
<meta name="description" content="SynapseMax — автоматизация, цифровая трансформация и AI.">
<meta property="og:title" content="SynapseMax — Automation · Digital Transformation · AI">
<meta property="og:description" content="Соединяем технологии, интеллект и бизнес в единый цифровой контур.">
<meta name="twitter:title" content="SynapseMax — Automation · Digital Transformation · AI">
<meta name="twitter:description" content="Соединяем технологии, интеллект и бизнес в единый цифровой контур.">
<title>SynapseMax — Automation · Digital Transformation · AI</title>
<div class="eyebrow">Автоматизация · Цифровая трансформация · AI</div>
      <h1>Соединяем <span class="gradient">технологии,</span><br>интеллект и бизнес.</h1>
      <p class="lead">SynapseMax строит цифровые системы, где автоматизация, данные и AI работают как единый контур — от идеи до измеримого результата.</p>
      <div class="actions"><a class="btn primary" href="#contact">Обсудить проект <span>→</span></a><a class="btn ghost" href="#cases">Смотреть кейсы <span>↗</span></a></div>`;

const output = applyPositioning(fixture);
assert.match(output, /диагностика потерь прибыли/);
assert.match(output, /Находим, где бизнес <span class="gradient">теряет прибыль\.<\/span>/);
assert.match(output, /\/dex-immediate\.html#profit-leakage/);
assert.match(output, /диагностика потерь → проектирование → симуляция → автоматизация → измеримый результат/);
assert.match(output, /<title>SynapseMax — диагностика потерь прибыли и цифровая трансформация<\/title>/);

assert.throws(() => applyPositioning(fixture.replace('Automation · Digital Transformation · AI', 'broken')), /POSITIONING_MARKER_MISSING/);

console.log('Positioning pass tests: PASS');
