import os
import re
import json
import time
import hashlib
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

LOOKBACK = timedelta(hours=24)

MAX_PUBLISH = 1
MIN_SCORE = 5
MAX_QUEUE = 100

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
    (
        'WORLD',
        'AI artificial intelligence OpenAI Anthropic Google DeepMind '
        'Microsoft Meta Nvidia'
    ),
    (
        'WORLD',
        'AI model launch release agent robotics chips regulation '
        'safety research'
    ),
    (
        'WORLD',
        'artificial intelligence breakthrough investment acquisition '
        'security AI agents'
    ),
    (
        'RUSSIA',
        'ИИ искусственный интеллект нейросети Россия Яндекс Сбер VK'
    ),
    (
        'RUSSIA',
        'ИИ нейросети регулирование закон инвестиции технологии Россия'
    )
]


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
    blob = (
        x['title']
        + ' '
        + x['desc']
        + ' '
        + x['source']
    ).lower()

    n = sum(
        v
        for k, v in WEIGHTS.items()
        if k in blob
    )

    age = (
        datetime.now(timezone.utc).timestamp()
        - x['time']
    ) / 3600

    if x['source'].lower().strip() in TRUSTED:
        n += 3

    if age < 2:
        n += 2

    elif age > 12:
        n -= 1

    return max(0, min(n, 30))


def similarity(a, b):
    A = {
        w
        for w in normalize(a).split()
        if len(w) > 2
    }

    B = {
        w
        for w in normalize(b).split()
        if len(w) > 2
    }

    if not A or not B:
        return 0

    return len(A & B) / len(A | B)


def collect():
    all_items = []

    for region, q in QUERIES:

        try:
            started = time.time()

            for x in rss(region, q):
                x['score'] = score(x)
                x['key'] = key(x)
                all_items.append(x)

            if time.time() - started > 15:
                raise TimeoutError(
                    'FEED_BUDGET_EXCEEDED'
                )

        except Exception as e:
            print(
                'FEED_ERROR',
                region,
                str(e)[:180]
            )

    all_items.sort(
        key=lambda x: (
            x['score'],
            x['time']
        ),
        reverse=True
    )

    out = []

    for x in all_items:

        if x['score'] < MIN_SCORE:
            continue

        if any(
            similarity(
                x['title'],
                y['title']
            ) >= 0.72
            for y in out
        ):
            continue

        out.append(x)

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

    queue = s['queue']

    queue_keys = {
        x.get('key')
        for x in queue
    }

    for x in candidates:

        if (
            x['key']
            not in s['published']
            and x['key']
            not in s['known']
            and x['key']
            not in queue_keys
        ):
            x['tier'] = tier(x)

            s['known'][
                x['key']
            ] = now

            queue.append(x)
            queue_keys.add(
                x['key']
            )

    # Remove expired/published items.
    queue = [
        x
        for x in queue
        if (
            x.get('time', 0)
            >= now
            - LOOKBACK.total_seconds()
            and x.get('key')
            not in s['published']
        )
    ]

    for x in queue:
        x['tier'] = (
            x.get('tier')
            or tier(x)
        )

    tier_rank = {
        'S': 3,
        'A': 2,
        'B': 1
    }

    queue.sort(
        key=lambda x: (
            tier_rank.get(
                x.get('tier', 'B'),
                1
            ),
            x.get('score', 0),
            x.get('time', 0)
        ),
        reverse=True
    )

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

            published = 1

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

            if x in remaining:
                remaining.remove(x)

            # Save diagnostic information.
            x['last_failed_at'] = int(now)
            x['last_failure'] = reason

            continue

    s['queue'] = (
        remaining[:MAX_QUEUE]
    )

    s['published'] = {
        k: v
        for k, v
        in s['published'].items()
        if v >= cut
    }

    s['known'] = {
        k: v
        for k, v
        in s['known'].items()
        if v >= cut
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
                'attempts': attempts
            },
            ensure_ascii=False
        )
    )


if __name__ == '__main__':
    main()
````
