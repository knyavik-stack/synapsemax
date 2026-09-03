import os
import re
import json
import time
import hashlib
from difflib import SequenceMatcher
import html
import urllib.parse
import urllib.request
import urllib.error
import random
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET


# ============================================================
# INTILY AI NEWS PUBLISHER
# Production queue / failover / watchdog / editorial QA
# ============================================================

# Discovery freshness is intentionally short. Old items should not occupy
# queue capacity when the channel publishes one story every five minutes.
# ============================================================
# PUBLICATION SETTINGS — single control point for Intily
# ============================================================

LOOKBACK = timedelta(hours=12)  # Maximum age of news eligible for discovery/queue.
SEARCH_INTERVAL_SECONDS = 30 * 60  # Planned news-search interval: 30 minutes.
PUBLISH_INTERVAL_SECONDS = 3 * 60  # Minimum interval between Telegram publications: 3 minutes.
IMPORTANCE_THRESHOLD = 60  # Minimum mathematical importance score (0–100) for queue/publication.
MAX_QUEUE = 20  # Maximum number of qualifying stories retained in memory.
RUSSIA_MIN_SHARE = 0.50  # Minimum Russian-news share in the queue when enough RU candidates exist.
RUSSIA_MIN_QUEUE_SLOTS = 10  # Number of RU slots reserved in a full 20-item queue.
JOKE_RATE = 0.90  # Target probability of a light joke on suitable non-serious posts.
URGENT_SEARCH_QUEUE_THRESHOLD = 1  # Search immediately when the durable queue has 1 or fewer items.

MAX_PUBLISH = 1
TARGET_QUEUE_SIZE = MAX_QUEUE
WORLD_TARGET_SHARE = 1 - RUSSIA_MIN_SHARE
RUSSIA_TARGET_SHARE = RUSSIA_MIN_SHARE
REGION_HISTORY_SIZE = 20
QUEUE_RETENTION = timedelta(days=7)
QUEUE_RETRY_BASE_SECONDS = 300
QUEUE_RETRY_MAX_SECONDS = 6 * 3600

# Temporary queue counter. Set False when Boss requests removal.
SHOW_QUEUE_COUNT = True

HEARTBEAT_MAX_SECONDS = 900
FAILURE_ALERT_THRESHOLD = 3
MAX_ATTEMPTS_PER_RUN = 10
MAX_EDIT_ATTEMPTS = 2


STATE_FILE = os.environ.get(
    'STATE_FILE',
    'data/intily-ai-news-state.json'
)

# Exact RSS-item memory is only an ingestion guard. It must never act as a
# 30-day tombstone for an unpublished story. Semantic published history is kept
# separately in stories.
KNOWN_LOOKBACK_SECONDS = 6 * 3600


# ------------------------------------------------------------
# Provider models
# ------------------------------------------------------------

GROQ_MODEL = 'llama-3.1-8b-instant'
GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

OPENAI_MODEL = 'gpt-4o-mini'
OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

GEMINI_MODEL = 'gemini-3.1-flash-lite'
GEMINI_URL = (
    'https://generativelanguage.googleapis.com/v1beta/models/'
    + GEMINI_MODEL
    + ':generateContent'
)

TG_URL = 'https://api.telegram.org/bot{}/sendMessage'


# ------------------------------------------------------------
# Sources
# ------------------------------------------------------------

QUERIES = [
    ('WORLD', 'AI artificial intelligence major technology news'),
    ('WORLD', 'OpenAI model launch agent product'),
    ('WORLD', 'Anthropic Claude model enterprise'),
    ('WORLD', 'Google DeepMind Gemini AI technology'),
    ('WORLD', 'Microsoft Meta Apple AI product technology'),
    ('WORLD', 'Nvidia AI chips GPU semiconductor'),
    ('WORLD', 'AI agents robotics autonomous systems'),
    ('WORLD', 'artificial intelligence research breakthrough science'),
    ('WORLD', 'AI implementation business enterprise adoption automation'),
    ('WORLD', 'AI practical application workflow productivity operations'),
    ('WORLD', 'AI customer service sales marketing finance implementation'),
    ('WORLD', 'AI healthcare education manufacturing logistics application'),
    ('WORLD', 'AI software tool platform feature review developer coding'),
    ('WORLD', 'AI deployment architecture inference cost reliability'),
    ('WORLD', 'AI security vulnerability breach agent safety failure problem'),
    ('WORLD', 'AI startup funding acquisition investment enterprise technology'),
    ('RUSSIA', 'ÐÐ Ð¸ÑÐºÑÑÑÑÐ²ÐµÐ½Ð½ÑÐ¹ Ð¸Ð½ÑÐµÐ»Ð»ÐµÐºÑ Ð½ÐµÐ¹ÑÐ¾ÑÐµÑÐ¸ Ð Ð¾ÑÑÐ¸Ñ ÑÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ð¸'),
    ('RUSSIA', 'Ð¯Ð½Ð´ÐµÐºÑ Ð¡Ð±ÐµÑ VK ÐÐ Ð¿ÑÐ¾Ð´ÑÐºÑ ÑÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ñ'),
    ('RUSSIA', 'ÑÐ¾ÑÑÐ¸Ð¹ÑÐºÐ¸Ðµ ÐºÐ¾Ð¼Ð¿Ð°Ð½Ð¸Ð¸ Ð²Ð½ÐµÐ´ÑÐµÐ½Ð¸Ðµ ÐÐ Ð±Ð¸Ð·Ð½ÐµÑ Ð°Ð²ÑÐ¾Ð¼Ð°ÑÐ¸Ð·Ð°ÑÐ¸Ñ'),
    ('RUSSIA', 'ÐÐ Ð¿ÑÐ¸Ð¼ÐµÐ½ÐµÐ½Ð¸Ðµ Ð¿ÑÐ°ÐºÑÐ¸ÐºÐ° Ð±Ð¸Ð·Ð½ÐµÑ ÐºÐµÐ¹Ñ Ð Ð¾ÑÑÐ¸Ñ'),
    ('RUSSIA', 'ÐÐ ÑÐ¸Ð½Ð°Ð½ÑÑ Ð¿ÑÐ¾Ð¼ÑÑÐ»ÐµÐ½Ð½Ð¾ÑÑÑ Ð¼ÐµÐ´Ð¸ÑÐ¸Ð½Ð° Ð¾Ð±ÑÐ°Ð·Ð¾Ð²Ð°Ð½Ð¸Ðµ Ð»Ð¾Ð³Ð¸ÑÑÐ¸ÐºÐ° Ð Ð¾ÑÑÐ¸Ñ'),
    ('RUSSIA', 'ÐÐ ÑÐ°Ð·ÑÐ°Ð±Ð¾ÑÐºÐ° Ð¸Ð½ÑÑÐ°ÑÑÑÑÐºÑÑÑÐ° Ð¼Ð¾Ð´ÐµÐ»Ð¸ Ð°Ð³ÐµÐ½ÑÑ Ð Ð¾ÑÑÐ¸Ñ'),
    ('RUSSIA', 'ÐÐ Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑÑ ÑÑÐ·Ð²Ð¸Ð¼Ð¾ÑÑÑ ÑÑÐµÑÐºÐ° Ð¿ÑÐ¾Ð±Ð»ÐµÐ¼Ñ Ð Ð¾ÑÑÐ¸Ñ'),
    ('RUSSIA', 'ÐÐ ÑÐ¾Ð±Ð¾ÑÐ¾ÑÐµÑÐ½Ð¸ÐºÐ° ÑÐ¸Ð¿Ñ Ð¸ÑÑÐ»ÐµÐ´Ð¾Ð²Ð°Ð½Ð¸Ñ Ð Ð¾ÑÑÐ¸Ñ'),
    ('RUSSIA', 'ÐÐ ÑÐµÐ³ÑÐ»Ð¸ÑÐ¾Ð²Ð°Ð½Ð¸Ðµ Ð·Ð°ÐºÐ¾Ð½ Ð¸Ð½Ð²ÐµÑÑÐ¸ÑÐ¸Ð¸ ÑÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ð¸ Ð Ð¾ÑÑÐ¸Ñ'),
    ('RUSSIA', 'ÑÐ¾ÑÑÐ¸Ð¹ÑÐºÐ¸Ð¹ ÐÐ ÑÑÐ°ÑÑÐ°Ð¿ Ð¿ÑÐ¾Ð´ÑÐºÑ Ð¿Ð»Ð°ÑÑÐ¾ÑÐ¼Ð° Ð¾Ð±Ð·Ð¾Ñ'),
    ('RUSSIA', 'site:yandex.ru/company/news ÐÐ Ð¸ÑÐºÑÑÑÑÐ²ÐµÐ½Ð½ÑÐ¹ Ð¸Ð½ÑÐµÐ»Ð»ÐµÐºÑ'),
    ('RUSSIA', 'site:sberbank.ru ÐÐ Ð¸ÑÐºÑÑÑÑÐ²ÐµÐ½Ð½ÑÐ¹ Ð¸Ð½ÑÐµÐ»Ð»ÐµÐºÑ ÑÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ð¸'),
    ('RUSSIA', 'site:rbc.ru ÐÐ Ð²Ð½ÐµÐ´ÑÐµÐ½Ð¸Ðµ Ð±Ð¸Ð·Ð½ÐµÑ ÑÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ð¸'),
    ('RUSSIA', 'site:kommersant.ru ÐÐ ÑÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ð¸ Ð±Ð¸Ð·Ð½ÐµÑ Ð Ð¾ÑÑÐ¸Ñ'),
    ('RUSSIA', 'site:vc.ru ÐÐ Ð±Ð¸Ð·Ð½ÐµÑ Ð²Ð½ÐµÐ´ÑÐµÐ½Ð¸Ðµ Ð°Ð²ÑÐ¾Ð¼Ð°ÑÐ¸Ð·Ð°ÑÐ¸Ñ')
]


