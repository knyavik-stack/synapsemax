# SynapseMax — Governance & Evidence Data Contract

**Дата:** 14 сентября 2026
**Версия:** 1.0
**Статус:** архитектурный контракт для следующего enterprise-слоя
**Нормативный источник:** `docs/synapsemax-master-operational-spec.md` v2.0

## 1. Назначение

Этот документ фиксирует минимальный контракт данных до внедрения PostgreSQL/RLS, Redis, очередей и других инфраструктурных компонентов.

Цель — сделать финансовую диагностику **evidence-backed**: каждое существенное денежное утверждение должно иметь происхождение данных, снимок входных параметров, версию расчётного контракта и проверяемый audit trail.

Контракт не объявляет compliance. Требования ФЗ-152, ISO 27001, EU AI Act и иных режимов остаются design requirements до появления отдельного технического и организационного evidence.

## 2. Основные сущности

### 2.1 Tenant

`tenant` — изолированный клиентский контур.

Обязательные поля:
- `tenant_id` — непрозрачный стабильный идентификатор;
- `status` — lifecycle state;
- `created_at`;
- `retention_policy_id`.

Правила:
- любой клиентский объект принадлежит ровно одному `tenant_id`;
- `tenant_id` не принимается как доверенное значение из UI без серверной проверки identity/context;
- cross-tenant reads/writes запрещены по умолчанию;
- системные/операторские действия должны иметь отдельный audit actor и reason.

### 2.2 Diagnostic Session

`diagnostic_session` — неизменяемый контекст одного диагностического цикла.

Обязательные поля:
- `session_id`;
- `tenant_id`;
- `status`;
- `created_at`;
- `created_by`;
- `calculation_contract_version`;
- `input_snapshot_id`;
- `evidence_set_id`.

Правило: повторный расчёт создаёт новую версию результата, а не переписывает исторический financial result.

### 2.3 Evidence Item

`evidence_item` — конкретное подтверждение исходного бизнес-факта.

Обязательные поля:
- `evidence_id`;
- `tenant_id`;
- `source_type` — например `manual`, `csv`, `erp`, `crm`, `api`, `document`;
- `source_ref` — безопасная ссылка на источник без помещения секретов в business payload;
- `observed_at`;
- `collected_at`;
- `metric`;
- `value`;
- `unit`;
- `quality` — `low | medium | high`;
- `provenance_hash`;
- `metadata` — структурированные дополнительные сведения.

Правила:
- evidence не должна содержать секреты, токены или пароли;
- provenance должен позволять определить источник и момент наблюдения;
- исправление исходного факта создаёт новую evidence revision, а не уничтожает старую запись;
- удаление по retention policy должно быть audit-visible.

### 2.4 Diagnostic Input Snapshot

`diagnostic_input_snapshot` — точная копия нормализованных входов, использованных расчётным ядром.

Обязательные поля:
- `snapshot_id`;
- `tenant_id`;
- `session_id`;
- `schema_version`;
- `payload_hash`;
- `normalized_payload`;
- `created_at`.

Правило: результат должен быть воспроизводим из snapshot + calculation contract version + scenario configuration.

### 2.5 Calculation Result

`calculation_result` — финансовый результат, опубликованный диагностическим ядром.

Минимальный контракт:
- `result_id`;
- `tenant_id`;
- `session_id`;
- `calculation_contract_version`;
- `scenario` — `conservative | base | optimistic`;
- `gross_recoverable_monthly`;
- `overlap_adjustment_monthly`;
- `net_recoverable_monthly`;
- `annual_net_value`;
- `upfront_investment`;
- `annual_opex`;
- `roi_percent`;
- `payback_months`;
- `margin_uplift_points`;
- `evidence_quality`;
- `assumptions`;
- `created_at`.

Правило: financial result является immutable snapshot. Коррекция расчёта создаёт новый result с новой версией.

## 3. Evidence → Calculation lineage

Минимальная цепочка происхождения:

`source → evidence_item → input_snapshot → calculation_result → scenario → action_plan`

Для каждого material KPI должно быть возможно ответить:
1. откуда пришло исходное значение;
2. когда оно наблюдалось;
3. кто/какой connector его предоставил;
4. какая версия схемы и расчётного контракта использована;
5. какие overlap/сценарные допущения применены;
6. какой итоговый финансовый показатель получен.

Если lineage отсутствует, показатель не должен маркироваться как high-confidence evidence-backed result.

## 4. Confidence model

На текущем этапе `evidenceQuality` остаётся сигналом качества, а не скрытым множителем ROI.

Следующая версия confidence model должна быть составной и объяснимой:
- source reliability;
- freshness;
- completeness;
- corroboration;
- manual-vs-system provenance;
- consistency checks.

Никаких непрозрачных коэффициентов, автоматически уменьшающих/увеличивающих ROI, до утверждения модели калибровки.

## 5. Audit Event

`audit_event` — неизменяемая запись значимого действия.

