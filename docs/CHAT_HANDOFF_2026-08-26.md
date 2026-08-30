# SynapseMax — CONTEXT HANDOFF

Дата: 2026-08-26 (continuation update: 2026-08-28)
Репозиторий: https://github.com/knyavik-stack/synapsemax
Домен production: https://synapsemax.ru/
Публичная почта: hello@synapsemax.ru

## 0. ОБЯЗАТЕЛЬНО ПЕРЕД ПРОДОЛЖЕНИЕМ

Новый чат НЕ начинает проект заново.

Сначала прочитать:
1. `docs/CHAT_HANDOFF_2026-08-26.md` — этот файл, текущая точка и история.
2. `docs/DECISION_LOG.md` — архитектурные и продуктовые решения.
3. `docs/PRODUCTIZATION_PASS.md` — H1 productization contract.
4. `docs/DEX_V3.md` — утверждённая концепция DEX v3.
5. `docs/DEX_V1.md` — историческая спецификация, только для контекста.
6. `docs/SYNAPSEMAX_PROJECT_MASTER.md` или актуальный master strategic document, если он присутствует в `docs/`.
7. `package.json`, `wrangler.jsonc`, `scripts/build-site.mjs`, `src/index.js`, `src/immediate-logic.js`, `scripts/browser-qa.spec.mjs`, `.github/workflows/*`.

После чтения обязательно проверить `main`, последние commits и фактические GitHub Actions runs. Никогда не считать commit доказательством deployment или runtime.

## 1. РОЛЬ И ЦЕЛЬ ПРОЕКТА

SynapseMax — серьёзная B2B technology ecosystem / будущая SaaS-платформа для цифровой трансформации компаний через ИИ, данные и автоматизацию.

Главная смысловая цепочка:
Сложность бизнеса → данные / процессы / системы → Synapse → интеллект → ИИ + автоматизация → управляемая система → бизнес-результат.

Это НЕ просто futuristic landing page. Сайт должен быть первым интерфейсом будущей Transformation Intelligence Platform.

Главный язык для клиента: финансовая диагностика потерь прибыли, ROI и влияние на рентабельность. Автоматизация/агенты — способы закрытия найденных проблем, а не самоцель.

## 2. КАНОНИЧЕСКИЙ БРЕНД И ВИЗУАЛ

- Текущий S-знак утверждён.
- Части S никогда не разрезаются.
- Центральная зона — synaptic activity; вокруг может быть neural/electrical environment.
- Wordmark SynapseMax использует канонический asset; нельзя имитировать его обычным web-шрифтом.
- HUD/FUI — функциональный визуальный язык, не cyberpunk-декорация.
- Каждая анимация должна объяснять сигнал → связь → интеллект → действие → система → результат.
- Контент, readability и business meaning выше visual effects.

## 3. DEX V3 — ТЕКУЩАЯ КОНЦЕПЦИЯ

DEX v2 отклонён: слишком упрощён, снизил смысловую нагрузку, ослабил иконки/анимации, создал generic futuristic landing.

DEX v3 — восстановление первоначальной концепции, а не упрощение.

Структура:
1. Hero
2. Отправная точка / проблема
3. Решения
4. Подход
5. Кейсы и сценарии
6. Архитектура
7. CTA

Разделы русские. Не уменьшать содержательность без причины. Не выдумывать клиентские кейсы: неподтверждённое маркировать как сценарий/гипотезу.

## 4. PRODUCTIZATION CONTRACT

Каноническая логика:
`Complexity → Understanding → System → Automation → Outcome`

Коммерческий цикл:
`Diagnose → Design → Simulate → Automate → Monitor`

Каждый основной блок должен отвечать:
1. Что SynapseMax получает/понимает?
2. Что система делает с этим контекстом?
3. Какой следующий измеримый результат получает клиент?

H1 = коммерческий терминал: позиционирование → доверие → диагностика → результат → заявка.
H1 НЕ должен притворяться H2/H3 SaaS.

H2/H3 future scope: Customer Workspace, Process Mining, Simulation, Personalized Roadmap, deep ROI, Integrations.

ROI: конкретный процесс → текущая стоимость → потенциал улучшения → инвестиция → эффект → окупаемость.

Architecture: данные → контекст → интеллект → действие → governance.

Integrations показывать как классы и направление обмена, не обещая несуществующие коннекторы.

Security: только подтверждаемая архитектурой; не делать неподтверждённых юридических обещаний.

Полный контракт: `docs/PRODUCTIZATION_PASS.md`.

## 5. ТЕХНИЧЕСКАЯ АРХИТЕКТУРА

Deployment:
GitHub → Cloudflare Workers Builds → dist → Wrangler → Cloudflare.

