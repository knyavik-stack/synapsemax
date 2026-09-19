import { assess, calculateRoi, diagnoseProfitLeakage } from './immediate-logic.js';
import { RELEASE } from './release.generated.js';

const RELEASE_MARKER = RELEASE;

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'x-frame-options': 'DENY',
};

function withSecurityHeaders(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return withSecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  }));
}

async function immediateAsset(env, request) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/dex-immediate', request.url), request));
  const headers = new Headers(asset.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-synapsemax-experience', 'immediate');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
}

async function diagnosticAsset(env, request) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/rls-smoke.html', request.url), request));
  const body = await asset.text();
  const hydrated = body.replaceAll('__SYNAPSEMAX_RELEASE__', RELEASE_MARKER);
  return withSecurityHeaders(new Response(hydrated, { status: asset.status, statusText: asset.statusText, headers: asset.headers }), {
    'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    'pragma': 'no-cache',
    'x-synapsemax-rls-smoke': RELEASE_MARKER,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/v1/health') return json({ ok: true, service: 'synapsemax-immediate', version: 'h1', release: RELEASE_MARKER });
    if (url.pathname === '/__synapsemax/version') return json({ ok: true, service: 'synapsemax', release: RELEASE_MARKER, rlsSmoke: RELEASE_MARKER, deployedAt: '2026-09-18' });
    if (request.method === 'POST' && url.pathname === '/api/v1/assessment') {
      try { return json({ ok: true, result: assess(await request.json()) }); }
      catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/roi') {
      try { return json({ ok: true, result: calculateRoi(await request.json()) }); }
      catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/profit-leakage') {
      try { return json({ ok: true, result: diagnoseProfitLeakage(await request.json()) }); }
      catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }
    }
    if (url.pathname === '/') return immediateAsset(env, request);
    if (url.pathname === '/index.html') return immediateAsset(env, request);
    if (url.pathname === '/rls-smoke.html') return diagnosticAsset(env, request);
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
