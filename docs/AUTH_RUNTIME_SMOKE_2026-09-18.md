# SynapseMax — Auth/RLS runtime smoke update

**Дата:** 2026-09-18  
**Production:** `red-bar-72989858` / `br-dawn-tree-b12bzx6r`  
**Scope:** Neon Auth → JWT → Neon Data API → PostgreSQL RLS

## Result

**CRITICAL gate remains OPEN.**

The previous manual REST diagnostic returned **HTTP 404**. This was a defect in the smoke harness: the test constructed the Data API request URL manually. The 404 is **not evidence of a PostgreSQL RLS failure**.

The smoke test is now restored to the official NeonJS runtime path:

1. `client.auth.getSession()` confirms the authenticated session.
2. `client.auth.getJWTToken()` confirms a JWT can be obtained.
3. `client.from('tenants').select('id,status')` performs the Data API query through the NeonJS SDK.
4. NeonJS is responsible for the authenticated JWT injection into the Data API request.
5. Only the expected tenant A is accepted; tenant B/C are forbidden.
6. The JWT value is never rendered or logged; only acquisition and character count are displayed.

This is the authoritative browser smoke path for SynapseMax.

## Security non-claims

This single-user smoke does **not** prove cross-user isolation. Final CRITICAL closure requires two real Neon Auth identities with separate tenant memberships and negative reads/writes in both directions, plus unauthenticated and ambiguous-membership fail-closed checks.

## Change

`rls-smoke.html` updated in commits `73b32e35e5c7d55a5cfb0ace62b1bf4a7c0c09d8` and `b094bd6e0bc7c6f0770d36b70362d320d785e22f`.