Ключевые файлы:
- `index.html` — Front baseline
- `dex-v1.html` — историческая версия
- `dex-v2.html` — отклонённая
- `dex-v3.html` — текущая концепция
- `dex-immediate.html` — актуальный Immediate production experience
- `scripts/build-site.mjs` — build/materialization
- `src/index.js` — Worker/API/runtime
- `src/immediate-logic.js` — deterministic business logic
- `wrangler.jsonc` — Cloudflare config
- `scripts/browser-qa.spec.mjs` — browser-level H1 gate
- `.github/workflows/immediate-qa.yml` — Immediate QA
- `.github/workflows/production-smoke.yml` — production smoke
- `docs/DECISION_LOG.md` — decisions
- `docs/PRODUCTIZATION_PASS.md` — productization
- `docs/DEX_V3.md` — DEX v3

Frontend не должен содержать будущую business logic или зависимость от конкретного LLM provider. Experience / Intelligence / Business Logic / Integration / Governance должны оставаться разделимыми.

## 6. ROUTING / PRODUCTION

Production source of truth: `https://synapsemax.ru/`.

Root `/` должен работать непосредственно через Worker и не зависеть от redirect на `/dex-immediate`.

Worker-first routing (`run_worker_first: true`) принят.

`/dex-immediate` — internal asset route. Не использовать старый `/dex-immediate.html` как canonical production route.

`2228a7a8-synapsemax.knyavik.workers.dev` не считать production source of truth; version/preview endpoint может отличаться.

Cloudflare production command:
`npm run deploy:cloudflare` → `npm run build && npx wrangler deploy`.

Cloudflare deployment был фактически подтверждён логом с `Executing user deploy command: npm run deploy:cloudflare`, затем `npm run build` и `npx wrangler deploy` с успешной публикацией Worker. Повторная проверка production status всё равно обязательна после дальнейших commits.

## 7. QA: ЧТО УЖЕ ДОКАЗАНО / ЧТО НЕТ

Static Immediate QA был усилен и ранее проходил полный baseline.

Browser gate существует и запускает реальный Chromium. Это обязательный release gate, но его PASS должен подтверждаться фактическим GitHub Actions run, а не наличием workflow.

Browser test должен проверять минимум:
- landing;
- Assessment availability;
- 4 inputs + labels;
- заполнение;
- submit;
- Result visibility;
- CTA;
- keyboard interaction;
- mobile viewport;
- отсутствие horizontal overflow;
- reduced motion.

Browser gate первоначально выявил инфраструктурную проблему: тест импортировал Playwright без установленного npm package. Runner был добавлен в QA workflow.

Затем browser QA выявил реальный продуктовый defect в Assessment → Result: report оставался hidden после submit.

Source-level анализ обнаружил duplicate Assessment runtime injection: client handler существовал в Immediate HTML и второй handler инжектировался Worker. Это устранено commit `8aefb247` (`fix: remove duplicate injected assessment runtime`).

После `8aefb247` browser gate должен считаться открытым до фактического PASS. Не ослаблять assertion ради зелёного CI.

## 8. CRITICAL H1 FLOW

Целевой путь:
Visitor → понимает проблему → узнаёт собственную сложность → проходит Assessment → получает Complexity Profile → видит финансовый/ROI смысл → понимает приоритет → видит следующий шаг → CTA/contact.

Canonical technical flow:
Assessment UI → POST `/api/v1/assessment` → `assess()` в `src/immediate-logic.js` → result state → report visible → CTA.

Не переносить business calculation из `src/immediate-logic.js` в HTML только ради теста.

## 9. ИСТОРИЯ ПОСЛЕДНИХ ВАЖНЫХ ИЗМЕНЕНИЙ

- `e073dda251f5c68d76bf3bd34c51366df19e5b91` — routing fix / Worker-first root.
- `c154f86cb371f063cfb1a43a024b15c2b29b67e0` — Immediate QA trigger/русская терминология.
- `3e97746521a5f1f7c71920ad96c0dd81e8963f2c` — Productization Pass.
- `ba1ccb92ef5405b2932222924a39643869cc11d` — cursor hover interaction fix; D-029.
- `f9e12f4f` — Assessment → Result → CTA productization pass.
- `0f52bae2` — browser runner dependency fix.
- `efb8674d` — Assessment result state wiring.
- `8aefb247` — removal of duplicate injected Assessment runtime.
- `4ddc623a` — Decision Log: H1 release/productization and development-history rules.
- `ffe16d46` — handoff/history preservation update.

ВАЖНО: список — история ключевых изменений, не утверждение, что каждый commit production-deployed. Deployment подтверждать GitHub Actions/Cloudflare evidence.

## 10. DEVELOPMENT HISTORY — НЕ ТЕРЯТЬ