QUALITY_TRUSTED = {
    'reuters', 'bloomberg', 'financial times', 'the verge',
    'techcrunch', 'wired', 'mit technology review', 'arstechnica',
    'venturebeat', 'tass', 'interfax', 'ÑÐ±Ðº', 'ÐºÐ¾Ð¼Ð¼ÐµÑÑÐ°Ð½ÑÑ',
    'Ð²ÐµÐ´Ð¾Ð¼Ð¾ÑÑÐ¸', 'forbes'
}

HIGH_IMPACT_TERMS = {
    'launch', 'released', 'release', 'introduces', 'introduced',
    'model', 'agent', 'robot', 'robotics', 'breakthrough',
    'acquisition', 'funding', 'investment', 'billion', 'chip',
    'gpu', 'security', 'breach', 'regulation', 'law',
    'Ð·Ð°Ð¿ÑÑÑ', 'Ð²ÑÐ¿ÑÑÑ', 'Ð¿ÑÐµÐ´ÑÑÐ°Ð²', 'Ð¼Ð¾Ð´ÐµÐ»Ñ', 'Ð°Ð³ÐµÐ½Ñ', 'ÑÐ¾Ð±Ð¾Ñ',
    'Ð¿ÑÐ¾ÑÑÐ²', 'Ð¸Ð½Ð²ÐµÑÑÐ¸Ñ', 'Ð¼Ð¸Ð»Ð»Ð¸Ð°ÑÐ´', 'Ð¿Ð¾Ð³Ð»Ð¾Ñ', 'ÑÐ¸Ð¿', 'ÑÑÐµÑ',
    'ÑÐµÐ³ÑÐ»Ð¸Ñ', 'Ð·Ð°ÐºÐ¾Ð½'
}

APPLICATION_TERMS = {
    'enterprise', 'business', 'productivity', 'automation',
    'developer', 'coding', 'software', 'platform', 'tool',
    'healthcare', 'education', 'science', 'industrial', 'application',
    'Ð²Ð½ÐµÐ´ÑÐµÐ½', 'Ð±Ð¸Ð·Ð½ÐµÑ', 'Ð°Ð²ÑÐ¾Ð¼Ð°ÑÐ¸Ð·Ð°Ñ', 'ÑÐ°Ð·ÑÐ°Ð±Ð¾ÑÑ', 'Ð¿ÑÐ¾Ð³ÑÐ°Ð¼Ð¼',
    'Ð¿Ð»Ð°ÑÑÐ¾ÑÐ¼', 'Ð¸Ð½ÑÑÑÑÐ¼ÐµÐ½Ñ', 'Ð·Ð´ÑÐ°Ð²Ð¾Ð¾ÑÑÐ°Ð½', 'Ð¾Ð±ÑÐ°Ð·Ð¾Ð²Ð°Ð½',
    'Ð¿ÑÐ¾Ð¸Ð·Ð²Ð¾Ð´ÑÑÐ²', 'Ð¿ÑÐ¸Ð¼ÐµÐ½ÐµÐ½'
}


PRACTICAL_IMPLEMENTATION_TERMS = {
    'deployment', 'adoption', 'implementation', 'workflow', 'operations',
    'case study', 'customer', 'revenue', 'cost', 'roi', 'inference',
    'reliability', 'latency', 'architecture', 'integration',
    'Ð²Ð½ÐµÐ´ÑÐµÐ½', 'Ð¿ÑÐ°ÐºÑÐ¸Ðº', 'ÐºÐµÐ¹Ñ', 'Ð²ÑÑÑÑÐº', 'Ð·Ð°ÑÑÐ°Ñ', 'Ð¾ÐºÑÐ¿Ð°ÐµÐ¼',
    'Ð¿ÑÐ¾ÑÐµÑÑ', 'Ð¾Ð¿ÐµÑÐ°Ñ', 'Ð¸Ð½ÑÐµÐ³ÑÐ°Ñ', 'Ð°ÑÑÐ¸ÑÐµÐºÑÑÑ', 'Ð¸Ð½ÑÑÐ°ÑÑÑÑÐºÑÑÑ',
    'Ð¿ÑÐ¾Ð¸Ð·Ð²Ð¾Ð´Ð¸ÑÐµÐ»ÑÐ½Ð¾ÑÑ', 'ÑÑÐ¾Ð¸Ð¼Ð¾ÑÑ', 'Ð·Ð°Ð´ÐµÑÐ¶Ðº'
}

RISK_AND_PROBLEM_TERMS = {
    'failure', 'outage', 'incident', 'vulnerability', 'exploit',
    'hallucination', 'privacy', 'security', 'breach', 'misuse',
    'problem', 'risk', 'attack', 'ÑÑÐ·Ð²Ð¸Ð¼', 'ÑÐ±Ð¾Ð¹', 'Ð¸Ð½ÑÐ¸Ð´ÐµÐ½Ñ',
    'Ð³Ð°Ð»Ð»ÑÑÐ¸Ð½Ð°Ñ', 'ÐºÐ¾Ð½ÑÐ¸Ð´ÐµÐ½Ñ', 'Ð±ÐµÐ·Ð¾Ð¿Ð°Ñ', 'ÑÑÐµÑ', 'Ð¿ÑÐ¾Ð±Ð»ÐµÐ¼',
    'ÑÐ¸ÑÐº', 'Ð°ÑÐ°ÐºÐ°', 'Ð²ÑÐµÐ´'
}

EXCLUSIVITY_TERMS = {
    'first', 'exclusive', 'unprecedented', 'largest', 'record',
    'major', 'billion', 'first-ever', 'Ð²Ð¿ÐµÑÐ²ÑÐµ', 'ÑÐºÑÐºÐ»ÑÐ·Ð¸Ð²',
    'ÐºÑÑÐ¿Ð½ÐµÐ¹Ñ', 'ÑÐµÐºÐ¾ÑÐ´', 'Ð¼Ð¸Ð»Ð»Ð¸Ð°ÑÐ´', 'Ð¿ÐµÑÐ²ÑÐ¹'
}

LOW_SIGNAL_TERMS = {
    'opinion', 'sponsored', 'advertisement', 'coupon',
    'horoscope', 'giveaway', 'stocks', 'stock price',
    'Ð¼Ð½ÐµÐ½Ð¸Ðµ ÑÐ¸ÑÐ°ÑÐµÐ»ÐµÐ¹', 'ÑÐµÐºÐ»Ð°Ð¼Ð°', 'Ð¿ÑÐ¾Ð¼Ð¾ÐºÐ¾Ð´', 'Ð³Ð¾ÑÐ¾ÑÐºÐ¾Ð¿'
}

# A query match alone is not enough: Google News can return adjacent
# technology/business stories that contain one broad query term but are not
# substantively about AI or an allowed AI-adjacent technology.
AI_RELEVANCE_TOKENS = {
    'ai', 'llm', 'openai', 'anthropic', 'claude', 'gemini', 'deepmind',
    'copilot', 'chatgpt', 'nvidia', 'gpu', 'Ð¸Ð¸'
}

