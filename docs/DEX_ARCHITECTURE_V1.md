# SynapseMax — Digital Experience Architecture v1

**Status:** Active  
**Branch:** `docs/project-operating-system-v1`  
**Date:** 2026-08-25

## 1. Goal

Turn the accepted frontend prototype into a durable product interface without losing the approved logo, wordmark, visual language or premium B2B feel.

The site must evolve from a marketing page into the first interface of a future Transformation Intelligence Platform.

## 2. Experience model

The user journey is:

**Complexity → Signal → Understanding → Architecture → Automation → Outcome**

Every major visual interaction should reinforce one of these states.

## 3. HUD Futuristic system

HUD is treated as a proprietary design language.

### Primitives

- `SM-Neural` — nodes and synaptic connections
- `SM-Orbit` — elliptical/radial system fields
- `SM-Node` — state or entity marker
- `SM-DataRail` — information/data path
- `SM-Callout` — technical annotation
- `SM-Scanner` — system inspection state
- `SM-Panel` — modular information surface
- `SM-Flow` — directional process/state transition
- `SM-Grid` — spatial/technical reference layer
- `SM-Glow` — controlled light treatment

## 4. Motion principles

Motion has three levels:

### Ambient
Slow background movement. It establishes system presence.

### Semantic
Movement communicates a process: signal travels, systems connect, complexity resolves into structure.

### Interactive
Pointer, hover and scroll reactions provide orientation and feedback.

No animation should exist only because it looks futuristic.

## 5. Logo rule

The canonical S is immutable during DEX v1.

- S parts stay intact.
- No fan-shaped synapses are reintroduced.
- The surrounding orbital field may contain slow electrical particles.
- The logo remains legible when animation is disabled.

## 6. Typography

### Wordmark
Use the approved image asset. Never substitute a generic font.

### UI
The UI font must optimize for:
- Russian readability;
- compact geometry;
- high information density;
- enterprise credibility;
- clear hierarchy.

Orbitron may remain an accent/display font during the migration, but it must not be forced onto body copy.

## 7. Spacing system

Base unit: 4 px.

Primary rhythm:

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`

Section spacing is driven by content hierarchy rather than a fixed “hero-sized” gap.

## 8. Color roles

The existing cyan → blue → violet → magenta gradient remains the brand accent.

Roles:

- background: near-black blue
- surface: translucent blue-black
- primary text: near-white
- secondary text: muted blue-gray
- information: cyan
- transformation/state: violet
- emphasis: magenta
- success: reserved semantic green, not decorative neon

Neon is a signal. It must not become the background color of everything.

## 9. Component architecture

Target component families:

### Navigation
- `Header`
- `NavLinks`
- `MobileNav`
- `SectionRail`

### Brand
- `SynapseMark`
- `Wordmark`
- `OrbitField`

### Content
- `SectionHeader`
- `Metric`
- `Card`
- `CaseCard`
- `Tag`
- `CTA`

### System visualization
- `NeuralGraph`
- `ProcessFlow`
- `DataRail`
- `SystemPanel`
- `Terminal`

### Interaction
- `Reveal`
- `PointerField`
- `MotionController`

## 10. Content architecture

Visual components must not own business content.

Future structure:

`content → component → visual system`

This is required for the later AI layer, localization and client-specific experiences.

## 11. Case integrity

Until verified customer cases exist, numerical outcomes must not be presented as real client results.

Use one of:

- `DEMO`
- `ILLUSTRATIVE SCENARIO`
- `SIMULATION`

When real evidence exists, the case format becomes:

**Client → Problem → Intervention → Architecture → Result → Evidence**

## 12. Performance budget

Targets for the marketing frontend:

- no continuous animation outside visible/necessary areas;
- pause expensive animation when offscreen;
- `prefers-reduced-motion` supported;
- avoid unnecessary canvas/WebGL;
- keep the first experience visually rich without requiring heavy assets;
- avoid layout thrashing in pointer/scroll handlers.

The current prototype already uses requestAnimationFrame gating and viewport pausing for the hero orbital field; preserve that principle during refactoring.

## 13. Responsive strategy

Desktop and mobile are separate compositions.

Desktop:
- large system visualizations;
- multi-column information density;
- HUD rail/navigation.

Mobile:
- preserve logo prominence;
- collapse secondary HUD elements;
- prioritize reading and CTA;
- reduce particle density and expensive effects;
- preserve semantic visualizations rather than merely shrinking them.

## 14. Refactoring strategy

Do not rewrite the accepted prototype in one destructive commit.

Sequence:

1. Freeze current visual baseline.
2. Establish tokens.
3. Establish component boundaries.
4. Extract CSS/JS without visual changes.
5. Introduce reusable primitives.
6. Replace repeated markup.
7. Add semantic content model.
8. Improve sections one at a time.
9. Validate preview after every major step.
10. Merge only after regression checks.

## 15. Quality gate

Before a release is accepted:

- domain references checked;
- email references checked;
- all internal anchors checked;
- assets return successfully;
- no obvious runtime errors;
- responsive layout inspected;
- reduced-motion behavior inspected;
- animation does not run unnecessarily offscreen;
- canonical logo/wordmark unchanged;
- preview deployment works;
- production remains untouched until approval.

## 16. Next implementation slice

**DEX-01 — Frontend foundation hardening**

Deliverables:

1. canonical `.ru` contact/domain consistency;
2. design tokens extracted from current prototype;
3. repeated CSS overrides identified and consolidated;
4. component boundaries defined in code;
5. case metrics labelled as verified or illustrative;
6. semantic Approach visualization retained and refined;
7. preview deployment verified.

This slice must preserve the accepted visual baseline while reducing technical debt.
