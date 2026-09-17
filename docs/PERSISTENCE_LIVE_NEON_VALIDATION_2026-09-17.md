# SynapseMax — Live Neon Persistence Validation

**Дата:** 2026-09-17
**Контур:** SynapseMax dedicated Neon project
**Project:** `red-bar-72989858`
**Production branch:** `production` / `br-dawn-tree-b12bzx6r`
**Database:** `neondb`
**PostgreSQL:** 18.6

## Decision update

Supabase is not a runtime dependency for SynapseMax. It was planned historically, but no SynapseMax persistence/auth deployment was made there. Production persistence and authentication are therefore implemented in Neon.

Authentication authority: **Neon Auth / Better Auth**.

Authorization boundary: **Neon Data API + PostgreSQL RLS + non-bypass `authenticated` role**.

## Live access

**PASS.** Neon MCP access is live. Production was inspected before schema deployment.

Initial inspection showed only `neon_auth.*`; no SynapseMax persistence tables existed.

## Controlled validation branch

Temporary branch:

`br-blue-brook-b1yxut9f` — `synapsemax-persistence-qa-20260917`

It was used to validate the persistence contract and Neon Data API/RLS integration before production deployment.

QA branch structural result:

- **11/11** required persistence tables;
- **10/10** tenant RLS policies;
- **9** persistence indexes;
- **5/5** append-only triggers.

Append-only and idempotency behavior were proven against real PostgreSQL on the QA branch.

## Neon Auth

Production Neon Auth was already present with provider `better_auth` and is now configured for:

- email/password sign-up;
- OTP email verification;
- required email verification;
- verification email on signup;
- verification email on sign-in;
- automatic sign-in after verification.

Current production configuration was verified directly from `neon_auth.project_config`.

The business password requirement is:

`>= 8 characters AND at least one uppercase Latin letter AND one lowercase Latin letter AND one digit.`

Neon/Better Auth provides the 8-character minimum, but the managed Neon Auth configuration does not expose a custom server-side regex hook through the available project interface. Therefore the exact composition rule remains an **application-layer implementation gate**; it is not being falsely claimed as database-enforced.

## Neon Data API + RLS

Production Neon Data API was provisioned with Neon Auth as the authentication provider.

The Data API created the `authenticated` Postgres role. Live role inspection shows:

- `authenticated`: `rolbypassrls = false`;
- `neondb_owner`: `rolbypassrls = true` and remains administrative only.

The production persistence migration now:

- enables RLS on all tenant persistence tables;
- uses restrictive policies for `authenticated`;
- revokes public table privileges;
- grants only explicit `SELECT`/`INSERT` privileges;
- grants execution of `current_tenant_id()` only to `authenticated`;
- resolves tenant context from Neon Auth `auth.user_id()` plus active `tenant_memberships`;
- optionally binds membership to `auth.organization_id()`;
- fails closed when zero or multiple applicable memberships exist;
- never treats client-supplied `tenant_id` as authorization.

This matches Neon's documented model in which Data API JWT validation supplies authenticated identity to RLS through `auth.user_id()`.

## Production deployment

**PASS — production persistence deployed.**

Production now contains the SynapseMax persistence contract:

1. retention policies;
2. tenants;
3. tenant memberships;
4. legal holds;
5. diagnostic sessions;
6. evidence items;
7. input snapshots;
8. calculation results;
9. result lineage;
10. audit events;
11. idempotency keys.

Production also contains the required indexes, RLS policies and append-only triggers.

No client/test tenant data was seeded into production.

## What is proven vs not proven

### Proven

- live Neon access;
- dedicated SynapseMax Neon project;
- Neon Auth provider and current configuration;
- Neon Data API provisioned with Neon Auth;
- non-bypass `authenticated` role exists;
- production persistence schema deployed;
- production RLS policies deployed;
- public grants revoked on persistence tables;
- append-only triggers deployed;
- QA append-only rejection proven;
- QA idempotency uniqueness proven.

### Not yet proven

- real browser/API authenticated cross-tenant negative test with two real principals;
- password composition rule at the application auth boundary;
- Worker -> Data API persistence smoke;
- retention executor and legal-hold execution;
- full API idempotency/lineage flow;
- Redis latency/load evidence;
- 5-year TCO/NPV model.

The first item is the remaining **CRITICAL security gate**. Structural RLS presence is not treated as proof of runtime tenant isolation.

## Security red-team

### CRITICAL — runtime tenant escape

The administrative SQL connection is `neondb_owner` and bypasses RLS. It cannot prove application isolation. The required proof is an authenticated non-owner integration test using real Neon Auth JWTs.

### HIGH — privileged service path

Any server-side privileged credential can bypass RLS if deliberately configured that way. Such credentials must never reach the browser and every privileged operation must perform explicit authorization plus audit logging.

### HIGH — password composition

The exact uppercase/lowercase/digit requirement is not exposed as a managed Neon Auth regex setting. It must be enforced server-side in the SynapseMax auth boundary; client validation alone is rejected.

### MEDIUM — test branch lifecycle

The QA branch contains only validation data. It should be retained only while needed for the next integration test and then deleted after evidence is captured.

## Finance impact

This is infrastructure risk control, not a direct revenue claim. The economic objective is to make every future leakage/ROI calculation attributable to a tenant, evidence set, calculation contract and immutable result history, reducing the risk of non-defensible financial conclusions and rework.

## Gate status

| Gate | Status |
|---|---|
| Live Neon MCP access | PASS |
| Correct dedicated DB | PASS |
| Neon Auth | PASS |
| Email OTP verification | PASS |
| Required email verification | PASS |
| Neon Data API | PASS |
| Non-bypass application DB role | PASS |
| Production persistence schema | PASS |
| Production RLS deployment | PASS |
| Public privilege revocation | PASS |
| QA append-only enforcement | PASS |
| QA idempotency uniqueness | PASS |
| Runtime cross-tenant isolation | **CRITICAL OPEN** |
| Password composition enforcement | **HIGH OPEN** |
| Worker integration | OPEN |
| Retention/legal-hold execution | OPEN |
| Redis performance evidence | OPEN |
| 5-year TCO/NPV | OPEN |

## Next execution gate

1. Implement the SynapseMax application auth boundary against Neon Auth.
2. Enforce the exact password composition rule server-side.
3. Create two real QA principals and two tenant memberships through the real auth path.
4. Execute Data API positive/negative cross-tenant tests.
5. Capture authenticated audit/idempotency/lineage evidence.
6. Connect the Cloudflare Worker to the authenticated persistence path.
7. Run retention/legal-hold tests.
8. Close the critical RLS gate only after runtime evidence passes.

## Repository source of truth

- `neon/migrations/20260917190000_synapsemax_persistence_auth_rls.sql`
- `docs/NEON_AUTH_RLS_SECURITY_BASELINE_2026-09-17.md`
- `docs/PERSISTENCE_EXECUTION_REPORT_2026-09-14.md`
- `docs/PERSISTENCE_RLS_ARCHITECTURE_2026-09-14.md`
- `docs/MASTER_OPERATIONAL_EXECUTION_REPORT.md`
