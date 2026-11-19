/* Acceso a datos: GitHub Pages usa índices paginados; servidor de gran escala
   puede exponer las mismas respuestas mediante API_URL. Nunca se pide el JSON
   completo desde una página pública. */
import {path,visibleCatalog,ecchiEnabled,aiEnabled,favoritesList} from './site.js?v=10.7';
import {API_URL} from './config.js?v=10.7';
import {norm,prefixOf,bucketOf} from './indexador.js?v=10.7';
const memo=new Map();
async function json(file){
 const url=path(file);
 if(!memo.has(url)){
  const promise=fetch(url,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error(`Datos no disponibles (${r.status}): ${file}`);return r.json()});
  memo.set(url,promise);promise.catch(()=>memo.delete(url));
 }
 return memo.get(url);
}
async function api(route){
 const url=API_URL.replace(/\/$/,'')+'/api/'+route;
 const r=await fetch(url,{headers:{Accept:'application/json'}});
 if(!r.ok)throw Error(`Servicio de catálogo (${r.status})`);
 return r.json();
}
const mode=()=>ecchiEnabled()?(aiEnabled()?'todos':'sin-ia'):(aiEnabled()?'sin-ecchi':'seguros');
const pageNo=()=>Math.max(1,Math.floor(Number(new URLSearchParams(location.search).get('page'))||1));
const queryOf=()=>new URLSearchParams(location.search).get('q')||'';
const homeMode=()=>['moviles','escritorio','aleatorio'].includes(location.hash.slice(1).toLowerCase())?location.hash.slice(1).toLowerCase():'todos';
let randomLane=0;
export const currentRandomLane=()=>randomLane;
const pickLane=count=>{
 let lane=0,last=0;
 try{
  const v=JSON.parse(sessionStorage.getItem('fraxinami-next-random-lane')||'null');
  sessionStorage.removeItem('fraxinami-next-random-lane');
  last=Number(sessionStorage.getItem('fraxinami-last-random-lane'))||0;
  if(v&&Date.now()-v.at<15000&&v.lane>=1&&v.lane<=count)lane=v.lane;
 }catch{}
 if(!lane){lane=1+Math.floor(Math.random()*count);if(count>1&&lane===last)lane=lane%count+1;}
 try{sessionStorage.setItem('fraxinami-last-random-lane',String(lane));}catch{}
 return lane;
};
const visibleMask=mask=>((ecchiEnabled()||(mask&1)===0)&&(aiEnabled()||(mask&2)===0));
export async function readManifest(){if(API_URL)return api('manifest');return json('data/index/manifest.json');}
const termWords=s=>norm(s).match(/[a-z0-9]+/g)||[];
async function searchLocal(q,page,manifest){
 const terms=[...new Set(termWords(q))];
 if(!terms.length)return {items:[],total:0};
 const postingLists=[];
 for(const word of terms){
  const dict=await json(`data/index/buscar/${prefixOf(word)}.json`).catch(err=>{if(/\(404\)/.test(err.message))return {};throw err});
  const matching=Object.entries(dict).filter(([key])=>key.startsWith(word));
  const list=new Map();
  for(const [,postings] of matching)for(const [id,flags] of postings)if(visibleMask(flags))list.set(id,flags);
  postingLists.push(list);
 }
 postingLists.sort((a,b)=>a.size-b.size);
 const ids=[...(postingLists[0]||new Map()).keys()].filter(id=>postingLists.every(x=>x.has(id)));
 // El orden de búsqueda respeta la publicación más reciente (primer índice).
 const current=ids.slice((page-1)*24,page*24);
 if(!current.length)return {items:[],total:ids.length};
 const groups=new Map();
 for(const id of current){const bucket=bucketOf(id);if(!groups.has(bucket))groups.set(bucket,[]);groups.get(bucket).push(id);}
 const values=new Map();
 await Promise.all([...groups].map(async ([bucket,keys])=>{
  const lookup=await json(`data/index/lookup/${bucket}.json`);
  for(const id of keys)if(lookup[id])values.set(id,lookup[id]);
 }));
 return {items:current.map(id=>values.get(id)).filter(Boolean),total:ids.length};
}
async function favoritesLocal(page){
 const ids=[...favoritesList()].reverse();
 // Un favorito requiere solo su ficha pequeña, no el catálogo completo.
 const records=await Promise.all(ids.map(id=>json(`data/index/id/${encodeURIComponent(id)}.json`).catch(()=>null)));
 const items=visibleCatalog(records.filter(Boolean));
 return {items:items.slice((page-1)*24,page*24),total:items.length};
}
export async function loadListing(page){
 const n=pageNo(),q=queryOf(),slug=document.documentElement.dataset.category||'',activeMode=mode();
 if(API_URL){
  let type='home',extra='';
  if(page==='search'){type='search';extra='&q='+encodeURIComponent(q)}
  if(page==='home'){const home=homeMode();if(home==='moviles'||home==='escritorio'){type='category';extra='&category='+encodeURIComponent(home);}else if(home==='aleatorio'){type='random';extra='&seed='+Math.floor(Math.random()*1000000);}}
  if(page==='category'){type='category';extra='&category='+encodeURIComponent(slug)}
  if(['ecchi','ai','favorites'].includes(page)){type=page; if(page==='favorites')extra='&ids='+encodeURIComponent([...favoritesList()].join(','));}
  return api(`list?type=${type}&page=${n}&ecchi=${+ecchiEnabled()}&ai=${+aiEnabled()}${extra}`);
 }
 if(page==='favorites')return favoritesLocal(n);
 const manifest=await readManifest();
 if(page==='search')return searchLocal(q,n,manifest);
 const view=manifest.views[activeMode];
 let sub='all',total=view.all;
 if(page==='category'){
  if(['moviles','escritorio'].includes(slug)){sub=`dispositivo/${slug}`;total=view.devices?.[slug]||0;}
  else{sub=`categoria/${slug}`;total=view.categories[slug]||0;}
 }
 if(page==='ecchi'||page==='ai'){sub=`especial/${page}`;total=view.special[page]||0;}
 if(page==='home'){
  const home=homeMode();
  if(['moviles','escritorio'].includes(home)){sub=`dispositivo/${home}`;total=view.devices?.[home]||0;}
  if(home==='aleatorio'){randomLane=pickLane(view.randomVariants||8);sub=`aleatorio/${randomLane}`;total=view.all;}else randomLane=0;
 }
 if(total===0||n>Math.ceil(total/24))return {items:[],total};
 const items=await json(`data/index/feed/${activeMode}/${sub}/${n}.json`);
 return {items,total};
}
export async function loadDetail(){
 const {category,slug}=document.documentElement.dataset;
 if(API_URL)return api(`detail?category=${encodeURIComponent(category)}&slug=${encodeURIComponent(slug)}&ecchi=${+ecchiEnabled()}&ai=${+aiEnabled()}`);
 const [item,related]=await Promise.all([
  json(`data/index/items/${category}/${slug}.json`).catch(()=>null),
  json(`data/index/relacionados/${category}/${slug}.json`).catch(()=>[])
 ]);
 return {item,related:visibleCatalog(related)};
}
