# SynapseMax — Minimal Persistence & RLS Architecture

**Дата:** 14 сентября 2026  
**Версия:** 1.0  
**Статус:** implementation contract; infrastructure not yet deployed

## 1. Решение

Persistence layer проектируется как минимальный PostgreSQL-контур, строго производный от `GOVERNANCE_DATA_CONTRACT_2026-09-14.md`.

В scope входят только сущности, необходимые для evidence-backed financial diagnostics:

- tenant;
- tenant membership / principal binding;
- retention policy и legal hold;
- diagnostic session;
- evidence item + revision lineage;
- input snapshot;
- calculation result;
- result lineage;
- audit event;
- idempotency key.

Redis, AI Gateway, Process Mining, integration adapters и отдельные очереди в этот pass не входят.

## 2. Identity boundary

Клиентский `tenant_id` никогда не считается источником authorization.

Цепочка:

`authenticated principal → server-side tenant context → database transaction context → RLS → business operation`

Database RLS получает tenant context из transaction-local server context. Приложение обязано устанавливать context после проверки authenticated principal и membership. Никакие browser/UI поля не должны напрямую управлять RLS context.

### Supabase-specific constraint

Если persistence будет размещаться в Supabase, `service_role`/secret key bypasses RLS и поэтому не является tenant-isolation механизмом. Он допустим только в явно серверных административных операциях, где authorization выполняется до запроса. Обычные tenant операции должны идти через RLS-enforced role/path. Это согласуется с актуальной моделью Supabase: grants и RLS являются разными уровнями контроля, а `service_role` имеет `BYPASSRLS`.

## 3. Schema principles

### 3.1 Tenant

`tenants` хранит lifecycle и ссылку на retention policy.

Все клиентские записи содержат `tenant_id` и имеют FK на tenant.

### 3.2 Membership

`tenant_memberships` связывает opaque `principal_id` с tenant и ролью:

- `tenant_user`;
- `tenant_admin`;
- `operator`;
- `service`;
- `auditor`.

Membership является server-side authorization input, а не пользовательским полем бизнес-запроса.

### 3.3 Evidence

`evidence_items` хранит нормализованный бизнес-факт без секретов. Исправление факта — новая revision через `supersedes_evidence_id`; историческая запись не перезаписывается.

`value` хранится как JSONB, чтобы не навязывать единственный numeric/text тип до появления доменных connector contracts. Для material KPI unit обязателен.

### 3.4 Input snapshot

`diagnostic_input_snapshots` — immutable normalized payload + hash + schema version.

### 3.5 Calculation result

`calculation_results` — append-only financial snapshots. UPDATE/DELETE запрещены триггером на уровне БД. Новый расчёт создаёт новый `result_id`.

### 3.6 Lineage

`calculation_result_lineage` связывает result с input snapshot и evidence items. Один result может ссылаться на несколько evidence items.

### 3.7 Audit

`audit_events` — append-only. UPDATE/DELETE запрещены триггером.

### 3.8 Idempotency

`idempotency_keys` scoped by tenant + operation + request_id. Повторная mutation с тем же request_id должна возвращать/переиспользовать исходный результат вместо создания duplicate financial result.

## 4. RLS model

RLS включается на всех business tables.

Policy predicate использует transaction-local setting:

`current_setting('app.tenant_id', true)`

Значение должно устанавливаться только сервером после authentication + membership check. Оно не является API input.

Для tenant-scoped rows базовый predicate:

`tenant_id = current_setting('app.tenant_id', true)::uuid`

Для membership policy дополнительно проверяется `principal_id` через server-side identity context.

### Important implementation rule

Не использовать RLS как единственный источник identity. Сначала application layer authenticates the principal and resolves membership; затем DB RLS выполняет defense-in-depth.

## 5. Grants

RLS policy сама по себе не заменяет SQL privileges.

До production exposure нужно явно выдать только необходимые grants и проверить отсутствие нежелательных grants для `anon`, `authenticated` и любых custom roles.

Raw evidence должен иметь более узкий access path, чем агрегированные KPI.

## 6. Immutability

Следующие таблицы append-only:

- `evidence_items` — revision вместо destructive update;
- `diagnostic_input_snapshots`;
- `calculation_results`;
- `calculation_result_lineage`;
- `audit_events`.

Retention deletion — отдельная контролируемая операция, которая создаёт audit event и не маскируется под обычный UPDATE/DELETE.

## 7. Retention / legal hold

`retention_policies` задаёт policy metadata, но не утверждает юридические сроки автоматически.

`tenant_legal_holds` блокирует автоматическое удаление scope, на который действует hold.

Конкретные сроки должны появиться только из договорного/юридического основания.

## 8. API boundary

Следующий application pass должен реализовать только contract-level operations:

- `POST /api/v1/diagnostic-sessions`;
- `POST /api/v1/evidence`;
- `POST /api/v1/diagnostic-sessions/{id}/calculate`;
- `GET /api/v1/diagnostic-sessions/{id}`;
- `GET /api/v1/diagnostic-sessions/{id}/results`;
- `GET /api/v1/diagnostic-sessions/{id}/lineage`.

Каждая mutation обязана иметь `request_id` / idempotency semantics.

## 9. Security acceptance gates

### CRITICAL — tenant escape

Тест должен доказать, что principal A с tenant A не может читать/изменять строки tenant B даже при наличии известного `tenant_id` B в URL/body.

### HIGH — historical result mutation

Попытка UPDATE/DELETE calculation result должна быть отвергнута DB-level control.

### HIGH — evidence provenance spoofing

Evidence без `source_type`, `source_ref`, observed/collected timestamps, quality или provenance hash не должна приниматься.

### HIGH — duplicate calculation

Повторный request с тем же tenant + operation + request_id не должен создавать второй financial result.

### MEDIUM — over-collection

Raw customer payload не хранится в business result и не попадает в обычные application logs.

## 10. Performance gate

На этом этапе не вводится Redis.

Сначала измеряем:

- p50/p95/p99 latency diagnostic-session read;
- calculation request latency;
- RLS policy overhead;
- concurrent tenant workload;
- result/lineage query cardinality.

Только если измерения показывают реальную проблему, принимается решение о cache/read model. Target `≤15 ms` для KPI остаётся target, а не SLA.

## 11. Deployment gate

Этот документ и SQL migration — подготовка, а не доказательство production isolation.

Production PASS возможен только после:

1. применения migration в выделенном SynapseMax Postgres/Supabase project;
2. явных grants + RLS policies;
3. pgTAP/integration negative tests для cross-tenant access;
4. immutability tests;
5. idempotency tests;
6. advisor/security review;
7. production smoke через реальный authorization boundary.

Текущий найденный Supabase project `knyavik-stack's Project` содержит unrelated game schema (`players`, `games`, `game_sessions`, `player_game_stats`). Он **не используется** для SynapseMax persistence до явного подтверждения отдельного project boundary.

## 12. Red-team conclusion

Три наиболее опасные точки:

1. **Tenant context spoofing** — veto-level, если DB context можно выставить клиентским значением.
2. **Service-role bypass** — RLS нельзя считать защитой, если application path использует elevated key без собственного authorization.
3. **Historical mutation** — переписываемые ROI/results разрушают доказуемость финансовой диагностики.

Инфраструктура не считается готовой, пока эти три сценария не имеют автоматических negative tests.
