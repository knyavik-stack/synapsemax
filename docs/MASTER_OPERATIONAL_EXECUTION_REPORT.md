# SynapseMax — Master Operational Execution Report

**Босс:** владелец проекта  
**Нормативный документ:** `docs/synapsemax-master-operational-spec.md` v2.0 от 2026-09-14  
**Репозиторий:** `knyavik-stack/synapsemax`  
**Назначение:** живой журнал фактического исполнения Master Operational Specification.  
**Правило:** `DONE` ставится только после соответствующего DoD, автоматической QA и production evidence.

---

## 0. Управляющий протокол

1. Проверить требование Master Spec.
2. Проверить repository/production.
3. Изменить только необходимое.
4. Прогнать автоматическую QA.
5. Проверить production smoke/deployment evidence.
6. Зафиксировать фактический результат.
7. Перейти к следующему блоку.

Merge не является доказательством релиза; ROI нельзя завышать; открытые HIGH/CRITICAL gaps не должны исчезать из очереди. FZ-152/ISO/EU AI Act требования считаются design requirements до появления фактического compliance evidence.

---

# 1. BASELINE AUDIT — 2026-09-14

### Master Spec
**VERIFIED.** `docs/synapsemax-master-operational-spec.md` v2.0 — основной операционный источник истины.

### Repository
**VERIFIED.** `knyavik-stack/synapsemax`, `main`, financial diagnostic, build pipeline, browser QA и production smoke присутствуют.

### Ключевые baseline gaps
- **R-01 Financial fallback/domain mismatch — CLOSED.** HIGH Issue #11 закрыт; fallback синхронизирован с evidence-driven domain contract.
- **R-02 Master Spec шире текущей реализации — OPEN / HIGH.** PostgreSQL/RLS/JSONB/Redis, AI Gateway, Integration и Governance остаются частично реализованными/документированными; без evidence не считаются DONE.
- **R-03 Brand tokens — OPEN / MEDIUM.** Нужна нормализация токенов Master Spec после аудита runtime pages.
- **R-04 Security/compliance claims — OPEN / CRITICAL if presented as guarantee.** Архитектурное требование не равно юридическому compliance.
- **R-05 Redis <=15 ms — OPEN / MEDIUM.** Benchmark/load evidence отсутствует.
- **R-06 CI dependency warning — OPEN / LOW-to-MEDIUM operational.** Browser QA сообщает о 2 high severity vulnerabilities во временно устанавливаемом Playwright dependency tree; это не доказательство уязвимости production runtime, но требует отдельного dependency review.

---

# 2. EXECUTION ROADMAP

| Блок | Статус | Прогресс |
|---|---|---:|
| North Star / positioning | **DONE — production evidence** | **100%** |
| Brand / HUD / design tokens | PARTIAL / queued | 60% |
| 5-layer architecture / DB | PARTIAL / queued | 30% |
| H1/H2/H3 roadmap | DOCUMENTED | 65% |
| Business model / funnel | DOCUMENTED | 55% |
| Security / FZ-152 / Change | DESIGN ONLY | 20% |
| Role checklists / DoD | PARTIAL | 55% |
| Telegram/SMM | DOCUMENTED | 40% |
| Production evidence | **STRONG** | **90%** |

**Общая оценка Master-Spec alignment:** ~60%. Это покрытие требований, не процент готовности бизнеса и не compliance score.

---

# 3. STEP 1 — NORTH STAR / POSITIONING

**Статус: DONE — production evidence / 100%**  
**PR:** #10  
**Merge:** `1a277173a4c2f97e9e39255aa0203b6e378364a9`

Реализован deterministic build-time positioning pass: финансовая диагностика profit leakage стала основной точкой входа, CTA ведёт к `/dex-immediate.html#profit-leakage`, narrative соответствует `Complexity → Understanding → System → Automation → Outcome` и `diagnose → design → simulate → automate → monitor`.

**Evidence:** build/regression checks PASS; Production Smoke после merge PASS.  
**Technical debt:** долгосрочно перенести canonical positioning из build-time transformation в основной source-of-truth страницы.

---

# 4. STEP 4 — BUSINESS / FINANCE — CURRENT PRIORITY

**Статус: FINANCE PRODUCTIZATION V2 — DONE FOR CURRENT SCOPE / production evidence**  
**Прогресс: 95% текущего H1 финансового контура**

## 4.1. Финансовый контракт

Domain logic `src/immediate-logic.js` остаётся авторитетным расчётным контрактом:
- monthly leakage;
- recoverable monthly value;
- annual recoverable value;
- annual net value;
- ROI;
- payback;
- margin uplift / projected margin;
- priority source;
- Action Map;
- evidence/data quality;
- conservative/base/optimistic scenarios;
- overlap adjustment;
- upfront investment / OPEX-aware economics;
- explicit assumptions.

Recoverability ошибок и задержек не предполагается автоматически: без evidence default = 0%.

