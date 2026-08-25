/**
 * SynapseMax Experience Layer
 *
 * Static assets are served through the Cloudflare Assets binding.
 * The root route selects the current approved experience prototype.
 * Business logic and future AI integrations remain outside this layer.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // DEX v2 is the current visual prototype. Older DEX versions remain
    // available as explicit files for comparison and regression checks.
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const dexUrl = new URL('/dex-v2.html', request.url);
      return env.ASSETS.fetch(new Request(dexUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
