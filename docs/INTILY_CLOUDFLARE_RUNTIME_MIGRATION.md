# INTILY — Cloudflare-native Python runtime migration

Date: 2026-09-05

## Decision
Production news execution is being moved from GitHub Actions to Cloudflare Python Workers. GitHub remains source control and emergency/manual CI; it is no longer the production scheduler/runtime.

## Production topology
Cloudflare Cron (`* * * * *`) -> Python Worker `intily-ai-news` -> KV `STATE` -> RSS/AI -> Telegram.

## Why
GitHub Actions private-repository quota reached 100%, blocking scheduled runs. Cloudflare Python Workers support the existing Python engine and Cloudflare-native bindings, avoiding a risky JS rewrite.

## Runtime policy preserved
- search every 30 minutes; immediate search when queue <= 1;
- publish no more than once every 3 minutes;
- maximum queue 20;
- importance threshold 60.0;
- Russian queue target 60% when sufficient candidates exist;
- Russian weight bonus 2.0–5.0 with one decimal;
- freshness: <3h => RU +2.5, WORLD +1.5; >3h => -2.0 for both;
- semantic/URL/title duplicate protection;
- 90% joke target only for suitable non-serious stories;
- Telegram editorial QA and AI failover retained.

## Safe rollout
1. Existing production Worker remains unchanged until the new runtime is validated.
2. Python Worker project is committed under `intily_python_worker/`.
3. Cloudflare Workers Builds is connected to GitHub repository `knyavik-stack/synapsemax`.
4. Production trigger is configured for `main`, root `/intily_python_worker`, using `uvx --from workers-py pywrangler deploy --yes`.
5. The production Worker cron remains `* * * * *`; the old random 1..3 dispatch gate is no longer needed after runtime cutover.
6. The GitHub Actions workflow is retained as an emergency/manual path until sustained green validation is complete.

## Current validation status
- Cloudflare MCP connection: ACTIVE.
- GitHub repository connection in Workers Builds: ACTIVE.
- Production build trigger: CREATED.
- Python source: `py_compile` PASS.
- Cloudflare Python runtime deployment: PENDING canary build result.
- Existing production Worker: unchanged.

## Rollback
If the Python build or runtime validation fails, do not promote it; keep the current production Worker and GitHub workflow path intact.
