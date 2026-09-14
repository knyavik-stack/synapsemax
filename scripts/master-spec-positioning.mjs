#!/usr/bin/env node

/**
 * Master Operational Spec positioning pass.
 *
 * Keeps the accepted visual implementation intact while making the public
 * entry point follow the financial-first narrative required by the Master Spec.
 * The pass is intentionally deterministic: it fails closed if the expected
 * source markers are missing instead of silently mutating an unknown page.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const defaultTarget = resolve(root, 'dist', 'index.html');

const replacements = [
  [
    '<meta name="description" content="SynapseMax — автоматизация, цифровая трансформация и AI.">',
    '<meta name="description" content="SynapseMax — диагностика потерь прибыли, цифровая трансформация и AI. Находим, где бизнес теряет деньги, и строим управляемую систему изменений.">'
  ],
  [
    '<meta property="og:title" content="SynapseMax — Automation · Digital Transformation · AI">',
    '<meta property="og:title" content="SynapseMax — диагностика потерь прибыли и цифровая трансформация">'
  ],
  [
    '<meta property="og:description" content="Соединяем технологии, интеллект и бизнес в единый цифровой контур.">',
    '<meta property="og:description" content="Диагностика потерь прибыли → архитектура → симуляция → автоматизация → измеримый результат.">'
  ],
  [
    '<meta name="twitter:title" content="SynapseMax — Automation · Digital Transformation · AI">',
    '<meta name="twitter:title" content="SynapseMax — диагностика потерь прибыли и цифровая трансформация">'
  ],
  [
    '<meta name="twitter:description" content="Соединяем технологии, интеллект и бизнес в единый цифровой контур.">',
    '<meta name="twitter:description" content="Диагностика потерь прибыли → архитектура → симуляция → автоматизация → измеримый результат.">'
  ],
  [
    '<title>SynapseMax — Automation · Digital Transformation · AI</title>',
    '<title>SynapseMax — диагностика потерь прибыли и цифровая трансформация</title>'
  ],
  [
    '<div class="eyebrow">Автоматизация · Цифровая трансформация · AI</div>\n      <h1>Соединяем <span class="gradient">технологии,</span><br>интеллект и бизнес.</h1>\n      <p class="lead">SynapseMax строит цифровые системы, где автоматизация, данные и AI работают как единый контур — от идеи до измеримого результата.</p>\n      <div class="actions"><a class="btn primary" href="#contact">Обсудить проект <span>→</span></a><a class="btn ghost" href="#cases">Смотреть кейсы <span>↗</span></a></div>',
    '<div class="eyebrow">Диагностика потерь · Трансформация · AI</div>\n      <h1>Находим, где бизнес <span class="gradient">теряет прибыль.</span></h1>\n      <p class="lead">SynapseMax переводит операционную сложность в управляемую систему: диагностика потерь → проектирование → симуляция → автоматизация → измеримый результат.</p>\n      <div class="actions"><a class="btn primary" href="/dex-immediate.html#profit-leakage">Диагностировать потери <span>→</span></a><a class="btn ghost" href="#process">Как работаем <span>↗</span></a></div>'
  ]
];

export function applyPositioning(html) {
  let result = html;
  for (const [from, to] of replacements) {
    if (!result.includes(from)) {
      throw new Error(`POSITIONING_MARKER_MISSING: ${from.slice(0, 90)}`);
    }
    result = result.replace(from, to);
  }
  return result;
}

export function run(target = defaultTarget) {
  if (!existsSync(target)) throw new Error(`POSITIONING_TARGET_MISSING: ${target}`);
  const before = readFileSync(target, 'utf8');
  const after = applyPositioning(before);
  writeFileSync(target, after, 'utf8');
  return { target, changed: before !== after };
}

const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  const result = run();
  console.log(`SynapseMax positioning pass: ${result.changed ? 'APPLIED' : 'NO_CHANGE'} → ${result.target}`);
}
