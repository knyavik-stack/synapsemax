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
LOOKBACK = timedelta(hours=6)

MAX_PUBLISH = 1
MIN_SCORE = 9
MAX_QUEUE = 30
TARGET_QUEUE_SIZE = 24
WORLD_TARGET_SHARE = 0.60
RUSSIA_TARGET_SHARE = 0.40
REGION_HISTORY_SIZE = 20
RUSSIA_MIN_QUEUE_SLOTS = 10
QUEUE_RETENTION = timedelta(days=7)
QUEUE_RETRY_BASE_SECONDS = 300
QUEUE_RETRY_MAX_SECONDS = 6 * 3600

JOKE_RATE = 0.80

# Temporary queue counter.
# Set False when Boss requests removal.
SHOW_QUEUE_COUNT = True

HEARTBEAT_MAX_SECONDS = 900
FAILURE_ALERT_THRESHOLD = 3

# Maximum number of queued items attempted in one run.
MAX_ATTEMPTS_PER_RUN = 5

# Maximum editorial regeneration attempts for one item.
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
    ('RUSSIA', 'ИИ искусственный интеллект нейросети Россия технологии'),
    ('RUSSIA', 'Яндекс Сбер VK ИИ продукт технология'),
    ('RUSSIA', 'российские компании внедрение ИИ бизнес автоматизация'),
    ('RUSSIA', 'ИИ применение практика бизнес кейс Россия'),
    ('RUSSIA', 'ИИ финансы промышленность медицина образование логистика Россия'),
    ('RUSSIA', 'ИИ разработка инфраструктура модели агенты Россия'),
    ('RUSSIA', 'ИИ безопасность уязвимость утечка проблемы Россия'),
    ('RUSSIA', 'ИИ робототехника чипы исследования Россия'),
    ('RUSSIA', 'ИИ регулирование закон инвестиции технологии Россия'),
    ('RUSSIA', 'российский ИИ стартап продукт платформа обзор'),
    ('RUSSIA', 'site:yandex.ru/company/news ИИ искусственный интеллект'),
    ('RUSSIA', 'site:sberbank.ru ИИ искусственный интеллект технологии'),
    ('RUSSIA', 'site:rbc.ru ИИ внедрение бизнес технологии'),
    ('RUSSIA', 'site:kommersant.ru ИИ технологии бизнес Россия'),
    ('RUSSIA', 'site:vc.ru ИИ бизнес внедрение автоматизация')
]


QUALITY_TRUSTED = {
    'reuters', 'bloomberg', 'financial times', 'the verge',
    'techcrunch', 'wired', 'mit technology review', 'arstechnica',
    'venturebeat', 'tass', 'interfax', 'рбк', 'коммерсантъ',
    'ведомости', 'forbes'
}

HIGH_IMPACT_TERMS = {
    'launch', 'released', 'release', 'introduces', 'introduced',
    'model', 'agent', 'robot', 'robotics', 'breakthrough',
    'acquisition', 'funding', 'investment', 'billion', 'chip',
    'gpu', 'security', 'breach', 'regulation', 'law',
    'запуст', 'выпуст', 'представ', 'модель', 'агент', 'робот',
    'прорыв', 'инвестиц', 'миллиард', 'поглощ', 'чип', 'утеч',
    'регулир', 'закон'
}

APPLICATION_TERMS = {
    'enterprise', 'business', 'productivity', 'automation',
    'developer', 'coding', 'software', 'platform', 'tool',
    'healthcare', 'education', 'science', 'industrial', 'application',
    'внедрен', 'бизнес', 'автоматизац', 'разработч', 'программ',
    'платформ', 'инструмент', 'здравоохран', 'образован',
    'производств', 'применен'
}


PRACTICAL_IMPLEMENTATION_TERMS = {
    'deployment', 'adoption', 'implementation', 'workflow', 'operations',
    'case study', 'customer', 'revenue', 'cost', 'roi', 'inference',
    'reliability', 'latency', 'architecture', 'integration',
    'внедрен', 'практик', 'кейс', 'выручк', 'затрат', 'окупаем',
    'процесс', 'операц', 'интеграц', 'архитектур', 'инфраструктур',
    'производительност', 'стоимост', 'задержк'
}

RISK_AND_PROBLEM_TERMS = {
    'failure', 'outage', 'incident', 'vulnerability', 'exploit',
    'hallucination', 'privacy', 'security', 'breach', 'misuse',
    'problem', 'risk', 'attack', 'уязвим', 'сбой', 'инцидент',
    'галлюцинац', 'конфиденц', 'безопас', 'утеч', 'проблем',
    'риск', 'атака', 'вред'
}

