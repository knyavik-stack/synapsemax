# SynapseMax — Development Rules

> Рабочий контракт разработки. Этот документ обязателен для всех следующих итераций.

## 1. Source of Truth

- Стратегия и принятые решения: `docs/SYNAPSEMAX_PROJECT_MASTER.md`.
- Текущий статус: `docs/PROJECT_STATUS.md`.
- Архитектура digital experience: `docs/DEX_ARCHITECTURE_V1.md`.
- Карта компонентов: `docs/DEX_COMPONENT_MAP_V1.md`.
- Код: GitHub repository `knyavik-stack/synapsemax`.
- Production domain: `https://synapsemax.ru/`.
- Public contact email: `hello@synapsemax.ru`.

## 2. Код должен быть понятным

Каждый новый нетривиальный блок кода должен иметь короткий комментарий, объясняющий **зачем** он существует и какое ограничение соблюдает. Не комментируем очевидный синтаксис.

Пример:

```js
// Keep orbital animation independent from the S-mark: the approved brand geometry must never be deformed.
requestAnimationFrame(updateOrbit);
```

Плохой пример:

```js
// Set x to 10.
x = 10;
```

## 3. Documentation-first для архитектурных изменений

Если изменение вводит новый паттерн, компонент, primitive, animation model или инфраструктурное правило, одновременно обновляем соответствующий документ.

## 4. Canonical domain policy

Любые `.ai`, `.com` и другие домены SynapseMax в production считаются ошибкой, если они не утверждены отдельно. Проверять нужно:

- canonical URL;
- `og:url`;
- `og:image`;
- Twitter metadata;
- favicon/assets;
- CTA links;
- `mailto:` links;
- footer/header;
- structured data, если появится;
- sitemap/robots, если появятся.

## 5. Quality Gate

Работа считается завершённой только после проверки:

1. source diff;
2. отсутствие очевидных broken references;
3. runtime/console errors, если среда проверки доступна;
4. responsive behaviour;
5. accessibility basics;
6. production/preview deployment, если доступен;
7. визуальная регрессия для принятых элементов.

Если фактический deployment невозможно проверить, статус должен быть явно помечен `NOT VERIFIED`, а не `DONE`.

## 6. Production safety

Не переписывать `main` напрямую для рискованных изменений. Предпочтительный путь:

`feature branch → preview → review → merge → production`.

Принятые элементы бренда нельзя менять в рамках технического рефакторинга без отдельного продуктового решения.

## 7. Marketing integrity

Не использовать вымышленные клиентские результаты как подтверждённые факты. До появления подтверждённых кейсов метрики должны быть явно обозначены как `SIMULATION`, `ILLUSTRATIVE SCENARIO` или эквивалент.

## 8. Cloudflare deployment invariant

Cloudflare Workers Builds выполняет отдельный build command перед deploy command, но Wrangler также поддерживает собственный `[build]` command. Для SynapseMax `wrangler.jsonc` должен содержать build command, который создаёт `./public` перед `versions upload`. Это защищает deployment от ситуации, когда внешний Cloudflare build hook не был применён к trigger.

Preview deploy должен использовать `npx wrangler versions upload`; production deploy — `npx wrangler deploy`. В обоих случаях источник статических assets — `./public`.

## 9. Definition of Done

Этап можно закрыть только когда:

- код понятен следующему инженеру;
- документация синхронизирована;
- принятое UX/brand поведение сохранено или изменение явно одобрено;
- новые primitives используются там, где они действительно нужны;
- legacy-слой не накапливается без причины;
- deployment подтверждён фактическим успешным build/deploy, а не только наличием конфигурации;
- результат проверен настолько, насколько позволяют доступные инструменты.
