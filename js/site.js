/* Fraxinami shared UI: root-relative static routing compatible with local server and Pages. */
export const ROOT = new URL(document.documentElement.dataset.root || './', document.baseURI);
export const path = file => new URL(file || '', ROOT).href;
export const linkTo = item => path(`${item.categorySlug}/${item.slug}/`);
export const imageFor = item => path(item.image);
export const thumbnailFor = item => path(item.thumbnail || item.image);
export const normalize = input => String(input??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').trim();
export const cleanTag = tag => String(tag??'').replace(/^#+/,'').trim();
export const escapeHtml = value => String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export const prettyNumber = n => Number(n).toLocaleString('es-PE');
export function searchLink(value){return `${path('search/')}?${new URLSearchParams({q:String(value || '')})}`;}
export const CATEGORIES=[
 ['Móviles','moviles'], ['Escritorio','escritorio'],
 ['Anime','anime'], ['Waifus','waifus'], ['Cosplay','cosplay'],
 ['Ecchi','ecchi'], ['Paisajes anime','paisajes-anime'], ['Cielos','cielos'], ['Nubes','nubes'],
 ['Paisajes','paisajes'],['Naturaleza','nature'],['Adorables','cute'],
 ['Oscuros','black-dark'],['Videojuegos','games'],
 ['Autos','cars'],['Motos','bikes'],['Espacio','space']
];
// Móviles y Escritorio son vistas del catálogo, no categorías para publicar.
export const PUBLISH_CATEGORIES=CATEGORIES.filter(([,slug])=>!['moviles','escritorio'].includes(slug));
// Old category routes remain valid for existing published items, but are not offered to new uploads.
const LEGACY_CATEGORY_NAMES={abstract:'Abstractos',movies:'Películas',music:'Música',technology:'Tecnología','anime-wallpapers':'Anime','anime-fanart':'Anime',fantasy:'Fantasía','fanart-ecchi':'Fanart Ecchi'};
export const categoryName = slug => CATEGORIES.find(x => x[1] === slug)?.[0] || LEGACY_CATEGORY_NAMES[slug] || slug;

const ICONS={download:'<path d="M12 2v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',check:'<path d="M5 12l4 4L19 6"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',heart:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21l8.84-8.61a5.5 5.5 0 0 0 0-7.78Z"/>'};
export const icon=(name,size=18)=>`<svg class="icon-svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.image}</svg>`;
const fa=(name,kind='solid')=>`<i class="fa-${kind} fa-${name}" aria-hidden="true"></i>`;
const FAVORITES_KEY='fraxinami-wallpapers:favorites-v2';
const ECCHI_KEY='fraxinami-wallpapers:show-ecchi';
const AI_KEY='fraxinami-wallpapers:show-ai';
let showEcchi=true,showAI=true;
try{showEcchi=localStorage.getItem(ECCHI_KEY)!=='false';showAI=localStorage.getItem(AI_KEY)!=='false';}catch{}
export const ecchiEnabled=()=>showEcchi;
export const isEcchi=item=>item?.ecchi===true||item?.rating==='ecchi'||['ecchi','fanart-ecchi'].includes(item?.categorySlug);
export const isAI=item=>item?.ai===true||item?.generatedAI===true;
export const aiEnabled=()=>showAI;
export const visibleCatalog=items=>items.filter(item=>(showEcchi||!isEcchi(item))&&(showAI||!isAI(item)));
function syncEcchiToggle(){
 const button=document.getElementById('ecchi-toggle');
 if(button){button.setAttribute('aria-checked',String(showEcchi));button.classList.toggle('enabled',showEcchi);button.setAttribute('aria-label',showEcchi?'Ocultar contenido Ecchi':'Mostrar contenido Ecchi');}
 const ecchiIcon=document.getElementById('ecchi-visibility-icon');if(ecchiIcon)ecchiIcon.className=`fa-solid fa-${showEcchi?'eye':'eye-slash'}`;
 document.querySelectorAll('.ecchi-category').forEach(link=>link.hidden=!showEcchi);
 const aiLink=document.getElementById('ai-category');if(aiLink)aiLink.hidden=!showAI;
 const aiBtn=document.getElementById('ai-toggle');if(aiBtn){aiBtn.setAttribute('aria-checked',String(showAI));aiBtn.classList.toggle('enabled',showAI);}
}
function setEcchi(value){showEcchi=!!value;try{localStorage.setItem(ECCHI_KEY,String(showEcchi));}catch{}
 syncEcchiToggle();document.dispatchEvent(new CustomEvent('contentchange',{detail:{ecchi:showEcchi}}));}
function setAI(value){showAI=!!value;try{localStorage.setItem(AI_KEY,String(showAI));}catch{}
 syncEcchiToggle();document.dispatchEvent(new CustomEvent('contentchange',{detail:{ai:showAI}}));}
export function externalUrl(value){
 try{const url=new URL(String(value));return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}

let favorites=new Set();
try{let f=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');if(Array.isArray(f))favorites=new Set(f.filter(x=>typeof x==='string'));}catch{}
export const isFavorite=id=>favorites.has(id);
export const favoritesList=()=>new Set(favorites);
export function syncFavorites(){
 document.querySelectorAll('[data-favorite-id]').forEach(button=>{
  const selected=isFavorite(button.dataset.favoriteId);
  button.classList.toggle('is-favorite',selected);button.setAttribute('aria-pressed',String(selected));
  button.setAttribute('aria-label',selected?'Quitar de favoritos':'Añadir a favoritos');
  const label=button.querySelector('[data-favorite-label]');if(label)label.textContent=selected?'Guardado en favoritos':'Guardar en favoritos';
  const heart=button.querySelector('[data-heart-icon]');if(heart)heart.className=`fa-${selected?'solid':'regular'} fa-heart`;
 });
}
export function toggleFavorite(id){if(favorites.has(id))favorites.delete(id);else favorites.add(id);try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...favorites]));}catch{}syncFavorites();document.dispatchEvent(new CustomEvent('favoritechange',{detail:{id,liked:favorites.has(id)}}));return favorites.has(id);}
export function toast(message){const node=document.getElementById('toast');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2200);}
function setTheme(theme){const selected=theme==='light'?'light':'dark';document.documentElement.dataset.theme=selected;const themeMeta=document.querySelector('meta[name="theme-color"]');if(themeMeta)themeMeta.content=selected==='light'?'#f6f3fa':'#222029';try{localStorage.setItem('fraxinami-wallpapers:theme',selected);}catch{}
 const btn=document.getElementById('theme-toggle');if(btn){btn.innerHTML=fa(selected==='dark'?'sun':'moon','regular');btn.setAttribute('aria-label',selected==='dark'?'Activar modo claro':'Activar modo oscuro');btn.title=btn.getAttribute('aria-label');}}
