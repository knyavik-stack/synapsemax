/**
 * SynapseMax Experience + Immediate API edge.
 * Business logic remains outside the browser so the Experience Layer can
 * later connect to the Intelligence Layer without a UI rewrite.
 */

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function assessment(body) {
  const systems = Math.max(1, Number(body.systems) || 1);
  const manual = Math.min(90, Math.max(5, Number(body.manualPct) || 5));
  const errors = Math.min(50, Math.max(1, Number(body.errorPct) || 1));
  const processRisk = Math.min(100, Math.round(manual * 1.05));
  const itRisk = Math.min(100, systems * 5);
  const automationPotential = Math.min(95, Math.round(manual * 0.7 + errors * 0.8));
  const complexityScore = Math.min(100, Math.round(manual * 0.55 + errors * 0.7 + systems * 1.7));
  const priority = automationPotential >= 65 ? 'высокий' : automationPotential >= 40 ? 'средний' : 'точечный';
  return {
    complexityScore,
    processRisk,
    itRisk,
    automationPotential,
    priority,
    summary: `Первичный профиль показывает ${priority} потенциал для автоматизации. Наиболее вероятный источник эффекта — процессы с высокой долей ручного труда и повторяющимися ошибками.`,
    recommendation: 'Следующий шаг: подтвердить гипотезу на фактических данных и построить As-Is / To-Be модель. Это не заменяет полноценный аудит.'
  };
}

function roi(body) {
  const people = Math.max(1, Number(body.people) || 1);
  const hours = Math.max(1, Number(body.hours) || 1);
  const cost = Math.max(0, Number(body.cost) || 0);
  const saving = Math.min(80, Math.max(5, Number(body.saving) || 5));
  const annualGrossSaving = people * hours * cost * 52 * (saving / 100);
  return { annualGrossSaving, assumptions: { people, hours, cost, saving }, note: 'Гипотеза до учёта стоимости внедрения, лицензий и AI inference.' };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/v1/health') return json({ status: 'ok', service: 'synapsemax-immediate' });

    if (url.pathname === '/api/v1/assessment') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      try { return json(assessment(await request.json())); }
      catch { return json({ error: 'invalid_json' }, 400); }
    }

    if (url.pathname === '/api/v1/roi') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      try { return json(roi(await request.json())); }
      catch { return json({ error: 'invalid_json' }, 400); }
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const current = new URL('/dex-immediate.html', request.url);
      return env.ASSETS.fetch(new Request(current, request));
    }
    return env.ASSETS.fetch(request);
  },
};
