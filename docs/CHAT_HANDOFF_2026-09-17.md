# SynapseMax — Chat Handoff 2026-09-17

## 0. Purpose

This file is the operational handoff for the next ChatGPT session. It must be read before any implementation work. Do not reconstruct project state from memory when repository evidence is available.

## 1. Project identity

- Repository: `knyavik-stack/synapsemax`
- Default branch: `main`
- Domain: `synapsemax.ru`
- Current Master Operational Specification: `docs/synapsemax-master-operational-spec.md`, v2.0, approved 2026-09-14.
- Execution journal: `docs/MASTER_OPERATIONAL_EXECUTION_REPORT.md`.
- Primary product principle: financial diagnosis first; automation/agents are mechanisms for closing diagnosed problems, not the product foundation.
- Core value chain: `Complexity → Understanding → System → Automation → Outcome`.
- Operating cycle: `diagnose → design → simulate → automate → monitor`.

## 2. HOW TO START THE NEXT CHAT

Read in this order:

1. `docs/CHAT_HANDOFF_2026-09-17.md` — this file.
2. `docs/synapsemax-master-operational-spec.md` — current source of truth.
3. `docs/MASTER_OPERATIONAL_EXECUTION_REPORT.md` — factual execution history and open gaps.
4. `docs/PROJECT_OPERATING_SYSTEM.md` — repository operating rules and documentation discipline.
5. `docs/GOVERNANCE_DATA_CONTRACT_2026-09-14.md` — governance/evidence contract.
6. `docs/ARCHITECTURE_EVIDENCE_AUDIT_2026-09-14.md` — implemented-vs-target architecture evidence.
7. `docs/NEON_PERSISTENCE_EXECUTION_REPORT_2026-09-16.md` — latest persistence execution state.
8. `docs/PERSISTENCE_PROVIDER_DECISION_2026-09-16.md` — decision to use dedicated Neon as current persistence provider.
9. Inspect PR #18 and its branch before modifying persistence.
10. Inspect current `main` and current PR head; never assume an old commit is current.

After reading, report facts, inference, and unknowns separately, then continue from the next executable gate. Do not redo completed finance work unless a regression is found.

## 3. WHAT HAS ACTUALLY BEEN DONE

### Finance / productization

Finance V2 is implemented and released for the current scope.

The financial domain contract covers:
- monthly leakage;
- recoverable monthly value;
- annual effect;
- annual net effect;
- ROI;
- payback;
- margin uplift/projected margin;
- priority/action map;
- evidence quality;
- conservative/base/optimistic scenarios;
- explicit overlap/no-double-counting controls;
- upfront CAPEX/implementation cost;
- recurring OPEX;
- explicit assumptions.

Important rule: error/delay recoverability defaults to 0% without evidence. Do not silently turn unverified savings into guaranteed savings.

Production evidence recorded in execution report:
- PR #12 closed Issue #11 (fallback/domain contract mismatch).
- PR #14 closed Issue #13 and added evidence quality, scenarios, overlap controls and OPEX/CAPEX economics.
- Immediate QA #269 passed.
- Production Smoke #170 passed.
- Current finance production merge commit recorded in the execution report: `9a957531599b341efeb34017a6e758ee50042c55`.

The control test scenario is test data, not a customer forecast: recoverable 260,000 RUB/month, annual 3,120,000 RUB, ROI 108%, payback 5.8 months, margin uplift +5.2 pp.

### Positioning

PR #10 implemented financial-first public positioning and was merged with production evidence. The landing journey points toward the profit-leakage diagnostic.

### Governance runtime contract

PR #16 was merged. `src/governance-contract.js` defines runtime contract primitives for:
- tenant context;
- diagnostic session;
- evidence item;
- input snapshot;
- calculation result;
- audit event;
- lineage.

It rejects tenant mismatch/invalid roles, rejects top-level secret evidence, freezes immutable contract objects, and validates scenarios.

This is NOT production persistence and NOT proof of real multi-tenant isolation.

### Governance data contract

