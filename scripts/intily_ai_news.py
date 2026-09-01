import os, re, json, time, hashlib, html, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
from xml.etree import ElementTree as ET

LOOKBACK=timedelta(hours=24); MAX_PUBLISH=5; MIN_SCORE=7; MAX_QUEUE=100
STATE_FILE=os.getenv('STATE_FILE','data/intily-ai-news-state.json')
MODEL='openai/gpt-4o-mini'; AI_URL='https://models.github.ai/inference/chat/completions'
TG_URL='https://api.telegram.org/bot{}/sendMessage'
QUERIES=[('WORLD','AI artificial intelligence OpenAI Anthropic Google DeepMind Microsoft Meta Nvidia'),('WORLD','AI model launch release agent robotics chips regulation safety research'),('WORLD','artificial intelligence breakthrough investment acquisition security AI agents'),('RUSSIA','ИИ искусственный интеллект нейросети Россия Яндекс Сбер VK'),('RUSSIA','ИИ нейросети регулирование закон инвестиции технологии Россия'),('RUSSIA','искусственный интеллект российские компании разработка модели агент')]
WEIGHTS={'launch':5,'release':5,'model':4,'agent':5,'breakthrough':7,'research':3,'security':5,'safety':5,'regulation':5,'law':5,'investment':4,'billion':5,'acquisition':5,'chip':4,'gpu':4,'openai':4,'anthropic':4,'google':3,'deepmind':4,'nvidia':4,'microsoft':3,'yandex':4,'sber':4,'закон':6,'регулир':5,'миллиард':5,'запуст':5,'выпуст':5,'агент':5,'модель':4,'нейросет':4,'исследован':3,'инвести':4,'покуп':5,'сделк':4,'безопасност':5}
TRUSTED={'reuters','bloomberg','financial times','the verge','techcrunch','tass','interfax','рбк','коммерсантъ','ведомости'}

def load_state():
    os.makedirs(os.path.dirname(STATE_FILE),exist_ok=True)
    try:
        with open(STATE_FILE,encoding='utf-8') as f:s=json.load(f)
    except Exception:s={}
    published=s.get('published',{})
    if isinstance(published,list): published={str(x):0 for x in published}
    known=s.get('known',{})
    if isinstance(known,list): known={str(x):0 for x in known}
    queue=s.get('queue',[])
    if not isinstance(queue,list): queue=[]
    return {'published':published,'known':known,'queue':queue,'last_run':s.get('last_run'),'last_published':s.get('last_published',0)}

def save_state(s):
    with open(STATE_FILE,'w',encoding='utf-8') as f:json.dump(s,f,ensure_ascii=False,indent=2)

