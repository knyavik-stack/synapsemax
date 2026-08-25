/**
 * SynapseMax Experience Layer
 *
 * The Worker stays intentionally thin: static files are served by the
 * Cloudflare Assets binding, while the root route selects the current
 * experience prototype. This keeps the future Experience Layer separate
 * from business logic and AI integrations.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // DEX v1 is the next experience prototype. Other static assets remain
    // available directly through the Assets binding.
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const dexUrl = new URL('/dex-v1.html', request.url);
      return env.ASSETS.fetch(new Request(dexUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
