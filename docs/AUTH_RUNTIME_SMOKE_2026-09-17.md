# SynapseMax — Neon Auth runtime smoke test

Date: 2026-09-17

## What is now tangible

Production code contains a dedicated `/auth.html` smoke-test entrypoint wired into the canonical build. It targets the live Neon Managed Better Auth endpoint for the production branch and exposes real email/password sign-up, sign-in, session check and sign-out actions.

## Auth contract

- Provider: Neon Managed Better Auth.
- Production auth base: configured in Neon; the page uses the branch-specific endpoint provisioned for SynapseMax.
- Email/password sign-up: enabled.
- Email verification: mandatory, OTP method.
- Password UI gate: at least 8 characters, Latin uppercase, Latin lowercase and digit.
- Trusted origin: `https://synapsemax.ru`.

## Important security boundary

The browser-side password check is a user-experience gate, not a database-enforced password composition policy. Neon Auth currently exposes the minimum-length/configuration controls available to the managed provider; exact composition is therefore still an open application-boundary requirement and must not be represented as fully database-enforced.

## Database authorization verification

Live production `public.current_tenant_id()` was inspected on 2026-09-17. It derives tenant context from `auth.user_id()`, active `public.tenant_memberships`, and `auth.organization_id()`; zero or multiple applicable memberships fail closed to `NULL`.

This confirms the intended auth-to-tenant resolver in the live database. It does **not** replace a real two-user browser/API cross-tenant negative test.

## Required human smoke test

1. Open `https://synapsemax.ru/auth.html`.
2. Choose `Регистрация`.
3. Use a fresh email address and a test password satisfying the displayed rule.
4. Submit registration.
5. Confirm the OTP received by email through the Neon Auth flow.
6. Return to `/auth.html`, choose `Вход`, and sign in with the same credentials.
7. Confirm the page reports `Сессия получена`.
8. Click `Выйти` and confirm the session disappears.

Do not use a real production password. Use a dedicated test mailbox/account.

## Release evidence

Commit `b1f16e9a95eaf9b10d9496e3ac2fca887ea782c3` added the build hook for `/auth.html`. GitHub Actions `Immediate QA` run `35249552380` and `Production Smoke` run `35249552092` were triggered by that commit and were in progress at documentation time.

## Open gates

- CRITICAL: prove tenant isolation with two real Neon Auth users against the production Data API/RLS path.
- HIGH: enforce exact password composition at a trusted server-side/application boundary.
- HIGH: connect authenticated diagnostic sessions to persistent tenant-scoped storage and idempotency/lineage.