AI_RELEVANCE_STEMS = (
    'artificial intelligence', 'machine learning', 'generative ai',
    'language model', 'neural network', 'Ð¸ÑÐºÑÑÑÑÐ²ÐµÐ½Ð½ Ð¸Ð½ÑÐµÐ»Ð»ÐµÐºÑ',
    'Ð¼Ð°ÑÐ¸Ð½Ð½ Ð¾Ð±ÑÑ', 'Ð³ÐµÐ½ÐµÑÐ°ÑÐ¸Ð²', 'Ð½ÐµÐ¹ÑÐ¾ÑÐµÑ', 'Ð½ÐµÐ¹ÑÐ¾Ð½Ð½',
    'ÑÐ¾Ð±Ð¾Ñ', 'Ð°Ð²ÑÐ¾Ð½Ð¾Ð¼Ð½', 'Ð°Ð³ÐµÐ½Ñ', 'Ð¿Ð¾Ð»ÑÐ¿ÑÐ¾Ð²Ð¾Ð´', 'ÑÐ¸Ð¿'
)

WEIGHTS = {
    'launch': 5,
    'release': 5,
    'model': 4,
    'agent': 5,
    'breakthrough': 7,
    'research': 3,
    'security': 5,
    'safety': 5,
    'regulation': 5,
    'law': 5,
    'investment': 4,
    'billion': 5,
    'acquisition': 5,
    'chip': 4,
    'gpu': 4,
    'openai': 4,
    'anthropic': 4,
    'google': 3,
    'deepmind': 4,
    'nvidia': 4,
    'microsoft': 3,
    'yandex': 4,
    'sber': 4,
    'Ð·Ð°ÐºÐ¾Ð½': 6,
    'ÑÐµÐ³ÑÐ»Ð¸Ñ': 5,
    'Ð¼Ð¸Ð»Ð»Ð¸Ð°ÑÐ´': 5,
    'Ð·Ð°Ð¿ÑÑÑ': 5,
    'Ð²ÑÐ¿ÑÑÑ': 5,
    'Ð°Ð³ÐµÐ½Ñ': 5,
    'Ð¼Ð¾Ð´ÐµÐ»Ñ': 4,
    'Ð½ÐµÐ¹ÑÐ¾ÑÐµÑ': 4,
    'Ð¸ÑÑÐ»ÐµÐ´Ð¾Ð²Ð°Ð½': 3
}


TRUSTED = {
    'reuters',
    'bloomberg',
    'financial times',
    'the verge',
    'techcrunch',
    'tass',
    'interfax',
    'ÑÐ±Ðº',
    'ÐºÐ¾Ð¼Ð¼ÐµÑÑÐ°Ð½ÑÑ',
    'Ð²ÐµÐ´Ð¾Ð¼Ð¾ÑÑÐ¸'
}


# ------------------------------------------------------------
# Persistent state
# ------------------------------------------------------------

def load_state():
    directory = os.path.dirname(STATE_FILE)

    if directory:
        os.makedirs(directory, exist_ok=True)

    try:
        with open(STATE_FILE, encoding='utf-8') as f:
            s = json.load(f)

    except Exception:
        s = {}

    if not isinstance(s.get('published'), dict):
        s['published'] = {}

    if not isinstance(s.get('known'), dict):
        s['known'] = {}

    if not isinstance(s.get('queue'), list):
        s['queue'] = []

    if not isinstance(s.get('health'), dict):
        s['health'] = {}

    if not isinstance(s.get('providers'), dict):
        s['providers'] = {}

    # Semantic story memory: recent story fingerprints are stored separately
    # from URL/title dedup so paraphrased reports of the same event are not
    # republished as new stories.
    if not isinstance(s.get('stories'), dict):
        s['stories'] = {}

    if not isinstance(s.get('publication_regions'), list):
        s['publication_regions'] = []

    return s


def save_state(s):
    directory = os.path.dirname(STATE_FILE)

    if directory:
        os.makedirs(directory, exist_ok=True)

    tmp = STATE_FILE + '.tmp'

    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(
            s,
            f,
            ensure_ascii=False,
            indent=2
        )

    os.replace(tmp, STATE_FILE)


# ------------------------------------------------------------
# HTTP
# ------------------------------------------------------------

def get(url, timeout=12, headers=None):
    req = urllib.request.Request(
        url,
        headers=headers or {
            'User-Agent': 'IntilyAI-News/7.0'
        }
    )

    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# ------------------------------------------------------------
# RSS
# ------------------------------------------------------------

def rss(region, q):
    cutoff = (
        datetime.now(timezone.utc)
        - LOOKBACK
    )

    params = urllib.parse.urlencode({
        'q': f'{q} after:{cutoff.date().isoformat()}',
        'hl': 'ru-RU',
        'gl': 'RU' if region == 'RUSSIA' else 'US',
        'ceid': 'RU:ru' if region == 'RUSSIA' else 'US:en'
    })

    root = ET.fromstring(
        get(
            'https://news.google.com/rss/search?' + params
        )
    )

    out = []

    for it in root.findall('.//item'):
        title = html.unescape(
            it.findtext('title') or ''
        ).strip()

        link = (
            it.findtext('link') or ''
        ).strip()

        desc = re.sub(
            r'\s+',
            ' ',
            re.sub(
                r'<[^>]+>',
                ' ',
                html.unescape(
                    it.findtext('description') or ''
                )
            )
        ).strip()

        source = (
            it.findtext('source') or ''
        ).strip()

        raw = (
            it.findtext('pubDate') or ''
        )

        try:
            dt = parsedate_to_datetime(raw)

            if not dt.tzinfo:
                dt = dt.replace(
                    tzinfo=timezone.utc
                )

        except Exception:
            continue

        if not title or not link or dt < cutoff:
            continue

        out.append({
            'region': region,
            'title': title,
            'link': link,
            'desc': desc,
            'source': source,
            'time': dt.timestamp()
        })

    return out


# ------------------------------------------------------------
# Scoring / dedup
# ------------------------------------------------------------

def normalize(t):
    return ' '.join(
        re.sub(
            r'[^a-zÐ°-ÑÑ0-9]+',
            ' ',
            t.lower()
        ).split()
    )


def key(x):
    return hashlib.sha256(
        (
            normalize(x['title'])
            + '|'
            + normalize(x['source'])
        ).encode()
    ).hexdigest()


def tier(x):
    s = x.get('score', 0)

    if s >= 85:
        return 'S'

    if s >= IMPORTANCE_THRESHOLD:
        return 'A'

    return 'B'


def score(x):
    """Return 0–100 audience-importance probability proxy.

    The model combines topical relevance, impact, practical value, source
    quality and freshness. It is deliberately deterministic and explainable.
    """
    blob = (x.get('title', '') + ' ' + x.get('desc', '') + ' ' + x.get('source', '')).lower()
    age = (datetime.now(timezone.utc).timestamp() - x.get('time', 0)) / 3600
    if age < -0.5 or age > LOOKBACK.total_seconds() / 3600:
        return 0

    relevance = 35 if ai_relevant(x) else 0
    impact_hits = sum(1 for term in HIGH_IMPACT_TERMS if term in blob)
    impact = min(25, impact_hits * 4)
    application_hits = sum(1 for term in APPLICATION_TERMS if term in blob)
    practical = min(15, application_hits * 3)
    source = x.get('source', '').lower().strip()
    source_points = 10 if source in QUALITY_TRUSTED else (6 if source in TRUSTED else 2)
    freshness = 15 if age <= 1 else 12 if age <= 3 else 8 if age <= 6 else 4
    penalty = 15 if any(term in blob for term in LOW_SIGNAL_TERMS) else 0
    return max(0, min(100, relevance + impact + practical + source_points + freshness - penalty))


def editorial_value(x):
    blob = (x['title'] + ' ' + x['desc']).lower()
    source = x.get('source', '').lower().strip()
    value = x.get('score', 0)

    if source in QUALITY_TRUSTED:
        value += 3
    if any(term in blob for term in HIGH_IMPACT_TERMS):
        value += 3
    if any(term in blob for term in APPLICATION_TERMS):
        value += 2
    if any(term in blob for term in PRACTICAL_IMPLEMENTATION_TERMS):
        value += 3
    if any(term in blob for term in RISK_AND_PROBLEM_TERMS):
        value += 3
    if any(term in blob for term in EXCLUSIVITY_TERMS):
        value += 2
    if len(normalize(x.get('desc', ''))) >= 120:
        value += 1
    elif len(normalize(x.get('desc', ''))) < 35:
        value -= 3
    if any(term in blob for term in LOW_SIGNAL_TERMS):
        value -= 8
    return max(0, min(value, 50))


