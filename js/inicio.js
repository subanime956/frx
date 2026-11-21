import {escapeHtml,path} from './site.js?v=10.7';

// Los destacados aceptan ruta de publicación o miniatura directa con enlace.
const validLocal=raw=>{
 const str=String(raw||'').trim().replace(/^\/+/, '');
 return /^(?:assets\/thumbs\/[a-z0-9_-]+\.(?:webp|jpg|png)|[a-z0-9-]+\/[a-z0-9-]+\/?)$/.test(str)?str:'';
};
async function loadFeatured(hero){
 try{
  const response=await fetch(path('data/portada.json'),{cache:'no-cache'});
  if(!response.ok)throw Error(`Portada (${response.status})`);
  const config=await response.json();
  const chosen=(Array.isArray(config.destacados)?config.destacados:[]).slice(0,3);
  const entries=(await Promise.all(chosen.map(async candidate=>{
   if(typeof candidate==='object'&&candidate){
    const image=validLocal(candidate.imagen||candidate.image);
    const href=validLocal(candidate.enlace||candidate.href);
    if(image.startsWith('assets/thumbs/')&&href&&!href.startsWith('assets/'))return {src:path(image),href:path(href),title:'Ver wallpaper destacado'};
    return null;
   }
   const route=validLocal(candidate);
   if(!route)return null;
   if(route.startsWith('assets/thumbs/'))return {src:path(route),href:path(''),title:'Ver la colección'};
   const slug=route.replace(/\/$/,'');
   try{const r=await fetch(path(`data/index/items/${slug}.json`));if(!r.ok)return null;const item=await r.json();return {src:path(item.thumbnail||item.image),href:path(`${item.categorySlug}/${item.slug}/`),title:`Ver ${item.title}`};}catch{return null;}
  }))).filter(Boolean);
  const art=hero.querySelector('.hero-art');
  if(!art||entries.length!==3)return;
  const positions=['back','front','side'];
  art.innerHTML='<div class="hero-glow" aria-hidden="true"></div>'+entries.map((entry,i)=>
   `<a class="hero-shot hero-shot-${positions[i]}" href="${entry.href}" aria-label="${escapeHtml(entry.title)}"><img src="${entry.src}" alt="${escapeHtml(entry.title)}" decoding="async"></a>`
  ).join('');
  art.hidden=false;hero.classList.add('has-featured');
 }catch(err){console.warn('No se pudo leer la selección de portada.',err);}
}
const homeFilter=()=>({moviles:'mobile',escritorio:'desktop',aleatorio:'random',todos:'all'})[location.hash.slice(1).toLowerCase()]||'all';
const screenQuality=items=>{
 const widest=Math.max(0,...items.map(i=>Number(i.width)||0));
 return !widest?'—':widest>=7680?'8K':widest>=5120?'5K':widest>=3840?'4K':widest>=2560?'2K':widest>=1920?'Full HD':'HD';
};
export function homeContent(items,total){
 const tags=new Set(items.flatMap(x=>x.tags||[]).map(x=>String(x).replace(/^#+/,'').trim().toLowerCase()).filter(Boolean));
 const hero=`<section class="home-hero" aria-labelledby="home-hero-heading">
  <div class="home-hero-copy"><p class="home-kicker"><span class="home-kicker-dot"></span>TU RINCÓN DE INSPIRACIÓN</p>
   <h1 id="home-hero-heading">Un nuevo fondo.<span>Una nueva vibra.</span></h1>
   <p class="home-hero-text">Descubre wallpapers para darle vida a tu pantalla. Encuentra tus favoritos y explora fondos similares según sus hashtags.</p>
   <button class="home-hero-cta" type="button" id="explorar-coleccion">Explorar colección <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></button>
   <div class="home-stats" aria-label="Estadísticas del catálogo"><div><strong>${Number(total).toLocaleString('es-PE')}</strong><span>Wallpapers</span></div><div><strong>${tags.size}</strong><span>Hashtags en esta página</span></div><div><strong>${escapeHtml(screenQuality(items))}</strong><span>Resolución</span></div></div>
  </div>
  <div class="hero-art" hidden aria-label="Wallpapers destacados elegidos por Fraxinami"></div>
 </section>`;
 const selected=homeFilter();
 const controls=`<section id="coleccion" class="home-collection" aria-label="Explorar la colección">
  <p class="home-collection-kicker">DESCUBRE TU ESTILO</p>
  <div class="home-collection-head"><div><h2>Explora la colección <span aria-hidden="true">✳</span></h2><p>Cada hashtag conecta un wallpaper con otros de estilo parecido.</p></div><span class="home-collection-number">COLECCIÓN / ${String(Math.max(1,Number(new URLSearchParams(location.search).get('page')||1))).padStart(2,'0')}</span></div>
  <div class="home-filters" role="group" aria-label="Filtrar colección"><button type="button" data-home-filter="all" class="home-filter ${selected==='all'?'active':''}" aria-pressed="${selected==='all'}"><i class="fa-solid fa-star" aria-hidden="true"></i> Todos</button><button type="button" data-home-filter="mobile" class="home-filter ${selected==='mobile'?'active':''}" aria-pressed="${selected==='mobile'}">Móvil</button><button type="button" data-home-filter="desktop" class="home-filter ${selected==='desktop'?'active':''}" aria-pressed="${selected==='desktop'}">Escritorio</button><button type="button" data-home-filter="random" class="home-filter ${selected==='random'?'active':''}" aria-pressed="${selected==='random'}">Aleatorio</button></div>
  <div class="home-collection-rule"></div>
 </section>`;
 return {markup:hero+controls,bind(app){
  const hero=app.querySelector('.home-hero');
  loadFeatured(hero);
  app.querySelector('#explorar-coleccion')?.addEventListener('click',()=>{
   app.querySelector('#coleccion')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  });
  app.querySelectorAll('[data-home-filter]').forEach(button=>button.addEventListener('click',()=>{
   const filter=button.dataset.homeFilter;
   const fragment={all:'todos',mobile:'moviles',desktop:'escritorio',random:'aleatorio'}[filter];
   const url=new URL(location.href);
   url.searchParams.delete('page');url.hash=fragment;
   history.pushState({fraxinamiFilter:fragment},'',url);
   window.dispatchEvent(new CustomEvent('fraxinami-home-filter'));
   app.querySelector('#coleccion')?.scrollIntoView({behavior:'instant',block:'start'});
  }));
 }};
}
