# INTILY Production Status — 2026-09-04

## Canonical production architecture

`Cloudflare Cron (every minute) → 1/3 random gate in Worker → GitHub workflow_dispatch → scripts/intily_ai_news.py → Telegram`

The GitHub workflow remains `workflow_dispatch` only. The Worker performs no news collection itself on the scheduled path.

## Current publication policy

- Search: every 30 minutes, or immediately when the durable queue has 0–1 items.
- Publication: one story per eligible execution, minimum 3 minutes between Telegram posts.
- Importance threshold: **60.0**.
- Weight precision: all scoring/priority components are represented as floats and rounded to one decimal where persisted/displayed.
- Recency: <3h = **+2.5 RU / +1.5 WORLD**; >3h = **−2.0 both**; exactly 3h = no special adjustment.
- Russian experiment: **60% queue target** when enough qualifying RU candidates exist; persistent random **+1.0…+5.0** RU bonus assigned once.
- Queue: max 20 qualifying stories.
- Humor: target 90% on suitable non-serious posts; serious/security/regulation/law/harm incidents suppress humor.

## Duplicate filtering — corrected

The previous filter depended too heavily on source/title similarity and could miss syndicated stories with different source names or paraphrased headlines. The current filter is source-independent and checks canonical URLs, normalized exact titles, token containment, title similarity, title n-grams, and distinctive event anchors. It is used both during ingestion and against the recent published-story memory.

## Cloudflare scheduler — changed

The production Worker cron is now `* * * * *`. At the very start of each scheduled invocation it executes a random integer gate from 1 through 3. If the value is not 1, the invocation returns immediately and does not call GitHub. If it is 1, the existing GitHub dispatch path runs unchanged. Existing bindings are preserved: `AI`, `STATE`, `TELEGRAM_BOT_TOKEN`, `GITHUB_DISPATCH_TOKEN`.

This keeps the expected dispatch cadence near one successful dispatch every three minutes while allowing minute-level scheduler granularity. It is probabilistic, not a hard three-minute guarantee.

## Verification performed before production write

- Python syntax check: **PASS**.
- Recency test: 2h RU score received +2.5 versus equivalent 4h RU score; 2h WORLD received +1.5 versus equivalent 4h WORLD score; 4h cases received −2.0.
- Duplicate tests: exact title across different sources = duplicate; paraphrased title = duplicate; unrelated story = not duplicate.
- Worker source was read from the live deployment before modification.
- Live Worker bindings were captured before upload.

## Backups / rollback

- `docs/backups/2026-09-04/intily_ai_news.py.pre-weight-dedup-minute-gate` — exact publisher source before this change.
- `docs/backups/2026-09-04/intily-ai-news.worker.v46.pre-weight-dedup-minute-gate.js` — exact Worker source before scheduler change.
- Cloudflare Worker version **46** remains the pre-change infrastructure rollback point.

## Remaining validation

The code-level changes are complete, but production validation still requires observing several automatic minute-level ticks and at least one successful gate=1 dispatch, then confirming the resulting GitHub run and publisher behavior. The scheduler is intentionally probabilistic, so one or more skipped ticks is expected.
