# SynapseMax — Neon Auth/RLS Runtime Runbook

**Date:** 2026-09-17
**Status:** implemented baseline; runtime isolation gate pending real browser/API JWT smoke.

## Production architecture

`SynapseMax frontend → Neon Auth (Better Auth) → Neon JWT → Neon Data API → PostgreSQL role authenticated → tenant RLS`

Supabase is not part of the production runtime.

## Authentication requirements

- Email/password enabled.
- Email verification mandatory.
- Verification method: OTP.
- Verification on signup and sign-in.
- Password: minimum 8 characters, at least one uppercase Latin letter, one lowercase Latin letter, and one digit.
- Password composition must be enforced server-side at the application auth boundary; managed Neon Auth configuration currently exposes minimum length but not the required custom regex hook.

## Authorization invariant

The client-provided `tenant_id` is never trusted for authorization. Tenant context must be derived from the authenticated Neon Auth principal and active membership; ambiguous membership fails closed.

## Database invariant

Application role `authenticated` must remain `rolbypassrls=false` and receive only explicit privileges. `neondb_owner` is administrative and must never be used as evidence of tenant isolation.

## Release gates

1. Authenticated user A obtains a verified Neon Auth session/JWT.
2. A is mapped to tenant A.
3. A can read/write only tenant A records allowed by operation policy.
4. A cannot read/write tenant B records.
5. User B demonstrates the inverse isolation.
6. Unauthenticated requests cannot read tenant data.
7. Multiple/ambiguous membership fails closed.
8. Privileged service operations are server-only and audited.
9. API idempotency and evidence lineage pass through the same boundary.
10. Retention/legal-hold execution passes.

## Current verification

- Production Neon Auth enabled and configured.
- Production Neon Data API provisioned with Neon Auth.
- Production persistence schema deployed.
- 11 persistence tables present.
- 10 tenant RLS policies present.
- 5 append-only triggers present.
- Application role `authenticated` confirmed non-bypass-RLS.
- Calculation result SELECT/INSERT allowed; UPDATE/DELETE denied for application role.
- Trusted origin: `https://synapsemax.ru`.

## Explicit non-claims

The MCP owner connection cannot prove runtime tenant isolation because `neondb_owner` bypasses RLS. The remaining CRITICAL gate is therefore an authenticated Data API/browser test using real Neon Auth JWTs.