def topic_tags(x):
    blob = (x.get('title', '') + ' ' + x.get('desc', '')).lower()
    groups = {
        'models': ('model', 'claude', 'gemini', 'gpt', 'Ð¼Ð¾Ð´ÐµÐ»Ñ'),
        'agents': ('agent', 'agents', 'Ð°Ð³ÐµÐ½Ñ'),
        'robotics': ('robot', 'robotics', 'ÑÐ¾Ð±Ð¾Ñ'),
        'chips': ('chip', 'gpu', 'nvidia', 'ÑÐ¸Ð¿', 'Ð¿Ð¾Ð»ÑÐ¿ÑÐ¾Ð²Ð¾Ð´'),
        'research': ('research', 'breakthrough', 'Ð¸ÑÑÐ»ÐµÐ´Ð¾Ð²Ð°Ð½', 'Ð¿ÑÐ¾ÑÑÐ²'),
        'business': ('enterprise', 'business', 'investment', 'Ð²Ð½ÐµÐ´ÑÐµÐ½', 'Ð±Ð¸Ð·Ð½ÐµÑ', 'Ð¸Ð½Ð²ÐµÑÑÐ¸Ñ'),
        'applications': ('application', 'automation', 'healthcare', 'education', 'Ð¿ÑÐ¸Ð¼ÐµÐ½ÐµÐ½', 'Ð°Ð²ÑÐ¾Ð¼Ð°ÑÐ¸Ð·Ð°Ñ', 'Ð·Ð´ÑÐ°Ð²Ð¾Ð¾ÑÑÐ°Ð½', 'Ð¾Ð±ÑÐ°Ð·Ð¾Ð²Ð°Ð½'),
        'tools': ('tool', 'platform', 'software', 'feature', 'Ð¸Ð½ÑÑÑÑÐ¼ÐµÐ½Ñ', 'Ð¿Ð»Ð°ÑÑÐ¾ÑÐ¼', 'Ð¿ÑÐ¾Ð³ÑÐ°Ð¼Ð¼'),
        'security_regulation': ('security', 'breach', 'regulation', 'law', 'ÑÑÐµÑ', 'Ð±ÐµÐ·Ð¾Ð¿Ð°Ñ', 'ÑÐµÐ³ÑÐ»Ð¸Ñ', 'Ð·Ð°ÐºÐ¾Ð½')
    }
    return sorted(tag for tag, terms in groups.items() if any(term in blob for term in terms))


def ai_relevant(x):
    text = normalize(x.get('title', '') + ' ' + x.get('desc', ''))
    tokens = set(text.split())

    if tokens & AI_RELEVANCE_TOKENS:
        return True

    return any(stem in text for stem in AI_RELEVANCE_STEMS)


def candidate_quality(x):
    importance = int(x.get('importance', score(x)))
    x['score'] = importance
    x['importance'] = importance
    if importance < IMPORTANCE_THRESHOLD:
        return False
    if not ai_relevant(x):
        return False
    x['editorial_value'] = editorial_value(x)
    x['topics'] = topic_tags(x)
    return True



STORY_LOOKBACK_SECONDS = 24 * 3600
STORY_TITLE_THRESHOLD = 0.58
STORY_BODY_THRESHOLD = 0.28
STORY_COMBINED_THRESHOLD = 0.44

# Common Russian/English glue words add noise to semantic comparison.
STORY_STOPWORDS = {
    'ÑÑÐ¾', 'ÐºÐ°Ðº', 'ÑÑÐ¾', 'Ð´Ð»Ñ', 'Ð¿ÑÐ¸', 'Ð¿Ð¾ÑÐ»Ðµ', 'Ð¿ÐµÑÐµÐ´', 'ÑÐµÑÐµÐ·',
    'Ð½Ð¾Ð²ÑÐ¹', 'Ð½Ð¾Ð²Ð°Ñ', 'Ð½Ð¾Ð²Ð¾Ðµ', 'Ð½Ð¾Ð²ÑÐµ', 'ÐºÐ¾ÑÐ¾ÑÑÐ¹', 'ÐºÐ¾ÑÐ¾ÑÐ°Ñ', 'ÐºÐ¾ÑÐ¾ÑÑÐµ',
    'Ð¼Ð¾Ð¶ÐµÑ', 'Ð¼Ð¾Ð³ÑÑ', 'Ð±Ð¾Ð»ÐµÐµ', 'ÑÐ°ÐºÐ¶Ðµ', 'ÑÐ¶Ðµ', 'ÐµÑÑ', 'ÐµÑÐµ', 'ÑÐ²Ð¾Ð¹',
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'new', 'news'
}


def token_set(text):
    return {
        w for w in normalize(text).split()
        if len(w) >= 4 and w not in STORY_STOPWORDS
    }


def jaccard(a, b):
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def story_similarity(a, b):
    # Use both word overlap and character-level similarity. Russian headlines
    # often change word forms (Ð¿ÑÐµÐ´ÑÑÐ°Ð²Ð¸Ð»/Ð¿ÑÐµÐ´ÑÑÐ°Ð²Ð¸Ð»Ð°, Ð Ð¾ÑÑÐ¸Ð¸/ÑÐ¾ÑÑÐ¸Ð¹ÑÐºÐ¸Ð¹),
    # so token-only Jaccard is too brittle for paraphrase detection.
    at = normalize(a.get('title', ''))
    bt = normalize(b.get('title', ''))
    ac = normalize(
        a.get('title', '') + ' ' + a.get('desc', '')
    )
    bc = normalize(
        b.get('title', '') + ' ' + b.get('desc', '')
    )

    title_tokens = jaccard(
        token_set(at),
        token_set(bt)
    )
    title_seq = SequenceMatcher(
        None, at, bt
    ).ratio()
    combined_seq = SequenceMatcher(
        None, ac, bc
    ).ratio()

    # Character 3-gram overlap catches inflectional changes without needing
    # a heavyweight NLP dependency.
    ag = at.replace(' ', '')
    bg = bt.replace(' ', '')
    A = {ag[i:i+3] for i in range(max(0, len(ag) - 2))}
    B = {bg[i:i+3] for i in range(max(0, len(bg) - 2))}
    title_grams = (
        len(A & B) / len(A | B)
        if A and B else 0.0
    )

    # Conservative gates: one strong title match, or a strong paraphrase
    # supported by similarity of the full event description.
    if title_seq >= 0.76:
        return title_seq

    if (
        title_seq >= 0.66
        and combined_seq >= 0.58
        and (
            title_tokens >= 0.18
            or title_grams >= 0.40
        )
    ):
        return (
            title_seq * 0.55
            + combined_seq * 0.30
            + max(title_tokens, title_grams) * 0.15
        )

    return max(
        title_tokens,
        title_grams * 0.9,
        title_seq * 0.8
    )


def similarity(a, b):
    # Backward-compatible title similarity used by existing callers/tests.
    return jaccard(token_set(a), token_set(b))


def story_anchor_tokens(x):
    text = normalize(x.get('title', '') + ' ' + x.get('desc', ''))
    tokens = token_set(text)
    return {
        w for w in tokens
        if w in {
            'openai', 'anthropic', 'google', 'deepmind', 'gemini',
            'claude', 'nvidia', 'microsoft', 'meta', 'apple',
            'yandex', 'ÑÐ±ÐµÑ', 'sber', 'ÑÐ¾ÑÑÐ¸Ñ', 'ÑÐ¾ÑÑÐ¸Ð¸',
            'fable', 'mythos', 'astra', 'llama', 'kimi', 'copilot',
            'chatgpt', 'openclaw', 'agentforce'
        } or any(ch.isdigit() for ch in w)
    }


def title_bigrams(text):
    words = [
        w for w in normalize(text).split()
        if len(w) >= 3 and w not in STORY_STOPWORDS
    ]
    return {
        ' '.join(words[i:i + 2])
        for i in range(len(words) - 1)
    }


def same_story(a, b):
    # A shared company name alone is not enough to classify two events as the same story.
    sim = story_similarity(a, b)
    shared_anchors = story_anchor_tokens(a) & story_anchor_tokens(b)
    bigrams_a = title_bigrams(a.get('title', ''))
    bigrams_b = title_bigrams(b.get('title', ''))
    shared_bigrams = bigrams_a & bigrams_b

    if sim >= 0.70:
        return True

    # Two distinctive title bigrams identify the same event even when the
    # publisher changes the surrounding wording.
    # Two distinctive title bigrams plus a product/company anchor are enough
    # for syndicated launch headlines whose descriptions differ substantially.
    if len(shared_bigrams) >= 2 and shared_anchors and sim >= 0.30:
        return True

    if sim >= 0.58 and shared_anchors:
        return True

    if any(any(ch.isdigit() for ch in token) for token in shared_anchors):
        return sim >= 0.54

    return False