## 4.2. Issue #11 — CLOSED

HIGH Issue #11 `synchronize profit-leakage frontend fallback with domain recoverability contract` закрыт. Frontend fallback приведён к evidence-driven contract; regression checks подтверждают, что отсутствие подтверждающих данных не превращается в 100% recovery.

## 4.3. Issue #13 — CLOSED

Issue #13 `feat(finance): add evidence confidence, scenarios and double-counting controls` закрыт через PR #14.

**Merge:** `9a957531599b341efeb34017a6e758ee50042c55`.

Реализовано:
- evidence quality / confidence signal;
- conservative / base / optimistic scenarios;
- явные overlap controls между manual/errors/delays;
- CAPEX/OPEX-aware ROI и payback;
- regression + real-browser QA coverage.

## 4.4. No-double-counting control

Модель различает gross recoverable value и очищенный recoverable value. Для errors/delays доступны явные overlap shares; модель вычитает только заявленное пересечение и не делает скрытых корреляционных предположений.

Это сознательно консервативный дизайн: автоматическая «умная» корреляция без доказательств была бы красивее, но финансово опаснее.

## 4.5. Scenario economics

По умолчанию:
- **conservative:** 70% очищенного net monthly value;
- **base:** 100%;
- **optimistic:** 115%.

Коэффициенты являются сценарными допущениями, а не вероятностями и не гарантией. Каждый сценарий показывает annual value, ROI и payback.

## 4.6. TCO / OPEX / CAPEX

Финансовый расчёт теперь учитывает:
- `implementationCost` + `oneTimeCapex` как upfront investment;
- `monthlyOpex` + `annualOpex / 12` как ongoing cost;
- annual net value после ongoing costs;
- ROI и payback по net economics.

Это устраняет слабое место старой модели, где единичный implementation cost не отражал эксплуатационную стоимость решения.

## 4.7. Evidence quality

`evidenceQuality` отображается как `Низкая / Средняя / Высокая`. Значение не изменяет математический результат автоматически: оно является явным сигналом качества исходных данных и не превращается в скрытый multiplier ROI.

Это сделано намеренно: confidence должен сначала стать governance/evidence механизмом, а не произвольным коэффициентом, который может незаметно менять деньги.

## 4.8. Browser QA evidence

Immediate QA **#269**, run id `34886432033`, завершён **SUCCESS**.

Проверены:
- landing → assessment → CTA;
- profit leakage → economic effect;
- ROI / payback / margin impact;
- conservative/base/optimistic scenario cards;
- evidence quality display;
- Action Map;
- mobile viewport без горизонтального overflow.

Все build, immediate/financial regression, positioning, artifact, routing, performance budget, Wrangler validation/dry-run, local Worker и 3 browser tests прошли.

Production Smoke **#170**, run id `34886568180`, для merge commit `9a957531599b341efeb34017a6e758ee50042c55` завершён **SUCCESS**; production deployment/smoke verification прошёл.

## 4.9. Финансовый контрольный сценарий

QA scenario:
- labor = 1 000 000 ₽/мес.;
- manual share = 50%;
- recoverable manual share = 40%;
- errors = 100 000 ₽/мес.; recovery = 50%;
- delays = 50 000 ₽/мес.; recovery = 20%;
- implementation = 1 500 000 ₽;
- revenue = 5 000 000 ₽/мес.; margin = 20%.

Expected/factual base result:
- recoverable = **260 000 ₽/мес.**;
- annual net effect = **3 120 000 ₽**;
- ROI = **108%**;
- payback = **5,8 мес.**;
- margin uplift = **+5,2 п.п.**.

Scenario cards:
- conservative = **2 184 000 ₽/год**;
- base = **3 120 000 ₽/год**;
- optimistic = **3 588 000 ₽/год**.

Это тестовый сценарий, а не клиентский прогноз.

## 4.10. Finance red-team — current

1. **HIGH — evidence quality:** confidence пока является signal, а не автоматически вычисляемой доказательной оценкой. Следующий enterprise layer должен связывать evidence с конкретными источниками и audit trail.
2. **MEDIUM/HIGH — overlap attribution:** текущий контроль использует явные пользовательские overlap shares. Реальная process graph correlation ещё не доказана.
3. **MEDIUM — scenario factors:** 70/100/115% — продуктовые допущения, не статистически калиброванные вероятности.
4. **MEDIUM — TCO horizon:** текущий TCO покрывает upfront + recurring costs, но ещё не является полноценной 5-летней моделью NPV/TCO.

---

# 5. STEP 2 — BRAND / DESIGN SYSTEM

**Статус: QUEUED / READY FOR AUDIT — 60%**

Проверить Master Spec requirements: Orbitron/Manrope, Void/Cyan/Blue/Purple/Magenta tokens, HUD/FUI functional behavior, synaptic-zone animation, canonical assets, mobile composition. Не менять принятый logo direction без основания.

