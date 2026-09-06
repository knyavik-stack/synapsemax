# DEX-01 Foundation Notes

## Purpose

This document records implementation constraints for the first controlled frontend extraction.

## Canonical identity

- Domain: `synapsemax.ru`
- Public email: `hello@synapsemax.ru`
- Brand wordmark and symbol are canonical assets; do not recreate them with substitute typography.

## Extraction strategy

The current prototype remains the visual reference. Refactoring must be incremental:

1. Introduce tokens.
2. Introduce reusable HUD primitives.
3. Extract repeated UI patterns.
4. Migrate one section at a time.
5. Remove the corresponding legacy rules only after visual parity is checked.

## Code-commenting rule

Non-obvious animation, geometry, performance, accessibility, or browser-compatibility decisions must include a short comment explaining **why** the code exists, not merely what it does.

## Quality rule

A GitHub commit is not a release. A change is complete only after build/deployment and functional verification are possible. If Cloudflare preview cannot be verified from available tooling, the status must explicitly say so.

## Visual guardrails

- The S-shaped logo itself remains geometrically intact.
- Motion belongs to the surrounding neural/orbital field unless a future visual change is explicitly approved.
- HUD effects must support information hierarchy rather than become decoration.
- Typography must remain compact and legible without becoming artificially tiny.