def collect():
    all_items = []
    raw_total = 0
    scored_out = 0
    quality_out = 0
    story_dupes = 0

    for region, q in QUERIES:
        try:
            started = time.time()
            items = rss(region, q)
            raw_total += len(items)
            for x in items:
                x['score'] = score(x)
                x['key'] = key(x)
                all_items.append(x)
            print('RSS_QUERY', region, 'raw', len(items), q[:80])
            if time.time() - started > 15:
                raise TimeoutError('FEED_BUDGET_EXCEEDED')
        except Exception as e:
            print('FEED_ERROR', region, str(e)[:180])

    all_items.sort(key=lambda x: (x['score'], x['time']), reverse=True)
    out = []
    for x in all_items:
        if x['score'] < IMPORTANCE_THRESHOLD:
            scored_out += 1
            continue
        if not candidate_quality(x):
            quality_out += 1
            continue
        if any(same_story(x, y) for y in out):
            story_dupes += 1
            continue
        out.append(x)

    print('INGEST_SUMMARY', 'raw', raw_total, 'all', len(all_items),
          'score_filtered', scored_out, 'quality_filtered', quality_out,
          'story_dedup', story_dupes, 'candidates', len(out))
    return out



# ------------------------------------------------------------
# Provider circuit breaker
# ------------------------------------------------------------

PROVIDER_COOLDOWN = {
    'GROQ': 6 * 3600,
    'OPENAI': 24 * 3600,
    'GEMINI': 120
}


def provider_blocked(s, name):
    p = s['providers'].get(name, {})

    until = float(
        p.get('disabled_until', 0) or 0
    )

    if until > time.time():
        remaining = int(
            until - time.time()
        )

        print(
            'AI_PROVIDER_BLOCKED',
            name,
            remaining
        )

        return True

    return False


def block_provider(s, name, reason):
    cooldown = PROVIDER_COOLDOWN.get(
        name,
        300
    )

    until = time.time() + cooldown

    s['providers'][name] = {
        'disabled_until': until,
        'reason': str(reason)[:240],
        'updated_at': time.time()
    }

    print(
        'AI_PROVIDER_CIRCUIT_OPEN',
        name,
        cooldown,
        str(reason)[:180]
    )


def clear_provider(s, name):
    s['providers'][name] = {
        'disabled_until': 0,
        'reason': '',
        'updated_at': time.time()
    }


# ------------------------------------------------------------
# OpenAI-compatible chat
# ------------------------------------------------------------

def chat(
    url,
    model,
    token,
    prompt,
    provider,
    retries=2
):
    body = json.dumps({
        'model': model,
        'messages': [
            {
                'role': 'system',
                'content': (
                    'Ð¢Ñ Ð¿ÑÐ¾ÑÐµÑÑÐ¸Ð¾Ð½Ð°Ð»ÑÐ½ÑÐ¹ ÑÐµÐ´Ð°ÐºÑÐ¾Ñ '
                    'ÑÑÑÑÐºÐ¾Ð³Ð¾ Telegram-ÐºÐ°Ð½Ð°Ð»Ð° Ð¾Ð± AI. '
                    'ÐÑÐµÐ³Ð´Ð° Ð¾ÑÐ²ÐµÑÐ°Ð¹ ÑÐ¾Ð»ÑÐºÐ¾ Ð²Ð°Ð»Ð¸Ð´Ð½ÑÐ¼ JSON.'
                )
            },
            {
                'role': 'user',
                'content': prompt
            }
        ],
        'temperature': 0.25,
        'max_tokens': 900
    }).encode()

    last = None

    for attempt in range(retries):

        try:
            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    'Authorization':
                        'Bearer ' + token,
                    'Content-Type':
                        'application/json'
                }
            )

            with urllib.request.urlopen(
                req,
                timeout=20
            ) as r:
                d = json.loads(
                    r.read().decode()
                )

            return d['choices'][0][
                'message'
            ]['content']

        except urllib.error.HTTPError as e:

            raw = e.read().decode(
                'utf-8',
                'replace'
            )

            last = RuntimeError(
                f'{provider}_HTTP_{e.code}: '
                f'{raw[:300]}'
            )

            if (
                provider == 'OPENAI'
                and e.code == 429
            ):
                raise last

            if (
                provider == 'GROQ'
                and e.code == 403
            ):
                raise last

            if e.code not in (
                429,
                500,
                502,
                503,
                504
            ):
                raise last

            retry = e.headers.get(
                'Retry-After'
            )

            if retry and retry.isdigit():
                wait = min(
                    int(retry),
                    30
                )
            else:
                wait = min(
                    2 ** attempt * 3,
                    20
                )

            print(
                provider + '_RETRY',
                e.code,
                wait
            )

            time.sleep(wait)

        except Exception as e:
            last = e

            if attempt < retries - 1:
                wait = min(
                    2 ** attempt * 3,
                    15
                )

                print(
                    provider + '_RETRY_EXCEPTION',
                    wait
                )

                time.sleep(wait)

    raise last or RuntimeError(
        provider + '_FAILED'
    )


# ------------------------------------------------------------
# Gemini
# ------------------------------------------------------------

def gemini_chat(prompt, token):
    body = json.dumps({
        'systemInstruction': {
            'parts': [{
                'text': (
                    'Ð¢Ñ Ð¿ÑÐ¾ÑÐµÑÑÐ¸Ð¾Ð½Ð°Ð»ÑÐ½ÑÐ¹ ÑÐµÐ´Ð°ÐºÑÐ¾Ñ '
                    'ÑÑÑÑÐºÐ¾Ð³Ð¾ Telegram-ÐºÐ°Ð½Ð°Ð»Ð° Ð¾Ð± AI. '
                    'ÐÑÐµÐ³Ð´Ð° Ð¾ÑÐ²ÐµÑÐ°Ð¹ ÑÐ¾Ð»ÑÐºÐ¾ Ð²Ð°Ð»Ð¸Ð´Ð½ÑÐ¼ JSON.'
                )
            }]
        },
        'contents': [{
            'role': 'user',
            'parts': [{
                'text': prompt
            }]
        }],
        'generationConfig': {
            'temperature': 0.25,
            'maxOutputTokens': 900,
            'responseMimeType': 'application/json'
        }
    }).encode()

    last = None

    for attempt in range(3):

        try:
            url = (
                GEMINI_URL
                + '?key='
                + urllib.parse.quote(
                    token,
                    safe=''
                )
            )

            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    'Content-Type':
                        'application/json'
                }
            )

            with urllib.request.urlopen(
                req,
                timeout=25
            ) as r:
                d = json.loads(
                    r.read().decode()
                )

            return d[
                'candidates'
            ][0][
                'content'
            ][
                'parts'
            ][0]['text']

        except urllib.error.HTTPError as e:

            raw = e.read().decode(
                'utf-8',
                'replace'
            )

            last = RuntimeError(
                f'GEMINI_HTTP_{e.code}: '
                f'{raw[:300]}'
            )

            if e.code in (
                500,
                502,
                503,
                504,
                429
            ):
                wait = min(
                    5 * (2 ** attempt),
                    20
                )

                print(
                    'GEMINI_RETRY',
                    e.code,
                    wait
                )

                time.sleep(wait)
                continue

            raise last

        except Exception as e:
            last = e

            if attempt < 2:
                wait = min(
                    5 * (2 ** attempt),
                    20
                )

                print(
                    'GEMINI_RETRY_EXCEPTION',
                    wait
                )

                time.sleep(wait)

    raise last or RuntimeError(
        'GEMINI_FAILED'
    )


# ------------------------------------------------------------
# AI failover
# ------------------------------------------------------------

def ai(prompt, s):
    errors = []

    providers = [
        (
            'GEMINI',
            None,
            None,
            os.environ.get(
                'GEMINI_API_KEY'
            )
        ),
        (
            'GROQ',
            GROQ_URL,
            GROQ_MODEL,
            os.environ.get(
                'GROQ_API_KEY'
            )
        ),
        (
            'OPENAI',
            OPENAI_URL,
            OPENAI_MODEL,
            os.environ.get(
                'OPENAI_API_KEY'
            )
        )
    ]

    for name, url, model, token in providers:

        if not token:
            print(
                name + '_SKIPPED_NO_KEY'
            )
            continue

        if provider_blocked(s, name):
            errors.append(
                name + ': CIRCUIT_OPEN'
            )
            continue

        try:
            print(
                'AI_PROVIDER_ATTEMPT',
                name
            )

            if name == 'GEMINI':
                result = gemini_chat(
                    prompt,
                    token
                )

            else:
                result = chat(
                    url,
                    model,
                    token,
                    prompt,
                    name
                )

            if (
                result
                and len(result.strip()) > 20
            ):
                clear_provider(
                    s,
                    name
                )

                print(
                    'AI_PROVIDER_OK',
                    name
                )

                return result

            raise RuntimeError(
                'EMPTY_RESPONSE'
            )

        except Exception as ex:

            message = str(ex)

            errors.append(
                name
                + ': '
                + message[:180]
            )

            print(
                'AI_PROVIDER_FAILED',
                name,
                message[:180]
            )

            if (
                name == 'OPENAI'
                and (
                    'HTTP_429' in message
                    or 'no credits' in message.lower()
                    or 'credits remaining' in message.lower()
                )
            ):
                block_provider(
                    s,
                    name,
                    'NO_CREDITS_OR_429'
                )

            elif (
                name == 'GROQ'
                and (
                    'HTTP_403' in message
                    or '1010' in message
                )
            ):
                block_provider(
                    s,
                    name,
                    'GROQ_403_1010'
                )

            elif (
                name == 'GEMINI'
                and (
                    'HTTP_503' in message
                    or 'HTTP_500' in message
                )
            ):
                block_provider(
                    s,
                    name,
                    'TEMPORARY_SERVICE_ERROR'
                )

    raise RuntimeError(
        'AI_PROVIDERS_UNAVAILABLE | '
        + ' | '.join(errors)
    )


