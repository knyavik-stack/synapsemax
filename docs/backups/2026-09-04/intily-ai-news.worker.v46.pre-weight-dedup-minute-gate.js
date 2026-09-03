const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const CRON = '*/3 * * * *';

const STATE_KEY = 'publisher:v3';
const LOCK_KEY = 'publisher:lock:v3';

const LOOKBACK_MS = 12 * 60 * 60 * 1000;
const LOCK_TTL = 240;
const PUBLISHED_TTL = 7 * 24 * 60 * 60;
const MAX_PUBLISH_PER_RUN = 30;
const MAX_QUEUE = 100;

const MIN_SCORE = 3;

// Collect at most once per hour; scheduled runs can still drain the queue.
const COLLECT_INTERVAL_MS = 20 * 60 * 1000;
const REQUEST_DELAY_MS = 2500;

export default {
  async fetch(request, env) {
    const u = new URL(request.url);

    if (u.pathname === '/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        service: 'intily-ai-news',
        version: '5.0',
        cron: CRON,
        time: new Date().toISOString()
      });
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    if (event.cron !== CRON) return;
    ctx.waitUntil(dispatchGitHub(env));
  }
};

async function dispatchGitHub(env) {
  const response = await fetch('https://api.github.com/repos/knyavik-stack/synapsemax/actions/workflows/intily-ai-news.yml/dispatches', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      'accept': 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'intily-cloudflare-scheduler'
    },
    body: JSON.stringify({ ref: 'main' })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GITHUB_DISPATCH_FAILED ${response.status}: ${detail.slice(0,300)}`);
  }
  console.log('GITHUB_DISPATCH', response.status);
}