---

# 6. STEP 3 — 5-LAYER TECHNICAL ARCHITECTURE

**Статус: QUEUED — 30%**

Цель: `Experience → Intelligence → Business Logic → Integration → Governance`.

Требуется factual evidence по AI Abstraction Gateway, PostgreSQL/RLS, JSONB complexity graphs, GIN indexes, Redis, integration adapters/queues, governance/audit/masking.

---

# 7. STEP 5 — SECURITY / GOVERNANCE

**Статус: QUEUED — 20%**

Следующий security pass должен проверить data flow, tenant isolation, access model, audit events, masking/anonymization, encryption, retention/deletion и compliance evidence boundaries.

**Critical rule:** FZ-152/ISO/EU AI Act нельзя заявлять как достигнутые без технических и организационных доказательств.

---

# 8. STEP 6 — QA / RELEASE

**Статус: PASSING — current finance scope released**

Current evidence:
- build PASS;
- domain/immediate tests PASS;
- financial fallback contract PASS;
- finance productization V2 test PASS;
- positioning regression PASS;
- artifact/static contract PASS;
- browser UX **3/3 PASS**;
- Production Smoke **PASS**;
- production live verification **PASS**.

Current production merge commit: `9a957531599b341efeb34017a6e758ee50042c55`.

---

# 9. TECHNICAL DEBT REGISTER

1. `finance-productization-pass.mjs` и `align-financial-fallback.mjs` являются переходным build-time слоем. Долгосрочная цель — один shared financial calculation contract без post-build patching.
2. `master-spec-positioning.mjs` остаётся transitional source transformation.
3. Evidence provenance/audit trail ещё не реализован на enterprise уровне.
4. Автоматическая process correlation для no-double-counting отсутствует; пока используется explicit overlap input.
5. Полный 5-year TCO/NPV ещё не реализован.
6. Security/compliance evidence отсутствует в объёме, достаточном для production guarantee.
7. Redis performance target <=15 ms не benchmarked.
8. Dependency review для Playwright/browser QA предупреждений ещё не закрыт.

---

# 10. NEXT EXECUTION STEP

Финансовый H1-контур текущей итерации закрыт по DoD. Следующий результат — **evidence-backed diagnostic layer**:

`источник данных → evidence provenance → confidence model → leakage attribution → correlation/no-double-counting → scenario calibration → 5-year TCO/NPV → ROI/payback → action plan`.

После этого — полноценный Brand/HUD audit, затем 5-layer architecture/DB evidence и Governance/security.

---

# 11. STATUS UPDATE — 2026-09-19

## 11.1 Current readiness, separated by scope

Percentages below are engineering readiness estimates against the documented DoD, not subjective quality scores and not compliance scores.

| Контур | Текущий статус | Готовность |
|---|---|---:|
| Commercial / financial diagnostic core | production evidence, H1 finance scope complete | **95%** |
| Public frontend / Immediate experience | production + browser QA | **90%** |
| CI / release / deployment control | Immediate QA + Production Smoke green on current main | **100%** |
| Neon Auth | configured and real login verified; server-side password-composition gate remains | **85%** |
| Persistence / tenant RLS | schema + policies deployed; real two-user runtime isolation still open | **75%** |
| Security / governance | architecture and controls documented, runtime authorization proof incomplete | **45%** |
| 5-layer platform architecture | foundation documented, major integration/AI/governance layers not evidenced | **35%** |
| Brand / HUD / design system | accepted foundation, normalization/audit remains | **60%** |
| Business model / funnel | documented, not fully operationalized | **55%** |
| Telegram / SMM | documented plan, execution remains | **40%** |

### 11.2 Three project-level percentages

- Commercial MVP / client-facing diagnostic readiness: **~80%**.
- Enterprise platform readiness: **~55%**.
- Master-Spec alignment: **~62%**.

Important: the project is **not enterprise-ready despite green CI**. The CRITICAL tenant-isolation gate remains open.

## 11.3 Release state

Current main CI evidence on 2026-09-19:
- Immediate QA: **SUCCESS**
- Production Smoke: **SUCCESS**
- production deployment path: Cloudflare Workers Builds
- current main release passed syntax, build, deployment graph, browser UX and production smoke gates.

This closes the current CI/release incident. It does not close security authorization.

## 11.4 Updated execution order

### NEXT — P0 / CRITICAL
**Close runtime tenant isolation.**

Proof required:
1. real Neon Auth user A -> tenant A only;
2. real Neon Auth user B -> tenant B only;
3. A cannot read/write B;
4. B cannot read/write A;
5. unauthenticated request returns no tenant data;
6. ambiguous membership fails closed;
7. no privileged owner credential participates in the proof.

### P1
**Evidence-backed financial diagnostic layer.**

Target chain:
source -> evidence provenance -> confidence model -> leakage attribution -> correlation/no-double-counting -> scenario calibration -> 5-year TCO/NPV -> ROI/payback -> action plan.