export function initSite(){
 let theme='dark';try{theme=localStorage.getItem('fraxinami-wallpapers:theme')||'dark';}catch{}
 const menu=CATEGORIES.map(([name,slug])=>`<a ${['ecchi','fanart-ecchi'].includes(slug)?'class="ecchi-category" hidden':''} href="${path(slug+'/')}"><span>${escapeHtml(name)}</span>${fa('angle-right')}</a>`).join('')+
 
 `<a id="ai-category" href="${path('ai/')}" hidden><span>Wallpapers IA</span>${fa('angle-right')}</a>`+
 `<div class="content-settings"><span class="content-settings-label"><i id="ecchi-visibility-icon" class="fa-solid fa-eye" aria-hidden="true"></i> Contenido Ecchi</span><button type="button" id="ecchi-toggle" class="content-switch" role="switch" aria-checked="true" aria-label="Ocultar contenido Ecchi"><span class="content-switch-thumb"></span></button></div>`+
 `<div class="content-settings content-settings--ai"><span class="content-settings-label"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Contenido IA</span><button type="button" id="ai-toggle" class="content-switch" role="switch" aria-checked="true" aria-label="Mostrar contenido IA"><span class="content-switch-thumb"></span></button></div>`+
 `<a class="donations-menu-link" href="${path('donaciones/')}"><span><i class="fa-solid fa-mug-hot" aria-hidden="true"></i> Donaciones voluntarias</span>${fa('angle-right')}</a>`;
 document.getElementById('site-header').innerHTML=`<header class="site-header"><div class="header-inner">
  <a class="brand" href="${path('')}" aria-label="Fraxinami Wallpapers - Inicio"><span class="brand-symbol-wrap" aria-hidden="true"><img src="${path('assets/icons/fraxinami-symbol-dark.svg')}" class="brand-symbol brand-symbol--dark" alt=""><img src="${path('assets/icons/fraxinami-symbol-light.svg')}" class="brand-symbol brand-symbol--light" alt=""></span><span class="brand-wordmark" aria-hidden="true"><span class="brand-name">fraxinami<span class="brand-period">.</span></span><span class="brand-caption">WALLPAPERS</span></span></a>
  <form class="global-search" action="${path('search/')}" method="get"><input name="q" type="search" id="site-search" placeholder="Buscar wallpapers" autocomplete="off" aria-label="Buscar wallpapers"><button class="search-clear" type="button" id="search-clear" aria-label="Limpiar búsqueda" title="Limpiar búsqueda" hidden>${fa('xmark')}</button><button class="search-submit" aria-label="Buscar" type="submit">${fa('magnifying-glass')}</button></form>
  <nav class="header-actions" aria-label="Navegación"><div class="category-menu-wrap"><button class="nav-btn nav-categories" id="category-toggle" type="button" aria-controls="categories-menu" aria-expanded="false">Categorías ${fa('bars-staggered')}</button><div id="categories-menu" class="category-menu" aria-hidden="true">${menu}</div></div>
  <a class="nav-btn nav-icon favorites-nav" href="${path('favoritos/')}" aria-label="Favoritos" title="Favoritos">${fa('heart','regular')}</a>
  <button class="nav-btn nav-icon" id="theme-toggle" type="button" aria-label="Cambiar tema"></button></nav>
 </div></header>`;
 document.getElementById('site-footer').innerHTML=`<footer class="footer"><div class="footer-inner"><nav class="footer-links" aria-label="Información legal y contacto"><a href="${path('privacy/')}">PRIVACIDAD</a><a href="${path('tos/')}">TÉRMINOS</a><a href="${path('copyright/')}">DERECHOS DE AUTOR</a><a href="${path('contact-us/')}">CONTACTO</a><a href="${path('upload/')}">PUBLICACIONES</a></nav><div class="footer-copy">© ${new Date().getFullYear()} FRAXINAMI.COM</div></div></footer>`;
 const toggle=document.getElementById('category-toggle'),panel=document.getElementById('categories-menu');
 const close=()=>{toggle.setAttribute('aria-expanded','false');panel.classList.remove('open');panel.setAttribute('aria-hidden','true');};
 toggle.addEventListener('click',()=>{const opening=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(opening));panel.classList.toggle('open',opening);panel.setAttribute('aria-hidden',String(!opening));});
 document.addEventListener('click',event=>{if(!event.target.closest('.category-menu-wrap'))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
 document.getElementById('theme-toggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
 document.getElementById('ecchi-toggle').addEventListener('click',()=>setEcchi(!showEcchi));
 document.getElementById('ai-toggle').addEventListener('click',()=>setAI(!showAI));
 syncEcchiToggle();
 const backTop=document.createElement('button');backTop.type='button';backTop.id='back-to-top';backTop.className='back-to-top';
 backTop.innerHTML='<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';
 backTop.setAttribute('aria-label','Volver arriba');backTop.title='Volver arriba';document.body.append(backTop);
 const syncBackTop=()=>{backTop.classList.toggle('visible',window.scrollY>320);};
 window.addEventListener('scroll',syncBackTop,{passive:true});syncBackTop();
 backTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 const searchInput=document.getElementById('site-search');
 const clearButton=document.getElementById('search-clear');
 searchInput.value=document.documentElement.dataset.page==='search'?(new URLSearchParams(location.search).get('q')||''):'';
 const syncClear=()=>{clearButton.hidden=!searchInput.value.trim();};
 searchInput.addEventListener('input',syncClear);
 clearButton.addEventListener('click',()=>{searchInput.value='';syncClear();searchInput.focus();});
 syncClear();
 setTheme(theme);
 document.addEventListener('click',event=>{const btn=event.target.closest('[data-favorite-id]');if(!btn)return;event.preventDefault();event.stopPropagation();const added=toggleFavorite(btn.dataset.favoriteId);toast(added?'Añadido a favoritos':'Eliminado de favoritos');});
 syncFavorites();
}
export function renderCard(item){
 const name=escapeHtml(item.title),url=linkTo(item),src=thumbnailFor(item),liked=isFavorite(item.id);
 const w=Number(item.thumbnailWidth||item.previewWidth||item.width),h=Number(item.thumbnailHeight||item.previewHeight||item.height);
 const ratio=(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0)?`${w} / ${h}`:'16 / 9';
 return `<article class="gallery-card" style="--wallpaper-ratio:${ratio}"><div class="card-media"><a class="card-image" href="${url}" aria-label="Ver ${name}"><img class="card-subject" src="${src}" alt="${name}" loading="lazy" decoding="async"></a><button class="card-heart ${liked?'is-favorite':''}" data-favorite-id="${escapeHtml(item.id)}" type="button" aria-pressed="${String(liked)}" aria-label="${liked?'Quitar de favoritos':'Añadir a favoritos'}"><i data-heart-icon class="fa-${liked?'solid':'regular'} fa-heart" aria-hidden="true"></i></button></div><a class="card-title" title="${name}" href="${url}">${name}</a></article>`;
}
export const sectionTitle=(value,tag='h2')=>`<div class="section-title"><${tag}>${escapeHtml(value)}</${tag}></div>`;
export const emptyState=(title,body,link=path(''),label='Volver al inicio')=>`<div class="empty-state"><i class="fa-regular fa-image"></i><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p><a href="${link}" class="button">${escapeHtml(label)}</a></div>`;
export async function readCatalog(){const response=await fetch(path('data/wallpapers.json'),{cache:'no-cache'});if(!response.ok)throw new Error(`Catálogo no disponible (${response.status})`);const data=await response.json();if(!Array.isArray(data))throw new Error('Formato de catálogo no válido');return data;}
