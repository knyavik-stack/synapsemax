import asyncio
import html
import random
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from workers import fetch


# Google News remains the canonical discovery source.  The runtime deliberately
# uses a small number of broad queries, browser-like request headers and jitter
# so Google does not see a burst of identical datacenter RSS requests.
GOOGLE_UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) '
    'Chrome/151.0.0.0 Safari/537.36'
)
GOOGLE_HEADERS = {
    'User-Agent': GOOGLE_UA,
    'Accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, text/html;q=0.7, */*;q=0.5',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
}
GOOGLE_MIN_DELAY = 1.5
GOOGLE_MAX_DELAY = 2.3
GOOGLE_RETRY_MIN = 2.5
GOOGLE_RETRY_MAX = 4.0

# Four broad searches replace the former burst of ~30 narrow searches.
# The existing editorial AI relevance gate remains the final authority.
GOOGLE_QUERIES = [
    (
        'WORLD',
        '((OpenAI OR Anthropic OR "Google DeepMind" OR Gemini OR Microsoft OR Meta OR Nvidia OR AI) '
        '(artificial intelligence OR agent OR model OR robotics OR research OR product OR security)) when:12h',
    ),
    (
        'RUSSIA',
        '((ИИ OR "искусственный интеллект" OR нейросети) '
        '(Россия OR российский OR Яндекс OR Сбер OR VK OR бизнес OR регулирование OR безопасность)) when:12h',
    ),
]

DIRECT_FEEDS = {
    'WORLD': [
        ('TechCrunch', 'https://techcrunch.com/feed/'),
        ('Ars Technica', 'https://arstechnica.com/feed/'),
        ('The Verge', 'https://www.theverge.com/rss/index.xml'),
        ('Hacker News', 'https://news.ycombinator.com/rss'),
    ],
    'RUSSIA': [
        ('Habr', 'https://habr.com/ru/rss/articles/?fl=ru'),
        ('TASS', 'https://tass.ru/rss/v2.xml'),
        ('Kommersant', 'https://www.kommersant.ru/RSS/news.xml'),
        ('Vedomosti', 'https://www.vedomosti.ru/rss/news'),
    ],
}


async def _fetch_bytes(url, timeout=6, headers=None):
    response = await asyncio.wait_for(
        fetch(url, headers=headers or {'User-Agent': 'IntilyAI-News/7.1 RSS fallback'}),
        timeout=timeout,
    )
    if not response.ok:
        body = await response.text()
        raise RuntimeError(f'HTTP_{int(response.status)}: {body[:160]}')
    # Python Workers' Response exposes text()/json() reliably; the JS-only
    # arrayBuffer() method is not available on this Pyodide Response wrapper.
    return (await response.text()).encode('utf-8')


async def _google_fetch(url, timeout=6, browser_binding=None):
    await asyncio.sleep(random.uniform(GOOGLE_MIN_DELAY, GOOGLE_MAX_DELAY))
    try:
        return await _fetch_bytes(url, timeout=min(timeout, 6), headers=GOOGLE_HEADERS)
    except Exception as direct_error:
        if browser_binding is None:
            raise direct_error
        message = str(direct_error)
        if not any(code in message for code in ('HTTP_503', 'HTTP_429', 'HTTP_403', 'TimeoutError', 'timeout')):
            raise
        print('GOOGLE_BROWSER_FALLBACK', message[:160])
        try:
            rendered = await browser_binding.quickAction('content', {
                'url': url,
                'userAgent': GOOGLE_UA,
                'waitForTimeout': 500,
                'rejectResourceTypes': ['image', 'stylesheet', 'font', 'media'],
            })
            if hasattr(rendered, 'text'):
                rendered_text = await rendered.text()
            else:
                rendered_text = str(rendered)
            # Browser Run /content returns rendered HTML. Google RSS is an XML
            # document, so recover the XML tree even when Chrome HTML-escapes it.
            decoded = html.unescape(rendered_text)
            match = re.search(r'(?is)(<\?xml[^>]*>.*?</rss>|<rss\b.*?</rss>)', decoded)
            if not match:
                raise RuntimeError('GOOGLE_BROWSER_NO_RSS_XML')
            return match.group(1).encode('utf-8')
        except Exception as browser_error:
            print('GOOGLE_BROWSER_ERROR', str(browser_error)[:180])
            raise direct_error


def _parse_items(data, region, source_hint, cutoff):
    root = ET.fromstring(data)
    out = []
    for it in root.findall('.//item'):
        title = html.unescape(it.findtext('title') or '').strip()
        link = (it.findtext('link') or '').strip()
        desc = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html.unescape(it.findtext('description') or ''))).strip()
        source = (it.findtext('source') or source_hint).strip() or source_hint
        raw = (it.findtext('pubDate') or it.findtext('{http://purl.org/dc/elements/1.1/}date') or '').strip()
        try:
            dt = parsedate_to_datetime(raw)
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if not title or not link or dt < cutoff:
            continue
        out.append({'region': region, 'title': title, 'link': link, 'desc': desc, 'source': source, 'time': dt.timestamp()})
    return out


async def direct_rss(region, lookback_hours=48):
    cutoff = datetime.now(timezone.utc).timestamp() - lookback_hours * 3600
    cutoff_dt = datetime.fromtimestamp(cutoff, timezone.utc)

    async def one(source, url):
        try:
            data = await _fetch_bytes(url)
            items = _parse_items(data, region, source, cutoff_dt)
            print('RSS_DIRECT_OK', region, source, len(items))
            return items
        except Exception as exc:
            print('RSS_DIRECT_ERROR', region, source, str(exc)[:180])
            return []

    batches = await asyncio.gather(*(one(source, url) for source, url in DIRECT_FEEDS[region]))
    merged = []
    seen = set()
    for batch in batches:
        for item in batch:
            key = (item['title'].strip().lower(), item['link'].strip())
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
    merged.sort(key=lambda x: x['time'], reverse=True)
    return merged


def install_runtime_rss(engine, browser_binding=None):
    # Python Worker isolates can survive multiple Cron invocations. Never stack
    # another wrapper around an already wrapped engine.
    if getattr(engine, '_intily_google_resilience', False):
        return getattr(engine, '_intily_fallback_active', {'WORLD': False, 'RUSSIA': False})

    original_rss = engine.rss
    original_get = engine.get
    fallback_active = {'WORLD': False, 'RUSSIA': False}

    async def resilient_get(url, timeout=12, headers=None):
        if 'news.google.com/' in str(url):
            return await _google_fetch(url, timeout=min(timeout, 12))
        return await original_get(url, timeout=timeout, headers=headers)

    # Keep the canonical Google RSS parser, but replace only its transport.
    engine.get = resilient_get

    async def resilient_rss(region, query):
        if fallback_active[region]:
            return []
        try:
            return await asyncio.wait_for(original_rss(region, query), timeout=30)
        except Exception as exc:
            message = str(exc)
            if not any(code in message for code in ('HTTP_503', 'HTTP_429', 'HTTP_403', 'TimeoutError', 'timeout')):
                raise
            fallback_active[region] = True
            print('RSS_FALLBACK', region, 'reason', message[:180])
            return await direct_rss(region)

    engine.rss = resilient_rss
    # Collapse the old query burst into four high-recall Google searches.
    engine.QUERIES = list(GOOGLE_QUERIES)
    engine._intily_google_resilience = True
    engine._intily_fallback_active = fallback_active
    print('GOOGLE_RUNTIME_READY', 'queries', len(engine.QUERIES), 'browser_profile', True, 'browser_run', browser_binding is not None)
    return fallback_active
