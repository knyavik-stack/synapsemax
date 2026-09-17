# DEX-01 — Component Migration Log

## Component 01: HUD Card

### Baseline

The accepted prototype uses an inline `.card` rule inside `index.html`. It combines layout, visual treatment, hover interaction and card-specific typography in one global selector.

### Target

`src/components/hud-card.css` introduces `.sm-card` and explicit child roles:

- `.sm-card`
- `.sm-card__icon`
- `.sm-card__title`
- `.sm-card__text`
- `.sm-card__arrow`

### Why this extraction exists

The card pattern is a reusable visual primitive across Services, Cases and future AI-facing UI. Naming the child roles explicitly prevents accidental coupling to generic HTML selectors during migration.

### Controlled preview

`preview/dex-card.html` mounts three representative cards against the DEX token/HUD layers only. It deliberately does not import the production `index.html` stylesheet. This isolates component behavior from legacy cascade conflicts.

### Current acceptance state

- [x] Desktop structure exists.
- [x] Mobile layout rule exists.
- [x] Hover glow is restrained.
- [x] Reduced-motion fallback exists.
- [x] No generic `.card` selector is used by the component.
- [x] DEX tokens are used for canonical values.
- [x] Preview is isolated from production.
- [ ] Visual parity against the accepted prototype confirmed by human review.
- [ ] Runtime preview verified through Cloudflare.
- [ ] Legacy `.card` instances migrated.
- [ ] Legacy card CSS removed.

### Next action

Review the isolated preview first. If the visual direction is accepted, mount one real production card using `.sm-card`, verify the Cloudflare preview, then migrate the remaining instances. Do not promote the component to production before those checks pass.
