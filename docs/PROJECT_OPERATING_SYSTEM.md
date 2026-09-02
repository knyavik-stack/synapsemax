# SynapseMax / Intily — Project Operating System

Дата актуализации: 2026-09-01

## 1. Назначение проекта

SynapseMax — продуктовая платформа/сайт будущей Transformation Intelligence Platform. Репозиторий `knyavik-stack/synapsemax` содержит фронтенд-прототип, продуктовую документацию, QA/acceptance contracts и автоматизированный контур Intily — AI-новостного издателя для Telegram.

## 2. Канонический production-контур

```text
Google News RSS → Intily ingestion → score/freshness → semantic story dedup
→ durable queue → AI editorial generation/QA → Telegram @intily
→ published/story memory → GitHub state persistence
```

Production scheduler: Cloudflare Worker `intily-news-trigger`, Cron `*/5 * * * *`.

Worker вызывает GitHub Actions workflow `Intily AI News Publisher` через `workflow_dispatch`. Production workflow не использует GitHub `schedule`.

## 3. Основные компоненты

| Компонент | Роль | Статус |
|---|---|---|
| `scripts/intily_ai_news.py` | discovery, scoring, dedup, queue, AI, Telegram, health | GREEN |
| `data/intily-ai-news-state.json` | durable publisher state | GREEN |
| `.github/workflows/intily-ai-news.yml` | production execution + state persistence | GREEN |
| Cloudflare Worker `intily-news-trigger` | единственный production scheduler | GREEN |
| Google News RSS | discovery layer | GREEN / verified |
| Telegram `@intily` | publication target | GREEN |
| `docs/DECISION_LOG.md` | architecture decisions | GREEN |
| `docs/*` | strategy, handoff, UX/QA and operations | GREEN |
| SynapseMax frontend | product interface | GREEN baseline |

## 4. Принципы Intily

1. Найденная новость не равна опубликованной новости.
2. Очередь durable: ошибка одной новости не уничтожает её из очереди.
3. Exact-item memory — короткая техническая память, не долговременный blacklist.
4. Semantic story memory защищает от повторной публикации одного события в разных формулировках.
5. Один production cycle публикует максимум одну новость.
6. Очередь накапливает новости между пятиминутными публикациями.
7. Provider failover: Gemini → Groq → OpenAI.
8. State сохраняется в GitHub после production run.
9. Production scheduler остаётся Cloudflare-only.
10. Существенные дефекты и решения фиксируются в Markdown/Decision Log.

## 5. Память

- `queue`: ожидающие публикации новости.
- `published`: реально опубликованные item keys.
- `stories`: semantic memory опубликованных историй.
- `known`: кратковременная память RSS-item keys.
- `health`: heartbeat/failure state.
- `providers`: provider cooldown/failover state.

Фактическое состояние после production run 22:40 UTC: `queue=91`, `published=17`, `stories=2`, `known=94`, `health=OK`, `consecutive_failures=0`.

## 6. Production-ready критерии

Production-ready — это не только успешный build. Должны подтверждаться discovery свежих источников, измеримый ingestion, semantic dedup, durable queue, provider failover, Telegram delivery, state persistence, отсутствие двойного scheduler и успешные CI/Smoke/Cloudflare gates.

## 7. Канонические документы

- `docs/INTILY_OPERATIONS.md` — эксплуатационная модель Intily.
- `docs/DECISION_LOG.md` — архитектурные решения.
- `docs/STRATEGIC_REBASELINE.md` — стратегическая рамка.
- `docs/UX_QUALITY_CONTRACT.md` — UX/QA контракт.
- `docs/RC_CHAT_TRANSITION_2026-08-30.md` — RC transition history.
- `docs/NEW_CHAT_START_PROMPT.md` — handoff/start context.

## 8. Правило продолжения

Новые изменения сверяются с этим документом и Decision Log. После существенного изменения обновляются код, verification и документация. GitHub должен оставаться источником истины, позволяющим продолжить проект без восстановления состояния из памяти чата.


## Latest reliability change

Commit `8b34a9130b182a65164ba36b5e3ed0f1e9ccf4fd` separates queue retention from discovery freshness: queued stories are retained for 7 days, while discovery remains 24h. Failed queue items now receive exponential retry backoff from 5 minutes up to 6 hours.

## Latest production correction — 2026-09-02

Durable queue state is not trusted blindly across scoring-policy revisions. Each cycle revalidates queued items using the current AI relevance, score and editorial-quality gates before regional rebalance and publication. This preserves durable memory while automatically purging legacy backlog that no longer meets the live editorial standard.

## Live verification after queue-policy correction — 2026-09-02

После применения revalidation durable queue фактический state сократился до queue=1, published=129, stories=114, known=61; в очереди оставалась одна WORLD-история со score 12. Это подтверждает, что legacy backlog около 100 материалов очищен и ranked/revalidation policy работает.

Последний зафиксированный run в этот момент имел FAILED_NO_PUBLISH и consecutive_failures=1: кандидаты существовали, но Telegram получил ноль публикаций в конкретном cycle. Workflow при этом завершился технически успешно и сохранил state; это остаётся предметом наблюдения следующих production cycles, а не поводом возвращать backlog policy.

### QA correction

Immediate QA выявил не продуктовый дефект, а некорректную проверку accessibility: тест использовал programmatic HTMLElement.focus(), хотя H1 intentionally показывает ring через focus-visible, который зависит от keyboard modality. Browser gate переведён на реальную keyboard navigation через Tab и проверяет тот же computed focus indicator после фактического клавиатурного фокуса.

### Current status update

Queue-pressure issue из предыдущего YELLOW статуса закрыт фактической проверкой (queue=1 после revalidation). Остаются: наблюдение нескольких cycles после quality correction, исторический semantic-memory gap для старых публикаций и CI runtime modernization выполнена: workflows переведены на actions/checkout@v6 и actions/setup-node@v6, Immediate QA прошёл полностью.

## Verification closure — 2026-09-02

Следующий Cloudflare-triggered production cycle подтвердил восстановление после единичного FAILED_NO_PUBLISH: ingestion получил 169 RSS items, сформировал 19 candidates, Gemini успешно прошёл editorial generation, Telegram отправил message_id=138, published=1, queue_after=0, heartbeat=OK, failures=0.

Immediate QA после исправления keyboard focus и обновления CI action runtimes завершился SUCCESS: build, runtime tests, routing, artifact budget, Wrangler, deployment graph, local Worker, Chromium browser UX gate и artifact upload прошли полностью.
