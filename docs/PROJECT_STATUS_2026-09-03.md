# INTILY Production Status — 2026-09-03

## Current architecture

`Cloudflare Cron → intily-ai-news Worker → GitHub workflow_dispatch → scripts/intily_ai_news.py → Telegram`

Cloudflare is the scheduler; GitHub Actions is the publisher execution environment. The workflow remains `workflow_dispatch` only. GitHub documents that workflow dispatch requires the workflow to accept that event, and the REST endpoint supports dispatch by workflow filename/ref.

## Production policy

- Search: every 30 minutes, or immediately at queue size 0–1.
- Publication: one story per cycle, minimum 3 minutes between posts.
- Importance: 0–100 deterministic model; only >=60 enters queue/publication.
- Queue: max 20; RU minimum 50% when enough qualifying RU stories exist.
- Humor: target 90% on suitable non-serious stories; serious topics suppress humor.
- Candidate queue reset: performed without deleting published-story history.

## Verification

Live full collector test: 216 raw items → 51 qualifying candidates; 31 WORLD / 20 RUSSIA. This is sufficient to satisfy the 50% RU queue quota at the 20-item cap.

Manual GitHub publisher run after the first policy commit completed successfully.

Cloudflare scheduler was changed from the observed `*/2` to the required `*/3 * * * *`. Active deployment is version 44 after this scheduler-only update; all four existing bindings are retained.

## Backups

`docs/backups/2026-09-03/intily_ai_news.py.prechange` — publisher before policy migration.
`docs/backups/2026-09-03/intily-ai-news.worker.v43.prechange.js` — exact Cloudflare Worker source before scheduler migration.
`docs/backups/2026-09-03/intily-ai-news-state.prechange.json` — durable state before queue reset.
Cloudflare version 43 remains the infrastructure rollback point.
