import asyncio
import html
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from workers import fetch


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


async def _fetch_bytes(url, timeout=8):
    response = await asyncio.wait_for(
        fetch(url, headers={'User-Agent': 'IntilyAI-News/7.0 RSS fallback'}),
        timeout=timeout,
    )
    if not response.ok:
        body = await response.text()
        raise RuntimeError(f'HTTP_{int(response.status)}: {body[:160]}')
    return bytes(await response.arrayBuffer())


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


def install_runtime_rss(engine):
    original_rss = engine.rss
    fallback_active = {'WORLD': False, 'RUSSIA': False}

    async def resilient_rss(region, query):
        if fallback_active[region]:
            return []
        try:
            return await asyncio.wait_for(original_rss(region, query), timeout=8)
        except Exception as exc:
            message = str(exc)
            if not any(code in message for code in ('HTTP_503', 'HTTP_429', 'HTTP_403', 'TimeoutError', 'timeout')):
                raise
            fallback_active[region] = True
            print('RSS_FALLBACK', region, 'reason', message[:180])
            return await direct_rss(region)

    engine.rss = resilient_rss
    return fallback_active
