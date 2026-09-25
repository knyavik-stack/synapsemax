import { createAuthClient } from '@neondatabase/auth';

const AUTH_URL = process.env.NEON_AUTH_URL;
const DATA_API_URL = process.env.NEON_DATA_API_URL;
const A_EMAIL = process.env.SYNAPSEMAX_RLS_A_EMAIL;
const A_PASSWORD = process.env.SYNAPSEMAX_RLS_A_PASSWORD;
const A_JWT = process.env.SYNAPSEMAX_RLS_A_JWT;
const B_EMAIL = process.env.SYNAPSEMAX_RLS_B_EMAIL;
const B_PASSWORD = process.env.SYNAPSEMAX_RLS_B_PASSWORD;
const B_JWT = process.env.SYNAPSEMAX_RLS_B_JWT;

for (const [name, value] of Object.entries({NEON_AUTH_URL:AUTH_URL,NEON_DATA_API_URL:DATA_API_URL})) {
  if (!value) throw new Error(`Missing required test secret/env: ${name}`);
}
if ((!A_JWT && (!A_EMAIL || !A_PASSWORD)) || (!B_JWT && (!B_EMAIL || !B_PASSWORD))) {
  throw new Error('Each principal requires either a verified-session JWT or an email/password pair');
}

async function login(email, password, jwt) {
  const auth = createAuthClient(AUTH_URL);
  if (jwt) {
    const payload = jwt.split('.')[1];
    if (!payload) throw new Error(`Invalid JWT format for ${email || 'principal'}`);
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const userId = claims.sub || claims.user_id || claims.userId;
    if (!userId) throw new Error(`JWT mode requires a subject claim for ${email || 'principal'}`);
    return { email: email || claims.email || 'jwt-principal', userId, token: jwt, auth };
  }
  const result = await auth.signIn.email({ email, password });
  if (result?.error) throw new Error(`sign-in failed for ${email}: ${result.error.message || 'unknown error'}`);
  const session = await auth.getSession();
  const user = session?.data?.user || session?.user;
  if (!user?.id) throw new Error(`No authenticated user returned for ${email}`);
  const token = await auth.getJWTToken();
  if (!token) throw new Error(`No JWT returned for ${email}`);
  return { email, userId: user.id, token, auth };
}

async function api(token, path, options = {}) {
  const response = await fetch(`${DATA_API_URL}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = await response.text();
  let data = null;
  try { data = JSON.parse(body); } catch {}
  return { status: response.status, data, body };
}

function assertStatus(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected HTTP ${expected}, got HTTP ${actual}`);
  console.log(`PASS ${label}: HTTP ${actual}`);
}

const A = await login(A_EMAIL, A_PASSWORD, A_JWT);
const B = await login(B_EMAIL, B_PASSWORD, B_JWT);

console.log(`Authenticated A user=${A.userId}`);
console.log(`Authenticated B user=${B.userId}`);
if (A.userId === B.userId) throw new Error('A and B resolved to the same principal');

const aTenants = await api(A.token, 'tenants?select=id,status&limit=2');
const bTenants = await api(B.token, 'tenants?select=id,status&limit=2');
assertStatus('A tenant read', aTenants.status, 200);
assertStatus('B tenant read', bTenants.status, 200);

const aRows = Array.isArray(aTenants.data) ? aTenants.data : [];
const bRows = Array.isArray(bTenants.data) ? bTenants.data : [];
if (aRows.length !== 1 || bRows.length !== 1) throw new Error('Each principal must see exactly one tenant');
if (aRows[0].id === bRows[0].id) throw new Error('A and B unexpectedly see the same tenant');

const [aMemberships, bMemberships] = await Promise.all([
  api(A.token, 'tenant_memberships?select=tenant_id,principal_id,status&status=eq.active&limit=2'),
  api(B.token, 'tenant_memberships?select=tenant_id,principal_id,status&status=eq.active&limit=2'),
]);
assertStatus('A membership read', aMemberships.status, 200);
assertStatus('B membership read', bMemberships.status, 200);

const aM = Array.isArray(aMemberships.data) ? aMemberships.data : [];
const bM = Array.isArray(bMemberships.data) ? bMemberships.data : [];
if (aM.length !== 1 || bM.length !== 1) throw new Error('Each principal must have exactly one active membership');
if (aM[0].tenant_id !== aRows[0].id || bM[0].tenant_id !== bRows[0].id) throw new Error('Membership does not match visible tenant');
if (aM[0].principal_id !== A.userId || bM[0].principal_id !== B.userId) throw new Error('Membership principal mismatch');

const aCrossRead = await api(A.token, `calculation_results?tenant_id=eq.${bRows[0].id}&select=id,tenant_id&limit=1`);
const bCrossRead = await api(B.token, `calculation_results?tenant_id=eq.${aRows[0].id}&select=id,tenant_id&limit=1`);
assertStatus('A cross-tenant result read', aCrossRead.status, 200);
assertStatus('B cross-tenant result read', bCrossRead.status, 200);
if ((aCrossRead.data || []).length !== 0 || (bCrossRead.data || []).length !== 0) {
  throw new Error('CRITICAL: cross-tenant rows are visible');
}

const aOwnRead = await api(A.token, `calculation_results?tenant_id=eq.${aRows[0].id}&select=id,tenant_id&limit=1`);
const bOwnRead = await api(B.token, `calculation_results?tenant_id=eq.${bRows[0].id}&select=id,tenant_id&limit=1`);
assertStatus('A own result read', aOwnRead.status, 200);
assertStatus('B own result read', bOwnRead.status, 200);
for (const [label, result, tenant] of [['A own', aOwnRead, aRows[0].id], ['B own', bOwnRead, bRows[0].id]]) {
  for (const row of (result.data || [])) if (row.tenant_id !== tenant) throw new Error(`${label}: returned foreign tenant row`);
}

const unauth = await fetch(`${DATA_API_URL}/calculation_results?select=id,tenant_id&limit=1`, {headers:{Accept:'application/json'}});
if (![401,403].includes(unauth.status)) throw new Error(`Unauthenticated Data API request returned unexpected HTTP ${unauth.status}`);
console.log(`PASS unauthenticated Data API request: HTTP ${unauth.status}`);

const endpointA = await fetch('https://synapsemax.ru/api/v1/tenant-context', {headers:{Authorization:`Bearer ${A.token}`}});
const endpointB = await fetch('https://synapsemax.ru/api/v1/tenant-context', {headers:{Authorization:`Bearer ${B.token}`}});
assertStatus('A Worker tenant-context', endpointA.status, 200);
assertStatus('B Worker tenant-context', endpointB.status, 200);

const aContext = await endpointA.json();
const bContext = await endpointB.json();
if (aContext.tenant?.id !== aRows[0].id || bContext.tenant?.id !== bRows[0].id) {
  throw new Error('Worker runtime tenant context does not match RLS-visible tenant');
}

console.log('RESULT: REAL TWO-PRINCIPAL RLS ISOLATION PASS');
