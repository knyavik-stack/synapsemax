# SynapseMax — Neon Auth OTP incident — 2026-09-17

## Symptom

Production smoke test exposed two failures in `/auth.html`:

1. Verification email was not reliably received.
2. Entering a code resulted in `Auth HTTP 404`.

## Root cause

The first implementation manually constructed the OTP verification request against the Neon Auth URL. The managed Neon Auth OTP integration is exposed through the Neon SDK / Better Auth client surface; the repository implementation was calling a route that is not valid for this managed endpoint, producing HTTP 404.

The implementation also reported `Код отправлен` immediately after signup without independently handling resend or the unverified-user sign-in path.

## Evidence

Current Neon Auth documentation identifies the official client as `@neondatabase/auth` and exposes the email OTP methods through the auth client. The documented OTP flow is:

- `auth.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })`
- `auth.emailOtp.verifyEmail({ email, otp })`

The official Better Auth OTP documentation describes the same email-verification operations. See the project change discussion/source references used during implementation.

## Fix

Commit `10e6545a9030f660da0996e155cccaba1e7260d8` changes `auth.html` to use the official Neon Auth client instead of manually constructing the OTP HTTP request.

Additional changes:

- explicit OTP resend control;
- unverified sign-in detection and automatic OTP send;
- explicit handling of SDK errors;
- session check after successful verification;
- no false `Auth HTTP 404` fallback for an unsupported endpoint;
- OTP state remains visible until verification succeeds.

## Security impact

Severity: HIGH operational/security boundary.

The defect blocked email verification but did not create a known tenant-isolation bypass. It did, however, prevent the required authentication gate from completing and therefore blocked the production auth acceptance gate.

No credential or OTP is persisted by the application code.

## Remaining acceptance test

After deployment:

1. register a new test account;
2. verify that the OTP email arrives;
3. enter the real six-digit code;
4. verify that email becomes confirmed and a session is established;
5. sign out and sign in again;
6. test resend with a fresh code;
7. only then proceed to authenticated tenant/RLS runtime testing.

## Non-claim

This document does not claim that the production email provider is healthy until the real browser test confirms delivery. If no email arrives after this client fix, the next diagnostic target is Neon Auth's managed email delivery/provider path rather than the frontend OTP endpoint.