def get(url,timeout=25,headers=None):
    req=urllib.request.Request(url,headers=headers or {'User-Agent':'IntilyAI-News/5.0'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return r.read()

def rss(region,q):
    p=urllib.parse.urlencode({'q':q,'hl':'ru-RU','gl':'RU' if region=='RUSSIA' else 'US','ceid':'RU:ru' if region=='RUSSIA' else 'US:en','when':'1d'})
    root=ET.fromstring(get('https://news.google.com/rss/search?'+p));out=[]
    for it in root.findall('.//item'):
        title=html.unescape((it.findtext('title') or '').strip());link=(it.findtext('link') or '').strip();desc=re.sub(r'<[^>]+>',' ',it.findtext('description') or '');desc=re.sub(r'\s+',' ',html.unescape(desc)).strip();source=(it.findtext('source') or '').strip();raw=it.findtext('pubDate') or ''
        try:dt=datetime.strptime(raw,'%a, %d %b %Y %H:%M:%S %z')
        except Exception:continue
        if not title or not link or datetime.now(timezone.utc)-dt>LOOKBACK:continue
        out.append({'region':region,'title':title,'link':link,'desc':desc,'source':source,'time':dt.timestamp()})
    return out

def normalize(t):return ' '.join(re.sub(r'[^a-zа-я0-9 ]',' ',t.lower().replace('ё','е')).split())
def key(x):return hashlib.sha256((normalize(x['title'])+'|'+normalize(x['source'])).encode()).hexdigest()

def score(x):
    b=(x['title']+' '+x['desc']+' '+x['source']).lower();n=sum(v for k,v in WEIGHTS.items() if k in b)
    if x['source'].lower().strip() in TRUSTED:n+=3
    age=(datetime.now(timezone.utc).timestamp()-x['time'])/3600
    if age<2:n+=2
    elif age>12:n-=1
    return max(0,min(n,30))

def similarity(a,b):
    A=set(w for w in normalize(a).split() if len(w)>2);B=set(w for w in normalize(b).split() if len(w)>2)
    return len(A&B)/len(A|B) if A and B else 0

def collect():
    allx=[]
    for region,q in QUERIES:
        try:
            for x in rss(region,q):
                x['score']=score(x);x['key']=key(x)
                if x['score']>=5:allx.append(x)
        except Exception as e:print('feed_error',region,e)
    allx.sort(key=lambda x:(x['score'],x['time']),reverse=True);out=[]
    for x in allx:
        if any(similarity(x['title'],y['title'])>=0.72 for y in out):continue
        out.append(x)
    return out

def ai(prompt):
    body=json.dumps({'model':MODEL,'messages':[{'role':'system','content':'Ты профессиональный русскоязычный редактор Telegram-канала об AI. Отвечай только JSON.'},{'role':'user','content':prompt}],'temperature':0.35,'max_tokens':900}).encode()
    req=urllib.request.Request(AI_URL,data=body,headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Content-Type':'application/json','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req,timeout=60) as r:data=json.loads(r.read().decode())
    return data['choices'][0]['message']['content']

def russian_ok(text):
    clean=re.sub(r'https?://\S+|<[^>]+>','',text);c=len(re.findall(r'[А-Яа-яЁё]',clean));l=len(re.findall(r'[A-Za-z]',clean))
    return c>=30 and (l<=8 or l<=c*0.12) and len(clean.split())>=8 and '...' not in clean

def edit(x):
    prompt=f'''Подготовь готовый Telegram-пост ЦЕЛИКОМ на естественном русском языке. Не переводи дословно — перескажи по-человечески. Раскрой: что произошло, кто участвует, почему это важно и практический вывод. Не выдумывай факты. Весь title, body, meaning и joke должны быть на русском. Не используй речевые штампы ИИ: "таким образом", "в свою очередь", "данное событие", "важный шаг", "следует отметить". 1–3 уместных эмодзи. Юмор только если уместен; для безопасности, регулирования, происшествий и серьёзных тем юмор запрещён. Верни JSON строго с полями title, body, meaning, joke. joke может быть пустым.
Источник: {x['source']}
Заголовок: {x['title']}
Описание: {x['desc']}'''
    raw=ai(prompt);raw=re.sub(r'^```json\s*|\s*```$','',raw.strip(),flags=re.I);j=json.loads(raw);title=str(j.get('title','')).strip();body=str(j.get('body','')).strip();meaning=str(j.get('meaning','')).strip();joke=str(j.get('joke','')).strip();full=' '.join([title,body,meaning,joke])
    if not title or not body or not meaning or not russian_ok(full):raise RuntimeError('RU_QA_FAILED')
    if any(p in full.lower() for p in ['таким образом','в свою очередь','данное событие','важный шаг','следует отметить']):raise RuntimeError('AI_STYLE_QA_FAILED')
    flag='🇷🇺' if x['region']=='RUSSIA' else '🌍';joke_block=('\n\n😏 '+html.escape(joke)) if joke else '';source=html.escape(x['source'] or 'Источник');dt=datetime.fromtimestamp(x['time'],timezone.utc).astimezone(timezone(timedelta(hours=3))).strftime('%d.%m.%Y %H:%M МСК')
    return f'{flag} <b>{html.escape(title)}</b>\n\n{html.escape(body)}\n\n<b>Что это значит:</b> {html.escape(meaning)}{joke_block}\n\n📰 {source} · {dt}\n🔗 <a href="{html.escape(x["link"],quote=True)}">Подробнее</a>'

def telegram(text):
    token=os.environ['TELEGRAM_BOT_TOKEN'];chat=os.environ.get('TELEGRAM_CHAT_ID','@intilyshop');payload=json.dumps({'chat_id':chat,'text':text,'parse_mode':'HTML','disable_web_page_preview':True}).encode();last=None
    for attempt in range(5):
        try:
            req=urllib.request.Request(TG_URL.format(token),data=payload,headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(req,timeout=30) as r:data=json.loads(r.read().decode())
            if data.get('ok'):return
            last=RuntimeError(str(data));wait=min(int(data.get('parameters',{}).get('retry_after',2)),60)
        except Exception as e:last=e;wait=min(2**attempt,30)
        time.sleep(wait)
    raise last

def main():
    if not os.environ.get('TELEGRAM_BOT_TOKEN'):raise RuntimeError('TELEGRAM_BOT_TOKEN secret is missing')
    state=load_state();now=time.time();cutoff=now-LOOKBACK.total_seconds();candidates=collect();q=state['queue'];qkeys={x['key'] for x in q}
    for x in candidates:
        if x['key'] not in state['published'] and x['key'] not in state['known'] and x['key'] not in qkeys:state['known'][x['key']]=now;q.append(x);qkeys.add(x['key'])
    q=[x for x in q if x['time']>=cutoff and x['key'] not in state['published']];q.sort(key=lambda x:(x['score'],x['time']),reverse=True);remaining=[];published=0
    for x in q:
        if published>=MAX_PUBLISH or x['score']<MIN_SCORE:remaining.append(x);continue
        try:post=edit(x);telegram(post);state['published'][x['key']]=int(now);published+=1;print('PUBLISHED',x['title'])
        except Exception as e:print('ITEM_FAILED',x['title'],e);remaining.append(x)
    state['queue']=remaining[:MAX_QUEUE]
    for k,v in list(state['published'].items()):
        if v<now-30*86400:del state['published'][k]
    for k,v in list(state['known'].items()):
        if v<now-30*86400:del state['known'][k]
    state['last_run']=datetime.now(timezone.utc).isoformat();state['last_published']=published;save_state(state);print(json.dumps({'candidates':len(candidates),'published':published,'queue':len(state['queue'])},ensure_ascii=False))

if __name__=='__main__':main()
