# Intily — AI News Publisher Operations

Дата актуализации: 2026-09-02

## Production objective

Intily непрерывно обнаруживает важные AI-новости, накапливает их в durable queue и публикует не более одной новости за production cycle. Cycle запускается каждые 5 минут через Cloudflare Worker.

## Discovery

Основной discovery source — Google News RSS search. Текущие query-кластеры: общий AI, OpenAI, Anthropic/Claude, Google DeepMind/Gemini, agents/robotics, chips/Nvidia/GPU, regulation/safety/law, investment/acquisition/funding, research/breakthrough, российский ИИ, Яндекс/Сбер/VK и российское регулирование/инвестиции.

Каждый запуск пишет диагностические counters:

```text
RSS_QUERY ...
INGEST_SUMMARY ...
QUEUE_INGEST ...
```

Это позволяет отличить отсутствие новостей от их отбрасывания фильтрами.

## Freshness and memory

Discovery использует rolling lookback 12 часов. Exact RSS-item memory `known` имеет TTL 6 часов. `known` не является архивом публикаций.

Долговременная защита от повторов выполняется через `published` и semantic `stories`.

## Content quality and regional policy

Целевой редакционный состав: **примерно 80% WORLD / 20% RUSSIA**.

Это не механическая блокировка: если за период нет достаточного количества качественных российских материалов, свободные слоты получает WORLD. Но Россия имеет reserved queue capacity и publication boost, который принудительно выбирает российскую публикацию при недоборе квоты, если её фактическая доля в последних публикациях падает ниже 20%.

Тематика расширена: business adoption, automation, AI tools/platforms, developer/coding, cybersecurity, healthcare, education, science, industrial applications и technology reviews.

Очередь больше не является складом на 100 материалов. Рабочая цель — около 36 лучших свежих историй, hard cap — 48. При queue pressure применяется ranked rebalance.

## Filtering pipeline

1. RSS fetch.
2. Score.
3. Freshness.
4. Exact key dedup.
5. Semantic story dedup внутри discovery batch.
6. Semantic dedup против queue.
7. Semantic dedup против recent published story memory.
8. Admission в durable queue.

## Durable queue

Queue хранится в `data/intily-ai-news-state.json` и сохраняется в GitHub после run.

При ошибке обработки item не удаляется из durable queue. Для диагностики сохраняются `last_failed_at`, `last_failure`, `failure_count`; cycle может продолжить обработку следующего item.

## Publication model

`MAX_PUBLISH = 1`. Поэтому накопленные новости не выпускаются пачкой: backlog постепенно уменьшается по одной публикации каждые 5 минут.

## AI providers

Failover order: Gemini → Groq → OpenAI. Provider cooldown используется для недоступных провайдеров.

## Editorial QA

Перед Telegram выполняется editorial QA. Канцелярские запретные формулировки и sensitive-topic joke suppression остаются частью контракта.

## Runtime verification — 2026-09-01 22:40 UTC

Production run после ingestion fix дал:

```text
RSS raw items: 337
score-filtered: 213
story dedup inside discovery: 32
candidates: 92
queue added: 2
already queued: 85
story queue duplicates: 2
story history duplicates: 3
published: 1
queue after: 91
heartbeat: OK
failures: 0
```

Это прямое доказательство, что поиск новостей работает: один production cycle получил 337 RSS items и сформировал 92 кандидата.

Фактический state после run: `queue=91`, `published=17`, `stories=2`, `known=94`, `health=OK`, `consecutive_failures=0`.

## Status

### GREEN

- Google News RSS discovery реально работает.
- Расширенные query-кластеры реально возвращают материалы.
- Ingestion counters работают.
- Semantic story dedup работает.
- Durable queue сохраняется.
- Failed item не выбрасывается из queue.
- Gemini успешно сгенерировал материал в production verification.
- Telegram delivery подтверждён.
- Heartbeat OK.
- Cloudflare → GitHub dispatch architecture работает.
- Двойного GitHub scheduler после удаления `schedule` не обнаружено.

### YELLOW

- Queue `91/100`: нужен queue-pressure policy, чтобы длительный backlog не ухудшал приоритет свежих важных историй.
- Semantic `stories=2`: исторические публикации, сохранённые ранее только как key/timestamp, нельзя полностью восстановить в semantic memory без внешней истории.
- GitHub Actions сообщает Node 20 deprecation warning для `actions/checkout@v4`; не блокирует production, но требует планового обновления.
- После фикса требуется наблюдение нескольких последовательных production cycles, чтобы подтвердить стабильное пополнение новыми событиями, а не только переработку backlog.

### RED

- Критических красных блокеров на текущей проверке нет.

## Operational rule

Обычный production workflow не запускается вручную. Канонический production trigger — Cloudflare Worker. Ручные/diagnostic executions используются только для согласованной диагностики.


## Latest reliability change

2026-09-01: queue retention was separated from discovery freshness and set to 7 days. Failed items receive durable exponential retry scheduling from 5 minutes up to 6 hours.


## Quality optimization — 2026-09-02