# ------------------------------------------------------------
# Editorial QA
# ------------------------------------------------------------

def russian_ok(text):
    clean = re.sub(
        r'https?://\S+|<[^>]+>',
        ' ',
        text
    )

    c = len(
        re.findall(
            r'[Ð-Ð¯Ð°-ÑÐÑ]',
            clean
        )
    )

    l = len(
        re.findall(
            r'[A-Za-z]',
            clean
        )
    )

    words = len(
        clean.split()
    )

    return (
        c >= 40
        and c >= l * 0.8
        and words >= 15
    )


def forbidden_style(text):
    low = text.lower()

    return any(
        x in low
        for x in (
            'ÑÐ°ÐºÐ¸Ð¼ Ð¾Ð±ÑÐ°Ð·Ð¾Ð¼',
            'Ð² ÑÐ²Ð¾Ñ Ð¾ÑÐµÑÐµÐ´Ñ',
            'Ð´Ð°Ð½Ð½Ð¾Ðµ ÑÐ¾Ð±ÑÑÐ¸Ðµ',
            'Ð²Ð°Ð¶Ð½ÑÐ¹ ÑÐ°Ð³',
            'ÑÑÐ¾ ÑÑÐ¾ Ð·Ð½Ð°ÑÐ¸Ñ:'
        )
    )


def parse_editor_json(raw):
    cleaned = raw.strip()

    cleaned = re.sub(
        r'^```(?:json)?\s*',
        '',
        cleaned,
        flags=re.I
    )

    cleaned = re.sub(
        r'\s*```$',
        '',
        cleaned,
        flags=re.I
    )

    return json.loads(cleaned)


def build_edit_prompt(x, retry=False, previous_error=''):
    want_joke = (
        random.random()
        < JOKE_RATE
    )

    joke_instruction = (
        'Ð½ÑÐ¶Ð½Ð°'
        if want_joke
        else 'Ð½Ðµ Ð½ÑÐ¶Ð½Ð°'
    )

    retry_instruction = ''

    if retry:
        retry_instruction = (
            '\nÐÑÐµÐ´ÑÐ´ÑÑÐ°Ñ Ð²ÐµÑÑÐ¸Ñ Ð½Ðµ Ð¿ÑÐ¾ÑÐ»Ð° '
            'ÑÐµÐ´Ð°ÐºÑÐ¾ÑÑÐºÑÑ Ð¿ÑÐ¾Ð²ÐµÑÐºÑ. '
            'Ð¡Ð´ÐµÐ»Ð°Ð¹ ÑÐµÐºÑÑ Ð¿ÑÐ¾ÑÐµ, ÐµÑÑÐµÑÑÐ²ÐµÐ½Ð½ÐµÐµ '
            'Ð¸ Ð¿Ð¾Ð»Ð½Ð¾ÑÑÑÑ Ð½Ð° ÑÑÑÑÐºÐ¾Ð¼ ÑÐ·ÑÐºÐµ. '
            'ÐÐµ Ð¿Ð¾Ð²ÑÐ¾ÑÑÐ¹ Ð¿ÑÐ¾Ð±Ð»ÐµÐ¼Ð½ÑÑ ÐºÐ¾Ð½ÑÑÑÑÐºÑÐ¸Ñ.'
        )

        if previous_error:
            retry_instruction += (
                '\nÐÑÐ¸ÑÐ¸Ð½Ð° Ð¿ÑÐµÐ´ÑÐ´ÑÑÐµÐ³Ð¾ Ð¾ÑÐºÐ°Ð·Ð°: '
                + previous_error[:180]
            )

    return (
        'ÐÐ¾Ð´Ð³Ð¾ÑÐ¾Ð²Ñ Ð³Ð¾ÑÐ¾Ð²ÑÐ¹ Telegram-Ð¿Ð¾ÑÑ '
        'Ð¦ÐÐÐÐÐÐ Ð½Ð° ÐµÑÑÐµÑÑÐ²ÐµÐ½Ð½Ð¾Ð¼ ÑÑÑÑÐºÐ¾Ð¼ ÑÐ·ÑÐºÐµ. '
        'ÐÐµ Ð´ÐµÐ»Ð°Ð¹ Ð´Ð¾ÑÐ»Ð¾Ð²Ð½ÑÐ¹ Ð¿ÐµÑÐµÐ²Ð¾Ð´: Ð¿ÐµÑÐµÑÐºÐ°Ð¶Ð¸ '
        'ÑÐµÐ»Ð¾Ð²ÐµÑÐµÑÐºÐ¸Ð¼ ÑÐ·ÑÐºÐ¾Ð¼. '
        'ÐÐ±ÑÐ·Ð°ÑÐµÐ»ÑÐ½Ð¾ ÑÐ°ÑÐºÑÐ¾Ð¹: ÑÑÐ¾ Ð¿ÑÐ¾Ð¸Ð·Ð¾ÑÐ»Ð¾, '
        'ÐºÑÐ¾ ÑÑÐ°ÑÑÐ½Ð¸ÐºÐ¸, Ð¿Ð¾ÑÐµÐ¼Ñ ÑÑÐ¾ Ð²Ð°Ð¶Ð½Ð¾ '
        'Ð¸ Ð¿ÑÐ°ÐºÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð²ÑÐ²Ð¾Ð´. '
        'ÐÐµ Ð²ÑÐ´ÑÐ¼ÑÐ²Ð°Ð¹ ÑÐ°ÐºÑÑ. '
        'ÐÐµÑÑ ÑÐµÐ·ÑÐ»ÑÑÐ°Ñ Ð½Ð° ÑÑÑÑÐºÐ¾Ð¼; Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ñ ÐºÐ¾Ð¼Ð¿Ð°Ð½Ð¸Ð¹, '
        'Ð¿ÑÐ¾Ð´ÑÐºÑÐ¾Ð² Ð¸ Ð¼Ð¾Ð´ÐµÐ»ÐµÐ¹ Ð¼Ð¾Ð¶Ð½Ð¾ Ð¾ÑÑÐ°Ð²Ð»ÑÑÑ '
        'Ð² Ð¾ÑÐ¸Ð³Ð¸Ð½Ð°Ð»ÑÐ½Ð¾Ð¼ Ð½Ð°Ð¿Ð¸ÑÐ°Ð½Ð¸Ð¸.\n'
        'Ð®Ð¼Ð¾Ñ: ÑÑÑÐµÐ¼Ð¸Ð¼ÑÑ Ð´Ð¾Ð±Ð°Ð²Ð»ÑÑÑ Ð»ÑÐ³ÐºÑÑ ÑÐµÐ»Ð¾Ð²ÐµÑÐµÑÐºÑÑ '
        'ÑÑÑÐºÑ Ð¿ÑÐ¸Ð¼ÐµÑÐ½Ð¾ Ð² 90%% Ð¿Ð¾Ð´ÑÐ¾Ð´ÑÑÐ¸Ñ Ð¿ÑÐ±Ð»Ð¸ÐºÐ°ÑÐ¸Ð¹. '
        'Ð ÑÑÐ¾Ð¹ Ð¿ÑÐ±Ð»Ð¸ÐºÐ°ÑÐ¸Ð¸ ÑÑÑÐºÐ° %s. '
        'ÐÑÐ»Ð¸ ÑÐµÐ¼Ð° Ð¿ÑÐ¾ Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑÑ, ÑÐµÐ³ÑÐ»Ð¸ÑÐ¾Ð²Ð°Ð½Ð¸Ðµ, '
        'Ð·Ð°ÐºÐ¾Ð½, ÑÑÐµÑÐºÑ, Ð°Ð²Ð°ÑÐ¸Ñ, Ð²ÑÐµÐ´ Ð¸Ð»Ð¸ ÑÐµÑÑÑÐ·Ð½ÑÐ¹ '
        'Ð¸Ð½ÑÐ¸Ð´ÐµÐ½Ñ â ÑÑÑÐºÐ° Ð·Ð°Ð¿ÑÐµÑÐµÐ½Ð° Ð½ÐµÐ·Ð°Ð²Ð¸ÑÐ¸Ð¼Ð¾ '
        'Ð¾Ñ ÑÑÐ¾Ð³Ð¾ ÑÐ»Ð°Ð³Ð°. '
        'ÐÐµ Ð¸ÑÐ¿Ð¾Ð»ÑÐ·ÑÐ¹ ÑÐµÑÐµÐ²ÑÐµ ÑÑÐ°Ð¼Ð¿Ñ ÐÐ. '
        'ÐÐµ Ð¸ÑÐ¿Ð¾Ð»ÑÐ·ÑÐ¹ ÐºÐ°Ð½ÑÐµÐ»ÑÑÐ¸Ñ. '
        'ÐÐµ Ð½Ð°ÑÐ¸Ð½Ð°Ð¹ ÑÐµÐºÑÑ Ñ ÑÐ°Ð±Ð»Ð¾Ð½Ð½ÑÑ ÑÑÐ°Ð·. '
        'ÐÐµÑÐ½Ð¸ JSON ÑÑÑÐ¾Ð³Ð¾ Ñ Ð¿Ð¾Ð»ÑÐ¼Ð¸ '
        'title, body, meaning, joke. '
        'joke Ð¼Ð¾Ð¶ÐµÑ Ð±ÑÑÑ Ð¿ÑÑÑÐ¾Ð¹ ÑÑÑÐ¾ÐºÐ¾Ð¹.\n'
        '%s'
        '\n'
        'ÐÑÑÐ¾ÑÐ½Ð¸Ðº: %s\n'
        'ÐÐ°Ð³Ð¾Ð»Ð¾Ð²Ð¾Ðº: %s\n'
        'ÐÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ: %s'
    ) % (
        joke_instruction,
        retry_instruction,
        x['source'],
        x['title'],
        x['desc']
    )


