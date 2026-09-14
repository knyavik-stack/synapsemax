# SynapseMax — 5-Layer Architecture Evidence Audit

**Дата:** 2026-09-14  
**Источник требований:** Master Operational Specification v2.0  
**Статус:** target architecture documented; current runtime evidence is H1/Experience-centric.

## 1. Evidence matrix

| Layer | Master Spec target | Repository evidence | Status |
|---|---|---|---|
| Experience | Cloudflare Workers/Pages, dashboards, LCH, architecture maps | `src/index.js`, `wrangler.jsonc`, `dist` build and browser QA | **PASS / H1** |
| Intelligence | agent orchestration, document parsing, Process Mining, AI Abstraction Gateway | No production runtime implementation found in current repository search | **OPEN / HIGH** |
| Business Logic | Go core, scenario execution, ROI, To-Be process graph | Financial domain currently implemented in JS; no Go core evidence found | **PARTIAL / HIGH** |
| Integration | 1C/ERP/CRM/SAP/DB adapters, REST/gRPC, queues | No concrete adapter/queue implementation found | **OPEN / HIGH** |
| Governance | security monitoring, access audit, PII masking/FZ-152 | Worker has baseline security headers; no tenant/RLS/audit/masking subsystem evidence found | **OPEN / CRITICAL if claimed as compliance** |

## 2. Database / state evidence

Current `wrangler.jsonc` exposes an `ASSETS` binding and Worker entry point. No PostgreSQL, RLS, JSONB complexity graph store, GIN indexes, Redis binding/client, or benchmark evidence was found in the current repository surface.

Therefore Master Spec statements about PostgreSQL/RLS/JSONB/Redis are treated as **target architecture**, not implemented capabilities.

## 3. Security boundary

`src/index.js` currently applies baseline response headers including `nosniff`, strict referrer policy, permissions policy and `x-frame-options: DENY`. This is useful hardening but is not tenant isolation, access governance, encryption/retention policy or FZ-152 compliance evidence.

## 4. Architectural decision

Do not introduce PostgreSQL/Redis/Go merely to make the diagram look complete. The correct next step is to define the minimal H1 persistence and tenant boundary required by the actual commercial diagnostic workflow, then implement evidence-backed interfaces that can evolve into the 5-layer target architecture without coupling Experience to storage/integration details.

## 5. Red Team

1. **Architecture gap — HIGH:** Master Spec currently describes a much larger platform than the deployed H1 implementation. Treating target-state components as present would create false architectural claims.
2. **Governance gap — CRITICAL for compliance claims:** security headers alone do not provide FZ-152/ISO/EU AI Act compliance.
3. **Premature infrastructure — HIGH:** adding databases/queues/Redis before a measured workload and tenant model risks unnecessary cost and operational debt.

## 6. Next implementation gate

Before adding infrastructure, define and test:
- tenant identity boundary;
- diagnostic session model;
- evidence/provenance records;
- immutable calculation inputs/results;
- audit event schema;
- retention/deletion semantics;
- API contract between Experience and future persistence layer.

Only after those contracts exist should PostgreSQL/RLS and Redis be introduced. Performance target `<=15 ms` remains unproven until a representative benchmark exists.
