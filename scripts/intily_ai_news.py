import os, re, json, time, hashlib, html, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

LOOKBACK=timedelta(hours=24); MAX_PUBLISH=3; MIN_SCORE=7; MAX_QUEUE=100
STATE_FILE=os.getenv('STATE_FILE','data/intily-ai-news-state.json')
GROQ_MODEL='llama-3.1-8b-instant'; GROQ_URL='https://api.groq.com/openai/v1/chat/completions'; OPENAI_MODEL='gpt-4o-mini'; OPENAI_URL='https://api.openai.com/v1/chat/completions'
TG_URL='https://api.telegram.org/bot{}/sendMessage'
QUERIES=[('WORLD','AI artificial intelligence OpenAI Anthropic Google DeepMind Microsoft Meta Nvidia'),('WORLD','AI model launch release agent robotics chips regulation safety research'),('WORLD','artificial intelligence breakthrough investment acquisition security AI agents'),('RUSSIA','ÐÐ Ð¸ÑÐºÑÑÑÑÐ²ÐµÐ½Ð½ÑÐ¹ Ð¸Ð½ÑÐµÐ»Ð»ÐµÐºÑ Ð½ÐµÐ¹ÑÐ¾ÑÐµÑÐ¸ Ð Ð¾ÑÑÐ¸Ñ Ð¯Ð½Ð´ÐµÐºÑ Ð¡Ð±ÐµÑ VK'),('RUSSIA','ÐÐ Ð½ÐµÐ¹ÑÐ¾ÑÐµÑÐ¸ ÑÐµÐ³ÑÐ»Ð¸ÑÐ¾Ð²Ð°Ð½Ð¸Ðµ Ð·Ð°ÐºÐ¾Ð½ Ð¸Ð½Ð²ÐµÑÑÐ¸ÑÐ¸Ð¸ ÑÐµÑÐ½Ð¾Ð»Ð¾Ð³Ð¸Ð¸ Ð Ð¾ÑÑÐ¸Ñ'),('RUSSIA','Ð¸ÑÐºÑÑÑÑÐ²ÐµÐ½Ð½ÑÐ¹ Ð¸Ð½ÑÐµÐ»Ð»ÐµÐºÑ ÑÐ¾ÑÑÐ¸Ð¹ÑÐºÐ¸Ðµ ÐºÐ¾Ð¼Ð¿Ð°Ð½Ð¸Ð¸ ÑÐ°Ð·ÑÐ°Ð±Ð¾ÑÐºÐ° Ð¼Ð¾Ð´ÐµÐ»Ð¸ Ð°Ð³ÐµÐ½Ñ')]
WEIGHTS={'launch':5,'release':5,'model':4,'agent':5,'breakthrough':7,'research':3,'security':5,'safety':5,'regulation':5,'law':5,'investment':4,'billion':5,'acquisition':5,'chip':4,'gpu':4,'openai':4,'anthropic':4,'google':3,'deepmind':4,'nvidia':4,'microsoft':3,'yandex':4,'sber':4,'Ð·Ð°ÐºÐ¾Ð½':6,'ÑÐµÐ³ÑÐ»Ð¸Ñ':5,'Ð¼Ð¸Ð»Ð»Ð¸Ð°ÑÐ´':5,'Ð·Ð°Ð¿ÑÑÑ':5,'Ð²ÑÐ¿ÑÑÑ':5,'Ð°Ð³ÐµÐ½Ñ':5,'Ð¼Ð¾Ð´ÐµÐ»Ñ':4,'Ð½ÐµÐ¹ÑÐ¾ÑÐµÑ':4,'Ð¸ÑÑÐ»ÐµÐ´Ð¾Ð²Ð°Ð½':3,'Ð¸Ð½Ð²ÐµÑÑÐ¸':4,'Ð¿Ð¾ÐºÑÐ¿':5,'ÑÐ´ÐµÐ»Ðº':4,'Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ':5}
TRUSTED={'reuters','bloomberg','financial times','the verge','techcrunch','tass','interfax','ÑÐ±Ðº','ÐºÐ¾Ð¼Ð¼ÐµÑÑÐ°Ð½ÑÑ','Ð²ÐµÐ´Ð¾Ð¼Ð¾ÑÑÐ¸'}

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
    cutoff_date=(datetime.now(timezone.utc)-LOOKBACK).date().isoformat(); q_live=f'{q} after:{cutoff_date}'; p=urllib.parse.urlencode({'q':q_live,'hl':'ru-RU','gl':'RU' if region=='RUSSIA' else 'US','ceid':'RU:ru' if region=='RUSSIA' else 'US:en'})
    root=ET.fromstring(get('https://news.google.com/rss/search?'+p));out=[]; raw_count=0
    for it in root.findall('.//item'):
        title=html.unescape((it.findtext('title') or '').strip());link=(it.findtext('link') or '').strip();desc=re.sub(r'<[^>]+>',' ',it.findtext('description') or '');desc=re.sub(r'\s+',' ',html.unescape(desc)).strip();source=(it.findtext('source') or '').strip();raw=it.findtext('pubDate') or ''
        try:dt=parsedate_to_datetime(raw)
        except Exception:continue
        if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
        if not title or not link:continue
        raw_count+=1
        if datetime.now(timezone.utc)-dt>LOOKBACK:continue
        out.append({'region':region,'title':title,'link':link,'desc':desc,'source':source,'time':dt.timestamp()})
    print('feed_ok',region,'raw',raw_count,'fresh',len(out))
    return out