def hashtags_for(x):
    # Telegram topic tags: always include core AI tags, then add only relevant topics.
    blob = (x.get('title', '') + ' ' + x.get('desc', '')).lower()
    tags = ['#ИИ', '#AI']
    mapping = [
        ('agent', '#AIагенты'), ('агент', '#AIагенты'),
        ('model', '#AIмодели'), ('модель', '#AIмодели'),
        ('robot', '#Робототехника'), ('робот', '#Робототехника'),
        ('security', '#БезопасностьИИ'), ('безопас', '#БезопасностьИИ'),
        ('regulation', '#РегулированиеИИ'), ('регулир', '#РегулированиеИИ'),
        ('investment', '#AIинвестиции'), ('инвести', '#AIинвестиции'),
        ('business', '#AIбизнес'), ('бизнес', '#AIбизнес'),
        ('automation', '#Автоматизация'), ('автоматиза', '#Автоматизация'),
        ('inference', '#Inference'), ('инфраструктур', '#AIинфраструктура')
    ]
    for term, tag in mapping:
        if term in blob and tag not in tags:
            tags.append(tag)
        if len(tags) >= 5:
            break
    return ' '.join(tags[:5])



def edit(x, s):
    last_error = ''

    for attempt in range(
        MAX_EDIT_ATTEMPTS
    ):
        try:
            prompt = build_edit_prompt(
                x,
                retry=attempt > 0,
                previous_error=last_error
            )

            raw = ai(
                prompt,
                s
            )

            j = parse_editor_json(raw)

            title = str(
                j.get('title', '')
            ).strip()

            body = str(
                j.get('body', '')
            ).strip()

            meaning = str(
                j.get('meaning', '')
            ).strip()

            joke = str(
                j.get('joke', '')
            ).strip()

            full = ' '.join([
                title,
                body,
                meaning,
                joke
            ])

            if not title:
                raise RuntimeError(
                    'RU_QA_TITLE_EMPTY'
                )

            if not body:
                raise RuntimeError(
                    'RU_QA_BODY_EMPTY'
                )

            if not meaning:
                raise RuntimeError(
                    'RU_QA_MEANING_EMPTY'
                )

            if not russian_ok(full):
                raise RuntimeError(
                    'RU_QA_RUSSIAN_LANGUAGE'
                )

            if forbidden_style(full):
                raise RuntimeError(
                    'RU_QA_FORBIDDEN_STYLE'
                )

            sensitive = any(
                k in (
                    x['title']
                    + ' '
                    + x['desc']
                ).lower()
                for k in (
                    'security',
                    'safety',
                    'regulation',
                    'law',
                    'breach',
                    'ÑÑÐµÑ',
                    'Ð±ÐµÐ·Ð¾Ð¿Ð°Ñ',
                    'ÑÐµÐ³ÑÐ»Ð¸Ñ',
                    'Ð·Ð°ÐºÐ¾Ð½',
                    'Ð°Ð²Ð°Ñ'
                )
            )

            if sensitive:
                joke = ''

            elif (
                attempt == 0
                and want_joke_from_text(
                    joke,
                    s
                )
                is False
            ):
                # Do not reject a usable publication merely
                # because the joke was weak or absent.
                joke = ''

            x['tier'] = tier(x)

            esc = lambda value: html.escape(
                str(value),
                quote=True
            )

            flag = (
                'ð·ðº'
                if x['region'] == 'RUSSIA'
                else 'ð'
            )

            dt = datetime.fromtimestamp(
                x['time'],
                timezone.utc
            ).astimezone(
                timezone(timedelta(hours=3))
            )

            jb = (
                '\n\nð '
                + esc(joke)
                if joke
                else ''
            )

            post = (
                f'{flag} '
                f'<b>{esc(title)}</b>\n\n'
                f'{esc(body)}\n\n'
                f'<b>ÐÑÐ²Ð¾Ð´:</b> '
                f'{esc(meaning)}'
                f'{jb}\n\n'
                f'{hashtags_for(x)}\n\n'
                f'ð° {esc(x["source"] or "ÐÑÑÐ¾ÑÐ½Ð¸Ðº")} '
                f'Â· {dt:%d.%m.%Y %H:%M} ÐÐ¡Ð\n'
                f'ð <a href="'
                f'{html.escape(x["link"], quote=True)}'
                f'">ÐÐ¾Ð´ÑÐ¾Ð±Ð½ÐµÐµ</a>'
            )

            print(
                'EDITORIAL_QA_OK',
                x['title']
            )

            return post

        except Exception as e:
            last_error = str(e)

            print(
                'EDITORIAL_QA_FAILED',
                x['title'],
                last_error[:240],
                'attempt',
                attempt + 1
            )

            if attempt < MAX_EDIT_ATTEMPTS - 1:
                continue

            raise RuntimeError(
                last_error
            )


def want_joke_from_text(joke, s):
    # The final joke requirement is deliberately soft.
    # A valid news publication must never be blocked solely
    # because the model omitted a joke.
    return bool(joke.strip())


# ------------------------------------------------------------
# Telegram
# ------------------------------------------------------------

def telegram(text):
    token = os.environ[
        'TELEGRAM_BOT_TOKEN'
    ]

    chat_id = os.environ.get(
        'TELEGRAM_CHAT_ID',
        '@intily'
    )

    payload = json.dumps({
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True
    }).encode()

    last = None

    for attempt in range(3):

        try:
            req = urllib.request.Request(
                TG_URL.format(token),
                data=payload,
                headers={
                    'Content-Type':
                        'application/json'
                }
            )

            with urllib.request.urlopen(
                req,
                timeout=15
            ) as r:
                d = json.loads(
                    r.read().decode()
                )

            if d.get('ok'):
                print(
                    'TELEGRAM_SENT',
                    d.get(
                        'result',
                        {}
                    ).get(
                        'message_id'
                    )
                )

                return

            last = RuntimeError(
                str(d)
            )

        except urllib.error.HTTPError as e:

            raw = e.read().decode(
                'utf-8',
                'replace'
            )

            last = RuntimeError(raw)

            retry_after = None

            try:
                data = json.loads(raw)

                retry_after = (
                    data.get(
                        'parameters',
                        {}
                    ).get(
                        'retry_after'
                    )
                )

            except Exception:
                pass

            wait = (
                min(
                    int(retry_after),
                    30
                )
                if retry_after
                else min(
                    2 ** attempt * 2,
                    15
                )
            )

            print(
                'TELEGRAM_RETRY',
                e.code,
                wait
            )

            time.sleep(wait)

        except Exception as e:
            last = e

            wait = min(
                2 ** attempt * 2,
                10
            )

            print(
                'TELEGRAM_RETRY_EXCEPTION',
                wait
            )

            time.sleep(wait)

    raise last or RuntimeError(
        'TELEGRAM_FAILED'
    )


