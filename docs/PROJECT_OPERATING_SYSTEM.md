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
