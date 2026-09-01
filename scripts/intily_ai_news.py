import os, re, json, time, hashlib, html, urllib.parse, urllib.request, random
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

LOOKBACK=timedelta(hours=24); MAX_PUBLISH=3; MIN_SCORE=5; MAX_QUEUE=100; JOKE_RATE=0.8
SHOW_QUEUE_COUNT=True  # TEMP_QUEUE_COUNT: remove when Boss requests removal
HEARTBEAT_MAX_SECONDS=900
FAILURE_ALERT_THRESHOLD=3
STATE_FILE=os.environ.get('STATE_FILE','data/intily-ai-news-state.json')
GROQ_MODEL='llama-3.1-8b-instant'; GROQ_URL='https://api.groq.com/openai/v1/chat/completions'
OPENAI_MODEL='gpt-4o-mini'; OPENAI_URL='https://api.openai.com/v1/chat/completions'
GEMINI_MODEL='gemini-3.1-flash-lite'; GEMINI_URL='https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent'
TG_URL='https://api.telegram.org/bot{}/sendMessage'
QUERIES=[('WORLD','AI artificial intelligence OpenAI Anthropic Google DeepMind Microsoft Meta Nvidia'),('WORLD','AI model launch release agent robotics chips regulation safety research'),('WORLD','artificial intelligence breakthrough investment acquisition security AI agents'),('RUSSIA','ИИ искусственный интеллект нейросети Россия Яндекс Сбер VK'),('RUSSIA','ИИ нейросети регулирование закон инвестиции технологии Россия')]
WEIGHTS={'launch':5,'release':5,'model':4,'agent':5,'breakthrough':7,'research':3,'security':5,'safety':5,'regulation':5,'law':5,'investment':4,'billion':5,'acquisition':5,'chip':4,'gpu':4,'openai':4,'anthropic':4,'google':3,'deepmind':4,'nvidia':4,'microsoft':3,'yandex':4,'sber':4,'закон':6,'регулир':5,'миллиард':5,'запуст':5,'выпуст':5,'агент':5,'модель':4,'нейросет':4,'исследован':3}
TRUSTED={'reuters','bloomberg','financial times','the verge','techcrunch','tass','interfax','рбк','коммерсантъ','ведомости'}


def load_state():
    os.makedirs(os.path.dirname(STATE_FILE),exist_ok=True)
    try:
        with open(STATE_FILE,encoding='utf-8') as f:s=json.load(f)
    except Exception:s={}
    for k,v in [('published',{}),('known',{}),('queue',[]),('health',{})]:
        if not isinstance(s.get(k),dict if k!='queue' else list): s[k]={} if k!='queue' else []
    return s

def save_state(s):
    with open(STATE_FILE,'w',encoding='utf-8') as f:json.dump(s,f,ensure_ascii=False,indent=2)

