# SynapseMax — Decision Log

| ID | Status | Decision |
|---|---|---|
| D-001 | Accepted | Synapse is the conceptual core: connection, transmission, intelligence and transformation. |
| D-002 | Accepted | The current S mark is the canonical visual identity. |
| D-003 | Accepted | Logo parts remain intact; motion belongs to the central synaptic zone and surrounding neural/electrical environment. |
| D-004 | Accepted | HUD/FUI is the visual grammar, not a decorative skin. |
| D-005 | Accepted | Content hierarchy, readability and business meaning outrank visual effects. |
| D-006 | Accepted | GitHub + Cloudflare Workers Builds is the deployment path. |
| D-007 | Accepted | `synapsemax.ru` remains registered at REG.RU; DNS/security are handled through Cloudflare. |
| D-008 | Accepted | Non-production branch builds are enabled for preview work. |
| D-009 | Accepted | The commercial website is the first interface of a future Transformation Intelligence Platform. |
| D-010 | Rejected | Direct coupling to a single LLM provider. |
| D-011 | Accepted | DEX prototypes use semantic HUD objects to explain transformation rather than decorative animation. |
| D-012 | Accepted | The accepted front prototype remains the baseline; DEX is layered as the next experience prototype rather than replacing the canonical brand foundation. |
| D-013 | Accepted | DEX v2 was rejected as too simplified: insufficient content density, weak business meaning and generic visual reduction. |
| D-014 | Accepted | DEX v3 restores the full business-transformation narrative, semantic content blocks, solution icons, richer approach visualization and Russian section hierarchy. |
| D-015 | Accepted | Python is reserved for visual QA, regression analysis, asset processing and future data/AI services; it is not required to render the frontend itself. |
| D-016 | Accepted | Production UI readability takes precedence over ultra-small HUD typography. Body copy, labels, metrics, navigation and architecture descriptions must remain comfortably readable on desktop and mobile. |
| D-017 | Accepted | Section rhythm is intentionally compacted after production QA identified excessive vertical gaps. Desktop and mobile spacing must preserve information density without creating empty screens. |
| D-018 | Accepted | Architecture cards collapse to content-driven height on mobile; fixed decorative heights are not allowed when they create empty space. |
| D-019 | Accepted | Canonical wordmark assets are used directly in header and footer. The wordmark must remain visually legible across browsers; no substitute web font is used. |
| D-020 | Accepted | Primary navigation uses a visible hover/focus underline, and desktop pointer interaction includes a restrained circular cursor indicator. Both disappear for coarse pointers and reduced-motion users. |
| D-021 | Accepted | The production build pipeline owns the Immediate footer materialization. Footer branding, links and typography are therefore tested at build output level rather than relying only on the source HTML placeholder. |
| D-022 | Accepted | Cross-browser brand rendering uses the canonical wordmark asset with a normalized responsive layout box; the asset itself is never redrawn or replaced with a web font. |
| D-023 | Accepted | The canonical root URL `/` serves the Immediate experience directly; it must not depend on an HTTP redirect to `/dex-immediate`. The Worker adds explicit no-store semantics to prevent stale redirect caching from masking the current production experience. |
| D-024 | Accepted | The production build fails closed if any asset other than the two approved runtime brand assets enters `dist/assets`. Reference/design material must never become deployable runtime content. |
| D-025 | Accepted | Responsive spacing is content-led. Architecture layers, process stages and other cards must not retain decorative minimum heights on small screens when those heights create empty visual fields. |
| D-026 | Accepted | `npx wrangler deploy` is the canonical production deployment command; `npx wrangler versions upload` is reserved for preview/version inspection and must not be treated as production promotion. |
| D-027 | Accepted | User-facing Immediate terminology is Russian at build output level; technical API paths and necessary technical terms may remain English. |
| D-028 | Accepted | Asset routing is Worker-first for the production experience. `run_worker_first` is enabled globally so `/` cannot fall through to the static `dist/index.html` legacy baseline before `src/index.js` can serve Immediate. |
| D-029 | Accepted | Interaction QA must be implemented end-to-end: navigation hover underline, cursor enlargement and responsive density need both behavior and visible CSS states. A JS-only state without a corresponding visual rule is considered incomplete. |

## Revisit rule

A major decision can be reopened only when new evidence, a material business requirement, a technical constraint, or a measurable UX problem justifies the change. Reopening a decision requires recording the reason and consequences here.