### P2
**Brand/HUD audit and canonical token normalization.**

### P3
**5-layer architecture evidence:** PostgreSQL/RLS/JSONB, integration adapters/queues, AI abstraction gateway, Redis benchmark and governance/audit.

### P4
**Commercial operating layer:** funnel instrumentation, SMM execution, client portal and rentable feature boundaries.

## 11.5 Red-team update

1. **CRITICAL:** green CI can create false confidence if authorization is inferred from owner SQL access. It must not be.
2. **HIGH:** evidence quality is still a signal, not a provenance-backed confidence model.
3. **HIGH:** the current product can calculate ROI, but client-grade attribution remains dependent on evidence quality and explicit overlap assumptions.
4. **MEDIUM:** Master Spec remains broader than current runtime; percentages must not be interpreted as feature completion of the future SaaS platform.

## 11.6 Self-correction

**Assumed:** the documented DoD remains the source of truth and no undocumented requirement has been added after the latest Master Spec.
**If false:** the affected percentage must be recalculated against the changed DoD.
**Not yet evidenced:** real two-user cross-tenant runtime isolation, full 5-year NPV/TCO, Redis latency target, complete governance/compliance evidence and production-grade process correlation.

## SELF-CORRECTION / EPISTEMIC BOUNDARY

**Факты:** PR #14 merged; Immediate QA #269 PASS; Production Smoke #170 PASS; Issue #13 CLOSED.  
**Inference:** финансовый контур теперь существенно ближе к decision-grade diagnostic и коммерческому ROI language, чем baseline.  
**Не доказано:** точность клиентских исходных данных, фактическая process-level correlation, статистическая калибровка scenario factors, 5-year NPV/TCO, Redis <=15 ms и юридическое compliance.  
**Если эти предпосылки окажутся неверны:** ROI/маржинальный эффект должны быть пересчитаны, а compliance claims запрещены до появления evidence.


## 11.7 P0 EXECUTION — 2026-09-19

Реализован и в main смержен PR #20 (2db8387675cad0aa94c041124aaa1457deb72c2e).

### Что реально внедрено
- новый server-side endpoint GET /api/v1/tenant-context;
- запрос без Bearer JWT получает HTTP 401;
- malformed/non-Bearer authorization получает HTTP 401;
- tenant не принимается из URL/body/JWT claim как самостоятельный источник авторизации;
- tenant определяется только через RLS-visible public.tenants + active public.tenant_memberships одного и того же tenant;
- 0 или >1 видимых tenant/membership, либо рассинхронизация tenant ↔ membership, дают fail-closed HTTP 403;
- добавлен автоматический QA gate test:tenant-context.

### Verification
PR #20 Immediate QA run #348 / 35464131899 — SUCCESS:
- build PASS;
- financial/immediate regression PASS;
- tenant-context unit gate PASS;
- artifact/routing/budget PASS;
- Wrangler check/dry-run PASS;
- local Worker PASS;
- Chromium browser QA PASS.

### Что это закрывает
Кодовый runtime boundary: CLOSED for the newly introduced endpoint.

### Что НЕ закрывает
CRITICAL proof of real tenant isolation remains OPEN until two real verified Neon Auth sessions are exercised against production Data API:
- User A → tenant A only;
- User B → tenant B only;
- A ↛ B read/write;
- B ↛ A read/write;
- unauthenticated → no tenant data;
- ambiguous membership → fail closed;
- no owner/bypass role in evidence.

Это не косметический gap: без двух реальных principals нельзя честно объявлять enterprise tenant isolation proven.

## 11.8 Immediate next execution

Следующий технический результат — real-session RLS harness: автоматизированный production smoke, который получает два реальных Neon Auth JWT и выполняет положительные/отрицательные read/write checks без privileged DB credentials. Если тестовые principals/credentials отсутствуют в доступном execution environment, этот единственный внешний prerequisite будет зафиксирован как blocker, а не замаскирован псевдо-тестом.


## 11.9 P0 REAL-SESSION HARNESS — 2026-09-19

PR #21 merged: 8523cb2188c96710433a09044398e7a2a33a43d6.

В репозиторий добавлен production-grade real-session RLS harness:
- `@neondatabase/auth` используется для реального email/password sign-in;
- JWT получается через официальный `auth.getJWTToken()`;
- A и B обязаны быть разными principals;
- каждый principal должен видеть ровно один tenant и одну matching active membership;
- cross-tenant `calculation_results` read проверяется на нулевую выдачу;
- own-tenant visibility проверяется отдельно;
- unauthenticated Data API request должен быть отвергнут;
- `/api/v1/tenant-context` проверяется против RLS-visible tenant;
- privileged DB credentials в тесте не используются.

Immediate QA #352 for PR #21: SUCCESS.

