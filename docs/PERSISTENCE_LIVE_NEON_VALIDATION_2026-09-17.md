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
- append-only triggers;
- revoked implicit client grants were intentionally NOT reproduced because this Neon database does not contain the Supabase `anon`/`authenticated` roles.

The canonical repository migration remains the source of truth; the QA execution used equivalent SQL with the Neon-specific grant section omitted where roles do not exist.

## Structural verification

Live QA branch returned:

- **11/11** required persistence tables present;
- **10/10** tenant RLS policies present;
- **9** persistence indexes present;
- **5/5** append-only triggers present.

RLS is enabled and `FORCE ROW LEVEL SECURITY` was temporarily enabled on selected tenant tables for the QA branch.

## Append-only verification

A real `calculation_results` row was inserted on the QA branch.

An attempted update of that row was rejected by PostgreSQL with:

`APPEND_ONLY_RESOURCE: calculation_results cannot be updated or deleted`

**Result: PASS.** Database-level immutability is proven on the real PostgreSQL instance.

## Tenant isolation verification

The SQL connection available to the validation tool uses the database owner/superuser path. PostgreSQL therefore bypassed the tenant RLS policy even when `FORCE ROW LEVEL SECURITY` was enabled for the tested owner context.

Attempts to switch to the created no-login QA roles failed because the owner connection is not permitted to grant membership to those roles through the available interface. The password/login path was not modified.

**Result: NOT PROVEN.** Cross-tenant negative authorization testing against a non-owner authenticated principal remains an explicit production gate.

This is a deliberate non-claim: existence of RLS policies is not equivalent to proving runtime tenant isolation.

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
| Cross-tenant runtime isolation | **OPEN** |
| Production migration | **NOT APPLIED** |
| Worker integration | **OPEN** |

## Next gate

1. Define the real authenticated application principal/role mapping.
2. Grant only the required database privileges.
3. Run cross-tenant positive/negative integration tests using non-owner principals.
4. Verify idempotency and evidence lineage through the API boundary.
5. Run retention/legal-hold tests.
6. Only after PASS prepare the production migration for explicit approval.

## Evidence boundary

**Facts:** live Neon project access, PostgreSQL 18.6, empty SynapseMax persistence baseline, temporary branch creation, 11 tables, 10 RLS policies, 9 indexes, 5 append-only triggers, successful append-only rejection.

**Not proven:** authenticated tenant isolation, application authorization, production grants, Worker persistence integration, retention executor, 5-year TCO/NPV, Redis performance.
