import { assess, calculateRoi } from './immediate-logic.js';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return withSecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  }));
}

const EXPERIENCE_SCRIPT = `(() => {
  const boot = () => {
    const form = document.querySelector('.form');
    const report = document.querySelector('#assessment-report');
    const button = form?.querySelector('button');
    if (!form || !report || !button) return;
    const fields = ['complexity','manualWork','dataFragmentation','errorRate'];
    const getInput = () => Object.fromEntries(fields.map(id => [id, Number(document.getElementById(id)?.value ?? 0)]));
    const show = (node) => { report.classList.add('show'); report.setAttribute('aria-live','polite'); report.replaceChildren(node); };
    const run = async (event) => {
      event?.preventDefault();
      const input = getInput();
      if (fields.some(id => !Number.isFinite(input[id]) || input[id] < 0 || input[id] > 100)) {
        const p = document.createElement('p'); p.textContent = 'Введите значения от 0 до 100 для всех показателей.'; show(p); return;
      }
      const original = button.textContent; button.disabled = true; button.textContent = 'Расчёт…';
      try {
        const response = await fetch('/api/v1/assessment', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(input) });
        if (!response.ok) throw new Error('assessment_failed');
        const payload = await response.json();
        if (!payload.ok || !payload.result) throw new Error('invalid_result');
        const r = payload.result;
        const fragment = document.createDocumentFragment();
        const title = document.createElement('h3'); title.textContent = 'Результат диагностики'; fragment.append(title);
        const grid = document.createElement('div'); grid.className = 'report-grid';
        [['score',r.score,'Индекс сложности'],['automation',r.automationPotential,'Потенциал автоматизации'],['ai',r.aiReadiness,'Готовность к ИИ'],['priority',r.priority,'Приоритет']].forEach(([key,value,label]) => {
          const card=document.createElement('div'); card.className='metric'; card.dataset.metric=key;
          const b=document.createElement('b'); b.textContent=typeof value==='number'?String(Math.round(value)):value;
          const s=document.createElement('span'); s.textContent=label; card.append(b,s); grid.append(card);
        });
        fragment.append(grid);
        const p=document.createElement('p'); p.textContent=r.priority==='Высокий'?'Есть заметный потенциал снижения операционной нагрузки. Следующий шаг — разобрать процессы и уточнить экономический эффект.':r.priority==='Средний'?'Есть измеримый потенциал улучшения. Следующий шаг — определить процессы с наибольшей стоимостью ручной работы и ошибок.':'Потенциал трансформации пока умеренный. Следующий шаг — уточнить структуру процессов и точки потерь.'; fragment.append(p);
        const actions=document.createElement('div'); actions.className='actions'; const cta=document.createElement('a'); cta.className='btn primary'; cta.href='#contact'; cta.textContent='Обсудить результат'; actions.append(cta); fragment.append(actions);
        show(fragment);
        report.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
      } catch {
        const wrap=document.createElement('div'); const h=document.createElement('h3'); h.textContent='Диагностика временно недоступна'; const p=document.createElement('p'); p.textContent='Не удалось получить расчёт. Повторите попытку.'; const retry=document.createElement('button'); retry.className='btn'; retry.type='button'; retry.textContent='Повторить расчёт'; retry.addEventListener('click',()=>button.click()); wrap.append(h,p,retry); show(wrap);
      } finally { button.disabled=false; button.textContent=original; }
    };
    button.addEventListener('click',run); form.addEventListener('submit',run);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();`;

async function immediateAsset(env, request) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/dex-immediate', request.url), request));
  const headers = new Headers(asset.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-synapsemax-experience', 'immediate');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  const response = new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  return new HTMLRewriter().on('body', { element(element) { element.append(`<script>${EXPERIENCE_SCRIPT}</script>`, { html: true }); } }).transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/health') return json({ ok:true, service:'synapsemax-immediate', version:'h1' });
    if (request.method === 'POST' && url.pathname === '/api/v1/assessment') {
      try { return json({ ok:true, result:assess(await request.json()) }); } catch { return json({ ok:false, error:'Invalid JSON' },400); }
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/roi') {
      try { return json({ ok:true, result:calculateRoi(await request.json()) }); } catch { return json({ ok:false, error:'Invalid JSON' },400); }
    }
    if (url.pathname === '/' || url.pathname === '/index.html') return immediateAsset(env, request);
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
