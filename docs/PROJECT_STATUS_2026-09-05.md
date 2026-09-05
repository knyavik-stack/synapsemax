# INTILY — Project Status 2026-09-05

## GREEN
- Production runtime is now Cloudflare Python Workers.
- Active production version: `8d949726-33ef-4854-be2a-3242c2738719` at 100%.
- Worker `intily-ai-news` responds successfully on `/health`.
- Cron configuration is `* * * * *`.
- Cloudflare Workers Builds is connected to `knyavik-stack/synapsemax`; production trigger is active for `main`.
- The first failed build was diagnosed and fixed: Wrangler rejected `--yes`; a second build succeeded after removing it.
- The first successful Python deployment initially exposed a config-selection issue; the trigger was corrected to pass `--config wrangler.toml`. The subsequent build successfully deployed the Python bundle with STATE KV and AI bindings.
- Current GitHub Actions workflow remains only as emergency/manual fallback; production runtime no longer depends on Actions minutes.
- Existing INTILY policy remains in the Python core: importance >=60.0, RU target 60%, one-decimal weights, freshness bonuses/penalties, duplicate protection, queue max 20, 30-minute search cadence, <=1 urgent search, 3-minute publication interval.

## YELLOW
- Cron propagation and first scheduled production execution still require observation after deployment; Cloudflare documents that Cron changes can take several minutes to propagate.
- KV state was bootstrapped from current GitHub `data/intily-ai-news-state.json` into the new canonical key `intily:publisher:v1`; first scheduled run must confirm read/write continuity.
- Queue diagnostics footer is still intentionally enabled.
- GitHub emergency workflow should remain until sustained Cloudflare-native operation is proven.

## RED
- None.

## Incident / rollback record
At 07:04 UTC a Workers Build successfully ran but deployed the wrong root `synapsemax` bundle because the Python deploy command did not explicitly select the nested Wrangler config. Production was immediately rolled back to the verified version. No credential or state data was deleted. The corrected deployment at 07:08 UTC explicitly loaded `intily_python_worker/wrangler.toml` and produced the intended Python Worker.

## Next validation
1. Observe Cron past events / health state after propagation.
2. Confirm one real scheduled engine execution and state persistence.
3. Confirm Telegram publication or an intentional publish-wait decision from the engine.
4. After sustained green operation, disable/archive the old GitHub Actions production path.
