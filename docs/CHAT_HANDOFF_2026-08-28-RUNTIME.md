# SynapseMax — H1 Runtime Handoff Delta

Дата: 2026-08-28

## Current state

H1 remains the active release target. DEX v4 is blocked until DEX v3 visual approval.

## Discovery

GitHub Actions Immediate QA run #54 on commit `2f2108a4a21290eaf6fcfd18ed500ff8260c27e5` passed build, deterministic tests, artifact verification, root routing, performance budget, Wrangler validation and deployment graph. Real Chromium then failed the critical journey: after valid Assessment submit, `[aria-live="polite"]` remained hidden. The mobile overflow test passed.

## Cause classification

The defect is runtime-layer, not a browser assertion problem. Static artifact checks were insufficient to prove the event handler was attached and the result state became visible in a real browser.

## Remediation

A dedicated post-build step `scripts/patch-immediate-runtime.mjs` now validates that exactly one authoritative Assessment runtime marker exists and replaces that materialized handler with a deterministic, target-specific H1 runtime. The runtime targets `#assessment-form` and `#assessment-report`, explicitly clears hidden/display state when rendering the result, preserves the Worker API contract, and keeps ROI in the same authoritative client runtime. `npm run build` now executes the patch step after `scripts/build-site.mjs`.

This is not a test relaxation and does not add a second handler. The patch step fails closed if the authoritative runtime cannot be located or if duplicate runtime markers exist.

## Verification state

IMPLEMENTED: post-build runtime hardening is committed.

VERIFIED: not yet. A fresh GitHub Actions Chromium PASS is still required.

RELEASED: no. Production smoke must remain open until the browser gate and subsequent production verification pass.

## Next actions

1. Confirm fresh Immediate QA run for the current `main`.
2. If Chromium passes, inspect artifact and production smoke.
3. Record the browser PASS and production smoke evidence here and in `docs/DECISION_LOG.md`.
4. Only after H1 RC acceptance continue to visual approval of DEX v3.
5. Do not start DEX v4 before DEX v3 visual approval.
