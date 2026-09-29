const INTEGRATION_ADAPTER_CONTRACT = 'integration-adapter-v1';

function assertSafeUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP(S) adapter endpoints are supported');
  if (url.username || url.password) throw new Error('Adapter endpoint must not contain credentials');
  const hostname = url.hostname.toLowerCase();
  const isIpv4 = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  const privateIpv4 = isIpv4 && (() => {
    const parts = hostname.split('.').map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 169 && parts[1] === 254)
      || parts[0] === 0;
  })();
  const privateIpv6 = hostname === '::1'
    || hostname === '[::1]'
    || hostname.startsWith('fc')
    || hostname.startsWith('fd')
    || hostname.startsWith('fe80:');
  if (hostname === 'localhost' || hostname.endsWith('.local') || privateIpv4 || privateIpv6) {
    throw new Error('Private/local adapter endpoints are not allowed');
  }
  return url;
}

function resolveRelativeTarget(path, baseUrl) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('Adapter request path must be an absolute relative path');
  const target = new URL(path, baseUrl);
  if (target.origin !== baseUrl.origin) throw new Error('Adapter request cannot change origin');
  return target;
}

export function createHttpAdapter({
  name,
  baseUrl,
  token,
  fetchImpl = fetch,
  timeoutMs = 5000,
  maxResponseBytes = 1_000_000,
} = {}) {
  if (!name) throw new Error('adapter name is required');
  const url = assertSafeUrl(baseUrl);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error('timeoutMs must be 100..30000');
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > 10_000_000) {
    throw new Error('maxResponseBytes must be 1024..10000000');
  }

  return {
    contractVersion: INTEGRATION_ADAPTER_CONTRACT,
    name,
    async request(path, { method = 'GET', body, headers = {} } = {}) {
      const target = resolveRelativeTarget(path, url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const requestHeaders = { accept: 'application/json', ...headers };
        if (body !== undefined) requestHeaders['content-type'] = 'application/json';
        if (token) requestHeaders.authorization = 'Bearer ' + token;
        const response = await fetchImpl(target, {
          method,
          headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
          redirect: 'manual',
        });
        if (response.status >= 300 && response.status < 400) {
          throw new Error('Integration adapter ' + name + ' rejected redirect (' + response.status + ')');
        }
        const contentLength = Number(response.headers.get('content-length') ?? 0);
        if (contentLength > maxResponseBytes) throw new Error('Integration adapter ' + name + ' response exceeds size limit');
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength > maxResponseBytes) {
          throw new Error('Integration adapter ' + name + ' response exceeds size limit');
        }
        let data = null;
        try { data = JSON.parse(text); } catch { data = text; }
        if (!response.ok) throw new Error('Integration adapter ' + name + ' failed (' + response.status + ')');
        return { status: response.status, data };
      } finally { clearTimeout(timer); }
    },
  };
}

export { INTEGRATION_ADAPTER_CONTRACT };