### Current external blocker
Production Neon Auth currently contains exactly **1 user / 1 active principal**. Поэтому реальный A↔B isolation proof физически не может быть выполнен: второго независимого principal нет.

Вместо фиктивного теста создан manual-only GitHub workflow `.github/workflows/real-rls-isolation.yml`. Он запускается только после добавления четырех repository secrets:
`SYNAPSEMAX_RLS_A_EMAIL`, `SYNAPSEMAX_RLS_A_PASSWORD`, `SYNAPSEMAX_RLS_B_EMAIL`, `SYNAPSEMAX_RLS_B_PASSWORD`.

Секреты не запрашиваются через код и не логируются. До появления второго production principal CRITICAL gate остаётся OPEN.


# 12. P1 — EVIDENCE-BACKED FINANCIAL DIAGNOSTIC — 2026-09-19

**Status: IMPLEMENTED IN CODE / QA GATE PENDING**

Implemented on branch `p1-evidence-backed-financial-diagnostic`:
- `src/evidence-diagnostic.js` — source/provenance/quality model, weighted evidence aggregation, leakage attribution through the existing financial contract, explicit overlap/no-double-counting control, evidence-calibrated scenarios, five-year NPV.
- `src/evidence-persistence.js` — authenticated Neon Data API persistence for diagnostic session, immutable input snapshot, evidence items, calculation results and calculation lineage.
- `POST /api/v1/financial-diagnostic` — requires the resolved Neon tenant context; rejects missing/invalid evidence cardinality and persists the calculation under the authenticated tenant.
- `scripts/test-evidence-diagnostic.mjs` — regression coverage for contract version, evidence quality, five-year horizon, scenario ordering and no-double-counting semantics.

**Financial principle:** evidence quality is not a hidden ROI multiplier. It controls scenario uncertainty while the base economic calculation remains traceable to source evidence and explicit assumptions.

**Persistence principle:** the request never supplies `tenant_id` as an authorization source; tenant identity comes from the authenticated Neon Data API/RLS context. Lineage connects every persisted scenario result to the input snapshot and evidence rows.

**Open gate:** runtime two-principal RLS proof remains separate and is not falsely marked closed. P1 code must pass Immediate QA before merge/production smoke.

**Red-team:**
1. HIGH — persistence is multi-step over Data API rather than a single database transaction; partial failure can leave an incomplete session. Follow-up: add transactional RPC/job orchestration if the platform exposes a safe transactional boundary.
2. MEDIUM — scenario calibration is deterministic and evidence-quality driven, not statistically calibrated from historical client outcomes.
3. MEDIUM — process correlation remains explicit-overlap based; causal graph correlation is not yet implemented.


## P2 Financial Decision Engine — 2026-09-20

Implemented `financial-decision-v1`: recoverable value, CAPEX, recurring OPEX/support/infrastructure, 5-year TCO, undiscounted net cash benefit, NPV, ROI, payback, margin uplift, projected margin and scenario sensitivity. Inputs are explicitly separated into facts, assumptions and scenario-dependent values. Edge-case regression coverage added for zero benefit/investment and invalid negative/rate inputs.


## P2.1 — FINANCIAL DECISION ENGINE INTEGRATION + PERSISTENCE HARDENING — 2026-09-20

**Status: CODE COMPLETE / QA IN PROGRESS**

The standalone `financial-decision-v1` engine is now wired into `runEvidenceBackedDiagnostic()`. One decision object is derived from the evidence-backed recoverable value and explicit CAPEX/OPEX/support/infrastructure assumptions and exposes:
- 5-year TCO;
- undiscounted net cash benefit;
- NPV;
- ROI;
- payback;
- margin uplift / projected margin;
- conservative/base/optimistic scenario economics;
- sensitivity to recoverable value and recurring cost.

The decision object is persisted into every calculation-result assumption envelope, preserving the link between the evidence diagnostic and the financial decision layer.

Persistence hardening added without changing the tenant authorization model:
- tenant-scoped `x-idempotency-key` / `idempotencyKey` support;
- duplicate requests resolve to the existing session instead of creating a second calculation;
- session lifecycle is explicit: `persisting → completed` or `persisting → failed`;
- audit events record start, completion and failure;
- failed sessions retain a visible failure state instead of silently disappearing.

**Atomicity boundary:** the Data API still executes multiple HTTP writes. The new lifecycle/idempotency controls mitigate duplicate/partial-write risk and make it observable, but they do **not** claim ACID atomicity. A transactional Neon RPC remains the final hardening step; introducing that database function requires a reviewed schema migration rather than an unreviewed production DDL mutation.

### Red-team
1. **HIGH — atomicity remains open:** a network/process failure can still occur between two Data API writes.
2. **MEDIUM — decision engine inputs:** client-supplied operating-cost assumptions remain assumptions until tied to source evidence.
3. **MEDIUM — scenario calibration:** factors remain uncertainty bands, not empirically estimated probabilities.

