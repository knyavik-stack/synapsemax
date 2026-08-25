# DEX-01 — Component Migration Log

## Component 01: HUD Card

### Baseline

The existing prototype uses an inline `.card` rule inside `index.html`. It combines layout, visual treatment, hover interaction and card-specific typography in one global selector.

### Target

`src/components/hud-card.css` introduces `.sm-card` and explicit child roles:

- `.sm-card`
- `.sm-card__icon`
- `.sm-card__title`
- `.sm-card__text`
- `.sm-card__arrow`

### Why this extraction exists

The card pattern is a reusable visual primitive across Services, Cases and future AI-facing UI. Naming the child roles explicitly prevents accidental coupling to generic HTML selectors during the migration.

### Migration rule

The new component is intentionally **not wired into production yet**. DEX-01 requires visual parity before replacing the legacy selector. This avoids changing architecture and design simultaneously.

### Acceptance criteria

- Desktop geometry remains equivalent to the accepted prototype.
- Mobile card remains readable and touch-friendly.
- Hover glow remains restrained.
- Reduced-motion mode removes non-essential transitions.
- No global selector collision.
- Component uses DEX tokens rather than duplicating canonical values.

### Next action

Create a controlled preview branch/commit that mounts one representative card using `.sm-card`, compare it with the legacy card, then migrate the remaining card instances only after parity is confirmed.
