# SynapseMax — Digital Experience Architecture v1

**Status:** Prototype deployed to the non-production path after Cloudflare build validation.

## Purpose

DEX v1 is the first implementation of the next website phase after the accepted front prototype. It changes the site from a visual showcase into an interface that explains how SynapseMax transforms business complexity into an intelligent system.

## Design decisions

- Preserve the canonical SynapseMax symbol and its identity.
- Keep the logo intact; motion belongs to the surrounding synaptic/electrical environment.
- Use HUD/FUI as a semantic visual language, not as decoration.
- Use Space Grotesk for display hierarchy and Manrope for readable UI/body text.
- Keep typography compact but never sacrifice hierarchy or legibility.
- Use neon only as an accent for state, flow and focus.
- Use animation to explain system behaviour: flow, signal, transformation, status.
- Respect `prefers-reduced-motion`.

## Information architecture in this iteration

1. Hero — business complexity → intelligent system.
2. Transformation thesis — Complexity → Understanding → System → Outcome.
3. Solutions — automation, AI, data/architecture, transformation, governance, measurable effect.
4. Approach — Complexity → Synapse Engine → System.
5. Cases — visual system objects rather than empty cards.
6. Trust architecture — governance and integration layer.
7. Transformation Assessment CTA.

## Technical architecture

```text
GitHub main
   ↓
Workers Builds
   ↓
node scripts/build-site.mjs
   ↓
dist/
   ├── index.html          accepted front baseline
   ├── dex-v1.html         current experience prototype
   └── assets/
   ↓
Wrangler
   ↓
Cloudflare Worker + Static Assets
   ↓
Experience Layer routes / → /dex-v1.html
```

The Worker is intentionally thin. It selects the experience shell and delegates static file delivery to the Cloudflare Assets binding. Business logic and future AI services remain outside the frontend shell.

## Validation gates

Before production promotion:

- Cloudflare build green.
- `dist` contains both baseline and DEX artifact.
- Worker preview opens without runtime errors.
- Desktop visual review.
- Mobile visual review.
- Asset paths and favicon verified.
- `hello@synapsemax.ru` verified.
- Reduced-motion behaviour verified.
- Production domain checked only after preview acceptance.

## Next DEX iteration

DEX-02 should focus on interaction depth rather than more decoration:

- interactive case demonstrations;
- transformation assessment entry point;
- ROI model shell;
- richer system telemetry;
- navigation state and section progress;
- content model separation from presentation;
- analytics events;
- accessibility audit.
