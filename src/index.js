import { assess, calculateRoi, diagnoseProfitLeakage } from './immediate-logic.js';
import { RELEASE } from './release.generated.js';
import { resolveTenantContext, tenantContextResponse } from './tenant-context.js';
import { persistEvidenceDiagnostic } from './evidence-persistence.js';
import { proxyNeonAuth } from './auth-proxy.js';

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

const NEON_DATA_API_URL = 'https://ep-lively-bread-b1ewktwx.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1';

async function portalSummary(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return json({ ok: false, error: 'Authentication required' }, 401);
  }

  const baseHeaders = {
    Authorization: authorization,
    Accept: 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public',
  };

  const sessionsResponse = await fetch(
    `${NEON_DATA_API_URL}/diagnostic_sessions?select=id&limit=1`,
    { headers: { ...baseHeaders, Prefer: 'count=exact' }, cf: { cacheTtl: 0 } },
  );
  if (!sessionsResponse.ok) return json({ ok: false, error: 'Portal data unavailable' }, sessionsResponse.status);

  const contentRange = sessionsResponse.headers.get('content-range');
  const sessionCount = contentRange?.match(/\/(\d+)$/)?.[1] ? Number(contentRange.match(/\/(\d+)$/)[1]) : null;

  const resultsResponse = await fetch(
    `${NEON_DATA_API_URL}/calculation_results?select=session_id,scenario,net_recoverable_monthly,annual_net_value,roi_percent,payback_months,margin_uplift_points,evidence_quality&scenario=eq.base&order=created_at.desc&limit=1`,
    { headers: baseHeaders, cf: { cacheTtl: 0 } },
  );
  if (!resultsResponse.ok) return json({ ok: false, error: 'Portal results unavailable' }, resultsResponse.status);

  const rows = await resultsResponse.json();
  const latest = rows[0] ?? null;

  return json({
    ok: true,
    result: {
      sessionCount: sessionCount ?? 0,
      baseMonthlyValue: latest?.net_recoverable_monthly ?? 0,
      annualNetValue: latest?.annual_net_value ?? 0,
      latestRoi: latest?.roi_percent ?? null,
      latestPayback: latest?.payback_months ?? null,
      marginUpliftPoints: latest?.margin_uplift_points ?? null,
      evidenceQuality: latest?.evidence_quality ?? null,
    },
  });
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
  const asset = await env.ASSETS.fetch(new Request(new URL('/rls-smoke.html', request.url), { method: 'GET', headers: request.headers, redirect: 'follow' }));
  const body = await asset.text();
  const hydrated = body.replaceAll('__SYNAPSEMAX_RELEASE__', RELEASE_MARKER);
  const headers = new Headers(asset.headers);
  headers.delete('content-length');
  return withSecurityHeaders(new Response(hydrated, { status: asset.status, statusText: asset.statusText, headers }), {
    'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    'pragma': 'no-cache',
    'x-synapsemax-rls-smoke': RELEASE_MARKER,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/v1/portal/summary') return portalSummary(request);
    if (url.pathname === '/api/v1/health') return json({ ok: true, service: 'synapsemax-immediate', version: 'h1', release: RELEASE_MARKER });
    if (url.pathname === '/__synapsemax/version') return json({ ok: true, service: 'synapsemax', release: RELEASE_MARKER, rlsSmoke: RELEASE_MARKER, deployedAt: '2026-09-18' });
    if (url.pathname.startsWith('/api/auth/')) return proxyNeonAuth(request, env.NEON_AUTH_URL);
    if (request.method === 'GET' && url.pathname === '/api/v1/tenant-context') {
      const context = await resolveTenantContext(request);
      return tenantContextResponse(context);
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/financial-diagnostic') {
      const context = await resolveTenantContext(request);
      if (context?.response) return context.response;
      try {
        const input = await request.json();
        if (!Array.isArray(input?.evidence) || input.evidence.length < 1 || input.evidence.length > 100) {
          return json({ ok: false, error: 'evidence must contain 1..100 items' }, 400);
        }
        const persisted = await persistEvidenceDiagnostic({ request, tenantContext: context, input });
        return json({ ok: true, result: persisted }, 201);
      } catch (error) {
        return json({ ok: false, error: error instanceof Error ? error.message : 'Financial diagnostic failed' }, 400);
      }
    }
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
    if (url.pathname === '/portal.html') return withSecurityHeaders(await env.ASSETS.fetch(new Request(new URL('/portal.html', request.url), request)));
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
