# SynapseMax — CHAT HANDOFF

**Дата:** 2026-09-17
**Repository:** `knyavik-stack/synapsemax`
**Current production branch:** `production` in dedicated Neon project `red-bar-72989858`

## 0. Current continuation point

Continue from the Master Operational Specification and execution reports. Do not repeat completed finance productization work.

Current priority is the evidence-backed diagnostic / persistence layer:

`источник данных → evidence provenance → confidence model → leakage attribution → correlation/no-double-counting → scenario calibration → 5-year TCO/NPV → ROI/payback → action plan`

## 1. Required source documents

- `docs/synapsemax-master-operational-spec.md`
- `docs/MASTER_OPERATIONAL_EXECUTION_REPORT.md`
- `docs/PERSISTENCE_EXECUTION_REPORT_2026-09-14.md`
- `docs/PERSISTENCE_RLS_ARCHITECTURE_2026-09-14.md`
- `docs/GOVERNANCE_DATA_CONTRACT_2026-09-14.md`
- `docs/ARCHITECTURE_EVIDENCE_AUDIT_2026-09-14.md`
- `docs/DECISION_LOG.md`

## 2. Important correction

The requested `CHAT_HANDOFF_2026-09-17.md` did not exist at the start of this continuation. This file is therefore the new canonical handoff for 2026-09-17 onward.

## 3. Live Neon state — 2026-09-17

Live Neon MCP access is **PASS**.

SynapseMax dedicated Neon project:

- Project: `red-bar-72989858`
- Production branch: `br-dawn-tree-b12bzx6r` (`production`)
- Database: `neondb`
- PostgreSQL: 18.6

Initial production inspection showed only `neon_auth.*` tables. No SynapseMax persistence schema was present before validation.

## 4. Controlled persistence validation

Temporary QA branch:

`br-blue-brook-b1yxut9f` — `synapsemax-persistence-qa-20260917`

The minimal persistence contract was deployed to this branch only.

Live structural evidence:

- 11 required persistence tables;
- 10 RLS policies;
- 9 persistence indexes;
- 5 append-only triggers.

A real `calculation_results` row was inserted and an update attempt was rejected by the database with `APPEND_ONLY_RESOURCE`.

## 5. Open authorization gate

Cross-tenant isolation is **NOT PROVEN**.

The available Neon SQL path runs as database owner/superuser, which bypasses RLS for testing purposes. Temporary no-login QA roles were created, but the available interface did not permit granting those roles to the owner connection; login/password modification was not performed.

Do not mark tenant isolation DONE based on policy existence alone.

## 6. Production gate

The production branch has **not** been modified by the persistence validation.

Do not apply the production migration until the actual application authentication/role model and authorization boundary are defined and tested. The database migration must remain an explicit approval gate.

## 7. Security red-team

- **CRITICAL:** tenant escape remains open until non-owner authenticated negative tests pass.
- **HIGH:** service-role/RLS bypass must remain server-only and authorization must precede privileged access.
- **HIGH:** repository migration references Supabase `anon`/`authenticated` roles, while the live Neon database does not contain those roles. Production grants therefore require an application-specific design rather than blind migration replay.

## 8. Next execution order

1. Establish actual authenticated principal → tenant membership mapping.
2. Validate non-owner RLS isolation.
3. Validate immutable financial history, lineage and idempotency through the API boundary.
4. Validate retention/legal-hold semantics.
5. Integrate Worker persistence only after the authorization gate passes.
6. Benchmark persistence latency before introducing Redis.
7. Continue evidence-backed financial diagnostic layer and 5-year TCO/NPV.
8. Then proceed to remaining architecture/governance evidence.

## 9. Documentation rule

Every material defect or decision follows:

`обнаружение → причина → исправление → verification → Decision Log/Handoff`

The live Neon validation is documented in:

`docs/PERSISTENCE_LIVE_NEON_VALIDATION_2026-09-17.md`

## 10. Epistemic boundary

**Fact:** live Neon access and controlled schema execution succeeded.

**Fact:** append-only DB enforcement was verified against the real PostgreSQL instance.

**Not proven:** production tenant isolation, authenticated application authorization, production grants, Worker persistence integration, retention executor, Redis latency, 5-year NPV/TCO, or compliance certification.
