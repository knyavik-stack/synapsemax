# SynapseMax — Pre-Release Quality Checklist

## Domain & identity

- [ ] `https://synapsemax.ru/` is canonical.
- [ ] No unintended `.ai`, `.com`, or other SynapseMax domain remains in UI/metadata.
- [ ] Public email is `hello@synapsemax.ru`.
- [ ] Logo symbol and wordmark use approved assets.

## Frontend

- [ ] No broken asset references.
- [ ] No broken internal anchors.
- [ ] Buttons and CTA links have valid destinations.
- [ ] Mobile navigation works.
- [ ] Desktop layout remains within intended max width.
- [ ] Text remains readable and does not collide with HUD elements.
- [ ] Animations do not alter the geometry of the approved S logo.
- [ ] `prefers-reduced-motion` is respected.

## Runtime

- [ ] No known JavaScript errors.
- [ ] Scroll/pointer animation does not create unnecessary continuous work when inactive.
- [ ] IntersectionObserver/visibility handling does not leak observers or timers.
- [ ] No obvious layout thrashing in animation loops.

## Marketing integrity

- [ ] Case-study metrics are real or explicitly marked as illustrative/simulation.
- [ ] Claims can be substantiated.
- [ ] CTA communicates a concrete next step.

## SEO / sharing

- [ ] Title.
- [ ] Description.
- [ ] Canonical URL.
- [ ] Open Graph title/description/image/url.
- [ ] Twitter card metadata.
- [ ] Favicon.

## Deployment

- [ ] GitHub branch/commit is known.
- [ ] Cloudflare build completed.
- [ ] Preview URL checked when available.
- [ ] Production URL checked after release.
- [ ] If any check could not be performed, mark it `NOT VERIFIED` instead of assuming success.