PR #15 was merged. It defines the chain:
`tenant → diagnostic session → evidence → input snapshot → calculation result → lineage → audit`.

It also defines provenance, immutability, retention/deletion semantics, masking, idempotency and tenant isolation requirements.

### Architecture audit

The target architecture is five layers:
`Experience → Intelligence → Business Logic → Integration → Governance`.

Current repository evidence shows the Experience layer and H1 business logic/API are real. There is no factual evidence yet that PostgreSQL/RLS, JSONB complexity graphs, GIN indexes, Redis <=15ms, AI Gateway, integration queues or full governance layer are production implemented. Do not present target architecture as implemented.

### Brand / HUD

Canonical design tokens:
- Void 1 `#0D1117`
- Void 2 `#1C2128`
- Cyan `#00D4FF`
- Blue `#0066FF`
- Purple `#8A2BFF`
- Magenta `#D100FF`
- Orbitron for logo/wordmark/H1-H3/HUD statuses
- Manrope for body/tables/analytics

Runtime brand normalization and QA passed, but source-level token drift remains technical debt. See `docs/BRAND_HUD_AUDIT_2026-09-14.md`.

## 4. CURRENT PERSISTENCE WORK — THE NEXT REAL GATE

### Provider decision

Dedicated Neon is the current persistence provider candidate for SynapseMax. Existing unrelated Supabase projects must NOT be reused.

The persistence migration lives under:
`database/migrations/20260916150000_synapsemax_persistence.sql`

The design includes 11 tables, tenant-aware composite foreign keys, RLS, FORCE RLS on runtime tables, append-only triggers, tenant-local context via `app.tenant_id`, and no client grants until authenticated application identity is implemented.

### PR #18 — CURRENT OPEN WORK

PR #18:
`feat(data): harden Neon persistence boundary`

Head branch:
`feat/neon-persistence-hardening-2026-09-16`

Head SHA currently recorded by GitHub:
`4755e8b0f1b9e5ae4a8d028f623cb0e58077dd6e`

Base:
`main`

PR is OPEN and NOT MERGED.

PR #18 explicitly requires before merge:
- repository QA;
- migration workflow against the dedicated Neon project;
- real cross-tenant negative tests;
- append-only tests;
- idempotency tests;
- Worker integration only after authorization boundary is closed.

### Critical security gaps still open

1. CRITICAL — client tenant spoofing must be impossible. `tenant_id` supplied by a client is never a trust boundary. Authenticated principal → membership lookup → server-side transaction-local tenant context must be implemented and tested.
2. HIGH — runtime DB role must be least privilege and must not rely on owner/BYPASSRLS access.
3. HIGH — JSONB evidence must be sanitized/redacted before persistence; top-level secret rejection is not sufficient for nested secrets/PII.
4. HIGH — immutable financial history must be proven on a live DB, not only by source inspection.
5. MEDIUM — retention policy metadata exists, but deletion executor/operational retention enforcement is not yet implemented.

Do not claim FZ-152, ISO 27001 or EU AI Act compliance from architecture alone. Compliance evidence is a separate gate.

## 5. NEON MCP BLOCKER — IMPORTANT FOR NEXT CHAT

User has confirmed multiple times that Neon is connected through:
`https://mcp.neon.tech/mcp`

User has already tried reconnecting and multiple connection methods. Do NOT keep asking the user to reconnect as the default response.

In the previous session, the Neon namespace first appeared, then disappeared from the tool layer. Calls such as `list_projects` returned `MCP error -32602: Tool list_projects not found`; later resource discovery reported that Neon was not among available namespaces. This is a tool-routing/session availability problem from the assistant side as observed in that session, not evidence that the user's Neon project is broken.

NEXT CHAT FIRST ACTION:
- inspect whether Neon tools are actually exposed in the current session;
- if exposed, use them immediately for live project/branch/database inspection;
- if not exposed, do not claim Neon is unavailable on the user's account and do not ask for another reconnect loop. State that the current session lacks the Neon tool binding and continue repository-safe work while preserving the blocker.

