# Intily Cloudflare Scheduler Incident — 2026-09-02

## Canonical production finding

The production Worker `intily-ai-news` is a full direct publishing engine (approximately 1,000 lines), with Cloudflare AI, KV state and Telegram secret bindings. It is **not** a short GitHub-dispatch-only Worker.

The active production version is:

- Worker version: `16997614-81e0-4676-9a2c-40d4e250d8a1`
- Version number: `14`
- Full bindings preserved: `AI`, `STATE`, `TELEGRAM_BOT_TOKEN`, `GITHUB_DISPATCH_TOKEN`
- Compatibility date: `2026-09-01`

Cloudflare version history provides an immutable rollback record for the production Worker.

## Root cause

The deployed Worker source defines:

```js
const CRON = '*/11 * * * *';
```

and its scheduled handler deliberately exits unless:

```js
if (event.cron !== CRON) return;
```

During recovery, the Cloudflare schedule had been changed to `*/6 * * * *`. Cloudflare was successfully invoking the Worker, but every invocation was ignored by the guard because `*/6` did not equal `*/11`.

This was the direct cause of the apparent scheduler failure.

## Minimal recovery

The Worker source was not replaced and no bindings were modified.

The Cloudflare schedule was restored to the exact production value:

`*/11 * * * *`

## Safety rule

Do not replace the full production Worker with a simplified implementation. Any future change must first preserve the complete source and bindings, then make the smallest possible patch.

## GitHub correction

An earlier recovery attempt incorrectly added a short replacement Worker under `cloudflare/intily-ai-news/`. Those files were removed because they were not the canonical production implementation.

## Remaining verification

The next scheduled production cycle must be observed in Cloudflare logs for the full `publish()` path (`RUN_COMPLETE`, `PUBLISHED`, or a concrete feed/AI/Telegram error). No code change is required for this scheduler mismatch fix.