EXCLUSIVITY_TERMS = {
    'first', 'exclusive', 'unprecedented', 'largest', 'record',
    'major', 'billion', 'first-ever', 'впервые', 'эксклюзив',
    'крупнейш', 'рекорд', 'миллиард', 'первый'
}

LOW_SIGNAL_TERMS = {
    'opinion', 'sponsored', 'advertisement', 'coupon',
    'horoscope', 'giveaway', 'stocks', 'stock price',
    'мнение читателей', 'реклама', 'промокод', 'гороскоп'
}

# A query match alone is not enough: Google News can return adjacent
# technology/business stories that contain one broad query term but are not
# substantively about AI or an allowed AI-adjacent technology.
AI_RELEVANCE_TOKENS = {
    'ai', 'llm', 'openai', 'anthropic', 'claude', 'gemini', 'deepmind',
    'copilot', 'chatgpt', 'nvidia', 'gpu', 'ии'
}

AI_RELEVANCE_STEMS = (
    'artificial intelligence', 'machine learning', 'generative ai',
    'language model', 'neural network', 'искусственн интеллект',
    'машинн обуч', 'генератив', 'нейросет', 'нейронн',
    'робот', 'автономн', 'агент', 'полупровод', 'чип'
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
    'закон': 6,
    'регулир': 5,
    'миллиард': 5,
    'запуст': 5,
    'выпуст': 5,
    'агент': 5,
    'модель': 4,
    'нейросет': 4,
    'исследован': 3
}


TRUSTED = {
    'reuters',
    'bloomberg',
    'financial times',
    'the verge',
    'techcrunch',
    'tass',
    'interfax',
    'рбк',
    'коммерсантъ',
    'ведомости'
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
            r'[^a-zа-яё0-9]+',
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

    if s >= 14:
        return 'S'

    if s >= 9:
        return 'A'

    return 'B'


def score(x):
    blob = x['title'] + ' ' + x['desc'] + ' ' + x['source']
    blob = blob.lower()
    age = (datetime.now(timezone.utc).timestamp() - x['time']) / 3600
    if age < -0.5 or age > LOOKBACK.total_seconds() / 3600:
        return 0

    base = sum(v for k, v in WEIGHTS.items() if k in blob)
    impact = sum(2 for term in HIGH_IMPACT_TERMS if term in blob)
    application = sum(1 for term in APPLICATION_TERMS if term in blob)
    source = x.get('source', '').lower().strip()
    trust = 4 if source in QUALITY_TRUSTED else (2 if source in TRUSTED else 0)
    freshness = 4 if age <= 1 else 3 if age <= 3 else 2 if age <= 6 else 1 if age <= 9 else 0
    penalty = 6 if any(term in blob for term in LOW_SIGNAL_TERMS) else 0
    n = base + min(8, impact) + min(5, application) + trust + freshness - penalty
    return max(0, min(n, 40))


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
        'models': ('model', 'claude', 'gemini', 'gpt', 'модель'),
        'agents': ('agent', 'agents', 'агент'),
        'robotics': ('robot', 'robotics', 'робот'),
        'chips': ('chip', 'gpu', 'nvidia', 'чип', 'полупровод'),
        'research': ('research', 'breakthrough', 'исследован', 'прорыв'),
        'business': ('enterprise', 'business', 'investment', 'внедрен', 'бизнес', 'инвестиц'),
        'applications': ('application', 'automation', 'healthcare', 'education', 'применен', 'автоматизац', 'здравоохран', 'образован'),
        'tools': ('tool', 'platform', 'software', 'feature', 'инструмент', 'платформ', 'программ'),
        'security_regulation': ('security', 'breach', 'regulation', 'law', 'утеч', 'безопас', 'регулир', 'закон')
    }
    return sorted(tag for tag, terms in groups.items() if any(term in blob for term in terms))


def ai_relevant(x):
    text = normalize(x.get('title', '') + ' ' + x.get('desc', ''))
    tokens = set(text.split())

    if tokens & AI_RELEVANCE_TOKENS:
        return True

    return any(stem in text for stem in AI_RELEVANCE_STEMS)


def candidate_quality(x):
    if x.get('score', 0) < MIN_SCORE:
        return False

    if not ai_relevant(x):
        return False

    x['editorial_value'] = editorial_value(x)
    x['topics'] = topic_tags(x)
    return x['editorial_value'] >= 14



STORY_LOOKBACK_SECONDS = 24 * 3600
STORY_TITLE_THRESHOLD = 0.58
STORY_BODY_THRESHOLD = 0.28
STORY_COMBINED_THRESHOLD = 0.44