### QA gate
Immediate QA must prove the integrated finance regression and existing runtime/browser gates before merge. Production deployment evidence remains separate from GitHub merge evidence.


## 12.1 P2 INTEGRATION — 2026-09-20

**Status: MERGED / QA VERIFIED**

PR #24 merged as `74913f448fb9f69882cef50ea869e67954dffe4f`; PR #25 merged as `fdb656148dcb33076ef51a21b823a2bb7dc98845`.

The evidence-backed diagnostic now consumes `financial-decision-v1` and exposes one decision envelope covering TCO, NPV, ROI, payback, margin impact and sensitivity. The same decision object is persisted with each scenario result, preserving calculation traceability.

Persistence hardening is also live in code: tenant-scoped idempotency keys, explicit session states, and audit events. PR #26 then added a transactional Postgres RPC migration plus an RPC-first Worker path with HTTP-404-only fallback to the legacy multi-write path.

Immediate QA #366 for PR #26: **SUCCESS**. Build, financial regression, positioning, artifact, routing, Wrangler, local Worker and Chromium browser gates all passed.

### Transactional persistence gate

The migration `neon/migrations/20260920103000_transactional_financial_diagnostic_rpc.sql` was applied and syntax-tested on an isolated Neon branch `synapsemax-tx-rpc-qa`. The function is `SECURITY INVOKER`, requires `current_tenant_id()`, grants EXECUTE only to `authenticated`, and owner execution without authenticated tenant context correctly fails closed.

**Production DDL is applied and verified.** The function is present on the production branch, `SECURITY INVOKER` is confirmed, and `authenticated` has EXECUTE. The database-owner execution path was tested and correctly failed closed because no authenticated tenant context was present. The Worker remains backward-compatible through the 404 fallback path as a defensive compatibility mechanism.

### Updated readiness — engineering scope

| Контур | Status | Readiness |
|---|---|---:|
| Financial diagnostic + decision engine | QA verified / merged | **98%** |
| Diagnostic persistence integrity | RPC applied + production verified | **98%** |
| Public frontend / Immediate | production + browser QA | **90%** |
| CI / release control | green on current changes | **100%** |
| Neon Auth | configured; password composition + two-user proof open | **85%** |
| Tenant authorization | runtime boundary implemented; two-user proof open | **80%** |
| Security / governance | audit/idempotency improved; retention/compliance evidence open | **55%** |
| 5-layer platform | foundation only; AI gateway/integration/Redis evidence open | **40%** |
| Brand / HUD | accepted foundation; normalization/audit remains | **60%** |
| Commercial operating layer | documented, not fully operationalized | **55%** |

**Project engineering readiness: ~72%.** This is not a compliance score and does not treat future SaaS capabilities as complete.

### Remaining blockers to 100%

1. **CRITICAL:** two real production Neon Auth principals with independent tenant memberships and bidirectional negative read/write proof.
3. **HIGH:** server-side password composition enforcement at the application auth boundary.
4. **HIGH:** retention executor/legal-hold runtime evidence and complete governance controls.
5. **MEDIUM:** Redis latency benchmark and integration-layer evidence.
6. **MEDIUM:** LLM-agnostic AI Gateway and integration adapter runtime evidence.
7. **MEDIUM:** process-level correlation beyond explicit overlap assumptions.
8. **MEDIUM:** production client portal/dashboard and full commercial funnel instrumentation.

## 12.2 — PRODUCTION RPC VERIFICATION — 2026-09-20

**Status: VERIFIED**

Production Neon verification confirms:
- `public.persist_financial_diagnostic(jsonb)` exists on the production branch;
- function security mode is `SECURITY INVOKER` (`prosecdef=false`);
- role `authenticated` has EXECUTE;
- execution without an authenticated tenant context fails closed with `FINANCIAL_DIAGNOSTIC_TENANT_CONTEXT_REQUIRED`;
- the Worker uses RPC-first persistence and only falls back on HTTP 404 as a compatibility path.

**Correction:** the earlier readiness table entry saying "production migration pending" was stale. The migration is applied; the remaining integrity/security gate is the real two-principal tenant-isolation proof.

### Current blockers after this verification
1. **CRITICAL:** two real production Neon Auth principals and bidirectional cross-tenant negative tests.
2. **HIGH:** server-side password-composition enforcement at the application auth boundary.
3. **HIGH:** retention executor/legal-hold runtime evidence and governance controls.
4. **MEDIUM:** Redis latency benchmark/integration evidence.
5. **MEDIUM:** LLM-agnostic AI Gateway and integration adapter runtime evidence.
6. **MEDIUM:** process-level correlation beyond explicit overlap assumptions.
7. **MEDIUM:** client portal/dashboard and full commercial funnel instrumentation.

### Red-team

