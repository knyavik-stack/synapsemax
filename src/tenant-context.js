const DATA_API_URL = 'https://ep-lively-bread-b1ewktwx.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1';

function unauthorized(message = 'Authentication required') {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function forbidden(message = 'Tenant context could not be resolved') {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function readJson(response) {
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, body: text.slice(0, 1000) };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 502, body: 'Data API returned non-JSON response' };
  }
}

export async function resolveTenantContext(request) {
  const authorization = request.headers.get('authorization');
  if (!authorization || !/^Bearer\\s+\\S+$/i.test(authorization)) return { response: unauthorized() };

  const headers = {
    Authorization: authorization,
    Accept: 'application/json',
    'Accept-Profile': 'public',
  };

  const [tenantsResponse, membershipsResponse] = await Promise.all([
    fetch(DATA_API_URL + '/tenants?select=id,status&limit=2', { method: 'GET', headers, cf: { cacheTtl: 0 } }),
    fetch(DATA_API_URL + '/tenant_memberships?select=tenant_id,status&status=eq.active&limit=2', { method: 'GET', headers, cf: { cacheTtl: 0 } }),
  ]);

  if (tenantsResponse.status === 401 || membershipsResponse.status === 401) return { response: unauthorized('Invalid or expired authentication token') };
  if (!tenantsResponse.ok || !membershipsResponse.ok) {
    return { response: forbidden('Tenant authorization backend rejected the request') };
  }

  const [tenants, memberships] = await Promise.all([readJson(tenantsResponse), readJson(membershipsResponse)]);
  if (!tenants.ok || !memberships.ok) return { response: forbidden('Tenant authorization backend returned invalid data') };

  const tenantRows = Array.isArray(tenants.data) ? tenants.data : [];
  const membershipRows = Array.isArray(memberships.data) ? memberships.data : [];
  const tenantIds = [...new Set(tenantRows.map((row) => row?.id).filter(Boolean))];
  const membershipTenantIds = [...new Set(membershipRows.map((row) => row?.tenant_id).filter(Boolean))];

  // Fail closed. Exactly one visible tenant and exactly one active membership
  // must resolve to the same tenant. The JWT itself is never treated as tenant_id.
  if (tenantIds.length !== 1 || membershipTenantIds.length !== 1 || tenantIds[0] !== membershipTenantIds[0]) {
    return { response: forbidden('Ambiguous or missing tenant membership') };
  }

  return {
    tenantId: tenantIds[0],
    status: tenantRows[0]?.status ?? null,
  };
}

export function tenantContextResponse(context) {
  if (context?.response) return context.response;
  return new Response(JSON.stringify({
    ok: true,
    tenant: { id: context.tenantId, status: context.status },
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
