#!/usr/bin/env python3
"""Fraxinami: API pública ligera con SQLite FTS5.

Uso:
  python backend/api.py --import --source data/wallpapers.json
  python backend/api.py --host 127.0.0.1 --port 8787
En producción configurar un reverse proxy HTTPS y CORS --origin https://fraxinami.com.
No ofrece escritura pública ni permite subir archivos desde el visitante.
"""
import argparse
import json
import math
import re
import sqlite3
import unicodedata
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT=Path(__file__).resolve().parent.parent
DB=ROOT/'backend'/'catalogo.sqlite3'
NOISE={'wallpaper','wallpapers','hd','fondo','background','4k','5k','8k'}

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD',str(s or '').lower()) if unicodedata.category(c)!='Mn')

def tags(x):
    return {norm(t).lstrip('#').strip() for t in x.get('tags',[]) if norm(t).lstrip('#').strip() not in NOISE}

def summary(x):
    keys=('id','slug','title','categorySlug','author','image','thumbnail','width','height','thumbnailWidth','thumbnailHeight','date','tags','hasDesktopVersion','hasMobileVersion')
    return {k:x[k] for k in keys if k in x} | {'ecchi':is_ecchi(x),'ai':is_ai(x)}

def is_ecchi(x):
    return bool(x.get('ecchi') or x.get('rating')=='ecchi' or x.get('categorySlug') in ('ecchi','fanart-ecchi'))

def is_ai(x):
    return bool(x.get('ai') or x.get('generatedAI'))

def is_mobile(x):
    return x.get('hasMobileVersion') is True or (x.get('hasMobileVersion') is None and int(x.get('height',0))>int(x.get('width',0)))

def is_desktop(x):
    return x.get('hasDesktopVersion') is not False

def connect(database=DB):
    conn=sqlite3.connect(str(database),timeout=30)
    conn.row_factory=sqlite3.Row
    conn.execute('PRAGMA busy_timeout=5000')
    return conn

def import_catalog(source=ROOT/'data'/'wallpapers.json',database=DB):
    with open(source,encoding='utf-8') as f: data=json.load(f)
    database.parent.mkdir(parents=True,exist_ok=True)
    database.unlink(missing_ok=True)
    con=connect(database)
    con.executescript('''
      PRAGMA journal_mode=WAL;
      CREATE TABLE wallpapers (id TEXT PRIMARY KEY,category TEXT NOT NULL,slug TEXT NOT NULL,
        position INTEGER NOT NULL,ecchi INTEGER NOT NULL,ai INTEGER NOT NULL,mobile INTEGER NOT NULL,desktop INTEGER NOT NULL,payload TEXT NOT NULL);
      CREATE UNIQUE INDEX idx_wallpaper_slug ON wallpapers(category,slug);
      CREATE INDEX idx_wallpaper_feed ON wallpapers(position,ecchi,ai);
      CREATE INDEX idx_wallpaper_category ON wallpapers(category,position);
      CREATE INDEX idx_wallpaper_mobile ON wallpapers(mobile,position);
      CREATE INDEX idx_wallpaper_desktop ON wallpapers(desktop,position);
      CREATE TABLE tag_links (tag TEXT NOT NULL,wallpaper_id TEXT NOT NULL,
        position INTEGER NOT NULL, PRIMARY KEY (tag,wallpaper_id));
      CREATE INDEX idx_tag_position ON tag_links(tag,position);
      CREATE VIRTUAL TABLE wallpapers_fts USING fts5(title,author,tags,category, tokenize='unicode61 remove_diacritics 2');
    ''')
    for i,x in enumerate(data):
        con.execute('INSERT INTO wallpapers VALUES (?,?,?,?,?,?,?,?,?)',
           (str(x['id']),str(x.get('categorySlug','anime')),str(x['slug']),i,int(is_ecchi(x)),int(is_ai(x)),int(is_mobile(x)),int(is_desktop(x)),json.dumps(x,ensure_ascii=False,separators=(',',':'))))
        con.execute('INSERT INTO wallpapers_fts (rowid,title,author,tags,category) VALUES (last_insert_rowid(),?,?,?,?)',
           (x.get('title',''),x.get('author',''),' '.join(x.get('tags',[])),x.get('category','')))
        con.executemany('INSERT OR IGNORE INTO tag_links(tag,wallpaper_id,position) VALUES (?,?,?)',[(t,str(x['id']),i) for t in tags(x)])
        if i%10000==0 and i:con.commit()
    con.commit()
    con.execute('PRAGMA journal_mode=DELETE')
    con.execute('ANALYZE')
    con.commit();con.close()
    print(f'Catálogo SQLite listo: {len(data)} wallpapers. {database}')

def filters(params):
    conditions=[];values=[]
    if params.get('ecchi',['1'])[0]!='1':conditions.append('w.ecchi=0')
    if params.get('ai',['1'])[0]!='1':conditions.append('w.ai=0')
    return conditions,values