Минимальные поля:
- `event_id`;
- `tenant_id`;
- `actor_type` — `user | service | connector | system`;
- `actor_id`;
- `action`;
- `resource_type`;
- `resource_id`;
- `timestamp`;
- `request_id`;
- `result` — `success | denied | failed`;
- `reason_code`;
- `metadata`.

Аудитировать минимум:
- authentication/authorization decisions;
- чтение/изменение чувствительных данных;
- импорт evidence;
- создание/пересчёт financial result;
- изменение retention policy;
- экспорт данных;
- административные действия;
- connector/integration failures.

## 6. Identity и access boundary

До появления полноценного IAM действует принцип:

`request → authenticated principal → tenant context → authorization policy → business operation`

Запрещено строить authorization только на `tenant_id`, переданном клиентом.

Роли следующего слоя должны разделять как минимум:
- tenant user;
- tenant admin;
- SynapseMax operator;
- service/connector;
- auditor/read-only.

Доступ к raw evidence должен быть уже, чем доступ к агрегированным KPI.

## 7. Retention / deletion

Для каждого tenant должен существовать явный retention policy.

Минимальные правила:
- retention определяется типом данных и договорными/регуляторными требованиями;
- удаление должно быть scoped по tenant;
- deletion job создаёт audit event;
- backups/replicas должны иметь отдельную retention semantics;
- legal hold должен блокировать автоматическое удаление соответствующих данных;
- hard delete не должен незаметно разрушать финансовый audit trail, если хранение требуется политикой.

Конкретные сроки хранения не утверждаются этим документом без юридического и договорного основания.

## 8. Data minimization и masking

По умолчанию хранится минимальный набор данных, необходимый для диагностики.

Правила:
- PII/персональные данные не попадают в финансовый result без необходимости;
- raw source payload отделён от normalized diagnostic data;
- секреты и credentials никогда не сохраняются в evidence payload;
- логирование не должно раскрывать raw customer payload;
- экспорт должен проходить через policy check.

## 9. API contract

Experience Layer не должен напрямую знать детали хранения.

Минимальные операции:
- `POST /api/v1/diagnostic-sessions`;
- `POST /api/v1/evidence`;
- `POST /api/v1/diagnostic-sessions/{id}/calculate`;
- `GET /api/v1/diagnostic-sessions/{id}`;
- `GET /api/v1/diagnostic-sessions/{id}/results`;
- `GET /api/v1/diagnostic-sessions/{id}/lineage`.

Каждый mutating request должен поддерживать `request_id`/idempotency semantics.

API не должен позволять клиенту подменять `tenant_id`, calculation contract version или audit actor.

## 10. Persistence decision gate

**PostgreSQL/RLS пока не внедряется только ради соответствия диаграмме.**

Внедрение persistence допускается после подтверждения:
1. identity/tenant boundary;
2. entity lifecycle;
3. evidence lineage;
4. immutable financial snapshots;
5. audit events;
6. retention semantics;
7. API contract.

После этого минимальная PostgreSQL-модель должна быть проверена на RLS isolation tests.

Redis вводится только при наличии измеренного latency/load use case. Цель `≤15 ms` из Master Spec считается target, а не достигнутым SLA.

## 11. Security red-team

### Critical
**Tenant escape:** если authorization строится на клиентском `tenant_id`, один ошибочный запрос способен раскрыть данные другого клиента. Это veto-level defect для multi-tenant production.

### High
**Mutable financial history:** если пересчёт переписывает старый result, невозможно доказать, почему предыдущий ROI отличался от текущего. Нужны immutable snapshots + lineage.

### High
**Evidence without provenance:** цифра без источника превращает financial diagnostic в opinionated calculator. Такие результаты нельзя выдавать за evidence-backed.

### Medium
**Over-collection:** хранение raw customer payload увеличивает breach impact и compliance scope без прямой бизнес-ценности.

### Medium
**Retention drift:** отсутствие tenant-scoped deletion/retention semantics создаёт долгосрочный data liability.

## 12. Acceptance criteria следующего implementation pass

Implementation может считаться PASS только если:
- [ ] tenant context формируется сервером из authenticated principal;
- [ ] cross-tenant access имеет отрицательные integration tests;
- [ ] evidence имеет provenance + freshness + quality;
- [ ] financial results immutable;
- [ ] calculation inputs/version сохраняются;
- [ ] lineage endpoint возвращает source → result chain;
- [ ] audit events immutable и tenant-scoped;
- [ ] retention/deletion policy проверяется тестами;
- [ ] raw payload не попадает в обычные application logs;
- [ ] idempotency предотвращает duplicate financial calculations;
- [ ] production smoke проверяет authorization boundary.

## 13. Что сознательно НЕ реализовано этим документом

- PostgreSQL deployment;
- RLS policy SQL;
- Redis deployment;
- AI Gateway;
- Process Mining;
- integration adapters;
- legal compliance certification;
- statistical calibration of confidence/scenario factors.

Это intentional sequencing: сначала контракт и threat model, затем минимальная инфраструктура.
