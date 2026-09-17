# SynapseMax — Live Neon Persistence Validation

**Дата:** 2026-09-17
**Контур:** SynapseMax dedicated Neon project
**Project:** `red-bar-72989858`
**Production branch:** `production` / `br-dawn-tree-b12bzx6r`
**Database:** `neondb`
**PostgreSQL:** 18.6

## Purpose

Validate the persistence contract against a real SynapseMax Neon database without applying unverified schema changes directly to production.

## Baseline

The repository persistence execution report explicitly stated that the persistence migration had been prepared but not deployed, and that real authorization-boundary smoke remained open.

## Live access

**PASS.** Neon MCP access is live. The SynapseMax project and production branch were resolved successfully. The production database was inspected before any schema write.

Initial public schema inspection showed only the existing `neon_auth` tables; the SynapseMax persistence tables were absent.

## Controlled validation branch

Created temporary Neon branch:

`br-blue-brook-b1yxut9f` — `synapsemax-persistence-qa-20260917`

The branch was created from production HEAD and used exclusively for persistence validation.

## Schema deployment to QA branch

The minimal persistence contract was applied to the temporary branch in a transaction. The contract contains:

- retention policies;
- tenants;
- tenant memberships;
- legal holds;
- diagnostic sessions;
- evidence items;
- immutable input snapshots;
- calculation results;
- result lineage;
- audit events;
- idempotency keys;
- tenant-scoped RLS policies;
- indexes;
- append-only triggers.

The canonical repository migration remains the source of truth. The Supabase-specific `anon`/`authenticated` revoke statements were not replayed because those roles do not exist in the live Neon environment.

## Structural verification

Live QA branch returned:

- **11/11** required persistence tables present;
- **10/10** tenant RLS policies present;
- **9** persistence indexes present;
- **5/5** append-only triggers present.

`pg_class` confirmed RLS enabled on the tested tenant tables. `FORCE ROW LEVEL SECURITY` was temporarily enabled during a diagnostic experiment and then reverted.

## Append-only verification

A real `calculation_results` row was present on the QA branch.

An attempted update of that row was rejected by PostgreSQL with:

`APPEND_ONLY_RESOURCE: calculation_results cannot be updated or deleted`

**Result: PASS.** Database-level immutability is proven on the real PostgreSQL instance.

## Idempotency verification

A real `(tenant_id, request_id, operation)` key was inserted into `public.idempotency_keys`.

A second insert using the same composite key was rejected by PostgreSQL with the primary-key violation on `idempotency_keys_pkey`.

**Result: PASS.** Database-level uniqueness for the idempotency contract is proven on the QA branch.

## Tenant isolation verification

The SQL connection available through the Neon validation interface uses `neondb_owner`. Live role inspection showed:

- `neondb_owner`: `rolbypassrls = true`;
- API-created QA roles also defaulted to `rolbypassrls = true`;
- a SQL-created login role could be created with `rolbypassrls = false`, but the available owner connection was not permitted to switch session authorization to it or grant membership for `SET ROLE` testing.

As a result, owner-context queries cannot prove runtime RLS isolation. A temporary `FORCE ROW LEVEL SECURITY` experiment was also insufficient because the active owner role has `BYPASSRLS`.

**Result: NOT PROVEN.** Cross-tenant negative authorization testing against a genuine non-owner application principal remains an explicit production gate.

This is a deliberate non-claim: existence of RLS policies is not equivalent to proving runtime tenant isolation.

## Environment finding — Neon vs Supabase grants

The canonical repository migration contains explicit revokes for Supabase `anon` and `authenticated`. The live Neon database does not contain those roles.

Blindly replaying those statements would fail migration execution. Production deployment therefore needs an environment-specific privilege layer tied to the real application authentication architecture rather than silently altering the canonical persistence semantics.

## Production status

**Production branch was not modified.**

No production migration was applied. No production data was changed.

## Security red-team

### CRITICAL — tenant escape

Still open until a real non-owner application principal is authenticated, mapped to tenant membership, and demonstrated unable to read/write another tenant's records.

### HIGH — service-role bypass

The migration's RLS model cannot protect a deliberately privileged bypass path. Any service credential must remain server-only and authorization must execute before privileged database access.

### HIGH — grants / authentication integration

The repository migration was designed around Supabase roles (`anon`, `authenticated`), while the live Neon database currently does not expose those roles. Production grants must be designed against the actual application authentication architecture before deployment.

### HIGH — Neon role defaults

Neon-created database roles observed in this validation have `rolbypassrls = true`. This is unacceptable as evidence of application-level tenant isolation. Production application roles must be explicitly validated for non-bypass behavior before they are treated as tenant principals.

## Finance impact

This validation does not claim direct revenue uplift. Its financial purpose is to establish a defensible persistence boundary for future evidence-backed diagnostics: reproducible inputs, immutable ROI history and tenant separation.

## Gate status

| Gate | Status |
|---|---|
| Live Neon MCP access | PASS |
| Correct dedicated DB | PASS |
| QA schema deployment | PASS |
| Structural schema validation | PASS |
| Append-only DB enforcement | PASS |
| Idempotency uniqueness | PASS |
| Cross-tenant runtime isolation | **OPEN** |
| Production migration | **NOT APPLIED** |
| Worker integration | **OPEN** |

## Next gate

1. Define the real authenticated application principal/role mapping.
2. Ensure the application database role does not bypass RLS.
3. Grant only the required database privileges.
4. Run cross-tenant positive/negative integration tests using non-owner principals.
5. Verify idempotency and evidence lineage through the API boundary.
6. Run retention/legal-hold tests.
7. Only after PASS prepare/apply the production migration.

## Evidence boundary

**Facts:** live Neon project access, PostgreSQL 18.6, empty SynapseMax persistence baseline, temporary branch creation, 11 tables, 10 RLS policies, 9 indexes, 5 append-only triggers, successful append-only rejection, successful idempotency uniqueness rejection, and observed Neon role/RLS behavior.

**Not proven:** authenticated tenant isolation, application authorization, production grants, Worker persistence integration, retention executor, 5-year TCO/NPV, Redis performance.
