"""Prueba opcional en base temporal de 30 000 entradas sintéticas; no cambia el sitio."""
import sys,time,json,os,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'backend'))
from api import import_catalog,connect,list_page,detail
base=Path(__file__).resolve().parent.parent
records=json.loads((base/'data/wallpapers.json').read_text())
import random
rng=random.Random(19)
with tempfile.TemporaryDirectory(prefix='fraxi-load-') as tmp:
 p=Path(tmp)/'test.json';db=Path(tmp)/'test.sqlite3'
 massive=[]
 for i in range(30000):
  x=records[i%len(records)].copy();x['id']=f"test-{i:07d}";x['slug']=f"{x['slug']}-sim-{i}";x['date']='2026-11-16'
  massive.append(x)
 p.write_text(json.dumps(massive,ensure_ascii=False))
 t=time.monotonic();import_catalog(p,db);insert=time.monotonic()-t
 con=connect(db)
 for name,params in [('home',{'type':['home'],'page':['1']}),('search',{'type':['search'],'q':['miside mita'],'page':['1']}),('category',{'type':['category'],'category':['games'],'page':['100']}),('detail',{'category':[massive[26]['categorySlug']],'slug':[massive[26]['slug']]})]:
  start=time.monotonic()
  result=detail(con,params) if name=='detail' else list_page(con,params)
  print(name,round((time.monotonic()-start)*1000,1),'ms',result.get('total',len(result.get('related',[]))))
 con.close();print('import',round(insert,2),'s','db_MB',round(db.stat().st_size/1e6,2))
