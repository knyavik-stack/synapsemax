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

## 8. КРИТИЧЕСКИЙ DEPLOYMENT ISSUE

Последний предоставленный Cloudflare log показал фактическую команду:
`Executing user deploy command: npx wrangler versions upload`

и ошибку:
`Cannot use assets with a binding in an assets-only Worker.`

Это означает, что Cloudflare Build фактически использовал preview/version upload вместо production deploy.

В GitHub package.json production-команда уже определена как:
`npm run deploy:cloudflare`
которая выполняет:
`npm run build && npx wrangler deploy`

В Cloudflare Build Settings нужно установить Deploy command:
`npm run deploy:cloudflare`

После сохранения нужно повторить Production deployment.

Правильный log должен содержать:
`Executing user deploy command: npm run deploy:cloudflare`
затем `npm run build`, затем `npx wrangler deploy`, затем успешную публикацию Worker.

Не считать Build PASS доказательством production. DoD = build + deploy + smoke test + production verification.

## 9. QA / REGRESSION

Ранее automatic Immediate QA был слабым: workflow не контролировал обычный push в main и содержал устаревшую проверку английской строки `Transformation Assessment`, хотя актуальный текст русский `Диагностика трансформации`.

Это исправлено в commit:
`c154f86cb371f063cfb1a43a024b15c2b29b67e0`

QA должен запускаться для main и rebase/immediate-product и проверять:
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

Принцип: commit ≠ proof of working. Проверять build/runtime/visual result.

## 10. ПОСЛЕДНИЕ PRODUCTIZATION-РЕШЕНИЯ

Создан документ:
`docs/PRODUCTIZATION_PASS.md`
commit:
`3e97746521a5f1f7c71920ad96c0dd81e8963f2c`

Он фиксирует продуктовую причинно-следственную модель и следующий этап развития.

## 11. ПОСЛЕДНИЙ UI/INTERACTION FIX

Был найден недоделанный cursor hover: JS добавлял `cursor-dot.is-hover`, но CSS-визуального состояния не хватало.

Исправлено. Зафиксировано D-029: интерактивное состояние считается реализованным только при наличии и JS-поведения, и визуального CSS-состояния.

Основной commit:
`ba1ccb92ef5405b2932222924a39643869cc11d`

Decision Log update:
`67fbfebb47c42a284c203a681ecf802af45b5f11`

## 12. РАНЕЕ НАЙДЕННЫЕ VISUAL QA ПРОБЛЕМЫ

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

## 13. СЛЕДУЮЩИЙ ЭТАП

НЕ начинать DEX v4 до visual approval DEX v3.

Сначала:
1. Исправить/подтвердить Cloudflare production deploy command.
2. Production smoke test.
3. Полный visual QA production.
4. Python-based regression testing.
5. Desktop/mobile/cross-browser.
6. Проверка размеров блоков, вертикального ритма, typography, icons, footer, menu, cursor.
7. Проверка productization: каждый блок должен объяснять путь от проблемы к результату.
8. Проверка performance/accessibility.
9. Quality Gate.

Только после утверждения DEX v3:
DEX v4 = интерактивность + scroll-linked transformation + richer HUD telemetry + responsive motion + AI transformation assessment.

## 14. ПРИНЦИПЫ РАБОТЫ

- Не начинать новую концепцию с нуля.
- Не упрощать дизайн.
- Не заменять реальные продуктовые функции fake dashboards.
- Не придумывать кейсы.
- Не использовать generic futuristic/cyberpunk декорации.
- HUD должен объяснять процессы.
- Иконки — часть системы.
- Анимация должна иметь смысл.
- Долгосрочная robust architecture важнее короткой скорости.
- Минимальные затраты на обслуживание и поддержку.
- Перспективная автономность.
- Документировать архитектурные решения.
- Комментировать нетривиальный код.
- Каждый deploy проверять фактически.

## 15. ТЕКУЩАЯ ТОЧКА ПЕРЕД ПЕРЕХОДОМ В НОВЫЙ ЧАТ

Production root подтверждён пользователем как работающий:
`https://synapsemax.ru/` открывается нормально.

Последняя незакрытая техническая задача:
Cloudflare всё ещё необходимо проверить/исправить так, чтобы Deploy command реально выполнял `npm run deploy:cloudflare`, а не `npx wrangler versions upload`.

После этого не возвращаться к routing без фактических доказательств.

Следующий большой фокус: production visual QA + productization + regression.

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