## 6. SAFE NEON EXECUTION ORDER

When Neon tools are available:

1. Identify the dedicated SynapseMax Neon project.
2. Identify production/main branch and database name.
3. Inspect current schema before mutation.
4. Prepare the migration on a temporary branch using the Neon migration preparation flow.
5. Run structural verification on the temporary branch.
6. Run real negative tests:
   - tenant A cannot read tenant B;
   - tenant A cannot insert/update/delete tenant B;
   - tenant context cannot be spoofed by request payload;
   - immutable result/snapshot/evidence/audit resources reject UPDATE/DELETE;
   - idempotency behavior is deterministic.
7. Verify RLS and FORCE RLS coverage.
8. Verify privileges and runtime role assumptions.
9. Inspect migration results and record evidence.
10. Only after all checks pass, ask the user for explicit approval to mutate production.

IMPORTANT: Neon `complete_database_migration` is destructive/mutating and must NEVER be called autonomously. User approval is required immediately before applying changes.

## 7. GITHUB FACTUAL STATUS AT HANDOFF

Repository access was just independently verified on 2026-09-17:
- repository exists: `knyavik-stack/synapsemax`;
- default branch: `main`;
- connector reports `admin=true`, `maintain=true`, `push=true`;
- repository is public and active.

Recent PR list confirms PR #18 is open/not merged, while PRs #10, #12, #14, #15, #16 and #17 are merged.

The assistant DOES have GitHub write capability. A previous message incorrectly stated that GitHub write access was unavailable. That statement was false and must not be propagated.

## 8. CHAT HANDOFF DOCUMENTATION RULE

This file itself must be committed to the repository. If the current branch/commit is not merged, the next chat must finish the documentation commit and merge/close path according to normal QA gates.

After every meaningful implementation stage:
- update the execution report;
- update Decision Log if an architectural decision changed;
- record commit/PR/QA/production evidence;
- record open risks and technical debt;
- never erase an unresolved HIGH/CRITICAL gap to make the report look green.

## 9. WHAT NOT TO DO

- Do not redo completed finance productization without evidence of regression.
- Do not introduce Redis merely to match the Master Spec; benchmark first.
- Do not connect the Worker to persistence before the authorization boundary is closed.
- Do not use existing unrelated Supabase projects.
- Do not expose or request `NEON_DATABASE_URL` in chat.
- Do not put secrets into source, docs, PR bodies or logs.
- Do not claim compliance without evidence.
- Do not call production migration autonomously.
- Do not report merge as production release evidence.

## 10. IMMEDIATE START PROMPT FOR THE NEXT CHAT

Paste/use this as the first user message if needed:

> Продолжай SynapseMax по `docs/CHAT_HANDOFF_2026-09-17.md`. Сначала прочитай handoff, `docs/synapsemax-master-operational-spec.md`, `docs/MASTER_OPERATIONAL_EXECUTION_REPORT.md`, `docs/PROJECT_OPERATING_SYSTEM.md`, governance/persistence audit docs и текущий PR #18. Не повторяй завершённую Finance V2 работу. Первым техническим действием проверь, действительно ли Neon MCP tools опубликованы в текущей сессии. Если Neon доступен — сразу переходи к live-аудиту dedicated Neon project и реальным cross-tenant/RLS/immutability/idempotency тестам на temporary branch. Если Neon tool binding отсутствует — не проси меня переподключать Neon снова; зафиксируй session/tool-routing blocker и продолжай только repository-safe работу. Все факты фиксируй в репозитории.

## 11. SELF-CORRECTION

Fact: GitHub access is currently verified and has push/admin permission.

Correction: The previous assistant statement that GitHub write access was unavailable was wrong. It resulted from a tool-binding discovery failure in that moment, not from the repository permission state.

Fact: Neon user-side connection has been confirmed by the user; current-session Neon tool exposure is the unresolved issue.

Unknown: live Neon project ID, production branch state, current database schema and whether migration has ever been applied. These must be verified through live Neon tools before claiming persistence deployment.