# ------------------------------------------------------------
# Editorial queue policy
# ------------------------------------------------------------

def region_counts(items):
    return {
        'WORLD': sum(1 for x in items if x.get('region') == 'WORLD'),
        'RUSSIA': sum(1 for x in items if x.get('region') == 'RUSSIA')
    }


def rebalance_queue(items, now):
    fresh = []
    dropped_expired = dropped_quality = 0
    for x in items:
        if x.get('time', 0) < now - LOOKBACK.total_seconds():
            dropped_expired += 1
            continue
        if not candidate_quality(x):
            dropped_quality += 1
            continue
        fresh.append(x)

    fresh.sort(key=lambda x: (x.get('importance', x.get('score', 0)), x.get('time', 0)), reverse=True)

    unique = []
    for x in fresh:
        if any(same_story(x, y) for y in unique):
            continue
        unique.append(x)

    ru = [x for x in unique if x.get('region') == 'RUSSIA']
    world = [x for x in unique if x.get('region') != 'RUSSIA']
    ru_slots = min(RUSSIA_MIN_QUEUE_SLOTS, len(ru), MAX_QUEUE)
    selected = ru[:ru_slots]
    selected_keys = {x.get('key') for x in selected}

    for x in world:
        if len(selected) >= MAX_QUEUE:
            break
        selected.append(x)
        selected_keys.add(x.get('key'))

    # If fewer than the RU quota exist, fill remaining capacity with the best
    # available qualifying stories; never invent or duplicate a Russian item.
    for x in ru[ru_slots:]:
        if len(selected) >= MAX_QUEUE:
            break
        if x.get('key') not in selected_keys:
            selected.append(x)
            selected_keys.add(x.get('key'))

    selected.sort(key=lambda x: (x.get('importance', x.get('score', 0)), x.get('time', 0)), reverse=True)
    if dropped_expired or dropped_quality:
        print('QUEUE_REBALANCE_FILTER', 'expired', dropped_expired, 'quality', dropped_quality, 'kept', len(selected))
    counts = region_counts(selected)
    if len(selected) >= RUSSIA_MIN_QUEUE_SLOTS * 2 and counts['RUSSIA'] < RUSSIA_MIN_QUEUE_SLOTS:
        print('QUEUE_RUSSIA_QUOTA_UNAVAILABLE', counts)
    return selected[:MAX_QUEUE]


def publication_region_boost(s, region):
    history = s.get('publication_regions', [])[-REGION_HISTORY_SIZE:]
    if not history:
        return 0
    ru_share = history.count('RUSSIA') / len(history)
    tolerance = 0.08
    if region == 'RUSSIA' and ru_share < RUSSIA_TARGET_SHARE - tolerance:
        return 50
    if region == 'WORLD' and ru_share < RUSSIA_TARGET_SHARE - tolerance:
        return -12
    if region == 'WORLD' and ru_share > RUSSIA_TARGET_SHARE + tolerance:
        return 20
    if region == 'RUSSIA' and ru_share > RUSSIA_TARGET_SHARE + tolerance:
        return -50
    return 0


def publication_priority(s, x):
    return x.get('editorial_value', x.get('score', 0)) + publication_region_boost(
        s, x.get('region', 'WORLD')
    )


# ------------------------------------------------------------
# Main production loop
# ------------------------------------------------------------

def main():
    s = load_state()
    now = time.time()
    cut = now - 30 * 86400
    health = s['health']

    previous_success = float(health.get('last_success_ts', 0) or 0)
    if previous_success and now - previous_success > HEARTBEAT_MAX_SECONDS:
        print('WATCHDOG_MISSED_HEARTBEAT', int(now - previous_success))

    health['last_start_ts'] = now
    health['last_status'] = 'RUNNING'
    health['last_error'] = ''

    queue = [x for x in s['queue'] if x.get('time', 0) >= now - LOOKBACK.total_seconds() and x.get('key') not in s['published']]
    urgent_search = len(queue) <= URGENT_SEARCH_QUEUE_THRESHOLD
    scheduled_search = (not s.get('last_search_ts') or now - float(s.get('last_search_ts', 0)) >= SEARCH_INTERVAL_SECONDS)
    should_search = urgent_search or scheduled_search
    candidates = []
    if should_search:
        print('SEARCH_START', 'reason', 'URGENT_QUEUE' if urgent_search else 'SCHEDULED')
        candidates = collect()
        s['last_search_ts'] = now
    else:
        print('SEARCH_SKIPPED', 'next_in', int(SEARCH_INTERVAL_SECONDS - (now - float(s.get('last_search_ts', 0)))))

    queue_keys = {x.get('key') for x in queue}
    stories = {k: v for k, v in s['stories'].items() if float(v.get('time', 0) or 0) >= now - STORY_LOOKBACK_SECONDS}
    s['stories'] = stories
    recent_stories = list(stories.values())
    s['known'] = {k: v for k, v in s['known'].items() if float(v or 0) >= now - KNOWN_LOOKBACK_SECONDS}

    admission = {'published_key': 0, 'known_recent': 0, 'already_queued': 0, 'story_queue': 0, 'story_history': 0, 'added': 0}
    for x in candidates:
        if x['key'] in s['published']:
            admission['published_key'] += 1; continue
        if x['key'] in queue_keys:
            admission['already_queued'] += 1; continue
        if x['key'] in s['known']:
            admission['known_recent'] += 1; continue
        if any(same_story(x, y) for y in queue):
            admission['story_queue'] += 1; continue
        if any(same_story(x, y) for y in recent_stories):
            admission['story_history'] += 1; continue
        x['tier'] = tier(x)
        x['importance'] = x.get('importance', x.get('score', 0))
        s['known'][x['key']] = now
        queue.append(x); queue_keys.add(x['key']); admission['added'] += 1

    queue = rebalance_queue(queue, now)
    counts = region_counts(queue)
    print('QUEUE_INGEST', 'candidates', len(candidates), 'added', admission['added'], 'queue_total', len(queue), 'world', counts['WORLD'], 'russia', counts['RUSSIA'])

    for x in queue:
        x['tier'] = tier(x)
        x['importance'] = int(x.get('importance', x.get('score', 0)))
        x['editorial_value'] = x.get('editorial_value') or editorial_value(x)
        x['topics'] = x.get('topics') or topic_tags(x)

    queue.sort(key=lambda x: (x.get('importance', x.get('score', 0)), x.get('time', 0)), reverse=True)
    remaining = list(queue)
    published = 0
    last_publish_ts = float(s.get('last_publish_ts', 0) or 0)
    can_publish = not last_publish_ts or now - last_publish_ts >= PUBLISH_INTERVAL_SECONDS

    if not can_publish:
        print('PUBLISH_WAIT', int(PUBLISH_INTERVAL_SECONDS - (now - last_publish_ts)))
    else:
        attempts = 0
        for x in list(queue):
            if attempts >= MAX_ATTEMPTS_PER_RUN:
                break
            if x.get('importance', x.get('score', 0)) < IMPORTANCE_THRESHOLD:
                continue
            attempts += 1
            try:
                post = edit(x, s)
                telegram(post)
                s['published'][x['key']] = int(now)
                s['stories'][x['key']] = {'time': int(now), 'title': x.get('title', ''), 'desc': x.get('desc', ''), 'source': x.get('source', ''), 'region': x.get('region', '')}
                s['publication_regions'].append(x.get('region', 'WORLD'))
                s['publication_regions'] = s['publication_regions'][-REGION_HISTORY_SIZE:]
                s['last_publish_ts'] = now
                published = 1
                remaining.remove(x)
                print('PUBLISHED', x['title'], 'importance', x.get('importance'))
                break
            except Exception as e:
                reason = str(e)[:300]
                x['last_failed_at'] = int(now)
                x['last_failure'] = reason
                x['failure_count'] = int(x.get('failure_count', 0) or 0) + 1
                retry_delay = min(QUEUE_RETRY_MAX_SECONDS, QUEUE_RETRY_BASE_SECONDS * (2 ** max(0, x['failure_count'] - 1)))
                x['next_retry_at'] = int(now + retry_delay)
                print('ITEM_FAILED', x.get('title', ''), reason)

    s['queue'] = rebalance_queue(remaining, now)
    s['published'] = {k: v for k, v in s['published'].items() if v >= cut}
    health['last_run_ts'] = now
    health['last_success_ts'] = now
    health['last_status'] = 'OK'
    health['last_error'] = ''
    health['last_candidates'] = len(candidates)
    health['last_published'] = published
    health['queue_size'] = len(s['queue'])
    save_state(s)
    print('RUN_COMPLETE', 'searched', should_search, 'candidates', len(candidates), 'published', published, 'queue', len(s['queue']))


if __name__ == '__main__':
    main()
