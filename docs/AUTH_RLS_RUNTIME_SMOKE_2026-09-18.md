# SynapseMax — Authenticated RLS Runtime Smoke

**Дата:** 2026-09-18
**Production:** `red-bar-72989858` / `br-dawn-tree-b12bzx6r` / `neondb`
**Статус:** runtime test harness deployed; final PASS requires a real authenticated browser run.

## What is proven before browser execution

- Neon Auth production session is real and verified by the owner test account.
- `current_tenant_id()` derives context from `auth.user_id()` and active membership.
- Production Data API is active and configured for Neon Auth JWTs.
- `authenticated` role has `rolbypassrls=false`.
- Public tenant RLS policy is `id = current_tenant_id()`.
- Test tenant `11111111-1111-1111-1111-111111111111` is assigned to the verified user `spamir@yandex.ru`.
- Negative tenants `22222222-2222-2222-2222-222222222222` and `33333333-3333-3333-3333-333333333333` exist without membership.

## Runtime test

Open `/rls-smoke.html` while authenticated and click **Проверить RLS**.

Expected result:

- authenticated user is displayed;
- `EMAIL VERIFIED: yes`;
- exactly one tenant row is returned;
- visible tenant is `11111111-1111-1111-1111-111111111111`;
- negative tenants are absent.

This validates the path:

`Neon Auth session → Neon JWT → Data API → role authenticated → PostgreSQL RLS → current_tenant_id()`

## Critical boundary

The SQL management connection uses `neondb_owner` and bypasses RLS. It is therefore not used as evidence of tenant isolation. The browser smoke is the acceptance gate.

## Next negative test

After user A passes, create/use a second real Neon Auth user mapped to tenant B and verify the inverse. Then verify unauthenticated Data API access returns no tenant rows.
