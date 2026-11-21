import {emptyState,sectionTitle,categoryName} from './site.js?v=10.7';
import {mountMasonry} from './masonry.js?v=10.9.3';
import {homeContent} from './inicio.js?v=10.9';
import {currentRandomLane} from './servicio.js?v=10.7';
const PAGE_SIZE=24;
function pageUrl(p){const url=new URL(location.href);url.searchParams.delete('page');if(p>1)url.searchParams.set('page',p);return url.href;}
function pagination(total,page){
 const pages=Math.ceil(total/PAGE_SIZE);
 if(pages<=1)return '';
 const seq=new Set([1,pages]);
 // Al principio se ven 1, 2, 3, 4; después, páginas cercanas y la última real.
 for(let p=1;p<=Math.min(4,pages);p++)seq.add(p);
 for(let p=page-1;p<=page+1;p++)if(p>=1&&p<=pages)seq.add(p);
 let prev=0,out='<nav class="pagination" aria-label="Paginación">';
 out+=page>1?`<a class="pager-nav" rel="prev" href="${pageUrl(page-1)}">‹ Anterior</a>`:'<span class="pager-disabled" aria-disabled="true">‹ Anterior</span>';
 for(const p of [...seq].sort((a,b)=>a-b)){
  if(prev&&p>prev+1)out+='<span class="dots" aria-hidden="true">...</span>';
  out+=p===page?`<span aria-current="page" class="current">${p}</span>`:`<a href="${pageUrl(p)}">${p}</a>`;
  prev=p;
 }
 out+=page<pages?`<a class="pager-nav next" rel="next" href="${pageUrl(page+1)}">Siguiente ›</a>`:'<span class="pager-disabled" aria-disabled="true">Siguiente ›</span>';
 return out+'</nav>';
}
export function renderGallery(page,{items,total}){
 const app=document.getElementById('app'),requested=Number(new URLSearchParams(location.search).get('page')||1);
 const n=Number.isInteger(requested)&&requested>0?requested:1;
 const titles={home:'Wallpapers recientes',category:categoryName(document.documentElement.dataset.category),favorites:'Mis favoritos',ecchi:'Wallpapers Ecchi',ai:'Wallpapers IA'};
 const q=new URLSearchParams(location.search).get('q')||'';
 const title=page==='search'?(q?`Resultados de búsqueda: ${q}`:'Buscar wallpapers'):(titles[page]||'Wallpapers');
 const home=page==='home'?homeContent(items,total):null;
 const heading=home?home.markup:`<section class="listing-heading">${sectionTitle(title,'h1')}</section>`;
 if(n>Math.max(1,Math.ceil(total/PAGE_SIZE))){app.innerHTML=heading+emptyState('Página no encontrada','No hay wallpapers en esta página.');return;}
 if(!items.length){
  if(page==='home'){
   app.innerHTML=heading+`<section class="empty-state" aria-live="polite"><i class="fa-regular fa-images" aria-hidden="true"></i><h2>La colección está por comenzar</h2><p>Pronto encontrarás wallpapers aquí.</p></section>`;
   home?.bind(app);return;
  }
  app.innerHTML=heading+emptyState('Sin resultados',page==='favorites'?'Todavía no has guardado favoritos.':'No hay wallpapers disponibles.');return;
 }
 app.innerHTML=heading+`<p class="home-filter-empty" hidden>No hay wallpapers de este tipo en esta página.</p><section class="gallery ${page==='home'?'gallery--home':''}" aria-label="Wallpapers"></section>`+pagination(total,n);
 mountMasonry(app.querySelector('.gallery'),items);
 home?.bind(app);
 if(page==='home'&&location.hash==='#aleatorio'&&currentRandomLane())app.querySelectorAll('.pagination a').forEach(link=>link.addEventListener('click',()=>{try{sessionStorage.setItem('fraxinami-next-random-lane',JSON.stringify({lane:currentRandomLane(),at:Date.now()}));}catch{}}));
}
