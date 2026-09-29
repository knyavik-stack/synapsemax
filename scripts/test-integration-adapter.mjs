import assert from 'node:assert/strict';
import { createHttpAdapter } from '../src/integration-adapter.js';

let called = false;
let captured;
const adapter = createHttpAdapter({
  name: 'demo',
  baseUrl: 'https://erp.example.com/api',
  token: 't',
  fetchImpl: async (u, o) => {
    called = String(u).endsWith('/health');
    captured = { u: String(u), o };
    assert.equal(o.headers.authorization, 'Bearer t');
    assert.equal(o.redirect, 'manual');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  },
});
const r = await adapter.request('/health');
assert.equal(r.data.ok, true);
assert.equal(called, true);
assert.equal(captured.u, 'https://erp.example.com/health');

assert.throws(() => createHttpAdapter({ name: 'bad', baseUrl: 'http://127.0.0.1:8080' }), /Private/);
assert.throws(() => createHttpAdapter({ name: 'bad', baseUrl: 'http://192.168.1.10' }), /Private/);
assert.throws(() => createHttpAdapter({ name: 'bad', baseUrl: 'http://169.254.169.254' }), /Private/);
assert.throws(() => createHttpAdapter({ name: 'bad', baseUrl: 'http://[::1]' }), /Private/);

const secure = createHttpAdapter({
  name: 'boundary',
  baseUrl: 'https://erp.example.com/api',
  fetchImpl: async () => new Response('', { status: 200 }),
});
assert.throws(() => secure.request('https://evil.example.com/exfiltrate'), /relative path/);

const redirecting = createHttpAdapter({
  name: 'redirect',
  baseUrl: 'https://erp.example.com/api',
  token: 'secret',
  fetchImpl: async () => new Response('', { status: 302, headers: { location: 'https://evil.example.com' } }),
});
await assert.rejects(() => redirecting.request('/redirect'), /rejected redirect/);

const oversized = createHttpAdapter({
  name: 'size',
  baseUrl: 'https://erp.example.com/api',
  maxResponseBytes: 1024,
  fetchImpl: async () => new Response('x'.repeat(2048), { status: 200 }),
});
await assert.rejects(() => oversized.request('/large'), /response exceeds size limit/);

console.log('integration-adapter: PASS');
