# SynapseMax — Neon Auth + Strict RLS Security Baseline

**Дата:** 2026-09-17
**Neon project:** `red-bar-72989858`
**Production branch:** `br-dawn-tree-b12bzx6r`
**Database:** `neondb`

## Architectural decision

Supabase is not a SynapseMax runtime dependency. It was planned historically, but no SynapseMax persistence/auth deployment was made there; therefore the production architecture is now explicitly Neon-native.

Authentication is provided by **Neon Auth / Better Auth**, with identity stored in the `neon_auth` schema. Neon documents that current Neon Auth is branchable, stores users/sessions/organizations in Neon, and integrates its JWTs with Postgres RLS/Data API. cite-neon-auth

## Authentication policy

Production configuration now has:

- email/password authentication enabled;
- signup enabled;
- OTP email verification;
- email verification required before sign-in/session creation;
- verification email sent on signup;
- verification email sent on sign-in;
- automatic sign-in after successful verification;
- password minimum length target: 8 characters;
- password hashing delegated to Better Auth/Neon Auth rather than application code.

Better Auth documents 8 characters as the default minimum password length and supports explicit `minPasswordLength`. It uses `scrypt` for password hashing by default. cite-better-auth-options cite-better-auth-password

### Password complexity requirement

Business security requirement for SynapseMax is stricter than the Better Auth minimum-length default:

`>= 8 characters AND at least one uppercase Latin letter AND one lowercase Latin letter AND one digit.`

The managed Neon Auth configuration exposed through the current Neon integration does not expose a server-side regex/password-validator hook. Therefore this exact composition rule is **not claimed as database-enforced yet**. It must be enforced at the SynapseMax application registration/reset boundary, with server-side validation before calling the managed auth endpoint. Client-only validation is insufficient.

## Authorization model

The application database role is `authenticated` and was created by the Neon Data API integration with `rolbypassrls = false`.

The following are explicit design rules:

1. `tenant_id` received from a client is never an authorization source.
2. `current_tenant_id()` derives tenant context from the authenticated Neon Auth principal via `auth.user_id()` and active `tenant_memberships`.
3. If the principal has zero or multiple applicable active memberships, `current_tenant_id()` returns `NULL` and access fails closed.
4. If a Neon Auth organization context exists, membership must match `auth.organization_id()`.
5. All persistence tables use restrictive tenant RLS policies for the `authenticated` role.
6. Public table privileges are revoked.
7. `authenticated` receives only explicit `SELECT`/`INSERT` grants required by the current persistence contract.
8. `calculation_results`, evidence, input snapshots, lineage and audit events are append-only at the database trigger layer.
9. Privileged owner/service access is never treated as proof of tenant isolation.

Neon documents the Data API as the recommended client-side RLS path: JWTs are validated by the Data API and `auth.user_id()` is available to RLS policies. cite-neon-rls

## Current live state

- Neon Auth: enabled, provider `better_auth`.
- Neon Data API: provisioned for production with Neon Auth.
- Production persistence schema: deployed.
- Production tenant RLS: deployed.
- Production application role: `authenticated`, `rolbypassrls = false`.
- Production database owner: `neondb_owner`, `rolbypassrls = true`; this role remains an administrative role and is not an application principal.

## Security gates

### PASS

- Authentication authority selected: Neon Auth.
- Email verification requirement configured.
- OTP verification method configured.
- Data API/JWT/RLS integration provisioned.
- Persistence tables deployed.
- Strict tenant RLS policies deployed.
- Public grants revoked.
- Application role is non-bypass-RLS.
- Append-only triggers deployed.
- Database idempotency key uniqueness deployed.

### OPEN — CRITICAL

Real browser/API integration must still execute a full authenticated tenant-isolation test using two real Neon Auth users/tenants:

- A can read/write A;
- A cannot read/write B;
- B cannot read/write A;
- unauthenticated requests receive no tenant data;
- ambiguous/no membership fails closed;
- privileged server paths are separately audited.

The current MCP SQL connection is `neondb_owner`; it cannot itself prove this runtime boundary because the owner bypasses RLS.

### OPEN — HIGH

The exact uppercase/lowercase/digit password composition rule needs an application-level server enforcement point because managed Neon Auth currently exposes minimum length but not a custom password regex hook through the available project configuration interface.

### OPEN — HIGH

Retention executor, legal-hold execution, API idempotency/lineage integration, and production Worker persistence smoke are still separate gates.

## Red-team

1. **Tenant escape:** the main failure mode is an application/service path accidentally using a bypass-RLS credential. Mitigation: client traffic through Data API + `authenticated`; privileged credentials server-only; negative tests mandatory.
2. **Authorization ambiguity:** multiple active memberships without an explicit organization context could otherwise select the wrong tenant. Mitigation: `current_tenant_id()` fails closed unless exactly one membership applies.
3. **Password policy gap:** a UI regex alone can be bypassed. Mitigation: server-side validation at the application auth boundary; do not claim full compliance until tested.

## References

- Neon RLS documentation: https://neon.com/docs/guides/row-level-security
- Better Auth options: https://better-auth.com/docs/reference/options
- Better Auth email/password: https://better-auth.com/docs/1.6/authentication/email-password

<!-- cite-neon-auth: current Neon Auth architecture verified against official Neon documentation on 2026-09-17. -->
<!-- cite-better-auth-options: Better Auth official options documentation verified on 2026-09-17. -->
<!-- cite-better-auth-password: Better Auth official email/password documentation verified on 2026-09-17. -->
<!-- cite-neon-rls: Neon official RLS documentation verified on 2026-09-17. -->
