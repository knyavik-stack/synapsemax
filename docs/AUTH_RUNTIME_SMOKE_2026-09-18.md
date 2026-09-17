# SynapseMax — Auth/RLS runtime smoke update

**Дата:** 2026-09-18  
**Production:** `red-bar-72989858` / `br-dawn-tree-b12bzx6r`  
**Scope:** Neon Auth → JWT → Neon Data API → PostgreSQL RLS

## Result

**CRITICAL gate remains OPEN.**

The first browser smoke established that Neon Auth session exists and email is verified, but `public.tenants` returned zero rows. That result was not sufficient to distinguish an RLS denial from a missing JWT on the Data API request.

The smoke test was therefore changed to explicitly verify the runtime chain:

1. `client.auth.getSession()` confirms the authenticated session.
2. `client.auth.getJWTToken()` explicitly obtains the Neon Auth JWT.
3. The JWT is sent as an `Authorization: Bearer` header to the Neon Data API.
4. The response status/body are checked.
5. Only the expected tenant A is accepted; tenant B/C are forbidden.
6. The JWT value is never rendered or logged; only acquisition and character count are displayed.

## Why this change

The official `@neondatabase/neon-js` contract exposes `auth.getJWTToken()` and documents automatic token injection for Data API queries. The diagnostic path now makes the authorization boundary observable instead of treating an empty result as a generic RLS failure.

## Current production smoke contract

For user `Семен / spamir@yandex.ru`:

- authenticated session: expected `yes`;
- email verification: expected `yes`;
- JWT acquisition: expected `yes`;
- Data API response: must be HTTP 200;
- visible tenant: exactly `11111111-1111-1111-1111-111111111111`;
- tenant B `22222222-2222-2222-2222-222222222222`: must not be visible;
- tenant C `33333333-3333-3333-3333-333333333333`: must not be visible.

## Security non-claims

This single-user smoke does **not** prove cross-user isolation. Final CRITICAL closure requires two real Neon Auth identities with separate tenant memberships and negative reads/writes in both directions, plus unauthenticated and ambiguous-membership fail-closed checks.

## Change

`rls-smoke.html` updated in commit `be83168c8237ef08932bac77e0ebde963e7068ce`.