def normalize(t):return ' '.join(re.sub(r'[^a-zÐ°-Ñ0-9 ]',' ',t.lower().replace('Ñ','Ðµ')).split())
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

def _chat(url, model, token, prompt, provider):
    body=json.dumps({'model':model,'messages':[{'role':'system','content':'Ð¢Ñ Ð¿ÑÐ¾ÑÐµÑÑÐ¸Ð¾Ð½Ð°Ð»ÑÐ½ÑÐ¹ ÑÑÑÑÐºÐ¾ÑÐ·ÑÑÐ½ÑÐ¹ ÑÐµÐ´Ð°ÐºÑÐ¾Ñ Telegram-ÐºÐ°Ð½Ð°Ð»Ð° Ð¾Ð± AI. ÐÑÐ²ÐµÑÐ°Ð¹ ÑÐ¾Ð»ÑÐºÐ¾ JSON.'},{'role':'user','content':prompt}],'temperature':0.35,'max_tokens':900}).encode()
    last=None
    for attempt in range(3):
        req=urllib.request.Request(url,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=60) as r:data=json.loads(r.read().decode())
            content=data['choices'][0]['message']['content']
            print('AI_OK',provider,'attempt',attempt+1)
            return content
        except urllib.error.HTTPError as e:
            raw=e.read().decode('utf-8','replace')
            last=RuntimeError(f'{provider}_HTTP_{e.code}: {raw[:500]}')
            if e.code not in (429,500,502,503,504): raise last
            retry=2**attempt
            try: retry=max(retry,min(int(e.headers.get('Retry-After','2')),60))
            except Exception: pass
            print(provider+'_RETRY',e.code,'retry_in',retry,'attempt',attempt+1)
            time.sleep(min(retry,30))
        except Exception as e:
            last=e;time.sleep(min(2**attempt,15))
    raise last

def ai(prompt):
    groq=os.environ.get('GROQ_API_KEY')
    if groq:
        try:return _chat(GROQ_URL,GROQ_MODEL,groq,prompt,'GROQ')
        except Exception as e:print('GROQ_FAILED',e)
    openai=os.environ.get('OPENAI_API_KEY')
    if openai:
        return _chat(OPENAI_URL,OPENAI_MODEL,openai,prompt,'OPENAI_FALLBACK')
    raise RuntimeError('AI_PROVIDER_UNAVAILABLE: GROQ_API_KEY and OPENAI_API_KEY are missing or unavailable')

def russian_ok(text):
    clean=re.sub(r'https?://\S+|<[^>]+>','',text);c=len(re.findall(r'[Ð-Ð¯Ð°-ÑÐÑ]',clean));l=len(re.findall(r'[A-Za-z]',clean))
    return c>=30 and (l<=8 or l<=c*0.12) and len(clean.split())>=8 and '...' not in clean



def translate_ru(text):
    text=(text or '').strip()
    if not text:return ''
    c=len(re.findall(r'[А-Яа-яЁё]',text)); l=len(re.findall(r'[A-Za-z]',text))
    if c>=20 and c>=l*0.7:return text
    try:
        q=urllib.parse.urlencode({'client':'gtx','sl':'auto','tl':'ru','dt':'t','q':text[:4500]})
        raw=get('https://translate.googleapis.com/translate_a/single?'+q,timeout=20,headers={'User-Agent':'Mozilla/5.0'})
        data=json.loads(raw.decode('utf-8'))
        return ''.join((part[0] or '') for part in data[0] if part and part[0]).strip() or text
    except Exception as e:
        print('TRANSLATE_FALLBACK',str(e)[:160]); return text

