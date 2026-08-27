# SynapseMax — CONTEXT HANDOFF

Дата: 2026-08-26
Репозиторий: https://github.com/knyavik-stack/synapsemax
Домен production: https://synapsemax.ru/
Публичная почта: hello@synapsemax.ru

## 1. РОЛЬ И ЦЕЛЬ ПРОЕКТА

SynapseMax — серьёзная B2B technology ecosystem / будущая SaaS-платформа для цифровой трансформации российских компаний через ИИ, данные и автоматизацию.

Главная смысловая цепочка:
Сложность бизнеса → данные / процессы / системы → Synapse → интеллект → ИИ + автоматизация → управляемая система → бизнес-результат.

Это НЕ просто красивый futuristic landing page. Сайт должен быть первым интерфейсом будущей Transformation Intelligence Platform.

## 2. КАНОНИЧЕСКИЙ БРЕНД

- Текущий S-знак утверждён.
- Части S никогда не разрезаются.
- Синаптическая активность находится в центральной зоне и окружающей нейронной/электрической среде.
- Wordmark SynapseMax использует канонический asset.
- Нельзя имитировать wordmark обычным web-шрифтом.

## 3. ВИЗУАЛ

HUD / Futuristic Interface / FUI.
Но не cyberpunk ради cyberpunk.
Каждая анимация должна иметь смысл:
сигнал → связь → интеллект → действие → система → результат.

Нужна высокая информационная плотность, сильный B2B technology platform, нормальная типографика, иконки как часть визуальной системы, содержательные анимации.

## 4. DEX V3

DEX v2 отклонён: слишком упростил сайт, снизил смысловую нагрузку, создал пустые пространства, ослабил иконки/анимации, generic futuristic landing page, английские названия разделов, недостаточно ясно объяснял digital transformation через AI.

DEX v3 — НЕ упрощение, а восстановление первоначальной концепции.

Структура:
1. Hero
2. Отправная точка / проблема
3. Решения
4. Подход
5. Кейсы и сценарии
6. Архитектура
7. CTA

Разделы должны называться по-русски.
Не уменьшать содержательность без причины.
Не делать generic landing page.
Не превращать сайт в cyberpunk-декорацию.
Не делать чрезмерные пустые пространства.

## 5. ПРОДУКТОВАЯ ЛОГИКА

Зафиксированный Productization Pass:

Complexity → Understanding → System → Automation → Outcome

Коммерческий цикл:
Diagnose → Design → Simulate → Automate → Monitor

Каждый блок сайта должен быть частью единой причинно-следственной цепочки, а не отдельной красивой карточкой.

Assessment должен вести:
данные бизнеса → диагностика → профиль сложности → узкие места → гипотезы автоматизации → следующий шаг.

ROI:
конкретный процесс → текущая стоимость → потенциал автоматизации → инвестиция → эффект → окупаемость.

Architecture:
данные → контекст → интеллект → действие → governance.

Не придумывать клиентские кейсы. Если нет подтверждённых кейсов — маркировать сценарий как сценарий/гипотезу.

H1 не должен притворяться H2. H1 = коммерческий шоукейс/терминал: позиционирование → доверие → диагностика → демонстрация результата → заявка. H2 — Customer Workspace, Process Mining, Simulation, ROI, Personalized Roadmap, Integrations.

## 6. ТЕХНИЧЕСКАЯ АРХИТЕКТУРА

Deployment:
GitHub → Cloudflare Workers Builds → dist → Wrangler → Cloudflare.

Принятые файлы:
- index.html — Front baseline
- dex-v1.html — историческая версия
- dex-v2.html — отклонённая
- dex-v3.html — текущая концепция
- dex-immediate.html — актуальный Immediate production experience
- scripts/build-site.mjs — build
- src/index.js — Worker
- wrangler.jsonc — Cloudflare config
- docs/DECISION_LOG.md — решения
- docs/DEX_V3.md — DEX v3
- docs/DEX_V1.md — историческая спецификация

## 7. ROUTING — СЕЙЧАС ЗАКРЫТО

Production:
https://synapsemax.ru/

Сейчас root `/` работает корректно и остаётся на `/`. Это production source of truth.

Важно: `2228a7a8-synapsemax.knyavik.workers.dev` больше НЕ считать эталоном production; это version/preview endpoint и он мог показывать другое поведение.

В Worker root обслуживает Immediate. Текущая реализация использует internal asset route `/dex-immediate`, а не `/dex-immediate.html`, чтобы не получать canonical asset redirect.

`wrangler.jsonc` был изменён на `run_worker_first: true`, чтобы Worker имел приоритет над static asset routing.

Последний известный routing-fix commit: `e073dda251f5c68d76bf3bd34c51366df19e5b91`.

## 8. DEPLOYMENT

Production-команда в GitHub:
`npm run deploy:cloudflare`
которая выполняет:
`npm run build && npx wrangler deploy`

Cloudflare deployment был фактически подтверждён логом с `Executing user deploy command: npm run deploy:cloudflare`, затем `npm run build` и `npx wrangler deploy` с успешной публикацией Worker.

Не считать Build PASS доказательством production. DoD = build + deploy + smoke test + production verification.

