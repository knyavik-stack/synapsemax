# Intily Cloudflare Trigger Incident — 2026-09-02

## Finding

The production Cloudflare Worker `intily-ai-news` was not running the canonical scheduler implementation. Its active quick-editor versions contained direct RSS/news-processing code (`NEWS_FEED_ERROR`, `RUN_COMPLETE`) instead of dispatching the GitHub Actions workflow.

Cloudflare Observability proved the Worker itself was receiving Cron events. The active code then attempted WORLD/RUSSIA RSS fetches and received HTTP 503 responses, ending cycles with zero candidates/publications. No `GITHUB_DISPATCH` events were present in the preceding 24h.

This means the primary failure was **Worker implementation drift**, not a missing Cloudflare Cron event.

## Recovery actions

1. Restored the canonical Cron schedule to `*/6 * * * *` on `intily-ai-news`.
2. Confirmed only one Intily Worker exists; the historical `intily-news-trigger` Worker is absent.
3. Confirmed GitHub Actions workflow `Intily AI News Publisher` is active and manual `workflow_dispatch` execution succeeds.
4. Added the canonical scheduler source to GitHub under `cloudflare/intily-ai-news/worker.js`.
5. Added `cloudflare/intily-ai-news/wrangler.jsonc` with the production Cron and required `GITHUB_DISPATCH_TOKEN` declaration.
6. The previous direct-news Worker version was restored temporarily after a rollback test to avoid leaving a no-op Worker active.

## Verification evidence

- GitHub manual production run succeeded at `2026-09-02T14:15:48Z`.
- Cloudflare Cron was observed executing on the active Worker.
- After schedule repair, Cloudflare reported a scheduled invocation on version `45a399bc-dc0c-4d06-8dbe-c2dd039c640f` at `2026-09-02T14:24:34Z`; that historical version was a no-op and was not retained as production.
- Production was returned to the previous active version `16997614-81e0-4676-9a2c-40d4e250d8a1` while the canonical scheduler source is prepared in GitHub.

## Required final deployment

The canonical `worker.js` must be deployed to Cloudflare Worker `intily-ai-news` using the existing `GITHUB_DISPATCH_TOKEN` secret binding, then verified by observing a `GITHUB_DISPATCH 204` event followed by a new GitHub Actions `workflow_dispatch` run.

## Operational rule

Cloudflare is the only production scheduler. GitHub Actions must not have a `schedule` trigger. Worker source/configuration must be maintained from the GitHub-controlled canonical files above rather than edited independently in the Cloudflare Quick Editor.