История разработки поддерживается в `docs/DECISION_LOG.md` и этом handoff. Каждый существенный дефект/решение документируется:
`обнаружение → причина → исправление → verification → Decision Log/Handoff`.

Недавние решения:
- D-030 — H1 Assessment = коммерческий диагностический терминал; путь Assessment → deterministic result → economic interpretation → CTA.
- D-031 — real-browser QA = release gate.
- D-032 — duplicate Assessment runtime injection запрещена.
- D-033 — история разработки должна непрерывно сохраняться.

## 11. VISUAL QA CHECKLIST

Обязательные реальные проверки:
- canonical logo/wordmark в header/footer;
- Yandex Browser и Chromium;
- desktop + mobile;
- вертикальный ритм без пустых экранов;
- architecture cards content-driven на mobile;
- body/metric/navigation typography читаемы;
- CTA/input spacing;
- navigation hover/focus underline;
- cursor-circle на fine pointer, отсутствие для coarse/reduced motion;
- footer не пустой;
- HUD elements содержательны;
- no horizontal overflow;
- reduced motion;
- performance.

## 12. CURRENT RELEASE TARGET

Главная цель: **H1 Release Candidate**, не DEX v4.

RC acceptance:
1. Positioning понятно примерно за 15 секунд.
2. Assessment принимает 4 входных параметра.
3. Deterministic result появляется после валидного submit.
4. Result содержит экономически понятный смысл.
5. CTA связан с результатом.
6. Browser gate PASS.
7. Mobile PASS.
8. Accessibility/reduced-motion PASS.
9. Production smoke PASS.
10. No P0/P1 defects.
11. Productization Pass DoD закрыт.
12. Deployment reproducible.

После этого: visual QA → cross-browser → Python regression → performance/accessibility → Quality Gate → visual approval DEX v3 → только затем DEX v4.

## 13. ЧТО НЕ ДЕЛАТЬ

- Не начинать DEX v4 до visual approval DEX v3.
- Не начинать проект заново.
- Не делать generic futuristic/cyberpunk landing.
- Не уменьшать смысловую плотность без причины.
- Не заменять реальные функции fake dashboards.
- Не придумывать client cases.
- Не считать commit доказательством runtime/deployment.
- Не ослаблять browser assertions ради зелёного CI.
- Не зашивать будущую business logic/LLM dependency в UI.
- Не делать автоматизацию/агентов центральной ценностью вместо business outcome.

## 14. ЕСЛИ НОВОМУ ЧАТУ НУЖНО ПОПРОСИТЬ ПОЛЬЗОВАТЕЛЯ О ДЕЙСТВИИ

По умолчанию от пользователя ничего не требовать.

Если нужен внешний шаг (Cloudflare setting, production browser verification, DNS, credential/permission), написать точную пошаговую инструкцию:
1. Где открыть.
2. Что нажать.
3. Что установить/изменить.
4. Какое значение поставить.
5. Что прислать обратно как evidence.

Не говорить просто «проверьте Cloudflare» или «нужен лог».

## 15. START COMMAND ДЛЯ НОВОГО ЧАТА

Продолжить с текущей точки, не начинать заново.

Первое действие нового чата:
1. Прочитать этот handoff.
2. Прочитать `docs/DECISION_LOG.md`, `docs/PRODUCTIZATION_PASS.md`, `docs/DEX_V3.md`.
3. Проверить `main`, последние commits и GitHub Actions.
4. Получить фактический статус browser gate и production smoke.
5. Если browser gate красный — исправить конкретный product/runtime defect.
6. Если browser gate зелёный — переходить к visual/cross-browser/performance release gates.
7. После существенного изменения обновить историю здесь.

Ключевая фраза проекта:
**SynapseMax — не сайт про технологии. Это первый интерфейс системы трансформации бизнеса.**


## 16. 2026-08-30 RC EVIDENCE UPDATE

- Immediate QA run #97 on commit `2e95b18b07eab5cdfd232050f36fd2b7afa3f309`: **SUCCESS**.
- Verified gates: build, static tests, production artifact, root routing, size budget, Wrangler configuration, deployment graph, real Chromium critical journey, mobile overflow/usability.
- Runtime boot marker verified; no browser page errors; Assessment → Result → CTA verified.
- Root cause of repeated hidden-report failures: browser QA selected a non-canonical button instead of `#assessment button[type="submit"]`.
- Cleanup started: obsolete `assessment-submit-bridge.mjs` removed and then removed from the build pipeline; D-032 single authoritative runtime rule restored structurally.
- Next required evidence before final RC declaration: clean QA on the post-cleanup main SHA and fresh production smoke for that SHA. Do not call RELEASED from the prior QA run alone.
