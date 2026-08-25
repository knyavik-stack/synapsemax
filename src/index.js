/**
 * SynapseMax Experience + H1 API edge.
 * Domain calculations live in src/immediate-logic.js so the future
 * Intelligence Layer can replace them without rewriting the Experience Layer.
 */
import { assess, calculateRoi } from './immediate-logic.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/health') return json({ ok: true, service: 'synapsemax-immediate', version: 'h1' });
    if (request.method === 'POST' && url.pathname === '/api/v1/assessment') {
      try { return json({ ok: true, result: assess(await request.json()) }); }
      catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/roi') {
      try { return json({ ok: true, result: calculateRoi(await request.json()) }); }
      catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return env.ASSETS.fetch(new Request(new URL('/dex-immediate.html', request.url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
