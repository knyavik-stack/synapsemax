import json
import os
from urllib.parse import urlparse
from workers import WorkerEntrypoint, Response
from intily_ai_news_core import main as run_engine

STATE_KEY = 'intily:publisher:v1'
LOCK_KEY = 'intily:publisher:lock:v1'
LOCK_TTL = 600


def _env_text(env, name):
    try:
        value = getattr(env, name)
    except Exception:
        return None
    if value is None:
        return None
    return str(value)


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        url = urlparse(str(request.url))
        if url.path == '/health' and str(request.method).upper() == 'GET':
            raw = await self.env.STATE.get(STATE_KEY)
            state = json.loads(raw) if raw else {}
            return Response.json({
                'ok': True,
                'service': 'intily-ai-news',
                'runtime': 'cloudflare-python-workers',
                'cron': '* * * * *',
                'queue': len(state.get('queue', [])) if isinstance(state, dict) else 0,
                'last_run': (state.get('health', {}).get('last_run_ts', 0) if isinstance(state.get('health', {}), dict) else 0) if isinstance(state, dict) else 0,
            })
        return Response('Not found', status=404)

    async def scheduled(self, controller, env, ctx):
        existing = await env.STATE.get(LOCK_KEY)
        if existing:
            try:
                if __import__('time').time() * 1000 - float(existing) < LOCK_TTL * 1000:
                    print('SKIP_LOCKED')
                    return
            except Exception:
                pass
        await env.STATE.put(LOCK_KEY, str(__import__('time').time() * 1000), {'expirationTtl': LOCK_TTL})
        try:
            for name in ('TELEGRAM_BOT_TOKEN', 'GITHUB_DISPATCH_TOKEN', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'GROQ_API_KEY'):
                value = _env_text(env, name)
                if value:
                    os.environ[name] = value
            async def load_state():
                raw = await env.STATE.get(STATE_KEY)
                default = {
                    'queue': [], 'published': {}, 'known': {}, 'stories': {},
                    'last_search_ts': 0, 'last_publish_ts': 0,
                    'health': {}, 'providers': {}, 'publication_regions': [],
                }
                if not raw:
                    return default
                try:
                    state = json.loads(raw)
                    if not isinstance(state, dict):
                        return default
                    if not isinstance(state.get('queue'), list): state['queue'] = []
                    if not isinstance(state.get('published'), dict): state['published'] = {}
                    if not isinstance(state.get('known'), dict): state['known'] = {}
                    if not isinstance(state.get('stories'), dict): state['stories'] = {}
                    if not isinstance(state.get('health'), dict): state['health'] = {}
                    if not isinstance(state.get('providers'), dict): state['providers'] = {}
                    if not isinstance(state.get('publication_regions'), list): state['publication_regions'] = []
                    return state
                except Exception:
                    print('STATE_JSON_INVALID')
                    return default
            async def save_state(state):
                await env.STATE.put(STATE_KEY, json.dumps(state, ensure_ascii=False, separators=(',', ':')))
            await run_engine(load_state_fn=load_state, save_state_fn=save_state, ai_binding=env.AI)
        finally:
            await env.STATE.delete(LOCK_KEY)
