# SynapseMax — Neon Persistence Execution Report

**Дата:** 16 сентября 2026  
**Branch:** `feat/neon-persistence-hardening-2026-09-16`

## Executive result

GitHub-side foundation for the dedicated Neon persistence boundary is prepared. The repository now has a provider-neutral PostgreSQL migration, hardened tenant/RLS constraints, a manual migration gate, and an explicit provider decision.

**Neon database has NOT been mutated by this change.** The production migration remains a separate controlled action.

## Delivered

- `database/migrations/20260916150000_synapsemax_persistence.sql`
  - 11 persistence tables;
  - composite tenant-aware foreign keys where cross-tenant references matter;
  - append-only financial/evidence/audit history;
  - RLS + FORCE RLS on runtime tables;
  - no client grants;
  - server-side transaction-local tenant context contract.
- `docs/PERSISTENCE_PROVIDER_DECISION_2026-09-16.md`
- `.github/workflows/neon-migration.yml`
  - manual only;
  - explicit `APPLY_NEON_PRODUCTION` confirmation;
  - `NEON_DATABASE_URL` read only from GitHub Secrets;
  - fail-closed schema invariant checks.

## Secret status

`NEON_DATABASE_URL` is expected to exist as a GitHub repository secret. Its value is intentionally never written to source, logs, documentation, PR text, or chat.

## Security gate

**CRITICAL — still open:** a real authenticated application path must resolve the tenant from the principal before setting `app.tenant_id`. RLS is not a substitute for authentication/authorization.

**HIGH — still open:** production runtime role must be least-privileged and must not have `BYPASSRLS`.

**HIGH — still open:** evidence `value`/metadata ingestion needs application-level secret/PII sanitization; JSONB constraints alone do not provide data classification.

## QA gate

Required before production connection:

1. repository build/test gate;
2. migration execution against the dedicated Neon database;
3. schema invariant verification;
4. negative cross-tenant read/write tests using two test tenants;
5. append-only update/delete rejection tests;
6. idempotency replay tests;
7. authenticated principal → tenant membership tests;
8. Cloudflare Worker integration test;
9. production smoke.

## Financial impact

No direct ROI is claimed from the persistence layer. The measurable business effect remains the financial diagnostic itself: leakage detected, recoverable value, annual effect, ROI, payback and margin uplift. Persistence is infrastructure required to make those outputs reproducible and defensible at scale.

## Next action

The next destructive action is **manual Neon migration**. It should be executed only after the dedicated Neon project/database identity is confirmed and the migration workflow is reviewed.
