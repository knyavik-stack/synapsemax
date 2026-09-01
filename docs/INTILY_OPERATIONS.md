# Intily — AI News Publisher Operations

Дата актуализации: 2026-09-01

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

Discovery использует rolling lookback 24 часа. Exact RSS-item memory `known` имеет TTL 6 часов. `known` не является архивом публикаций.

Долговременная защита от повторов выполняется через `published` и semantic `stories`.

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
