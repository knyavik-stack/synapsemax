# SynapseMax — Persistence / RLS Execution Report

**Дата:** 14 сентября 2026  
**PR:** #17  
**Merge commit:** `4f4f8f01f74f5697ee49c216468cb72e30aa5083`

## Executive result

Minimal persistence architecture is now codified in the repository without contaminating the existing unrelated Supabase project.

The implementation is **NOT production persistence yet**: migration files exist, RLS/immutability contracts are defined, but no database deployment or real authorization-boundary smoke has been claimed.

## Delivered

1. `docs/PERSISTENCE_RLS_ARCHITECTURE_2026-09-14.md`
   - PostgreSQL entity model;
   - server-side tenant context;
   - RLS strategy;
   - grants gate;
   - immutable financial history;
   - retention/legal hold model;
   - idempotency;
   - performance gate;
   - red-team acceptance criteria.

2. `supabase/migrations/20260914120000_financial_diagnostic_persistence.sql`
   - retention policies;
   - tenants;
   - memberships;
   - legal holds;
   - diagnostic sessions;
   - evidence + revision pointer;
   - input snapshots;
   - calculation results;
   - result lineage;
   - audit events;
   - idempotency keys;
   - indexes;
   - tenant-scoped RLS;
   - append-only triggers;
   - explicit revocation of implicit client grants.

3. `supabase/migrations/20260914120100_tighten_audit_rls.sql`
   - corrected audit policy so tenantless system audit rows are not visible through normal tenant context.

4. `supabase/tests/financial_persistence_contract.sql`
   - structural pgTAP checks for tables, RLS, policies, immutable triggers, grants, indexes and financial constraints.

## Verification

- Immediate QA PR #16: **SUCCESS**, including browser gate.
- PR #17 was reviewed for scope and merged to `main`.
- Main branch contains the persistence migration and tests.
- No migration was applied to the currently connected Supabase projects.

## Critical discovery

The connected Supabase project named `knyavik-stack's Project` is not a SynapseMax database. Its public schema contains unrelated game entities (`players`, `games`, `game_sessions`, `player_game_stats`). It is therefore explicitly excluded from SynapseMax persistence.

The other connected project is `WOBuy`; it is also not assumed to be SynapseMax infrastructure.

This prevents a high-cost architectural error: attaching enterprise financial data to an unrelated application database merely because a Supabase connection already exists.

## Security status

### CLOSED at contract level

- client `tenant_id` is not an authorization source;
- RLS is tenant-scoped;
- immutable financial results have DB-level update/delete rejection;
- evidence revisions preserve historical records;
- audit events are append-only;
- implicit client grants are revoked by the migration.

### OPEN / production gate

- real authenticated principal → tenant membership resolution;
- production database role/grant model;
- cross-tenant negative integration tests against a real SynapseMax DB;
- idempotency behavior at API + DB boundary;
- retention deletion executor + audit verification;
- security/performance advisor review;
- production smoke of authorization boundary.

## Red team

1. **CRITICAL — tenant escape:** remains veto-level until real authorization + RLS integration test passes.
2. **HIGH — service-role bypass:** RLS does not protect a path that intentionally bypasses RLS; elevated credentials must remain server-only and authorization must precede use.
3. **HIGH — historical mutation:** protected at DB trigger level for immutable resources; runtime verification still pending.

## Finance impact

This work does not directly add revenue. Its economic purpose is to make future financial diagnostics defensible at enterprise scale: reproducible inputs, evidence provenance, immutable ROI history and auditable tenant separation reduce the probability that a high-value diagnostic result becomes non-defensible or operationally unsafe.

No ROI uplift is claimed from infrastructure alone.

## Completion

- Financial diagnostic/productization core: **~85%**
- Brand/HUD pass: **~90%**
- Governance contract/runtime: **~75%**
- Persistence architecture/schema: **~70%**
- Production multi-tenant persistence: **~20%**
- Overall production platform maturity: **~55%**

These are engineering maturity estimates, not financial forecasts.

## Next gate

Before applying the migration anywhere, SynapseMax needs a **dedicated Postgres/Supabase project boundary**. Then the migration must be applied in a controlled environment, grants finalized, pgTAP/integration isolation tests executed, and only after PASS connected to the Cloudflare Worker.

Redis remains deliberately deferred until real latency/load measurements justify it.
