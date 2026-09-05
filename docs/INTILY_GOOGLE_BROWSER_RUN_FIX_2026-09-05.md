# INTILY — Google News Browser Run recovery — 2026-09-05

## Live finding
The first Google transport correction was deployed and verified in production. It reduced the query burst and added browser-profile headers/jitter, but Cloudflare Logs still showed Google `HTTP_503`. Therefore headers alone are insufficient from the current Cloudflare egress.

## Production correction
Google News remains the canonical discovery source. The Worker now uses a two-stage transport:

1. normal RSS fetch with a Chrome browser profile, browser navigation headers and randomized pacing;
2. on Google 403/429/503/timeout, the Worker invokes the Cloudflare **Browser Run** binding and opens the exact Google News RSS URL in a real headless Chromium browser;
3. rendered HTML is converted back to the RSS XML document and passed through the existing deterministic RSS parser;
4. only if both direct and browser transports fail does the regional direct-publisher RSS fallback activate.

The discovery query count was reduced to two broad searches (WORLD + RUSSIA) to keep Browser Run usage bounded. The existing 12-hour editorial window, importance >=60 gate, AI relevance, deduplication, queue policy, RU share and Telegram publisher are unchanged.

## Cloudflare configuration
`intily_python_worker/wrangler.toml` now declares:

```toml
[browser]
binding = "BROWSER"
```

Python Workers can use JavaScript/runtime APIs through the Python Workers FFI, and Browser Run is an officially supported Worker binding. Quick Actions such as `/content` run through the authenticated browser binding without a separate API token.

## Cost/risk control
Browser Run is an **on-demand recovery path**, not the first request. This avoids spending browser time when ordinary Google RSS works and limits the daily browser workload.

## Validation
Required GREEN evidence after deployment:

- `GOOGLE_RUNTIME_READY ... browser_run True`;
- a fresh scheduled run on the new version;
- `GOOGLE_BROWSER_FALLBACK` when direct Google returns 503;
- `RSS_QUERY WORLD raw > 0` and/or `RSS_QUERY RUSSIA raw > 0` from the browser transport;
- no `FEED_BUDGET_EXCEEDED`;
- queue insertion and Telegram publication when a qualifying item is available.

## Backups
Before this integration, backups were created for the feed runtime, Worker entrypoint and Wrangler config under `docs/backups/2026-09-05/*pre-browser-binding*`.
