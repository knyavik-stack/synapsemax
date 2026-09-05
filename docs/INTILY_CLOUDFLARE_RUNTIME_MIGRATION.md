# INTILY — Cloudflare-native Python runtime migration

Date: 2026-09-05

Production news execution is moving from GitHub Actions to Cloudflare Python Workers. GitHub remains source control and emergency/manual CI; it is no longer the production scheduler/runtime.

## Verified deployment
- Worker: `intily-ai-news`
- Active version after successful Python build: `8d949726-33ef-4854-be2a-3242c2738719`
- Cron: `* * * * *`
- Runtime bindings observed by Wrangler: `STATE` KV and `AI`
- GitHub source: `knyavik-stack/synapsemax`
- Workers Builds production trigger: `ff76ed68-6958-4209-bad1-620580f9fcdd`

## Runtime policy preserved
- search every 30 minutes; immediate search when queue <= 1;
- publish no more than once every 3 minutes;
- maximum queue 20;
- importance threshold 60.0;
- Russian queue target 60%;
- one-decimal Russian bonus and dynamic freshness adjustments;
- semantic/URL/title duplicate protection;
- 90% joke target only for suitable non-serious stories;
- Telegram editorial QA and AI failover.

## State migration
The current GitHub state file was copied into KV under `intily:publisher:v1`. The new Python runtime treats this KV key as canonical; GitHub state persistence is no longer required for production execution.

## Build incident
The first build failed because Wrangler received unsupported `--yes`. The retry succeeded after removing it. A subsequent config-path retry initially pointed to a duplicated nested path; the final command uses `--config wrangler.toml` from the Workers Builds root directory and succeeded.

## Rollback
The old verified Worker version remains available in deployment history. During validation, the mistaken root SynapseMax bundle was immediately rolled back to the verified version before the final Python deployment.