def get(url,timeout=12,headers=None):
    req=urllib.request.Request(url,headers=headers or {'User-Agent':'IntilyAI-News/5.1'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return r.read()

def rss(region,q):
    cutoff=datetime.now(timezone.utc)-LOOKBACK
    p=urllib.parse.urlencode({'q':f'{q} after:{cutoff.date().isoformat()}','hl':'ru-RU','gl':'RU' if region=='RUSSIA' else 'US','ceid':'RU:ru' if region=='RUSSIA' else 'US:en'})
    root=ET.fromstring(get('https://news.google.com/rss/search?'+p))
    out=[]
    for it in root.findall('.//item'):
        title=html.unescape(it.findtext('title') or '').strip(); link=(it.findtext('link') or '').strip(); desc=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',html.unescape(it.findtext('description') or ''))).strip(); source=(it.findtext('source') or '').strip(); raw=it.findtext('pubDate') or ''
        try:dt=parsedate_to_datetime(raw); dt=dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:continue
        if not title or not link or dt<cutoff:continue
        out.append({'region':region,'title':title,'link':link,'desc':desc,'source':source,'time':dt.timestamp()})
    return out

def normalize(t):return ' '.join(re.sub(r'[^a-zа-яё0-9]+',' ',t.lower()).split())
def key(x):return hashlib.sha256((normalize(x['title'])+'|'+normalize(x['source'])).encode()).hexdigest()
def tier(x):
    s=x.get('score',0)
    if s>=14:return 'S'
    if s>=9:return 'A'
    return 'B'

def score(x):
    b=(x['title']+' '+x['desc']+' '+x['source']).lower(); n=sum(v for k,v in WEIGHTS.items() if k in b); age=(datetime.now(timezone.utc).timestamp()-x['time'])/3600
    if x['source'].lower().strip() in TRUSTED:n+=3
    if age<2:n+=2
    elif age>12:n-=1
    return max(0,min(n,30))
def similarity(a,b):
    A=set(w for w in normalize(a).split() if len(w)>2);B=set(w for w in normalize(b).split() if len(w)>2)
    return len(A&B)/len(A|B) if A and B else 0

def collect():
    all=[]
    for region,q in QUERIES:
        try:
            started=time.time()
            for x in rss(region,q):x['score']=score(x);x['key']=key(x);all.append(x)
            if time.time()-started>15: raise TimeoutError('FEED_BUDGET_EXCEEDED')
        except Exception as e:print('FEED_ERROR',region,str(e)[:180])
    all.sort(key=lambda x:(x['score'],x['time']),reverse=True);out=[]
    for x in all:
        if x['score']<MIN_SCORE:continue
        if any(similarity(x['title'],y['title'])>=.72 for y in out):continue
        out.append(x)
    return out

def chat(url,model,token,prompt,provider):
    body=json.dumps({'model':model,'messages':[{'role':'system','content':'Ты профессиональный редактор русского Telegram-канала об AI. Всегда отвечай только валидным JSON.'},{'role':'user','content':prompt}],'temperature':0.25,'max_tokens':900}).encode()
    last=None
    for attempt in range(2):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}),timeout=20);d=json.loads(r.read().decode());return d['choices'][0]['message']['content']
        except urllib.error.HTTPError as e:
            raw=e.read().decode('utf-8','replace');last=RuntimeError(f'{provider}_HTTP_{e.code}: {raw[:300]}')
            if e.code not in (429,500,502,503,504):raise last
            retry=e.headers.get('Retry-After');wait=min(int(retry),60) if retry and retry.isdigit() else min(2**attempt*3,30);print(provider+'_RETRY',e.code,wait);time.sleep(wait)
        except Exception as e:last=e;time.sleep(min(2**attempt*3,15))
    raise last or RuntimeError(provider+'_FAILED')