def offline_edit(x):
    title=translate_ru(x.get('title',''))
    desc=translate_ru(x.get('desc',''))
    desc=re.sub(r'\s+',' ',desc).strip()
    if len(desc)>1100: desc=desc[:1097].rsplit(' ',1)[0]+'…'
    source=x.get('source') or '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a'
    region=x.get('region')
    flag='\U0001F1F7\U0001F1FA' if region=='RUSSIA' else '\U0001F30D'
    if desc:
        body=desc
        meaning=('Новость стоит отслеживать: она показывает, как развивается рынок AI и какие изменения могут повлиять на компании, продукты и пользователей.')
    else:
        body=title
        meaning='Подробностей в RSS-описании мало, поэтому вывод ограничен самим сообщением и не содержит неподтверждённых фактов.'
    joke=''
    if region!='RUSSIA' and any(k in (title+' '+desc).lower() for k in ('agent','робот','робот')):
        joke='Похоже, AI снова решил не ждать понедельника. 😏'
    dt=datetime.fromtimestamp(x['time'],timezone.utc).astimezone(timezone(timedelta(hours=3))).strftime('%d.%m.%Y %H:%M МСК')
    src=html.escape(source)
    joke_block=('\n\n😏 '+html.escape(joke)) if joke else ''
    return f'{flag} <b>{html.escape(title)}</b>\n\n{html.escape(body)}\n\n<b>Что это значит:</b> {html.escape(meaning)}{joke_block}\n\n📰 {src} · {dt}\n🔗 <a href="{html.escape(x["link"],quote=True)}">Подробнее</a>'

