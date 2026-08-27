# SynapseMax — UX Quality Contract (H1)

Status: baseline contract for DEX Immediate

## Purpose

This document defines the minimum browser-level contract for the H1 commercial showcase. It complements, but does not replace, the existing domain, artifact and deployment checks.

## 1. Critical user journeys

### U1 — Landing → Assessment
- Primary hero CTA reaches the Assessment section.
- Assessment is reachable without relying on pointer hover.
- Section has a meaningful heading and labelled controls.

### U2 — Assessment → Result
- User can provide all four assessment inputs.
- Values are bounded to the domain contract (0–100).
- Invalid or non-numeric values do not break the page.
- Submission produces a visible result.
- Result remains understandable without animation.

### U3 — Assessment → ROI
- ROI inputs are bounded according to the canonical financial model.
- Zero savings produces an undefined payback (`null` / N/A), never a misleading zero-month claim.
- Financial output is consistent with `src/immediate-logic.js`.

### U4 — Keyboard-only path
- All interactive controls are reachable with Tab/Shift+Tab.
- Focus remains visible.
- No essential action depends on pointer movement, custom cursor or hover.
- Enter/Space activates applicable controls.

### U5 — Mobile / reduced motion
- Primary content remains usable at narrow widths.
- No horizontal overflow is introduced by interaction states.
- `prefers-reduced-motion: reduce` preserves information while suppressing non-essential motion.
- Custom cursor is not required on touch/coarse-pointer devices or reduced-motion mode.

## 2. Accessibility contract

- Document language is Russian (`lang="ru"`).
- Form controls have accessible labels.
- Heading hierarchy communicates section structure.
- Focus-visible state is preserved.
- Dynamic assessment/ROI results should be announced to assistive technology where technically appropriate (`aria-live="polite"` or equivalent).
- Decorative motion must not carry essential information.

## 3. Resilience contract

The experience must remain usable when:
- API calls fail or are unavailable;
- inputs are empty, malformed, negative or above their permitted maximum;
- fonts or non-essential external assets are unavailable;
- JavaScript-dependent enhancement fails where a meaningful fallback is defined.

## 4. Performance contract

Browser QA should measure rather than assume:
- initial document and critical asset weight;
- font/network dependencies;
- image payload;
- animation and compositing cost;
- layout stability;
- Core Web Vitals where a real browser environment is available.

No optimisation is accepted solely for a synthetic score if it damages the approved DEX visual system or product comprehension.

## 5. Security contract

The Worker must retain the existing baseline response headers and must not introduce inline/external execution paths that weaken the security boundary without an explicit decision.

## 6. H1 / H2 boundary

H1 demonstrates the future platform; it must not imply that demonstration calculations are already connected to a customer's ERP/CRM or represent production-grade predictive intelligence.

H2 may replace the demonstration model with governed customer data, intelligence services, process mining and richer financial modelling while preserving the Experience Layer contract.

## 7. Release gate

H1 is considered browser-QA complete only when:

1. U1–U5 are verified in a real browser or an equivalent browser automation environment.
2. Accessibility checks above pass or have documented exceptions.
3. Performance is measured on the production artifact.
4. Production smoke confirms the deployed Worker serves the expected Experience and API contracts.
5. No unresolved P0/P1 UX, security or financial-contract defect remains.
