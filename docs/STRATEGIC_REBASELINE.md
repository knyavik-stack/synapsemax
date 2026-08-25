# SynapseMax — Strategic Rebaseline

**Статус:** рабочий архитектурный baseline для Immediate
**Дата:** 25 августа 2026

## 1. Решение

SynapseMax не развивается как generic AI landing page. Immediate должен быть первым Experience Layer будущей Transformation Intelligence Platform.

Master Strategic Book определяет бизнес-модель: `diagnose → design → simulate → automate → monitor`.
Technical Specification v1 определяет Immediate-контракт: 13 функциональных разделов, три user journeys, Complexity → Understanding → System → Automation → Outcome.
Database Architecture Specification определяет целевую модель данных этапа Then: accounts, complexity_graphs, As-Is/To-Be, JSONB process graphs, ROI и LLM-agnostic orchestration.

## 2. Что сохраняем

- утверждённый S-знак и canonical wordmark assets;
- HUD/FUI как функциональный язык;
- тёмную технологическую среду и контролируемый neon accent;
- высокую информационную плотность;
- DEX v1/v2/v3 как исторические visual baselines;
- Cloudflare Workers как Experience/API edge;
- LLM-agnostic принцип;
- русскую информационную иерархию.

## 3. Что меняем

Главный объект интерфейса перестаёт быть «страницей о компании». Им становится путь трансформации клиента:

`Complexity → Understanding → System → Automation → Outcome`.

Первый продуктовый нерв Immediate — **Transformation Assessment**. Он не должен быть декоративной формой: результатом становится Complexity Profile с гипотезами узких мест, приоритетами автоматизации и ROI-гипотезой.

## 4. Product model

Каноническая цепочка:

1. Company context
2. Assessment
3. Complexity Profile
4. As-Is hypothesis
5. To-Be hypothesis
6. Automation candidates
7. Impact / ROI hypothesis
8. AI Consultant context
9. CTA / discovery

В H2 эта модель эволюционирует в persistent Business Process Graph и customer workspace. Immediate не имитирует полноценный Process Mining backend, но интерфейс и API не должны ему противоречить.

## 5. Архитектурное правило

Experience Layer не содержит секретов, LLM keys или бизнес-расчётов. Клиент вызывает защищённые Worker API endpoints. Сейчас API реализует детерминированную Immediate-логику; будущий Intelligence Layer заменяет внутренний алгоритм без переписывания Experience Layer.

## 6. Что запрещено

- добавлять декоративные эффекты вместо продуктовой функции;
- делать AI chatbot без контекста клиента;
- обещать фактический ROI без исходных данных;
- привязывать Experience к конкретному LLM provider;
- строить H2 PostgreSQL/Process Mining до прохождения Immediate gate;
- возвращаться к упрощённой DEX v2 модели.

## 7. Gate для следующего этапа

Immediate считается готовым к следующей фазе только после:

- build PASS;
- API smoke tests PASS;
- desktop/mobile visual QA;
- assessment flow PASS;
- ROI calculation PASS;
- canonical logo/wordmark check PASS;
- no horizontal overflow;
- reduced-motion check;
- documentation update.

Только после этого разрешается переходить к scroll-linked transformation и более глубокой интерактивности.