def edit(x):
    prompt=f'''ÐÐ¾Ð´Ð³Ð¾ÑÐ¾Ð²Ñ Ð³Ð¾ÑÐ¾Ð²ÑÐ¹ Telegram-Ð¿Ð¾ÑÑ Ð¦ÐÐÐÐÐÐ Ð½Ð° ÐµÑÑÐµÑÑÐ²ÐµÐ½Ð½Ð¾Ð¼ ÑÑÑÑÐºÐ¾Ð¼ ÑÐ·ÑÐºÐµ. ÐÐµ Ð¿ÐµÑÐµÐ²Ð¾Ð´Ð¸ Ð´Ð¾ÑÐ»Ð¾Ð²Ð½Ð¾ â Ð¿ÐµÑÐµÑÐºÐ°Ð¶Ð¸ Ð¿Ð¾-ÑÐµÐ»Ð¾Ð²ÐµÑÐµÑÐºÐ¸. Ð Ð°ÑÐºÑÐ¾Ð¹: ÑÑÐ¾ Ð¿ÑÐ¾Ð¸Ð·Ð¾ÑÐ»Ð¾, ÐºÑÐ¾ ÑÑÐ°ÑÑÐ²ÑÐµÑ, Ð¿Ð¾ÑÐµÐ¼Ñ ÑÑÐ¾ Ð²Ð°Ð¶Ð½Ð¾ Ð¸ Ð¿ÑÐ°ÐºÑÐ¸ÑÐµÑÐºÐ¸Ð¹ Ð²ÑÐ²Ð¾Ð´. ÐÐµ Ð²ÑÐ´ÑÐ¼ÑÐ²Ð°Ð¹ ÑÐ°ÐºÑÑ. ÐÐµÑÑ title, body, meaning Ð¸ joke Ð´Ð¾Ð»Ð¶Ð½Ñ Ð±ÑÑÑ Ð½Ð° ÑÑÑÑÐºÐ¾Ð¼. ÐÐµ Ð¸ÑÐ¿Ð¾Ð»ÑÐ·ÑÐ¹ ÑÐµÑÐµÐ²ÑÐµ ÑÑÐ°Ð¼Ð¿Ñ ÐÐ: "ÑÐ°ÐºÐ¸Ð¼ Ð¾Ð±ÑÐ°Ð·Ð¾Ð¼", "Ð² ÑÐ²Ð¾Ñ Ð¾ÑÐµÑÐµÐ´Ñ", "Ð´Ð°Ð½Ð½Ð¾Ðµ ÑÐ¾Ð±ÑÑÐ¸Ðµ", "Ð²Ð°Ð¶Ð½ÑÐ¹ ÑÐ°Ð³", "ÑÐ»ÐµÐ´ÑÐµÑ Ð¾ÑÐ¼ÐµÑÐ¸ÑÑ". 1â3 ÑÐ¼ÐµÑÑÐ½ÑÑ ÑÐ¼Ð¾Ð´Ð·Ð¸. Ð®Ð¼Ð¾Ñ ÑÐ¾Ð»ÑÐºÐ¾ ÐµÑÐ»Ð¸ ÑÐ¼ÐµÑÑÐµÐ½; Ð´Ð»Ñ Ð±ÐµÐ·Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑÐ¸, ÑÐµÐ³ÑÐ»Ð¸ÑÐ¾Ð²Ð°Ð½Ð¸Ñ, Ð¿ÑÐ¾Ð¸ÑÑÐµÑÑÐ²Ð¸Ð¹ Ð¸ ÑÐµÑÑÑÐ·Ð½ÑÑ ÑÐµÐ¼ ÑÐ¼Ð¾Ñ Ð·Ð°Ð¿ÑÐµÑÑÐ½. ÐÐµÑÐ½Ð¸ JSON ÑÑÑÐ¾Ð³Ð¾ Ñ Ð¿Ð¾Ð»ÑÐ¼Ð¸ title, body, meaning, joke. joke Ð¼Ð¾Ð¶ÐµÑ Ð±ÑÑÑ Ð¿ÑÑÑÑÐ¼.
ÐÑÑÐ¾ÑÐ½Ð¸Ðº: {x['source']}
ÐÐ°Ð³Ð¾Ð»Ð¾Ð²Ð¾Ðº: {x['title']}
ÐÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ: {x['desc']}'''
    try:
        raw=ai(prompt)
        raw=re.sub(r'^```json\s*|\s*```$','',raw.strip(),flags=re.I)
        j=json.loads(raw)
        title=str(j.get('title','')).strip();body=str(j.get('body','')).strip();meaning=str(j.get('meaning','')).strip();joke=str(j.get('joke','')).strip();full=' '.join([title,body,meaning,joke])
    except Exception as e:
        print('AI_UNAVAILABLE_USE_RSS_EDITOR',str(e)[:220])
        return offline_edit(x)
    if not title or not body or not meaning or not russian_ok(full):raise RuntimeError('RU_QA_FAILED')
    if any(p in full.lower() for p in ['ÑÐ°ÐºÐ¸Ð¼ Ð¾Ð±ÑÐ°Ð·Ð¾Ð¼','Ð² ÑÐ²Ð¾Ñ Ð¾ÑÐµÑÐµÐ´Ñ','Ð´Ð°Ð½Ð½Ð¾Ðµ ÑÐ¾Ð±ÑÑÐ¸Ðµ','Ð²Ð°Ð¶Ð½ÑÐ¹ ÑÐ°Ð³','ÑÐ»ÐµÐ´ÑÐµÑ Ð¾ÑÐ¼ÐµÑÐ¸ÑÑ']):raise RuntimeError('AI_STYLE_QA_FAILED')
    flag='ð·ðº' if x['region']=='RUSSIA' else 'ð';joke_block=('\n\nð '+html.escape(joke)) if joke else '';source=html.escape(x['source'] or 'ÐÑÑÐ¾ÑÐ½Ð¸Ðº');dt=datetime.fromtimestamp(x['time'],timezone.utc).astimezone(timezone(timedelta(hours=3))).strftime('%d.%m.%Y %H:%M ÐÐ¡Ð')
    return f'{flag} <b>{html.escape(title)}</b>\n\n{html.escape(body)}\n\n<b>Ð§ÑÐ¾ ÑÑÐ¾ Ð·Ð½Ð°ÑÐ¸Ñ:</b> {html.escape(meaning)}{joke_block}\n\nð° {source} Â· {dt}\nð <a href="{html.escape(x["link"],quote=True)}">ÐÐ¾Ð´ÑÐ¾Ð±Ð½ÐµÐµ</a>'

def telegram(text):
    token=os.environ['TELEGRAM_BOT_TOKEN'];chat=os.environ.get('TELEGRAM_CHAT_ID','@intilyshop');payload=json.dumps({'chat_id':chat,'text':text,'parse_mode':'HTML','disable_web_page_preview':True}).encode();last=None
    for attempt in range(3):
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
    if candidates and published == 0:
        raise RuntimeError('NO_PUBLISH: candidates exist but Telegram received zero posts')

if __name__=='__main__':main()
