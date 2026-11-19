import {cleanTag,normalize} from './site.js?v=10.7';
/* Metadata-based recommendations: shared meaningful tags, category, rarity; no unrelated tag "Wallpaper". */
const NOISE = new Set(['wallpaper','4k','5k','8k','hd','fullhd','mobile','desktop','fondo','background','wallpapers']);
const tagsOf=item=>new Set((item.tags||[]).map(x=>normalize(cleanTag(x))).filter(x=>x&&!NOISE.has(x)));
export function similares(current,items,limit=12){
 const currentTags=tagsOf(current);const n=Math.max(items.length,1);const counts=new Map();
 for(const item of items){for(const tag of tagsOf(item))counts.set(tag,(counts.get(tag)||0)+1);}
 return items.filter(item=>item.id!==current.id).map(item=>{
    const tags=tagsOf(item);let score=0;
    for(const tag of currentTags){if(tags.has(tag)){score+=3+Math.log(1+n/(counts.get(tag)||1));}}
    if(normalize(item.categorySlug)===normalize(current.categorySlug))score+=2;
    const ratioA=current.width/current.height,ratioB=item.width/item.height;
    if(Math.abs(ratioA-ratioB)<.08)score+=.45;
    return {item,score};
 }).sort((a,b)=>b.score-a.score||String(b.item.date).localeCompare(String(a.item.date))).slice(0,limit).map(x=>x.item);
}

/* Cada carga: muestra una combinación diferente de candidatos que ya fueron
   seleccionados por coincidencias de hashtags y categoría. Prioriza los mejores
   sin dejar siempre exactamente las mismas 12 tarjetas en pantalla. */
export function rotarRelacionados(items,limit=12){
 const order=items.map((item,index)=>{
  const weight=1/(1+Math.floor(index/5)*.32);
  return {item,key:Math.pow(Math.max(1e-9,Math.random()),1/weight)};
 });
 return order.sort((a,b)=>b.key-a.key).slice(0,limit).map(x=>x.item);
}