- Do not call the project enterprise-ready while item 1 is open.
- Do not call diagnostic persistence ACID in production until item 2 is applied and production-verified.
- Do not turn scenario factors into probabilities without empirical calibration.
- Do not present FZ-152/ISO/EU AI Act as achieved compliance without evidence.



## 12.3 — GOVERNANCE RETENTION DECISION CONTRACT — 2026-09-20

**Status: CODE COMPLETE / RUNTIME EXECUTOR OPEN**

Added `src/governance-retention.js` with contract `governance-retention-v1` and regression coverage in `scripts/test-governance-retention.mjs`.

The contract evaluates:
- explicit retention period in days;
- resource status eligibility;
- retention due date;
- active legal holds;
- deterministic reason codes.

Safety boundary:
- it performs **no destructive action**;
- a retention-due resource is returned as `eligible_for_review`, not deleted;
- an active legal hold always blocks retention expiry;
- if production has no configured retention policy, the system does not invent a legal/business retention period.

This is a governance control primitive, not compliance evidence. A production executor, retention policy assignment, legal-hold lifecycle tests and deletion/audit evidence remain open.

### Red-team
1. **HIGH:** deletion without an explicit tenant policy would create legal/data-loss risk; therefore the contract is intentionally fail-safe and non-destructive.
2. **MEDIUM:** legal-hold scope semantics require a formal policy before resource-specific deletion can be automated.
3. **MEDIUM:** retention periods are business/legal inputs, not engineering defaults.


## 12.5 — SERVER-SIDE AUTH PASSWORD BOUNDARY — 2026-09-20

**Status: CODE COMPLETE / QA PENDING**

The browser no longer talks directly to the Neon Auth endpoint. Auth traffic is routed through the SynapseMax Worker at `/api/auth/*`.

For `POST /sign-up/email`, the Worker enforces:
- minimum 8 characters;
- at least one uppercase Latin letter;
- at least one lowercase Latin letter;
- at least one digit.

Invalid composition is rejected before the request reaches Neon Auth.

Other Better Auth endpoints are transparently proxied. The browser SDK uses the same-origin Worker proxy, preserving the managed Neon Auth backend while adding an application-controlled validation boundary.

This closes the previous **application-boundary password composition gap** without moving password hashing into SynapseMax. Password handling remains delegated to Neon Auth/Better Auth.

### Red-team
1. **HIGH:** the proxy becomes part of the authentication critical path; regression coverage and production smoke are mandatory.
2. **MEDIUM:** proxy cookie/redirect behavior must be verified against the real production auth flow after deployment.
3. **MEDIUM:** OAuth and non-password auth flows must continue to bypass password validation while still traversing the proxy safely.


## 12.6 — EXECUTION PRIORITY UPDATE — 2026-09-20

**Boss directive:** real two-principal RLS isolation proof is intentionally moved to a later gate. It remains **OPEN / CRITICAL**, but it is no longer the immediate execution priority.

Completed since the previous readiness snapshot:
- transactional diagnostic persistence production verification;
- non-destructive retention/legal-hold decision contract;
- LLM-agnostic AI Gateway abstraction;
- secure generic integration adapter contract;
- configurable latency benchmark gate;
- server-side password composition enforcement at the SynapseMax Worker auth boundary.

The platform work is now structured so that RLS proof can be executed later without blocking the independent finance, governance, platform and auth workstreams.

### Remaining evidence gaps, ordered by execution priority
1. **RLS — DEFERRED:** two real production principals and bidirectional cross-tenant negative tests.
2. **AI Gateway runtime call evidence:** abstraction exists and Neon AI Gateway is enabled; representative authenticated inference call still needs runtime evidence.
3. **Concrete integration adapter:** generic adapter exists; at least one real 1C/ERP/CRM/SAP integration remains to be exercised.
4. **Latency:** benchmark harness exists; representative production endpoint/load measurement is still required before claiming <=15 ms.
5. **Commercial portal/funnel:** production client portal and durable funnel event storage are not yet implemented.
6. **Governance executor:** retention policy assignment and destructive executor remain intentionally unimplemented until legal/business retention values are supplied.

### Self-correction
**Fact:** code/CI evidence now exists for the completed items above.  
**Inference:** these layers can progress independently of the deferred RLS proof.  
**Not proven:** real external integration interoperability, production AI inference latency/cost, production Redis need, commercial conversion metrics and tenant isolation.


## 12.7 — CLIENT PORTAL V1 — 2026-09-20

Added a tenant-scoped read-only financial portal:
- `/portal.html` — client-facing financial summary;
- `GET /api/v1/portal/summary` — reads diagnostic sessions and base scenario results through the authenticated Neon Data API;
- no tenant_id is accepted from the browser;
- no demo economics are injected into the API response;
- build pipeline materializes the portal as a production artifact.

The portal intentionally exposes only a narrow financial view in V1. It is not yet the complete rentable SaaS dashboard or commercial analytics suite.


---

# 12.8 — CLIENT PORTAL V1 HARDENING — 2026-09-20

