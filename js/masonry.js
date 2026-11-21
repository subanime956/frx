/* Masonry de orden natural: los primeros N elementos se sitúan en la primera fila
   (de izquierda a derecha). Luego cada tarjeta va a la columna más corta.
   No usa CSS columns, no hace zoom ni cambia el orden del catálogo. */
import {renderCard} from './site.js?v=10.7';
let active=null;
// Las 24 tarjetas siguen en la página, pero no se piden las 24 imágenes.
// Limita las solicitudes de miniaturas externas a las cercanas al viewport.
function createImageLoader(host){
 const pending=new Set();
 let running=0,disposed=false;
 const mobile=()=>window.matchMedia('(max-width:650px)').matches;
 const concurrency=()=>mobile()?3:5;
 const pump=()=>{
  if(disposed)return;
  while(running<concurrency()&&pending.size){
   const img=pending.values().next().value;
   pending.delete(img);
   if(!img.isConnected||!img.dataset.src)continue;
   const src=img.dataset.src;
   delete img.dataset.src;
   running++;
   let settled=false;
   const done=()=>{if(settled)return;settled=true;running=Math.max(0,running-1);pump();};
   img.addEventListener('load',done,{once:true});
   img.addEventListener('error',done,{once:true});
   img.src=src;
   // Una miniatura servida directamente de caché puede completarse de inmediato.
   if(img.complete)queueMicrotask(done);
  }
 };
 const add=img=>{if(!disposed&&img.dataset.src){pending.add(img);pump();}};
 let observer=null;
 if('IntersectionObserver' in window){
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){
    observer.unobserve(entry.target);add(entry.target);
   }
  },{rootMargin:'240px 0px',threshold:0});
  host.querySelectorAll('img.card-subject[data-src]').forEach(img=>observer.observe(img));
 }else{
  // Compatibilidad para navegadores antiguos: conservar lazy loading nativo.
  host.querySelectorAll('img.card-subject[data-src]').forEach(add);
 }
 return {destroy(){disposed=true;observer?.disconnect();pending.clear();}};
}
const count=()=>innerWidth<=650?2:innerWidth<=860?3:innerWidth<=1190?4:5;
export function mountMasonry(host,items){
 if(!host)return;
 if(active){active.imageLoader?.destroy();active.observer.disconnect();window.removeEventListener('resize',active.onResize);active=null;}
 host.classList.add('masonry');
 let lastWidth=0,lastCount=0,imageLoader=null;
 const paint=()=>{
  const n=count(),width=host.clientWidth;
  if(!width||(lastCount===n&&Math.abs(width-lastWidth)<1))return;
  lastCount=n;lastWidth=width;
  imageLoader?.destroy();
  host.style.setProperty('--masonry-cols',n);
  const fragment=document.createDocumentFragment(),columns=[];
  for(let i=0;i<n;i++){
   const col=document.createElement('div');col.className='masonry-column';col.dataset.column=String(i+1);
   columns.push(col);fragment.append(col);
  }
  host.replaceChildren(fragment);
  const heights=columns.map(()=>0);
  for(let i=0;i<items.length;i++){
   // Esto garantiza que 1,2,3,4,5 ocupen la primera fila en PC ancho y 1,2 en móvil.
   const target=i<n?i:heights.indexOf(Math.min(...heights));
   const wrapper=document.createElement('template');wrapper.innerHTML=renderCard(items[i]);
   const img=wrapper.content.querySelector('img.card-subject');
   if(img){
    img.dataset.src=img.getAttribute('src')||'';
    img.removeAttribute('src');
    img.setAttribute('fetchpriority','low');
   }
   columns[target].append(wrapper.content);
   heights[target]=columns[target].getBoundingClientRect().height;
  }
  imageLoader=createImageLoader(host);
 };
 paint();
 const observer=new ResizeObserver(()=>paint());observer.observe(host);

 // El viewport puede variar de columnas con barras laterales o modo responsive.
 const onResize=()=>paint();window.addEventListener('resize',onResize,{passive:true});
 // La observación de tamaño maneja el ancho; se desconecta el evento si el nodo se elimina.
 active={observer,onResize,get imageLoader(){return imageLoader;}};
}
