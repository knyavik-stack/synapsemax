# SynapseMax DEX v1 — Component Map

## Principle

The accepted prototype remains the visual reference. DEX-01 extracts repeated patterns without forcing a visual redesign.

## Foundation

| Primitive | Purpose | Current state |
|---|---|---|
| `sm-hud-panel` | premium technical container | defined |
| `sm-hud-kicker` | section/system label | defined |
| `sm-neural-node` | active intelligence point | defined |
| `sm-data-rail` | information/energy flow | defined |
| `sm-orbit` | system context / environment | defined |
| `sm-scan-line` | controlled system activity | defined |

## UI components to extract next

- Header / Brand
- SectionHeader
- PrimaryButton / GhostButton
- MetricStrip
- ServiceCard
- CaseCard
- TransformationFlow
- AI Lab module
- Contact/CTA module
- Footer

## Extraction rule

A component is extracted when at least one of these is true:

1. It appears in multiple sections.
2. It has behavior/animation that should have one source of truth.
3. It encodes a brand rule.
4. It will be reused by future AI/product surfaces.

## Non-goals for DEX-01

- no backend
- no LLM integration
- no CRM integration
- no replacement of the accepted logo
- no wholesale redesign of the approved prototype

## Preview gate

Before production promotion, verify:

- desktop visual parity
- mobile behavior
- animation performance
- reduced-motion behavior
- links/assets
- canonical domain/email
- browser console/runtime errors
