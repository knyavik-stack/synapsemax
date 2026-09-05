# INTILY — Cloudflare Runtime Incident 2026-09-05

## Incident
Production Cron invocations were reaching the Python Worker but terminating immediately with `AttributeError: 'NoneType' object has no attribute 'STATE'` in `scheduled()`.

## Root cause
The deployed Python `WorkerEntrypoint.scheduled()` invocation supplied `env=None` in the observed runtime shape. The code trusted `env.STATE` instead of the guaranteed entrypoint environment `self.env`.

## Evidence
Observed in Workers Logs on 2026-09-05 at approximately 11:45 UTC:
- Worker: `intily-ai-news`
- Cron: `* * * * *`
- eventType: `scheduled`
- outcome: `exception`
- error: `AttributeError: 'NoneType' object has no attribute 'STATE'`

The same defect was present in the previously deployed Wrangler version `36d8d175-dddc-4e0a-860f-3969ae3594b7`, so the earlier rollback was a safety rollback, not a functional fix.

## Remediation
1. Rolled production back from accidental Quick Editor version `6225827c-89c9-4b88-b20a-3289dde770ed` to the verified Python version as an immediate safety measure.
2. Patched `intily_python_worker/src/main.py` so scheduled execution consistently uses `self.env` for KV, secrets, and Workers AI bindings. Optional `env`/`ctx` parameters are retained for compatibility but are no longer trusted.
3. Preserved the exact pre-fix entrypoint in `docs/backups/2026-09-05/main.py.pre-scheduled-env-fix`.
4. Workers Builds must deploy the patched commit before runtime acceptance is declared GREEN.

## Acceptance criteria
- Workers Build succeeds from the repository.
- Patched Python version is deployed at 100%.
- At least one Cron invocation completes without exception.
- KV `intily:publisher:v1` is read and written successfully.
- `/health` reports a current `last_run` after a real scheduled execution.
- Telegram publication resumes through Cloudflare without GitHub-hosted runner minutes.

## GitHub Actions decision
The old GitHub publisher is `workflow_dispatch` only and remains an emergency/manual fallback. It has no schedule, so it cannot automatically duplicate Cloudflare publications after the monthly quota resets.
