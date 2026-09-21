const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,}$/;

export function validatePasswordPolicy(password) {
  return typeof password === 'string' && PASSWORD_POLICY.test(password);
}

export function buildNeonAuthTarget(requestUrl, neonAuthUrl) {
  const incoming = new URL(requestUrl);
  const base = new URL(neonAuthUrl);
  const route = incoming.pathname.replace(/^\/api\/auth/, '') || '/';
  const basePath = base.pathname.replace(/\/$/, '');
  return new URL(basePath + (route.startsWith('/') ? route : `/${route}`) + incoming.search, base.origin);
}

export async function proxyNeonAuth(request, neonAuthUrl) {
  if (!neonAuthUrl) throw new Error('NEON_AUTH_URL is not configured');
  const incoming = new URL(request.url);
  const target = buildNeonAuthTarget(request.url, neonAuthUrl);
  const headers = new Headers(request.headers);

  // Keep the public SynapseMax origin for Better Auth trusted-origin/CSRF checks.
  // The upstream URL is only the transport destination.
  headers.set('origin', incoming.origin);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('content-encoding');

  if (request.method === 'POST' && target.pathname.endsWith('/sign-up/email')) {
    let body;
    try { body = await request.clone().json(); } catch { return new Response(JSON.stringify({error:{message:'Invalid JSON'}}), {status:400,headers:{'content-type':'application/json'}}); }
    if (!validatePasswordPolicy(body?.password)) {
      return new Response(JSON.stringify({error:{message:'Password must be at least 8 characters and contain uppercase Latin, lowercase Latin and a digit.'}}), {status:400,headers:{'content-type':'application/json'}});
    }
  }

  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  const outHeaders = new Headers(response.headers);
  outHeaders.delete('content-length');
  outHeaders.delete('content-encoding');
  return new Response(response.body, {status:response.status,statusText:response.statusText,headers:outHeaders});
}
