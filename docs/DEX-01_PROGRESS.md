# DEX-01 — Progress Log

## Purpose

DEX-01 hardens the accepted frontend prototype without redesigning the approved brand mark or UX narrative.

## Completed

- Project operating documentation established.
- Canonical domain/email policy established: `synapsemax.ru` / `hello@synapsemax.ru`.
- Design tokens introduced as a separate layer.
- Initial SynapseMax HUD primitives documented and implemented as a separate CSS layer.
- Component extraction map defined.
- Development rules and quality gates documented.

## Current state

The production-facing prototype remains intentionally conservative. The existing `index.html` still contains the legacy inline CSS/runtime, while the new design-system layer is being integrated incrementally. This prevents a large, unreviewable visual rewrite.

## Current risks

1. Legacy inline CSS can conflict with new primitives until extraction is complete.
2. The current prototype is largely monolithic, so changes must remain atomic.
3. Live Cloudflare verification is not considered complete until the deployed response is directly observable.

## Next work package

### DEX-01.2 — Controlled extraction

1. Extract repeated visual primitives without changing approved appearance.
2. Replace duplicate CSS definitions with token references.
3. Add semantic comments to non-obvious animation/runtime code.
4. Audit links/assets/domain/email references.
5. Add a lightweight validation pass before preview.
6. Verify responsive behaviour and runtime stability.

## Approval gate

No product approval is required for internal technical cleanup. Approval is required when the extraction changes the visual hierarchy, motion language, logo behaviour, content meaning, or conversion flow.

## Verification policy

A deployment is never described as verified unless the actual preview/production result has been observed. GitHub commit success alone is not a runtime verification.
