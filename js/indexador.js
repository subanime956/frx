/* Generador de datos estáticos V10, compartido entre el navegador y Node.
   El cliente público solo carga una página de hasta 24 y datos de una ficha.
   Ejecutar offline al publicar; nunca se ejecuta en el inicio de los visitantes. */
const P=24;
const NOISE=new Set(['wallpaper','wallpapers','hd','4k','5k','8k','fondo','background','movil','pc']);
export const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const words=value=>norm(value).match(/[a-z0-9]+/g)||[];
export const isEcchiRecord=x=>x.ecchi===true||x.rating==='ecchi'||['ecchi','fanart-ecchi'].includes(x.categorySlug);
export const isAiRecord=x=>x.ai===true||x.generatedAI===true;
export const maskRecord=x=>(isEcchiRecord(x)?1:0)|(isAiRecord(x)?2:0);
export const bucketOf=id=>([...String(id)].reduce((n,ch)=>Math.imul(n^ch.charCodeAt(0),16777619)>>>0,2166136261)&255).toString(16).padStart(2,'0');
export const prefixOf=term=>(norm(term).replace(/[^a-z0-9]/g,'').slice(0,2)||'_');
export const isMobileWallpaper=x=>x.hasMobileVersion===true||(x.hasMobileVersion==null&&Number(x.height)>Number(x.width));
export const isDesktopWallpaper=x=>x.hasDesktopVersion!==false;
export const tagsWithDevice=x=>{const tags=[...(x.tags||[])];const has=t=>tags.some(x=>norm(x).replace(/^#/, '')===norm(t));if(isMobileWallpaper(x)&&!has('Movil'))tags.push('#Móvil');if(isDesktopWallpaper(x)&&!has('Escritorio'))tags.push('#Escritorio');return tags;};
export const summaryOf=x=>({id:x.id,slug:x.slug,categorySlug:x.categorySlug,title:x.title,author:x.author,
 image:x.image,thumbnail:x.thumbnail,width:x.width,height:x.height,
 thumbnailWidth:x.thumbnailWidth,thumbnailHeight:x.thumbnailHeight,
 hasDesktopVersion:isDesktopWallpaper(x),hasMobileVersion:isMobileWallpaper(x),
 date:x.date,tags:tagsWithDevice(x),ecchi:isEcchiRecord(x),ai:isAiRecord(x)});
const tagSet=item=>new Set(tagsWithDevice(item).map(t=>norm(t).replace(/^#+/,'')).filter(t=>t&&!NOISE.has(t)));
// El orden del catálogo es editorial: los nuevos se añaden al principio.
const sortRecords=(records)=>records.slice();
const modes={todos:()=>true,'sin-ecchi':x=>!isEcchiRecord(x),'sin-ia':x=>!isAiRecord(x),seguros:x=>!isEcchiRecord(x)&&!isAiRecord(x)};
const json=obj=>JSON.stringify(obj);
const shuffled=(items,seed)=>{
 const list=[...items];let state=(seed*2654435761)>>>0;
 const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
 for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
 return list;
};

// El consecutivo vive en el manifiesto y no retrocede cuando se borra una ficha.
// Compatibilidad: las versiones anteriores no incluyen publicationNumber.
export function buildIndexFiles(input,{lastPublicationNumber=0}={}){
 const records=sortRecords(input),files=[],summaryMap=new Map(records.map(x=>[x.id,summaryOf(x)]));
 const push=(name,body)=>files.push({name:'data/index/'+name+'.json',data:json(body)});
 const validNumber=n=>Number.isSafeInteger(Number(n))&&Number(n)>0?Number(n):0;
 const usedNumber=Math.max(validNumber(lastPublicationNumber),...records.map(x=>validNumber(x.publicationNumber)),0);
 const manifest={version:10,pageSize:P,total:records.length,lastPublicationNumber:usedNumber,views:{},generated:new Date().toISOString()};
 const paged=(name,arr)=>{for(let i=0;i<arr.length;i+=P)push(`${name}/${Math.floor(i/P)+1}`,arr.slice(i,i+P).map(x=>summaryMap.get(x.id)));};
 // Evita guardar cuatro copias idénticas de las páginas cuando los filtros
 // Ecchi/IA producen exactamente el mismo catálogo.
 const builtViews=[];
 for(const [mode,allowed] of Object.entries(modes)){
  const view=records.filter(allowed),ids=view.map(x=>x.id);
  const existing=builtViews.find(prev=>prev.ids.length===ids.length&&prev.ids.every((id,i)=>id===ids[i]));
  if(existing){manifest.views[mode]={...manifest.views[existing.mode],dataMode:existing.mode};continue;}
  const info={all:view.length,categories:{},special:{ecchi:0,ai:0},dataMode:mode};
  paged(`feed/${mode}/all`,view);
  // Las primeras 8 mezclas diferentes; si hay pocas imágenes evitamos
  // generar 8 archivos con el mismo orden una y otra vez.
  const seenOrders=new Set();let count=0;
  const attempts=view.length<=6?32:8;
  for(let seed=1;view.length&&seed<=attempts&&count<8;seed++){
   const items=shuffled(view,seed),signature=items.map(x=>x.id).join('\u001f');
   if(seenOrders.has(signature))continue;
   seenOrders.add(signature);count++;
   paged(`feed/${mode}/aleatorio/${count}`,items);
  }
  info.randomVariants=count;
  const grouped=new Map();
  for(const x of view){const key=x.categorySlug;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(x);}
  for(const [cat,arr] of grouped){info.categories[cat]=arr.length;paged(`feed/${mode}/categoria/${cat}`,arr);}
  info.devices={moviles:0,escritorio:0};
  for(const [name,pred] of [['moviles',isMobileWallpaper],['escritorio',isDesktopWallpaper]]){
   const arr=view.filter(pred);info.devices[name]=arr.length;paged(`feed/${mode}/dispositivo/${name}`,arr);
  }
  for(const [kind,pred] of [['ecchi',isEcchiRecord],['ai',isAiRecord]]){
   const arr=view.filter(pred);info.special[kind]=arr.length;paged(`feed/${mode}/especial/${kind}`,arr);
  }
  manifest.views[mode]=info;
  builtViews.push({mode,ids});
 }
 push('manifest',manifest);
 push('rutas',records.map(x=>`${x.categorySlug}/${x.slug}/index.html`));
 // Las fichas y las recomendaciones no descargan el catálogo general.
 const posting=new Map(),category=new Map();
 for(const rec of records){
  for(const tag of tagSet(rec)){
   if(!posting.has(tag))posting.set(tag,[]);posting.get(tag).push(rec);
  }
  if(!category.has(rec.categorySlug))category.set(rec.categorySlug,[]);category.get(rec.categorySlug).push(rec);
 }
 for(const current of records){
  const currentTags=tagSet(current),candidates=new Map();
  const add=x=>{if(x.id!==current.id)candidates.set(x.id,x);};
  for(const tag of currentTags){for(const x of (posting.get(tag)||[]).slice(0,500))add(x);}
  for(const x of (category.get(current.categorySlug)||[]).slice(0,150))add(x);
  if(candidates.size<12)for(const x of records.slice(0,120))add(x);
  const r1=Number(current.width)/Number(current.height)||1;
  const scored=[...candidates.values()].map(x=>{
    const tags=tagSet(x);let score=0;
    for(const tag of currentTags)if(tags.has(tag))score+=3+Math.log(1+records.length/(posting.get(tag)?.length||1));
    if(x.categorySlug===current.categorySlug)score+=2;
    if(Math.abs(r1-(Number(x.width)/Number(x.height)||1))<.08)score+=.45;
    return {x,score};
   }).sort((a,b)=>b.score-a.score||String(b.x.date||'').localeCompare(String(a.x.date||'')));
  push(`items/${current.categorySlug}/${current.slug}`,{item:current,related:scored.slice(0,24).map(v=>summaryMap.get(v.x.id))});
 }
 // Índice invertido de búsquedas; solo se consulta el prefijo necesario.
 const dictionary=new Map(),lookups=new Map();
 for(const x of records){
  const summary=summaryMap.get(x.id),bucket=bucketOf(x.id);
  if(!lookups.has(bucket))lookups.set(bucket,{});lookups.get(bucket)[x.id]=summary;
  const tokens=new Set(words([x.title,x.author,x.category,x.categorySlug,...tagsWithDevice(x)].join(' ')));
  for(const t of tokens){const pre=prefixOf(t);if(!dictionary.has(pre))dictionary.set(pre,{});
    const group=dictionary.get(pre);if(!group[t])group[t]=[];
    group[t].push([x.id,maskRecord(x)]);
  }
 }
 for(const [bucket,items] of lookups)push(`lookup/${bucket}`,items);
 for(const [prefix,tokens] of dictionary)push(`buscar/${prefix}`,tokens);
 return files;
}