## 9. QA / REGRESSION

QA должен запускаться для main и проверять:
- production build
- русские тексты
- footer
- runtime assets
- API endpoints
- artifact size
- Wrangler config
- deployment graph
- root routing contract
- `/` через Worker
- использование `/dex-immediate`, а не старого `/dex-immediate.html`

Real-browser gate добавлен в Immediate QA и является обязательным release gate. Workflow устанавливает browser test runner и Chromium, запускает `scripts/browser-qa.spec.mjs` на локальном Worker и проверяет критический Assessment → Result → CTA путь, keyboard interaction, mobile overflow и reduced-motion behavior.

Принцип: commit ≠ proof of working. Проверять build/runtime/visual result.

## 10. PRODUCTIZATION

Создан документ:
`docs/PRODUCTIZATION_PASS.md`
commit:
`3e97746521a5f1f7c71920ad96c0dd81e8963f2c`

Он фиксирует продуктовую причинно-следственную модель и следующий этап развития.

H1 release path зафиксирован как:
Assessment → deterministic result → economic interpretation → next-step CTA.

H1 не должен превращаться в H2. Business logic остаётся в Worker/domain layer, Experience Layer потребляет API contract.

## 11. UI / INTERACTION

Был найден недоделанный cursor hover: JS добавлял `cursor-dot.is-hover`, но CSS-визуального состояния не хватало.

Исправлено. Зафиксировано D-029: интерактивное состояние считается реализованным только при наличии и JS-поведения, и визуального CSS-состояния.

Основной commit:
`ba1ccb92ef5405b2932222924a39643869cc11d`

Decision Log update:
`67fbfebb47c42a284c203a681ecf802af45b5f11`

## 12. ASSESSMENT / BROWSER QA HISTORY

Browser gate первоначально выявил инфраструктурную проблему: тест импортировал Playwright без установленного npm package. Runner был добавлен в QA workflow.

Затем browser QA выявил реальный продуктовый defect в Assessment → Result: report оставался hidden после submit.

При source-level анализе обнаружилась duplicate Assessment runtime injection: client handler существовал в Immediate HTML и второй handler инжектировался Worker. Это признано архитектурным дефектом и устранено.

Последний material fix:
`8aefb247` — `fix: remove duplicate injected assessment runtime`

После него browser gate должен считаться открытым до фактического PASS; наличие теста само по себе не является proof.

## 13. РАНЕЕ НАЙДЕННЫЕ VISUAL QA ПРОБЛЕМЫ

Пользователь обнаружил:
- logo/wordmark плохо отображался в top и footer, особенно в Yandex Browser;
- слишком большие расстояния между секциями desktop/mobile;
- Architecture cards на mobile слишком большие и пустые;
- в некоторых блоках слишком маленький текст;
- кнопка «Проверить гипотезу» прилипала к input;
- меню слишком мелкое;
- пропала подсветка нижней линии меню при hover;
- отсутствовал cursor-circle;
- footer ранее был пустым/недоделанным.

Эти пункты являются обязательным visual QA checklist. Проверять desktop + mobile + Yandex Browser + другие Chromium.

## 14. СЛЕДУЮЩИЙ ЭТАП

НЕ начинать DEX v4 до visual approval DEX v3.

Сначала:
1. Production smoke test.
2. Полный visual QA production.
3. Python-based regression testing.
4. Desktop/mobile/cross-browser.
5. Проверка размеров блоков, вертикального ритма, typography, icons, footer, menu, cursor.
6. Проверка productization: каждый блок должен объяснять путь от проблемы к результату.
7. Проверка performance/accessibility.
8. Real-browser Quality Gate.
9. H1 Release Candidate.

Только после утверждения DEX v3:
DEX v4 = интерактивность + scroll-linked transformation + richer HUD telemetry + responsive motion + AI transformation assessment.

## 15. DEVELOPMENT HISTORY

Development history is maintained continuously in `docs/DECISION_LOG.md` and this handoff. Material implementation changes, discovered defects, verification results and release decisions must be recorded so work can continue across chats without reconstructing state from memory.

Recent recorded decisions:
- D-030 — H1 Assessment is a commercial diagnostic terminal; release path is Assessment → deterministic result → economic interpretation → CTA.
- D-031 — real-browser QA is a release gate.
- D-032 — duplicate Assessment runtime injection is prohibited.
- D-033 — development history must be maintained continuously in Decision Log and handoff.

## 16. КАК НАЧИНАТЬ НОВЫЙ ЧАТ

Первым делом:
1. Прочитать этот файл `docs/CHAT_HANDOFF_2026-08-26.md`.
2. Затем прочитать актуальные `docs/DECISION_LOG.md`, `docs/DEX_V3.md`, `docs/PRODUCTIZATION_PASS.md`.
3. Проверить GitHub main и последние commits.
4. Не предполагать, что commit = deployment.
5. Проверить текущий Cloudflare deployment status, если доступны инструменты.
6. Только после этого продолжать разработку.

Ключевая фраза проекта:
**SynapseMax — не сайт про технологии. Это первый интерфейс системы трансформации бизнеса.**
