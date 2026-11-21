import {cleanTag,emptyState,escapeHtml,imageFor,isFavorite,path,renderCard,searchLink,sectionTitle,syncFavorites,toast,visibleCatalog,isEcchi,ecchiEnabled,isAI,aiEnabled,externalUrl,categoryName} from './site.js?v=10.7';
import {rotarRelacionados} from './recomendaciones.js?v=10.7';
import {mountMasonry} from './masonry.js?v=10.9.3';
import {variantsFor,recommendedVariant,recommendationCaption,isLocalVariant,dimensionText,qualityOf} from './resoluciones.js?v=10.7';

// These remain available for pre-V7 LOCAL originals only. V7 publications use the exact user-entered URLs.
const PC=[[1920,1080],[1920,1200],[2560,1080],[2560,1440],[2880,1800],[3440,1440],[3840,1080],[3840,2160],[4480,2520],[5120,2880],[5120,2160],[5120,1440],[2560,1600]];
const MOBILE=[[720,1280],[750,1334],[828,1792],[1080,1920],[1125,2436],[1170,2532],[1242,2688],[1440,2560],[1440,3200],[2160,3840]];
const safeFile=s=>String(s).replace(/[^a-z0-9-]/gi,'-');
const fileExtension=s=>String(s).split(/[?#]/)[0].match(/\.(jpg|jpeg|png|webp|avif)$/i)?.[1]||'webp';
function directDownload(item,url,original=false,w=0,h=0){
 const external=externalUrl(url);
 if(external){window.open(external,'_blank','noopener,noreferrer');return;}
 const a=document.createElement('a');a.href=isLocalVariant(url)||/^assets\/wallpapers\/[\w/-]+\.(?:webp|jpe?g|png|avif)$/i.test(String(url||''))?path(url):imageFor(item);
 a.download=`${safeFile(item.slug)}-${original?'original':dimensionText(w,h)}.${fileExtension(item.image)}`;
 document.body.append(a);a.click();a.remove();
}
async function resizeLegacy(item,w,h){
 if(w*h>35000000)throw new Error('Resolución demasiado alta para el navegador');
 const img=new Image();img.crossOrigin='anonymous';
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=imageFor(item)});
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas no disponible');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const sw=img.naturalWidth,sh=img.naturalHeight;
 if(Math.abs(sw/sh-w/h)>.012){const k=Math.max(w/sw,h/sh);ctx.save();ctx.filter=`blur(${Math.max(12,Math.round(w/80))}px) brightness(.6)`;ctx.drawImage(img,(w-sw*k)/2,(h-sh*k)/2,sw*k,sh*k);ctx.restore();}
 const k=Math.min(w/sw,h/sh);ctx.drawImage(img,(w-sw*k)/2,(h-sh*k)/2,sw*k,sh*k);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('No se pudo exportar')),'image/png'));
 const uri=URL.createObjectURL(blob),a=document.createElement('a');a.href=uri;a.download=`${safeFile(item.slug)}-${dimensionText(w,h)}.png`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),15000);canvas.width=0;canvas.height=0;
}
const social=(url,label,icon)=>`<a class="social-link social-${icon}" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><i class="fa-brands fa-${icon}" aria-hidden="true"></i></a>`;
function legacyOptions(item,group){
 // A V6 local original still offers its former list, without claiming externally hosted alternate sizes.
 if(item.versions||externalUrl(item.originalUrl))return [];
 const w=Number(item.width),h=Number(item.height);
 if(group==='mobile' && item.hasMobileVersion!==true)return [];
 if(group==='desktop' && item.hasDesktopVersion===false)return [];
 return (group==='desktop'?PC:MOBILE).filter(([x,y])=>x<=w&&y<=h).map(([x,y])=>({w:x,h:y,group,legacyResize:true}));
}
function fullOptions(item){
 const explicit=variantsFor(item);
 const combined=[...explicit];
 for(const group of ['desktop','mobile']){
  for(const entry of legacyOptions(item,group)){
   if(!combined.some(v=>v.group===group&&v.w===entry.w&&v.h===entry.h))combined.push(entry);
  }
 }
 return combined;
}
function formatDescription(item){
 if(typeof item.description==='string'&&item.description.trim())return item.description.trim();
 const title=item.title||'este wallpaper';
 const mobile=item.hasMobileVersion===true||(item.hasMobileVersion==null&&Number(item.height)>Number(item.width));
 return `Obtén este genial fondo de pantalla de ${title} en resolución ${dimensionText(item.width,item.height)}. Puedes descargarlo para tu computadora${mobile?' y celular':''}, eligiendo entre las resoluciones disponibles.`;
}
export function renderDetail(item,related=[]){
 const app=document.getElementById('app');if(!item){app.innerHTML=emptyState('Wallpaper no encontrado','La publicación no está disponible.');return;}
 if(isEcchi(item)&&!ecchiEnabled()){app.innerHTML=emptyState('Contenido Ecchi oculto','Puedes mostrarlo desde Categorías.');return;}
 if(isAI(item)&&!aiEnabled()){app.innerHTML=emptyState('Contenido IA oculto','Puedes mostrarlo desde Categorías.');return;}
 const portrait=Number(item.height)>Number(item.width),image=imageFor(item),title=escapeHtml(item.title),liked=isFavorite(item.id);
 const authorUrl=externalUrl(item.authorUrl);
 const authorChip=authorUrl?`<a class="label-chip author-chip" href="${escapeHtml(authorUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.author||'Desconocido')}</a>`:`<span class="label-chip author-chip">${escapeHtml(item.author||'Desconocido')}</span>`;
 document.title=`${item.title} | Fraxinami Wallpapers`;
 const category=categoryName(item.categorySlug),description=escapeHtml(formatDescription(item));
 const tags=[...(item.tags||[]).map(cleanTag)];
 const hasChip=t=>tags.some(value=>value.toLocaleLowerCase('es')===t.toLocaleLowerCase('es'));
 const hasMobile=item.hasMobileVersion===true||(item.hasMobileVersion==null&&portrait);
 const hasDesktop=item.hasDesktopVersion!==false;
 if(hasMobile&&!hasChip('Móvil'))tags.push('Móvil');
 if(hasDesktop&&!hasChip('Escritorio'))tags.push('Escritorio');
 if(isEcchi(item)&&!tags.some(t=>t.toLowerCase()==='ecchi'))tags.push('Ecchi');
 if(isAI(item)&&!tags.some(t=>t.toLowerCase()==='ia'))tags.push('IA');
 const chips=tags.map(t=>{const url=t==='Móvil'?path('moviles/'):t==='Escritorio'?path('escritorio/'):searchLink(t);return `<a class="label-chip" href="${url}">${escapeHtml(t)}</a>`;}).join('');
 const target=encodeURIComponent(location.href),pic=encodeURIComponent(image),caption=encodeURIComponent(item.title);
 const shares=[social(`https://www.pinterest.com/pin/create/button/?url=${target}&media=${pic}&description=${caption}`,'Pinterest','pinterest-p'),social(`https://www.facebook.com/sharer/sharer.php?u=${target}`,'Facebook','facebook-f'),social(`https://twitter.com/intent/tweet?url=${target}&text=${caption}`,'X','x-twitter'),social(`https://www.reddit.com/submit?url=${target}&title=${caption}`,'Reddit','reddit-alien')].join('');
 const options=fullOptions(item),recommended=recommendedVariant(item,options),pcEnabled=item.hasDesktopVersion!==false,mobileEnabled=item.hasMobileVersion===true||(item.hasMobileVersion==null&&portrait);
 const pc=pcEnabled, mobile=mobileEnabled;
 const resolutionTabs=`${pc?'<button type="button" class="resolution-tab" data-device="desktop" aria-expanded="false" aria-controls="resolution-options"><i class="fa-solid fa-desktop" aria-hidden="true"></i> PC</button>':''}${mobile?'<button type="button" class="resolution-tab" data-device="mobile" aria-expanded="false" aria-controls="resolution-options"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i> Móviles</button>':''}`;
 app.innerHTML=`<section class="detail-intro">${sectionTitle(item.title,'h1')}<p class="detail-description">${description}</p></section>
 <div class="detail-layout">
  <section class="wallpaper-viewer" aria-label="Vista del wallpaper"><div class="hero-stage" data-orientation="${portrait?'portrait':'landscape'}" style="--original-ratio:${Math.max(1,Number(item.previewWidth||item.width)||1)} / ${Math.max(1,Number(item.previewHeight||item.height)||1)}"><img src="${image}" class="hero-backdrop" alt="" aria-hidden="true"><img src="${image}" class="hero-image" alt="${title}" fetchpriority="high"><button type="button" class="hero-heart ${liked?'is-favorite':''}" data-favorite-id="${escapeHtml(item.id)}" aria-pressed="${String(liked)}" aria-label="Añadir a favoritos"><i data-heart-icon class="fa-${liked?'solid':'regular'} fa-heart" aria-hidden="true"></i></button></div>
   ${resolutionTabs?`<div class="resolution-panel"><span class="resolution-label">Más resoluciones:</span>${resolutionTabs}<div class="resolution-collapse" id="resolution-collapse"><div class="resolution-collapse-inner"><div id="resolution-options" class="resolution-options"></div></div></div></div>`:''}
  </section>
  <aside class="wallpaper-sidebar"><div class="download-actions"><button type="button" id="download-best" class="button button--primary"><i class="fa-solid fa-download" aria-hidden="true"></i> ${escapeHtml(recommendationCaption(recommended))}</button><button type="button" id="download-original" class="button"><i class="fa-solid fa-download" aria-hidden="true"></i> Descargar original (${dimensionText(item.width,item.height)})</button></div>
   <div class="metadata-item"><div class="eyebrow">ARTISTA</div>${authorChip}</div>
   <div class="metadata-item"><div class="eyebrow">CATEGORÍA</div><a class="label-chip" href="${path(item.categorySlug+'/')}">${escapeHtml(category)}</a></div>
   <div class="metadata-item"><div class="eyebrow">ETIQUETAS</div><div class="tags">${chips}</div></div>
   <div class="metadata-item share-block"><div class="eyebrow">COMPARTIR</div><div class="share-actions">${shares}</div></div>
   <div class="report-block"><button type="button" class="report-trigger" id="report-trigger"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Reportar imagen</button></div>
  </aside></div>
 <section class="detail-related">${sectionTitle('Wallpapers relacionados')}<div class="gallery" aria-label="Wallpapers relacionados"></div></section>
 <dialog id="report-dialog" class="report-dialog" aria-labelledby="report-title">
  <form method="dialog" class="report-dialog-inner" id="report-form">
   <div class="report-dialog-heading"><h2 id="report-title">Reportar imagen</h2><button type="button" class="report-close" id="report-close" aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
   <label class="report-field">Motivo del reporte<select id="report-reason" required><option value="copyright">Infracción de derechos de autor</option><option value="quality">Imagen dañada o de baja calidad</option><option value="credit">Atribución incorrecta</option><option value="content">Contenido inapropiado</option><option value="other">Otro motivo</option></select></label>
   <label class="report-field">Enlace de la imagen<textarea id="report-url" rows="2" readonly>${escapeHtml(`https://fraxinami.com/${item.categorySlug}/${item.slug}/`)}</textarea></label>
   <label class="report-field">Detalles (opcional)<textarea id="report-details" rows="4" maxlength="3000" placeholder="Explica brevemente el problema para ayudarnos a revisarlo."></textarea></label>
   <p class="report-notice">Se abrirá Gmail con un borrador preparado. Podrás revisarlo antes de enviarlo.</p>
   <button class="button button--primary report-send" id="report-send" type="submit"><i class="fa-regular fa-envelope" aria-hidden="true"></i> Abrir en Gmail</button>
  </form>
 </dialog>`;
 mountMasonry(app.querySelector('.detail-related .gallery'),rotarRelacionados(visibleCatalog(related),12));
 syncFavorites();
 const reportDialog=document.getElementById('report-dialog');
 document.getElementById('report-trigger').addEventListener('click',()=>reportDialog.showModal());
 document.getElementById('report-close').addEventListener('click',()=>reportDialog.close());
 reportDialog.addEventListener('click',event=>{if(event.target===reportDialog)reportDialog.close();});
 document.getElementById('report-form').addEventListener('submit',event=>{
  event.preventDefault();
  const reason=document.getElementById('report-reason');
  const details=document.getElementById('report-details').value.trim();
  const pageUrl=document.getElementById('report-url').value.trim();
  const copyright=reason.value==='copyright';
  const subject=(copyright?'Solicitud copyright':'Reporte de imagen')+` — ${item.title}`;
  const text=[
   'Hola, equipo de Fraxinami:', '',
   'Quisiera reportar la siguiente publicación para su revisión:',pageUrl,'',
   `Imagen: ${item.title}`,
   `Motivo: ${reason.selectedOptions[0].textContent}`,
   ...(details?['','Detalles:',details]:[]), '',
   copyright?'Solicito que revisen los derechos de autor y retiren la imagen si corresponde.':'Solicito que revisen esta publicación y tomen las medidas correspondientes.',
   '', 'Gracias.'
  ].join('\n');
  const url=new URL('https://mail.google.com/mail/u/0/');
  url.search=new URLSearchParams({fs:'1',tf:'cm',to:'contact@fraxinami.com',su:subject,body:text}).toString();
  window.open(url.href,'_blank','noopener,noreferrer');
  reportDialog.close();
 });
 let busy=false;
 async function downloadVersion(entry,button){
  if(!entry){directDownload(item,item.originalUrl,true);return;}
  if(entry.url||entry.original){directDownload(item,entry.original?(item.originalUrl||entry.url):entry.url,!!entry.original,entry.w,entry.h);return;}
  if(!entry.legacyResize){directDownload(item,item.originalUrl,true);return;}
  if(busy)return;busy=true;button.disabled=true;
  try{await resizeLegacy(item,entry.w,entry.h);}catch(err){console.error(err);toast('No se pudo preparar la descarga');}finally{button.disabled=false;busy=false;}
 }
 const collapse=document.getElementById('resolution-collapse'),optionHost=document.getElementById('resolution-options');let selected=null,displayed=[];
 const originalOption=options.find(v=>v.original)||{w:Number(item.width),h:Number(item.height),original:true,group:'original',url:externalUrl(item.originalUrl)||null};
 // Mostrar las resoluciones sin duplicados ni etiquetas especiales. El original
 // solo pertenece al tipo de pantalla que corresponde a su orientación.
 const preferredGroup=Number(item.height)>Number(item.width)?'mobile':'desktop';
 const naturalGroup=(preferredGroup==='mobile'&&mobileEnabled)||(preferredGroup==='desktop'&&pcEnabled)?preferredGroup:(pcEnabled?'desktop':'mobile');
 function optionsForDevice(group){
  const list=options.filter(v=>v.group===group);
  if(group===naturalGroup)list.push({...originalOption,group,original:true});
  const seen=new Set();
  return list.filter(v=>{
   const size=dimensionText(v.w,v.h);
   if(seen.has(size))return false;
   seen.add(size);return true;
  });
 }
 document.querySelectorAll('.resolution-tab').forEach(btn=>btn.addEventListener('click',()=>{
  if(selected===btn.dataset.device){selected=null;collapse.classList.remove('expanded');optionHost.innerHTML='';displayed=[];}
  else{
   selected=btn.dataset.device;
   displayed=optionsForDevice(selected);
   optionHost.innerHTML=displayed.map((v,i)=>{
    const label=dimensionText(v.w,v.h);
    return `<button type="button" class="resolution-option" data-variant-index="${i}" aria-label="Descargar ${escapeHtml(label)}" title="${escapeHtml(label)}"><span>${label}</span></button>`;
   }).join('');
   collapse.classList.add('expanded');
  }
  document.querySelectorAll('.resolution-tab').forEach(t=>{t.classList.toggle('selected',t.dataset.device===selected);t.setAttribute('aria-expanded',String(t.dataset.device===selected));});
 }));
 optionHost?.addEventListener('click',event=>{
  const button=event.target.closest('[data-variant-index]');if(button)downloadVersion(displayed[Number(button.dataset.variantIndex)],button);
 });
 document.getElementById('download-original').addEventListener('click',()=>directDownload(item,item.originalUrl,true));
 document.getElementById('download-best').addEventListener('click',event=>{
  downloadVersion(recommended,event.currentTarget);
 });
}
