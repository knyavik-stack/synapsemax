# INTILY — Project Status 2026-09-05

## GREEN
- Production architecture is Cloudflare Python Workers; GitHub Actions is not the production execution path.
- Worker `intily-ai-news` has Cron `* * * * *`.
- Workers Builds is connected to `knyavik-stack/synapsemax` and deploys the nested Python Worker with an explicit Wrangler config.
- Production state was migrated to KV key `intily:publisher:v1`.
- Required bindings are present: `STATE`, `AI`, `TELEGRAM_BOT_TOKEN`, `GITHUB_DISPATCH_TOKEN`.
- The accidental Quick Editor overwrite was detected and rolled back safely.
- The old GitHub publisher has no schedule; it is manual/emergency only.

## YELLOW
- Confirmed production Cron defect: `scheduled()` was invoked with `env=None` and failed on `env.STATE`.
- The defect is patched on `main` in commit `7a86153bf8046a0eae1e2270c01cc81eca7b909b`.
- A pre-fix backup is stored at `docs/backups/2026-09-05/main.py.pre-scheduled-env-fix`.
- The next Workers Build/deployment must be validated with a real scheduled invocation before runtime is GREEN.
- Queue diagnostics footer remains intentionally enabled.

## RED
- None. The blocking runtime defect is identified and patched; production acceptance is pending deployment and live Cron validation.

## GitHub Actions quota — verified 2026-09-05
- Account plan: GitHub Free.
- September 2026 Actions usage: exactly 2,000 Linux minutes, matching the included monthly allowance.
- August 2026 Actions usage: 221 minutes.
- GitHub Free includes 2,000 Actions minutes/month for private repositories using GitHub-hosted standard runners.
- When the included quota is exhausted and no valid payment method is available, GitHub blocks additional usage.
- Self-hosted runners are not charged for Actions minutes; public repositories also have free standard-runner usage.

## Decision
INTILY production remains Cloudflare-native. We do not bypass GitHub billing controls. GitHub remains source control; Workers Builds performs deployment; Cloudflare Worker executes the news engine and consumes Cloudflare resources rather than GitHub-hosted runner minutes.

## Incident
See `docs/INTILY_CLOUDFLARE_RUNTIME_INCIDENT_2026-09-05.md` for the confirmed `env=None` root cause, rollback, backup, and acceptance criteria.

## Next validation
1. Confirm Workers Build from the patched commit succeeds.
2. Confirm the patched version is deployed at 100%.
3. Query Workers Logs for a scheduled invocation with `outcome=ok`.
4. Confirm KV state `last_run_ts` advances and Telegram publication resumes.
5. Only after sustained green operation, consider removing obsolete GitHub fallback code; do not remove it merely because the quota is exhausted.