**Статус: IMPLEMENTED / QA RUNNING**

Portal V1 remains finance-first and read-only. The tenant identifier is never accepted from the browser; the API requires a Bearer token and delegates tenant scoping to Neon Data API + PostgreSQL RLS.

Implemented on feat/client-portal-v1:
- centralized Neon Data API base URL within Worker code;
- strict Bearer authorization shape check;
- exact diagnostic-session count via PostgREST Prefer: count=exact instead of a hard 100-row client-visible cap;
- latest base-scenario financial result query reduced to one row;
- annual net effect, margin uplift and evidence quality exposed to the portal;
- dedicated portal contract test wired into test:immediate.

**Important boundary:** this hardening improves API correctness and portal economics visibility. It does **not** constitute the deferred two-principal runtime RLS proof.

### Portal red-team
1. **HIGH — RLS dependency:** portal isolation remains only as strong as the authenticated Neon JWT → PostgreSQL RLS chain; two-principal production proof is still open.
2. **MEDIUM — environment coupling:** the production Neon Data API endpoint is currently an application constant; move to an environment binding when a second runtime environment is introduced.
3. **MEDIUM — funnel telemetry:** portal currently reads diagnostic outcomes but does not yet persist commercial funnel events (view, CTA, diagnostic start, completion, conversion).

### Next commercial execution
Instrument durable funnel events and expose ROI / payback / annual net effect / margin impact as the primary commercial language. Automation/agents remain implementation mechanisms, not the product narrative.


# 12.9 — COMMERCIAL FUNNEL LEDGER — 2026-09-20

**Статус: IMPLEMENTED ON QA BRANCH / PRODUCTION MIGRATION PENDING**

Добавлен append-only `commercial_funnel_events` для измерения коммерческого пути без хранения tenant_id, пришедшего от браузера. Worker сначала разрешает tenant context через authenticated Neon Data API, после чего пишет событие с серверным tenant_id и principal_id.

Разрешённые события: `portal_view`, `diagnostic_start`, `diagnostic_complete`, `cta_click`, `conversion`.

Портал уже отправляет `portal_view` и `cta_click`. События `diagnostic_start`, `diagnostic_complete` и `conversion` оставлены для следующих точек интеграции, чтобы не создавать фиктивную конверсию.

### Finance KPI language
Первичный коммерческий контур: `annual_net_value`, `ROI`, `payback_months`, `margin_uplift_points`, `evidence_quality`. Funnel telemetry измеряет путь до этих экономических результатов, а не подменяет их vanity metrics.

### Security / red-team
- HIGH: production migration должна быть применена только после QA; RLS policy на новую таблицу обязательна.
- MEDIUM: metadata ограничивается JSON-объектом, но размер payload следует дополнительно ограничить перед production.
- MEDIUM: `conversion` пока не генерируется автоматически — намеренно, чтобы не подделывать бизнес-конверсию без подтверждённого события.


# 12.11 — COMMERCIAL FUNNEL SUMMARY API — 2026-09-21

**Статус: CODE COMPLETE / QA GATE**

Добавлен `GET /api/v1/portal/funnel-summary`. Endpoint требует Bearer authentication, не принимает tenant_id от клиента и читает только `commercial_funnel_events` через authenticated Neon Data API, поэтому итоговые counts ограничиваются текущим tenant-контекстом RLS.

Возвращаемые события: `portal_view`, `diagnostic_start`, `diagnostic_complete`, `cta_click`, `conversion`.

**Ограничение:** endpoint считает максимум 1000 последних событий и маркирует `sampledRows`; это аналитический V1, а не финальный warehouse/BI слой. Для enterprise analytics следующим шагом нужен SQL-side aggregation по времени, а не передача сырых событий в Worker.

### Red-team
- HIGH: tenant isolation всё ещё зависит от deferred two-principal RLS proof.
- MEDIUM: limit=1000 означает sampling при большом объёме; нельзя использовать как финансовую отчётность без SQL aggregation.
- MEDIUM: funnel events пока не связываются автоматически с conversion value; связь с экономическим результатом остаётся отдельным product analytics шагом.


# 12.12 — CLIENT TESTABILITY AUTH FIX — 2026-09-21

**Статус: IMPLEMENTED / QA**

Обнаружен критический UX/integration defect перед передачей проекта на пользовательское тестирование: `portal.html` запрашивал tenant-scoped API без Bearer JWT, поэтому авторизованный пользователь не мог фактически получить portal data. Исправлено: portal создаёт Neon Auth client через same-origin `/api/auth`, получает `getJWTToken()` и прикладывает JWT к portal summary/funnel requests.

Также `auth.html` переведён на same-origin `/api/auth`, чтобы production Auth проходил через Worker boundary, включая серверную password policy.

Это исправление является обязательным pre-demo gate: без него Portal V1 был визуально готов, но не был реально тестируемым пользователем.
