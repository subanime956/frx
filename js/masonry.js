/* Masonry de orden natural: los primeros N elementos se sitúan en la primera fila
   (de izquierda a derecha). Luego cada tarjeta va a la columna más corta.
   No usa CSS columns, no hace zoom ni cambia el orden del catálogo. */
import {renderCard} from './site.js?v=10.7';
let active=null;
const count=()=>innerWidth<=650?2:innerWidth<=860?3:innerWidth<=1190?4:5;
export function mountMasonry(host,items){
 if(!host)return;
 if(active){active.observer.disconnect();window.removeEventListener('resize',active.onResize);active=null;}
 host.classList.add('masonry');
 let lastWidth=0,lastCount=0;
 const paint=()=>{
  const n=count(),width=host.clientWidth;
  if(!width||(lastCount===n&&Math.abs(width-lastWidth)<1))return;
  lastCount=n;lastWidth=width;
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
   columns[target].append(wrapper.content);
   heights[target]=columns[target].getBoundingClientRect().height;
  }
 };
 paint();
 const observer=new ResizeObserver(()=>paint());observer.observe(host);

 // El viewport puede variar de columnas con barras laterales o modo responsive.
 const onResize=()=>paint();window.addEventListener('resize',onResize,{passive:true});
 // La observación de tamaño maneja el ancho; se desconecta el evento si el nodo se elimina.
 active={observer,onResize};
}