- Freshness: **12 hours**.
- MIN_SCORE повышен.
- Добавлен второй редакционный gate editorial_value.
- Trusted sources получают отдельный bonus.
- High-impact events получают bonus.
- Applied AI / technology / tools / enterprise use cases получают bonus.
- Low-signal материалы получают penalty.
- Semantic dedup усилен named-anchor matching и более строгим threshold.
- Target queue: **36**.
- Hard queue cap: **48**.
- Regional target: **80% WORLD / 20% RUSSIA**.
- Russian stories имеют reserved queue capacity и publication deficit boost.
- Queue pressure решается ranked rebalance, а не FIFO truncation.

Production metrics:

QUEUE_INGEST ... world N russia N

Финальный run JSON содержит world_queue и russia_queue.

## Latest production correction — 2026-09-02

Live state inspection found that the queue policy was working (`queue=17`, `WORLD=11`, `RUSSIA=6`, publication history `17/3`), but several legacy B-tier items with scores below the current `MIN_SCORE=9` were still present because durable queue entries were admitted under older rules and rebalance did not revalidate them.

Correction:

- every durable queue item is revalidated against the current score, AI relevance and editorial gate on every rebalance;
- stale low-score/off-topic legacy entries are removed automatically;
- an explicit AI relevance gate prevents broad Google News query leakage from unrelated technology/business stories;
- `QUEUE_REBALANCE_FILTER` exposes how many items were removed for expiry or quality.

This keeps durable memory without allowing obsolete backlog rules to contaminate current editorial output.

## Live status update — 2026-09-02

После durable queue revalidation live state был повторно проверен: queue=1, published=129, stories=114, known=61. Это означает, что прежний backlog около 100 материалов больше не является текущим production backlog: legacy low-quality entries очищены по действующей editorial policy.

Один последующий cycle завершился с FAILED_NO_PUBLISH и consecutive_failures=1, хотя сам workflow завершился успешно и state был сохранён. Причина publication-level failure остаётся под наблюдением следующих Cloudflare-triggered cycles; queue и память не потеряны.

Также исправлен browser QA: focus-visible теперь проверяется через реальную Tab-навигацию, а не через programmatic focus, который не обязан активировать keyboard focus ring.

## Verification closure — 2026-09-02

Следующий Cloudflare-triggered cycle после единичного FAILED_NO_PUBLISH восстановился штатно:

- RSS raw items: 169;
- candidates: 19;
- Gemini: OK;
- Editorial QA: OK;
- Telegram message_id: 138;
- published: 1;
- queue_after: 0;
- heartbeat: OK;
- consecutive failures: 0.

Таким образом queue-pressure correction подтверждён не только state inspection, но и последующим реальным production publish. CI modernization также завершён: workflows используют actions/checkout@v6 и actions/setup-node@v6, а полный Immediate QA с Chromium browser gate прошёл SUCCESS.


## Update 2026-09-02 — 6h freshness / 60:40 regional mix / practical AI expansion

### GREEN
- Discovery window reduced from 12 hours to 6 hours.
- Editorial regional target changed to 60% WORLD / 40% RUSSIA.
- Russian query coverage expanded to support the target.
- Search coverage expanded toward AI implementation in business, practical workflows, sector adoption, technical deployment details, cost/reliability, security, incidents and operational problems.
- Editorial scoring now explicitly rewards practical implementation, risks/problems and high-exclusivity developments.
- Semantic duplicate detection was tightened: sharing a company name is no longer sufficient to classify two different events as the same story.
- Published-story memory remains durable, but semantic event suppression now uses a 24-hour horizon rather than 72 hours so legitimate follow-up developments are not blocked.
- Queue remains bounded and freshness-first; items outside the active window are intentionally dropped instead of accumulating indefinitely.

### Scheduler
- Cloudflare Worker intily-ai-news is the canonical scheduler.
- Its cron is */11 * * * *.
- Duplicate cron on intily-news-trigger is disabled.

### Queue interpretation
A queue value of zero does not mean historical memory was lost. Published and story history remain persisted separately. Queue contains only currently publishable, fresh, unique candidates. The previous zero occurred after stale queued candidates were pruned and the current candidate set was rejected by duplicate/history gates. The gates are now narrower to avoid treating unrelated stories about the same company as duplicates.


### Follow-up hardening — duplicate queue cleanup
- Added a second-pass event dedup during queue rebalance so duplicate stories restored from state or arriving through multiple search queries cannot survive as separate queue entries.
- Added title-bigram event matching to catch the same model/product launch reported with different wording.
- Added targeted Russian-source discovery queries to improve the availability of fresh Russia candidates while preserving the editorial quality gates.
- The 60/40 ratio remains a target, not fabricated content: when fewer qualifying Russian stories exist in the active 6-hour window, the system publishes fewer rather than filling the quota with irrelevant material.


---

## Current canonical status — 2026-09-02 11:25 UTC

The canonical current status is docs/PROJECT_STATUS_2026-09-02.md. Earlier sections above preserve historical recovery evidence and may contain superseded values such as 12-hour freshness, 5-minute cadence or 80/20 regional mix. Current production policy is:

- discovery freshness: **6 hours**;
- Cloudflare cadence: **every 11 minutes** (*/11 * * * *);
- regional target: **60% WORLD / 40% RUSSIA**;
- target queue: **24**; hard cap **30**;
- MIN_SCORE=9; MAX_PUBLISH=1;
- story memory: **24 hours**; known-item memory: **6 hours**.

Cloudflare cleanup completed: duplicate Worker intily-news-trigger was deleted after verification that it had no schedules and no routes. The canonical Worker is intily-ai-news.
