# SynapseMax — Auth/RLS runtime smoke update

**Дата:** 2026-09-18  
**Production:** `red-bar-72989858` / `br-dawn-tree-b12bzx6r`  
**Scope:** Neon Auth → JWT → Neon Data API → PostgreSQL RLS

## Result

**CRITICAL gate remains OPEN.**

The reported **HTTP 404** is now treated as a real Data API/runtime symptom, not as evidence of PostgreSQL RLS failure. Additionally, the exact text still reported by the browser matches the pre-remediation smoke page, so stale asset delivery/cache is itself now a confirmed suspect. The earlier classification of the 404 as merely a smoke-harness defect was too strong and is superseded by this record.

Live Neon management state was verified:
- Neon Auth: active, Better Auth.
- Neon Data API: active.
- Data API endpoint: the endpoint returned by Neon management configuration.
- exposed schema: `public`.
- `public.tenants`: exists.
- `authenticated` has SELECT on `public.tenants`.
- RLS and FORCE RLS are enabled on `public.tenants`.
- production membership for the test identity exists and is active for tenant A.

The Data API configuration was refreshed without changing the security model:
- `db_schemas=[public]`
- `db_anon_role=anonymous`
- `jwt_role_claim_key=.role`
- CORS origin `https://synapsemax.ru`
- schema/config reload notifications issued via PostgreSQL.

## Smoke harness change

`rls-smoke.html` now:
1. obtains the authenticated Neon Auth session;
2. requires verified email;
3. obtains the JWT without rendering its value;
4. calls the exact Data API endpoint returned by Neon management configuration;
5. explicitly sends `Accept-Profile: public`;
6. reports the HTTP status and response body prefix when the Data API fails;
7. checks tenant A as the only allowed result and tenant B/C as forbidden.

The previous malformed forbidden-tenant UUID was also corrected.

## Security non-claims

The CRITICAL tenant-isolation gate is **not closed**.

Even after the Data API 404 is resolved, final closure requires:
- two real Neon Auth identities;
- separate active tenant memberships;
- negative reads/writes in both directions;
- unauthenticated fail-closed behavior;
- ambiguous-membership fail-closed behavior.

## Current hypothesis

The database/RLS layer currently has the expected grants and policies. The remaining failure point is most likely the **Neon Data API request/schema-cache/runtime boundary**, because the observed symptom is HTTP 404 rather than an RLS-denial response.

This is an inference, not a confirmed root cause.

## Change

Updated `rls-smoke.html` in commit `4fed0aae3ef998952161ac4f8fd9806a573f9fe7`.


## Delivery-control remediation — 2026-09-18

The repeated browser output was compared against the repository source. The reported two-line error format corresponds to the older smoke asset, while the repository already contained a newer diagnostic implementation. This makes **production asset/revision mismatch** the leading delivery hypothesis; the database/RLS model is not changed by this remediation.

Implemented in the repository:
- Worker release marker: `2026-09-18-3`.
- `/__synapsemax/version` endpoint exposes release and RLS smoke revision with `no-store`.
- `/rls-smoke.html` remains Worker-first and now returns an explicit revision header `x-synapsemax-rls-smoke: 2026-09-18-3` plus no-cache semantics.
- Browser smoke page visibly identifies its revision.
- Production smoke now verifies the version endpoint and the actual delivered RLS smoke asset before running functional checks.
- Health contract now includes the release marker.

**Release gate:** the CRITICAL tenant-isolation gate remains OPEN until the delivered revision is confirmed and the authenticated Data API test returns tenant A only, followed by the two-user negative isolation test.
