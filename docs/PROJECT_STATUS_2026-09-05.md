# INTILY — Project Status 2026-09-05

## GREEN
- Current production Worker remains intact.
- Cloudflare authentication restored.
- Python Worker source prepared and syntax-checked.
- Cloudflare Workers Builds GitHub connection created for `knyavik-stack/synapsemax`.
- Production build trigger created for `main` at `/intily_python_worker`.
- Core INTILY policy remains preserved: 60 importance threshold, 60% RU target, float weights, freshness bonuses/penalties, duplicate filtering, 3-minute publication cadence, 30-minute search cadence, queue <=1 urgent search.

## YELLOW
- First Cloudflare Workers Build must be executed and validated before claiming production cutover.
- KV state bootstrap from the existing GitHub state must be verified during/after first successful runtime execution.
- GitHub Actions workflow remains as emergency/manual fallback until sustained green operation is proven.

## RED
- None. No production rollback has been required.

## Incident context
GitHub Actions reached 100% of its included monthly minutes and stopped starting jobs because recent payments failed or the spending limit was not sufficient. This is the reason for removing GitHub Actions from the production runtime path.

## Architecture decision
Cloudflare Python Workers is preferred over a Python-to-JavaScript rewrite because the current engine is already Python and Cloudflare provides a Python Worker runtime with KV, AI, Cron and asynchronous fetch support.
