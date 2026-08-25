/**
 * SynapseMax Experience Layer.
 * The Worker serves the current approved DEX experience from static assets.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const current = new URL('/dex-v3.html', request.url);
      return env.ASSETS.fetch(new Request(current, request));
    }
    return env.ASSETS.fetch(request);
  },
};
