# INTILY — Google News RSS resilience correction — 2026-09-05

## Incident
Cloudflare production logs showed repeated `FEED_ERROR WORLD HTTP_503` / `RUSSIA HTTP_503` from `news.google.com` during scheduled execution. The Python Worker itself was running; the discovery transport was being rejected by Google.

The previous runtime had a high-frequency burst pattern: the publisher iterated over a large list of narrow Google News RSS queries with a datacenter-style `User-Agent`. The project history already identified the correct mitigation class: browser-like request headers, fewer/broader queries, and jitter between Google requests.

## Correction
Google News RSS remains the canonical discovery source.

The production runtime now:

1. uses a modern Chrome browser-profile `User-Agent` and browser navigation headers;
2. reduces discovery from the former large query burst to four broad high-recall Google News searches (2 WORLD + 2 RUSSIA);
3. serializes Google requests;
4. inserts 1.8–3.2s randomized delay before each Google request;
5. retries transient 503/429/403/timeout failures once after a 4–7s randomized delay;
6. keeps the existing 12h editorial lookback and AI relevance/importance gates;
7. falls back to direct publisher RSS only after Google discovery fails for a region, preserving publication continuity;
8. makes the runtime wrapper idempotent so long-lived Python Worker isolates do not stack wrappers across Cron invocations.

## Why Google stays primary
Google News aggregates a much broader source universe than the small direct-RSS fallback set and is the discovery layer historically verified for INTILY. The direct feeds are resilience only, not a replacement.

## Validation criteria
A deployment is not considered GREEN until Workers Logs show, for at least one fresh Cron cycle:

- `GOOGLE_RUNTIME_READY queries 4 browser_profile True`;
- `RSS_QUERY WORLD raw N` and/or `RSS_QUERY RUSSIA raw N` with N > 0;
- `INGEST_SUMMARY ... candidates N` with N > 0 when qualifying news exists;
- successful queue insertion and/or publication;
- no repeated Google 503 storm;
- KV heartbeat/state advancement.

If Google remains blocked despite this transport correction, the next escalation is Cloudflare Browser Run as an on-demand browser-rendering fallback, not a permanent replacement of Google RSS. Browser Run is deliberately not made the primary path because the current Workers Free tier has only 10 browser minutes/day; the paid tier includes 10 browser hours/month before additional usage. See Cloudflare Browser Run pricing/limits.

## Backup
Before replacement, the previous `intily_feed_runtime.py` was copied to:

`docs/backups/2026-09-05/intily_feed_runtime.pre-google-browser-profile.py`
