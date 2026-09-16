# SynapseMax — Persistence Provider Decision

**Дата:** 16 сентября 2026  
**Решение:** Neon PostgreSQL — целевой persistence provider для текущего этапа SynapseMax.

## 1. Почему принято решение

SynapseMax уже имеет PostgreSQL-oriented persistence contract: tenants, memberships, diagnostic sessions, evidence, immutable calculation results, lineage, audit events, idempotency и RLS. Для текущего продукта нам не требуется привязывать persistence к Supabase-specific Auth/Data API/Storage; поэтому обычный PostgreSQL-провайдер уменьшает coupling и оставляет application authorization под контролем SynapseMax.

Neon выбран как отдельный database boundary. Существующие подключенные Supabase-проекты не используются для SynapseMax.

## 2. Security boundary

Цепочка должна быть:

`authenticated principal → server-side tenant resolution → transaction-local tenant context → least-privilege PostgreSQL role → RLS`

Клиентский `tenant_id` не является источником авторизации.

`FORCE ROW LEVEL SECURITY` включается на runtime-таблицах, чтобы владелец таблицы не получил неявный обход RLS на runtime path. Production runtime role не должна иметь `BYPASSRLS`.

Tenant-scoped financial history является append-only. Исправление evidence выполняется новой revision-записью, а не изменением исторической строки.

## 3. Secret handling

`NEON_DATABASE_URL` хранится только в GitHub Actions Secrets и не должен попадать в repository, `.env`, документацию, issue/PR comments или чат.

Runtime Cloudflare Worker secret будет заведён отдельно, когда application persistence path будет готов к подключению.

## 4. Migration strategy

Исторические файлы в `supabase/migrations/` сохраняются как запись предыдущего архитектурного этапа. Новый provider-neutral baseline находится в `database/migrations/`.

Migration workflow не запускается автоматически на push. Production database mutation выполняется только вручную через GitHub Actions с явным подтверждением.

## 5. Что пока НЕ считается закрытым

- реальная миграция в Neon;
- production least-privilege role/grants;
- authenticated principal → membership resolution;
- API transaction boundary с `SET LOCAL app.tenant_id`;
- cross-tenant integration tests против реальной базы;
- retention executor;
- измеренный latency/load benchmark;
- подключение Worker к persistence.

До закрытия этих пунктов нельзя заявлять production multi-tenant persistence или compliance certification.

## 6. Red Team

1. **CRITICAL — tenant escape:** если tenant context может быть задан клиентом, RLS превращается в ложную границу безопасности.
2. **HIGH — privileged bypass:** owner/BYPASSRLS/service credentials могут обойти RLS; привилегированный путь должен быть server-only и проходить authorization до обращения к данным.
3. **HIGH — migration drift:** ручные SQL-изменения вне репозитория разрушают воспроизводимость. Все изменения схемы должны идти через versioned migrations.

## 7. Финансовый смысл

Persistence не создаёт самостоятельного ROI. Его функция — сделать финансовый диагностический результат воспроизводимым, доказуемым и пригодным для масштабирования: входные данные, evidence, расчёт, ROI и история изменений должны иметь проверяемую lineage.
