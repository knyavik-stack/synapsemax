# SynapseMax — RLS Runtime Provisioning Gate

**Дата:** 2026-09-25  
**Branch:** `fix/rls-runtime-provisioning`  
**Статус:** OPEN / CRITICAL gate not yet closed

## Decision

Для production-проверки tenant isolation smoke harness теперь принимает два режима аутентификации для каждого принципала:

1. **Verified-session JWT** — предпочтительный режим для CI. JWT передаётся через GitHub Actions Secret и проверяется Neon Data API. Это позволяет использовать уже подтверждённые Neon Auth sessions без попытки обходить обязательную email/OTP verification.
2. **Email/password** — fallback для окружений, где полноценный sign-in разрешён и аккаунты уже verified.

Подмена `neon_auth.user.emailVerified`, ручная запись session/token или owner-level SQL **не являются допустимым доказательством RLS isolation**.

## Required CI inputs

Core:

- `NEON_AUTH_URL`
- `NEON_DATA_API_URL`

For principal A: either

- `SYNAPSEMAX_RLS_A_JWT`

or both:

- `SYNAPSEMAX_RLS_A_EMAIL`
- `SYNAPSEMAX_RLS_A_PASSWORD`

For principal B: either

- `SYNAPSEMAX_RLS_B_JWT`

or both:

- `SYNAPSEMAX_RLS_B_EMAIL`
- `SYNAPSEMAX_RLS_B_PASSWORD`

## Acceptance criteria

The test must prove all of the following:

- A and B are different authenticated principals.
- Each principal sees exactly one tenant.
- A's tenant differs from B's tenant.
- Each principal's active membership matches its own tenant and principal id.
- Cross-tenant reads return zero rows in both directions.
- Own-tenant reads return only own-tenant rows.
- Unauthenticated Data API access returns HTTP 401 or 403.
- Worker `/api/v1/tenant-context` resolves the same tenant as Data API/RLS for both principals.

## Security rationale

The JWT is not trusted by the test harness for authorization. In JWT mode the harness only extracts the subject claim locally to correlate the principal; the actual authorization proof is performed by the production Neon Data API and PostgreSQL RLS.

## Remaining blocker

The repository now has a deterministic CI path, but the CRITICAL gate remains open until two independent verified production principals/tokens are supplied and the workflow produces:

`RESULT: REAL TWO-PRINCIPAL RLS ISOLATION PASS`

## Revisit condition

If Neon Auth provides a supported non-production test identity provider or branch-local mock-auth mode that preserves the same JWT → Data API → RLS path, add a separate isolated integration workflow. Do not weaken production Auth configuration merely to manufacture test identities.