def gemini_chat(prompt,token):
    body=json.dumps({'contents':[{'parts':[{'text':'Ты профессиональный редактор русского Telegram-канала об AI. Всегда отвечай только валидным JSON.\n'+prompt}]}],'generationConfig':{'temperature':0.25,'maxOutputTokens':900,'responseMimeType':'application/json'}}).encode()
    req=urllib.request.Request(GEMINI_URL+'?key='+urllib.parse.quote(token),data=body,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r:
        d=json.loads(r.read().decode())
    return d['candidates'][0]['content']['parts'][0]['text']


def gemini_chat(prompt,token):
    body=json.dumps({'systemInstruction':{'parts':[{'text':'Ты профессиональный редактор русского Telegram-канала об AI. Всегда отвечай только валидным JSON.'}]},'contents':[{'role':'user','parts':[{'text':prompt}]}],'generationConfig':{'temperature':0.25,'maxOutputTokens':900,'responseMimeType':'application/json'}}).encode()
    url=GEMINI_URL+'?key='+urllib.parse.quote(token,safe='')
    r=urllib.request.urlopen(urllib.request.Request(url,data=body,headers={'Content-Type':'application/json'}),timeout=20)
    d=json.loads(r.read().decode())
    return d['candidates'][0]['content']['parts'][0]['text']

def ai(prompt):
    errors=[]
    providers=[('GROQ',GROQ_URL,GROQ_MODEL,os.environ.get('GROQ_API_KEY')),('OPENAI',OPENAI_URL,OPENAI_MODEL,os.environ.get('OPENAI_API_KEY'))]
    for name,url,model,token in providers:
        if not token:
            print(name+'_SKIPPED_NO_KEY')
            continue
        try:
            print('AI_PROVIDER_ATTEMPT',name)
            result=gemini_chat(prompt,token) if name=='GEMINI' else chat(url,model,token,prompt,name)
            if result and len(result.strip())>20:
                print('AI_PROVIDER_OK',name)
                return result
            raise RuntimeError('EMPTY_RESPONSE')
        except Exception as ex:
            errors.append(name+': '+str(ex)[:180])
            print('AI_PROVIDER_FAILED',name,str(ex)[:180])
    g=os.environ.get('GEMINI_API_KEY')
    if g:
        try:
            print('AI_PROVIDER_ATTEMPT','GEMINI')
            result=gemini_chat(prompt,g)
            if result and len(result.strip())>20:
                print('AI_PROVIDER_OK','GEMINI')
                return result
            raise RuntimeError('EMPTY_RESPONSE')
        except Exception as ex:
            errors.append('GEMINI: '+str(ex)[:180]);print('AI_PROVIDER_FAILED','GEMINI',str(ex)[:180])
    else:
        print('GEMINI_SKIPPED_NO_KEY')
    raise RuntimeError('AI_PROVIDERS_UNAVAILABLE | '+' | '.join(errors))

def russian_ok(text):
    clean=re.sub(r'https?://\S+|<[^>]+>',' ',text); c=len(re.findall(r'[А-Яа-яЁё]',clean)); l=len(re.findall(r'[A-Za-z]',clean)); words=len(clean.split())
    return c>=40 and c>=l*0.8 and words>=15

def forbidden_style(text):
    low=text.lower(); return any(x in low for x in ('таким образом','в свою очередь','данное событие','важный шаг','что это значит:'))

def edit(x):
    want_joke=(random.random()<JOKE_RATE)
    joke_instruction=('нужна' if want_joke else 'не нужна')
    prompt=('Подготовь готовый Telegram-пост ЦЕЛИКОМ на естественном русском языке. Не делай дословный перевод: перескажи человеческим языком. Обязательно раскрой: что произошло, кто участники, почему это важно и практический вывод. Не выдумывай факты. Весь результат на русском; названия компаний, продуктов и моделей можно оставлять в оригинальном написании.\n'
             'Юмор: стремимся добавлять лёгкую человеческую шутку примерно в 80%% подходящих публикаций. В этой публикации шутка %s. Если тема про безопасность, регулирование, закон, утечку, аварию, вред или серьёзный инцидент — шутка запрещена независимо от этого флага. Не используй речевые штампы ИИ. Верни JSON строго с полями title, body, meaning, joke. joke может быть пустой строкой.\n'
             'Источник: %s\nЗаголовок: %s\nОписание: %s') % (joke_instruction,x['source'],x['title'],x['desc'])
    try:raw=ai(prompt);raw=re.sub(r'^```(?:json)?|```$','',raw.strip(),flags=re.I|re.M);j=json.loads(raw)
    except Exception as e:print('AI_EDITOR_FAILED',str(e)[:200]);raise
    title=str(j.get('title','')).strip();body=str(j.get('body','')).strip();meaning=str(j.get('meaning','')).strip();joke=str(j.get('joke','')).strip()
    full=' '.join([title,body,meaning,joke])
    if not title or not body or not meaning or not russian_ok(full) or forbidden_style(full):raise RuntimeError('RU_QA_FAILED')
    sensitive=any(k in (x['title']+' '+x['desc']).lower() for k in ('security','safety','regulation','law','breach','утеч','безопас','регулир','закон','авар'))
    if sensitive:joke=''
    elif want_joke and not joke: raise RuntimeError('JOKE_QA_FAILED')
    elif not want_joke: joke=''
    x['tier']=tier(x)
    esc=lambda s:html.escape(str(s),quote=True)
    flag='🇷🇺' if x['region']=='RUSSIA' else '🌍';dt=datetime.fromtimestamp(x['time'],timezone.utc).astimezone(timezone(timedelta(hours=3)))
    jb=('\n\n😏 '+esc(joke)) if joke else ''
    return f'{flag} <b>{esc(title)}</b>\n\n{esc(body)}\n\n<b>Вывод:</b> {esc(meaning)}{jb}\n\n📰 {esc(x["source"] or "Источник")} · {dt:%d.%m.%Y %H:%M} МСК\n🔗 <a href="{html.escape(x["link"],quote=True)}">Подробнее</a>'

def telegram(text):
    token=os.environ['TELEGRAM_BOT_TOKEN'];chat_id=os.environ.get('TELEGRAM_CHAT_ID','@intily');payload=json.dumps({'chat_id':chat_id,'text':text,'parse_mode':'HTML','disable_web_page_preview':True}).encode();last=None
    for attempt in range(3):
        try:
            r=urllib.request.urlopen(urllib.request.Request(TG_URL.format(token),data=payload,headers={'Content-Type':'application/json'}),timeout=15);d=json.loads(r.read().decode())
            if d.get('ok'):print('TELEGRAM_SENT',d.get('result',{}).get('message_id'));return
            last=RuntimeError(str(d))
        except urllib.error.HTTPError as e:
            raw=e.read().decode('utf-8','replace');last=RuntimeError(raw);wait=min(15,2**attempt*2);time.sleep(wait)
        except Exception as e:last=e;time.sleep(min(8,2**attempt*2))
    raise last or RuntimeError('TELEGRAM_FAILED')

def main():
    s=load_state();now=time.time();cut=now-30*86400
    health=s.setdefault('health',{})
    prev=float(health.get('last_success_ts',0) or 0)
    if prev and now-prev>HEARTBEAT_MAX_SECONDS:
        print('WATCHDOG_MISSED_HEARTBEAT',int(now-prev))
    health['last_start_ts']=now
    health['last_status']='RUNNING'
    health['last_error']=''
    candidates=collect();q=s['queue'];qkeys={x.get('key') for x in q}
    for x in candidates:
        if x['key'] not in s['published'] and x['key'] not in s['known'] and x['key'] not in qkeys:
            x['tier']=tier(x); s['known'][x['key']]=now; q.append(x); qkeys.add(x['key'])
    q=[x for x in q if x.get('time',0)>=now-LOOKBACK.total_seconds() and x.get('key') not in s['published']]
    for x in q: x['tier']=x.get('tier') or tier(x)
    tier_rank={'S':3,'A':2,'B':1}
    q.sort(key=lambda x:(tier_rank.get(x.get('tier','B'),1),x.get('score',0),x.get('time',0)),reverse=True)
    published=0;remaining=list(q)
    # One AI edit + one Telegram delivery per 5-minute cycle keeps the cycle bounded.
    for idx,x in enumerate(q):
        if x.get('score',0)<MIN_SCORE: continue
        try:
            post=edit(x)
            # TEMP_QUEUE_COUNT: remove this block when Boss requests removal.
            queue_after_send=max(0,len(remaining)-1)
            if SHOW_QUEUE_COUNT: post += f'\n\n\U0001f4ca \u0412 \u043e\u0447\u0435\u0440\u0435\u0434\u0438: {queue_after_send} \u043d\u043e\u0432\u043e\u0441\u0442\u0435\u0439'
            telegram(post);s['published'][x['key']]=int(now);published=1
            remaining.pop(idx);print('PUBLISHED',x['title'],'QUEUE_AFTER',queue_after_send);break
        except Exception as e:
            print('ITEM_FAILED',x['title'],str(e)[:240])
            # Keep failed item in durable queue; try it again on a later cycle.
            break
    s['queue']=remaining[:MAX_QUEUE]
    s['published']={k:v for k,v in s['published'].items() if v>=cut};s['known']={k:v for k,v in s['known'].items() if v>=cut};s['last_run']=datetime.now(timezone.utc).isoformat();s['last_published']=published
    health['last_success_ts']=now
    health['last_status']='OK' if (not candidates or published>0) else 'FAILED_NO_PUBLISH'
    if health['last_status']=='FAILED_NO_PUBLISH':
        health['consecutive_failures']=int(health.get('consecutive_failures',0))+1
        health['last_error']='candidates exist but Telegram received zero posts'
    else:
        health['consecutive_failures']=0;health['last_error']=''
    save_state(s)
    print('HEARTBEAT',health['last_status'],'queue',len(s['queue']),'failures',health['consecutive_failures'])
    print(json.dumps({'candidates':len(candidates),'published':published,'queue':len(s['queue'])},ensure_ascii=False))
    if candidates and published==0:raise RuntimeError('NO_PUBLISH: candidates exist but Telegram received zero posts')

if __name__=='__main__':main()