# Common Russian/English glue words add noise to semantic comparison.
STORY_STOPWORDS = {
    'это', 'как', 'что', 'для', 'при', 'после', 'перед', 'через',
    'новый', 'новая', 'новое', 'новые', 'который', 'которая', 'которые',
    'может', 'могут', 'более', 'также', 'уже', 'ещё', 'еще', 'свой',
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
    # often change word forms (представил/представила, России/российский),
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
            'yandex', 'сбер', 'sber', 'россия', 'россии',
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
        if x['score'] < MIN_SCORE:
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
                    'Ты профессиональный редактор '
                    'русского Telegram-канала об AI. '
                    'Всегда отвечай только валидным JSON.'
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
                    'Ты профессиональный редактор '
                    'русского Telegram-канала об AI. '
                    'Всегда отвечай только валидным JSON.'
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
            r'[А-Яа-яЁё]',
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
            'таким образом',
            'в свою очередь',
            'данное событие',
            'важный шаг',
            'что это значит:'
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
        'нужна'
        if want_joke
        else 'не нужна'
    )

    retry_instruction = ''

    if retry:
        retry_instruction = (
            '\nПредыдущая версия не прошла '
            'редакторскую проверку. '
            'Сделай текст проще, естественнее '
            'и полностью на русском языке. '
            'Не повторяй проблемную конструкцию.'
        )

        if previous_error:
            retry_instruction += (
                '\nПричина предыдущего отказа: '
                + previous_error[:180]
            )

    return (
        'Подготовь готовый Telegram-пост '
        'ЦЕЛИКОМ на естественном русском языке. '
        'Не делай дословный перевод: перескажи '
        'человеческим языком. '
        'Обязательно раскрой: что произошло, '
        'кто участники, почему это важно '
        'и практический вывод. '
        'Не выдумывай факты. '
        'Весь результат на русском; названия компаний, '
        'продуктов и моделей можно оставлять '
        'в оригинальном написании.\n'
        'Юмор: стремимся добавлять лёгкую человеческую '
        'шутку примерно в 80%% подходящих публикаций. '
        'В этой публикации шутка %s. '
        'Если тема про безопасность, регулирование, '
        'закон, утечку, аварию, вред или серьёзный '
        'инцидент — шутка запрещена независимо '
        'от этого флага. '
        'Не используй речевые штампы ИИ. '
        'Не используй канцелярит. '
        'Не начинай текст с шаблонных фраз. '
        'Верни JSON строго с полями '
        'title, body, meaning, joke. '
        'joke может быть пустой строкой.\n'
        '%s'
        '\n'
        'Источник: %s\n'
        'Заголовок: %s\n'
        'Описание: %s'
    ) % (
        joke_instruction,
        retry_instruction,
        x['source'],
        x['title'],
        x['desc']
    )


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
                    'утеч',
                    'безопас',
                    'регулир',
                    'закон',
                    'авар'
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
                '🇷🇺'
                if x['region'] == 'RUSSIA'
                else '🌍'
            )

            dt = datetime.fromtimestamp(
                x['time'],
                timezone.utc
            ).astimezone(
                timezone(timedelta(hours=3))
            )

            jb = (
                '\n\n😏 '
                + esc(joke)
                if joke
                else ''
            )

            post = (
                f'{flag} '
                f'<b>{esc(title)}</b>\n\n'
                f'{esc(body)}\n\n'
                f'<b>Вывод:</b> '
                f'{esc(meaning)}'
                f'{jb}\n\n'
                f'📰 {esc(x["source"] or "Источник")} '
                f'· {dt:%d.%m.%Y %H:%M} МСК\n'
                f'🔗 <a href="'
                f'{html.escape(x["link"], quote=True)}'
                f'">Подробнее</a>'
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
    dropped_expired = 0
    dropped_quality = 0

    for x in items:
        if x.get('time', 0) < now - LOOKBACK.total_seconds():
            dropped_expired += 1
            continue

        # Revalidate durable state on every cycle. This prevents legacy
        # low-score or off-topic items from surviving forever after scoring
        # rules are tightened.
        if not candidate_quality(x):
            dropped_quality += 1
            continue

        fresh.append(x)

    if dropped_expired or dropped_quality:
        print(
            'QUEUE_REBALANCE_FILTER',
            'expired', dropped_expired,
            'quality', dropped_quality,
            'kept', len(fresh)
        )

    fresh.sort(key=lambda x: (
        x.get('editorial_value', x.get('score', 0)),
        x.get('score', 0), x.get('time', 0)
    ), reverse=True)

    # Defensive second-pass event dedup. Collection can receive the same event
    # through several Google News queries, and a queue restored from state may
    # predate the latest dedup rules.
    unique = []
    dropped_story = 0
    for x in fresh:
        if any(same_story(x, y) for y in unique):
            dropped_story += 1
            print('QUEUE_REBALANCE_DUPLICATE', x.get('title', '')[:140])
            continue
        unique.append(x)

    if dropped_story:
        print('QUEUE_REBALANCE_STORY_DEDUP', dropped_story)

    fresh = unique

    target_ru = max(RUSSIA_MIN_QUEUE_SLOTS, round(TARGET_QUEUE_SIZE * RUSSIA_TARGET_SHARE))
    target_world = TARGET_QUEUE_SIZE - target_ru
    ru = [x for x in fresh if x.get('region') == 'RUSSIA']
    world = [x for x in fresh if x.get('region') != 'RUSSIA']
    selected = ru[:target_ru] + world[:target_world]
    selected_keys = {x.get('key') for x in selected}

    for x in fresh:
        if len(selected) >= TARGET_QUEUE_SIZE:
            break
        if x.get('key') not in selected_keys:
            selected.append(x)
            selected_keys.add(x.get('key'))

    selected = selected[:MAX_QUEUE]
    selected.sort(key=lambda x: (
        x.get('editorial_value', x.get('score', 0)),
        x.get('score', 0), x.get('time', 0)
    ), reverse=True)
    return selected


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

    previous_success = float(
        health.get(
            'last_success_ts',
            0
        ) or 0
    )

    if (
        previous_success
        and now - previous_success
        > HEARTBEAT_MAX_SECONDS
    ):
        print(
            'WATCHDOG_MISSED_HEARTBEAT',
            int(
                now - previous_success
            )
        )

    health['last_start_ts'] = now
    health['last_status'] = 'RUNNING'
    health['last_error'] = ''

    candidates = collect()

    queue = [
        x for x in s['queue']
        if (
            x.get('time', 0) >= now - LOOKBACK.total_seconds()
            and x.get('key') not in s['published']
        )
    ]
    queue_keys = {x.get('key') for x in queue}

    stories = {
        k: v for k, v in s['stories'].items()
        if float(v.get('time', 0) or 0) >= now - STORY_LOOKBACK_SECONDS
    }
    s['stories'] = stories
    recent_stories = list(stories.values())

    s['known'] = {
        k: v for k, v in s['known'].items()
        if float(v or 0) >= now - KNOWN_LOOKBACK_SECONDS
    }

    admission = {
        'published_key': 0, 'known_recent': 0, 'already_queued': 0,
        'story_queue': 0, 'story_history': 0, 'added': 0
    }

    for x in candidates:
        if x['key'] in s['published']:
            admission['published_key'] += 1
            continue
        if x['key'] in queue_keys:
            admission['already_queued'] += 1
            continue
        if x['key'] in s['known']:
            admission['known_recent'] += 1
            continue
        if any(same_story(x, y) for y in queue):
            admission['story_queue'] += 1
            print('STORY_DEDUP_QUEUE', x['title'])
            continue
        if any(same_story(x, y) for y in recent_stories):
            admission['story_history'] += 1
            print('STORY_DEDUP_HISTORY', x['title'])
            continue
        x['tier'] = tier(x)
        s['known'][x['key']] = now
        queue.append(x)
        queue_keys.add(x['key'])
        admission['added'] += 1

    before_rebalance = len(queue)
    queue = rebalance_queue(queue, now)
    counts = region_counts(queue)

    print('QUEUE_INGEST', 'candidates', len(candidates),
          'added', admission['added'],
          'published_key', admission['published_key'],
          'known_recent', admission['known_recent'],
          'already_queued', admission['already_queued'],
          'story_queue', admission['story_queue'],
          'story_history', admission['story_history'],
          'before_rebalance', before_rebalance,
          'queue_total', len(queue),
          'world', counts['WORLD'], 'russia', counts['RUSSIA'])

    for x in queue:
        x['tier'] = x.get('tier') or tier(x)
        x['editorial_value'] = x.get('editorial_value') or editorial_value(x)
        x['topics'] = x.get('topics') or topic_tags(x)

    queue.sort(key=lambda x: (
        publication_priority(s, x), x.get('score', 0), x.get('time', 0)
    ), reverse=True)

    published = 0

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Never use "break" on a failed item.
    #
    # A bad candidate must not block the queue.
    # --------------------------------------------------------

    remaining = list(queue)

    attempts = 0

    for x in list(queue):

        if attempts >= MAX_ATTEMPTS_PER_RUN:
            print(
                'QUEUE_ATTEMPT_LIMIT',
                MAX_ATTEMPTS_PER_RUN
            )
            break

        if x.get('score', 0) < MIN_SCORE:
            continue

        next_retry_at = float(x.get('next_retry_at', 0) or 0)
        if next_retry_at > now:
            print('QUEUE_RETRY_WAIT', x['title'], int(next_retry_at - now))
            continue

        attempts += 1

        try:
            post = edit(
                x,
                s
            )

            # Current queue count before removing item.
            queue_after_send = max(
                0,
                len(remaining) - 1
            )

            if SHOW_QUEUE_COUNT:
                post += (
                    '\n\n'
                    '📊 В очереди: '
                    f'{queue_after_send} новостей'
                )

            telegram(post)

            s['published'][
                x['key']
            ] = int(now)

            # Persist the event representation used for semantic dedup.
            # Keep it for 72h: enough to suppress recycled/paraphrased stories
            # without permanently blocking legitimate follow-up developments.
            s['stories'][
                x['key']
            ] = {
                'time': int(now),
                'title': x.get('title', ''),
                'desc': x.get('desc', ''),
                'source': x.get('source', ''),
                'region': x.get('region', '')
            }

            published = 1

            s['publication_regions'].append(
                x.get('region', 'WORLD')
            )
            s['publication_regions'] = (
                s['publication_regions'][-REGION_HISTORY_SIZE:]
            )

            # Remove exactly the successfully
            # published item.
            if x in remaining:
                remaining.remove(x)

            print(
                'PUBLISHED',
                x['title']
            )

            print(
                'QUEUE_AFTER',
                queue_after_send
            )

            break

        except Exception as e:

            reason = str(e)[:300]

            print(
                'ITEM_FAILED',
                x['title'],
                reason
            )

            # ------------------------------------------------
            # Critical queue behavior:
            #
            # Remove failed item from the current working
            # list so the next candidate can be attempted.
            #
            # The item is NOT published and therefore remains
            # durable in the queue for a future run.
            # ------------------------------------------------

            # Keep failed item in the durable queue. Continue to another item
            # this cycle, but do not silently drop the failed story.
            x['last_failed_at'] = int(now)
            x['last_failure'] = reason
            x['failure_count'] = int(x.get('failure_count', 0) or 0) + 1
            retry_delay = min(
                QUEUE_RETRY_MAX_SECONDS,
                QUEUE_RETRY_BASE_SECONDS * (2 ** max(0, x['failure_count'] - 1))
            )
            x['next_retry_at'] = int(now + retry_delay)
            print('QUEUE_RETRY_SCHEDULED', x['title'], retry_delay)

            continue

    s['queue'] = rebalance_queue(
        remaining,
        now
    )

    s['published'] = {
        k: v
        for k, v
        in s['published'].items()
        if v >= cut
    }

    s['known'] = {
        k: v
        for k, v in s['known'].items()
        if float(v or 0) >= now - KNOWN_LOOKBACK_SECONDS
    }

    s['stories'] = {
        k: v
        for k, v
        in s['stories'].items()
        if float(v.get('time', 0) or 0) >= now - STORY_LOOKBACK_SECONDS
    }

    s['last_run'] = (
        datetime.now(
            timezone.utc
        ).isoformat()
    )

    s['last_published'] = published

    # --------------------------------------------------------
    # Heartbeat semantics
    # --------------------------------------------------------

    if published > 0:

        health['last_status'] = 'OK'
        health['consecutive_failures'] = 0
        health['last_error'] = ''
        health['last_success_ts'] = now

    elif not candidates:

        health['last_status'] = 'OK'
        health['consecutive_failures'] = 0
        health['last_error'] = ''
        health['last_success_ts'] = now

    else:

        health['last_status'] = (
            'FAILED_NO_PUBLISH'
        )

        health['consecutive_failures'] = (
            int(
                health.get(
                    'consecutive_failures',
                    0
                )
            ) + 1
        )

        health['last_error'] = (
            'candidates exist but '
            'Telegram received zero posts'
        )

    save_state(s)

    print(
        'HEARTBEAT',
        health['last_status'],
        'queue',
        len(s['queue']),
        'failures',
        health[
            'consecutive_failures'
        ]
    )

    print(
        json.dumps(
            {
                'candidates': len(
                    candidates
                ),
                'published': published,
                'queue': len(
                    s['queue']
                ),
                'attempts': attempts,
                'world_queue': region_counts(s['queue'])['WORLD'],
                'russia_queue': region_counts(s['queue'])['RUSSIA']
            },
            ensure_ascii=False
        )
    )


if __name__ == '__main__':
    main()
