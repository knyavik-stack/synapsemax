const INTEGRATION_ADAPTER_CONTRACT = 'integration-adapter-v1';

function assertSafeUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP(S) adapter endpoints are supported');
  if (url.username || url.password) throw new Error('Adapter endpoint must not contain credentials');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')) {
    throw new Error('Private/local adapter endpoints are not allowed');
  }
  return url;
}

export function createHttpAdapter({ name, baseUrl, token, fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  if (!name) throw new Error('adapter name is required');
  const url = assertSafeUrl(baseUrl);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error('timeoutMs must be 100..30000');

  return {
    contractVersion: INTEGRATION_ADAPTER_CONTRACT,
    name,
    async request(path, { method = 'GET', body, headers = {} } = {}) {
      const target = new URL(path, url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const requestHeaders = { accept: 'application/json', ...headers };
        if (body !== undefined) requestHeaders['content-type'] = 'application/json';
        if (token) requestHeaders.authorization = 'Bearer ' + token;
        const response = await fetchImpl(target, {
          method, headers: requestHeaders,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await response.text();
        let data = null;
        try { data = JSON.parse(text); } catch { data = text; }
        if (!response.ok) throw new Error('Integration adapter ' + name + ' failed (' + response.status + ')');
        return { status: response.status, data };
      } finally { clearTimeout(timer); }
    },
  };
}

export { INTEGRATION_ADAPTER_CONTRACT };