def list_page(con,params):
    typ=params.get('type',['home'])[0]
    try:p=max(1,min(1000000,int(params.get('page',['1'])[0])))
    except ValueError:p=1
    conditions,values=filters(params)
    join=''
    if typ=='category':
        cat=params.get('category',[''])[0]
        if cat=='moviles':conditions.append('w.mobile=1')
        elif cat=='escritorio':conditions.append('w.desktop=1')
        else:conditions.append('w.category=?');values.append(cat)
    if typ=='ecchi':conditions.append('w.ecchi=1')
    if typ=='ai':conditions.append('w.ai=1')
    if typ=='favorites':
        # Es una búsqueda pública local; los favoritos solo llegan desde el cliente.
        ids=list(dict.fromkeys(params.get('ids',[''])[0].split(',')))[:900]
        if ids and ids[0]:conditions.append('w.id IN ('+','.join('?' for _ in ids)+')');values.extend(ids)
        else:return {'items':[],'total':0}
    if typ=='search':
        query=norm(params.get('q',[''])[0]);terms=re.findall(r'[a-z0-9]+',query)[:8]
        if not terms:return {'items':[],'total':0}
        # FTS5: tokens prefijo seguros; caracteres especiales no se incorporan a SQL.
        join=' JOIN wallpapers_fts ON wallpapers_fts.rowid=w.rowid'
        conditions.append('wallpapers_fts MATCH ?');values.append(' AND '.join('"'+t+'"*' for t in terms))
    where=(' WHERE '+' AND '.join(conditions)) if conditions else ''
    sql=' FROM wallpapers w'+join+where
    total=con.execute('SELECT COUNT(*)'+sql,values).fetchone()[0]
    rows=con.execute('SELECT w.payload'+sql+' ORDER BY w.position LIMIT 24 OFFSET ?',values+[(p-1)*24]).fetchall()
    return {'items':[summary(json.loads(r[0])) for r in rows],'total':total}

def related(con,current,params):
    tags_now=list(tags(current))
    candidates=defaultdict(float)
    # Índice invertido: empezar por los hashtags menos frecuentes y examinar como
    # máximo algunos centenares por etiqueta; nunca recorrer todas las publicaciones.
    counts=[]
    for t in tags_now:
        n=con.execute('SELECT COUNT(*) FROM tag_links WHERE tag=?',(t,)).fetchone()[0]
        if n:counts.append((n,t))
    total=con.execute('SELECT COUNT(*) FROM wallpapers').fetchone()[0]
    for n,t in sorted(counts)[:12]:
        score=3+math.log(1+total/n)
        for row in con.execute('''SELECT tl.wallpaper_id AS id FROM tag_links tl
          WHERE tl.tag=? ORDER BY tl.position LIMIT 350''',(t,)):
            candidates[row['id']]+=score
    for row in con.execute('SELECT id FROM wallpapers WHERE category=? ORDER BY position LIMIT 150',(current.get('categorySlug',''),)):
        candidates[row['id']]+=2
    candidates.pop(current['id'],None)
    if len(candidates)<12:
        for row in con.execute('SELECT id FROM wallpapers ORDER BY position LIMIT 80'):
            if row['id']!=current['id']:candidates[row['id']]+=0
    selected=sorted(candidates,key=lambda x:-candidates[x])[:100]
    if not selected:return []
    found={r['id']:r for r in con.execute('SELECT id,payload,ecchi,ai FROM wallpapers WHERE id IN ('+','.join('?' for _ in selected)+')',selected)}
    show_ecchi=params.get('ecchi',['1'])[0]=='1';show_ai=params.get('ai',['1'])[0]=='1'
    result=[]
    for id in selected:
        r=found.get(id)
        if not r or (r['ecchi'] and not show_ecchi) or (r['ai'] and not show_ai):continue
        result.append(summary(json.loads(r['payload'])))
        if len(result)>=24:break
    return result

def detail(con,params):
    category=params.get('category',[''])[0];slug=params.get('slug',[''])[0]
    row=con.execute('SELECT payload FROM wallpapers WHERE category=? AND slug=?',(category,slug)).fetchone()
    if not row:return {'item':None,'related':[]}
    x=json.loads(row[0]);return {'item':x,'related':related(con,x,params)}

class Handler(BaseHTTPRequestHandler):
    database=DB;origin='https://fraxinami.com'
    def do_GET(self):
        u=urlsplit(self.path);p=parse_qs(u.query)
        try:
            with connect(self.database) as con:
                if u.path=='/api/list':result=list_page(con,p)
                elif u.path=='/api/detail':result=detail(con,p)
                elif u.path=='/api/manifest':result={'total':con.execute('SELECT COUNT(*) FROM wallpapers').fetchone()[0],'pageSize':24}
                elif u.path=='/api/health':result={'ok':True}
                else:self.send_error(404,'Ruta inexistente');return
            blob=json.dumps(result,ensure_ascii=False,separators=(',',':')).encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(blob)))
            self.send_header('Cache-Control','public,max-age=30')
            self.send_header('Access-Control-Allow-Origin',self.origin)
            self.send_header('Vary','Origin');self.end_headers();self.wfile.write(blob)
        except sqlite3.Error as e:
            self.send_error(503,'Catálogo no disponible')
    def log_message(self,format,*args):pass

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--import',dest='import_data',action='store_true')
    parser.add_argument('--source',default=str(ROOT/'data/wallpapers.json'))
    parser.add_argument('--database',default=str(DB));parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8787);parser.add_argument('--origin',default='https://fraxinami.com')
    args=parser.parse_args()
    if args.import_data:import_catalog(Path(args.source),Path(args.database))
    else:
        Handler.database=Path(args.database);Handler.origin=args.origin
        print('Fraxinami API disponible en',args.host,args.port,'(se recomienda HTTPS en producción)')
        ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
