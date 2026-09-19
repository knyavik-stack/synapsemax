import { strict as assert } from 'node:assert';
import { resolveTenantContext } from '../src/tenant-context.js';

const request = (authorization) => new Request('https://synapsemax.test/api/v1/tenant-context', {
  headers: authorization ? { authorization } : {},
});

const unauthenticated = await resolveTenantContext(request());
assert.equal(unauthenticated.response.status, 401, 'missing Authorization must fail closed');

const malformed = await resolveTenantContext(request('Basic abc'));
assert.equal(malformed.response.status, 401, 'non-Bearer Authorization must fail closed');

console.log('tenant-context unit gate: PASS');
