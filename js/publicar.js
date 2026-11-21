import {CATEGORIES,PUBLISH_CATEGORIES,escapeHtml,icon,path,toast,externalUrl} from './site.js?v=10.7';
import {crearZip} from './zip.js?v=10.7';
import {buildIndexFiles} from './indexador.js?v=10.9.6';
import {renderDetailDocument} from './seo.js?v=10.9.4';

/* Private workflow URL, public static page: no server write permissions and no login.
   Creates a patch ZIP with new image(s), new route(s), and the complete updated catalog. */
const MAX_BYTES=60*1024*1024;
const TYPES=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/avif','avif']]);
const $=id=>document.getElementById(id);
const safeImageLink=value=>{try{const u=new URL(String(value));return u.protocol==='https:'?u.href:'';}catch{return '';}};
const slugify=s=>{const base=String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return base.slice(0,40).replace(/-+$/,'')||'wallpaper';};
function dateToday(){const dt=new Date();return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
function parseTags(value){
  const raw=value.includes(',')||value.includes('\n')?value.split(/[,\n]+/):value.match(/#[\p{L}\p{N}_-]+|[\p{L}\p{N}_-]+/gu)||[];
  const seen=new Set();const tags=[];
  for(const t of raw){const cleaned=t.trim().replace(/^#+/,'').replace(/[<>"']/g,'').slice(0,55);if(!cleaned)continue;const norm=cleaned.toLocaleLowerCase();if(seen.has(norm))continue;seen.add(norm);tags.push('#'+cleaned);}
  return tags.slice(0,24);
}
async function makeThumbnail(url){
 const image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Error preparando miniatura'));image.src=url;});
 const scale=Math.min(1,720/image.naturalWidth,1100/image.naturalHeight);
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No hay soporte de canvas');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.80));
 canvas.width=0;canvas.height=0;
 return blob?.type==='image/webp'?new Uint8Array(await blob.arrayBuffer()):null;
}
async function makeOgImage(url){
 const img=new Image();
 await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error('No se pudo preparar la imagen Open Graph'));img.src=url;});
 const width=1200,height=630;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas no disponible');
 const cover=Math.max(width/img.naturalWidth,height/img.naturalHeight);
 const cw=img.naturalWidth*cover,ch=img.naturalHeight*cover;
 ctx.save();ctx.filter='blur(26px) brightness(0.65)';ctx.drawImage(img,(width-cw)/2,(height-ch)/2,cw,ch);ctx.restore();
 const contain=Math.min(width/img.naturalWidth,height/img.naturalHeight);
 const fw=img.naturalWidth*contain,fh=img.naturalHeight*contain;
 ctx.drawImage(img,(width-fw)/2,(height-fh)/2,fw,fh);
 const blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',.78));
 canvas.width=0;canvas.height=0;
 return blob?new Uint8Array(await blob.arrayBuffer()):null;
}
async function imageDimensions(url){return new Promise((resolve,reject)=>{
 const img=new Image();let finished=false;
 const finish=(error,dims)=>{if(finished)return;finished=true;clearTimeout(timer);img.onload=null;img.onerror=null;error?reject(error):resolve(dims);};
 const timer=setTimeout(()=>finish(new Error('La imagen tardó demasiado en cargar')),12000);
 img.onload=()=>finish(null,{width:img.naturalWidth,height:img.naturalHeight});
 img.onerror=()=>finish(new Error('No se pudo abrir la imagen'));img.src=url;
});}
function msg(text,error=false){const el=$('publish-status');el.textContent=text;el.style.color=error?'#f39eac':'var(--muted)';}
let uploaded=null,preview=null,queued=[],catalog=[],templateDetail='',incrementalMode=false,lastPublicationNumber=0;
function refreshQueue(){
 $('queue-count').textContent=queued.length;
 $('export-package').disabled=!queued.length;
 $('queued-list').innerHTML=queued.length?queued.map((item,i)=>`<div class="queue-item"><img src="${escapeHtml(item.preview)}" alt=""/><div class="queue-item__body"><strong>${escapeHtml(item.record.title)}</strong><small>${item.record.width}×${item.record.height} · ${escapeHtml(item.record.category)}</small></div><button type="button" data-remove="${i}" title="Eliminar de la lista" aria-label="Eliminar ${escapeHtml(item.record.title)}">×</button></div>`).join(''):'<div class="queue-empty">Todavía no hay imágenes preparadas.</div>';
}
async function choose(file){
 if(!file)return;
 if(!TYPES.has(file.type)||file.size>MAX_BYTES){msg('Selecciona un JPG, PNG, WEBP o AVIF de máximo 60 MB.',true);return;}
 if(preview)URL.revokeObjectURL(preview);
 preview=URL.createObjectURL(file);
 try{const dims=await imageDimensions(preview);uploaded={file,dims};$('drop-image').hidden=false;$('drop-image').src=preview;msg(`Imagen preparada: ${file.name} (${dims.width}×${dims.height}).`);}
 catch{uploaded=null;msg('No se pudo leer la imagen.',true);}
}
function syncRecommendedOptions(){
 const select=$('pub-recommended');if(!select)return;
 const old=select.value;
 const entries=[['original','Original']];
 for(const group of ['desktop','mobile']){
  if(!$(`pub-has-${group}`).checked)continue;
  for(const row of $(`pub-${group}-rows`).querySelectorAll('[data-variant-row]')){
   const size=row.querySelector('[data-variant-size]').value.trim().replaceAll('×','x').replace(/\s+/g,'').toLowerCase();
   const url=row.querySelector('[data-variant-url]').value.trim();
   if(/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(size) && url)entries.push([`${group}:${size}`,`${group==='desktop'?'PC':'Móviles'} · ${size}`]);
  }
 }
 select.innerHTML=entries.map(([key,label])=>`<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join('');
 select.value=entries.some(e=>e[0]===old)?old:'original';
}
function syncDeviceFields(){
 for(const group of ['desktop','mobile']){
  const checked=$(`pub-has-${group}`)?.checked;
  const block=$(`pub-${group}-fields`);if(block)block.hidden=!checked;
 }
 syncRecommendedOptions();
}
let nextVariant=1;
function appendVariant(group){
 const holder=$(`pub-${group}-rows`),n=nextVariant++;
 const row=document.createElement('div');row.className='variant-row';row.dataset.variantRow=group;
 row.innerHTML=`<div class="field"><label for="variant-size-${n}">Resolución</label><input id="variant-size-${n}" data-variant-size type="text" inputmode="text" placeholder="1920x1080" aria-label="Resolución ${group}" /></div><div class="field"><label for="variant-url-${n}">Enlace del archivo JPG / PNG / WEBP</label><input id="variant-url-${n}" data-variant-url type="url" inputmode="url" placeholder="https://cdn.ejemplo.com/fondo.jpg" aria-label="Enlace ${group}" /></div><button type="button" class="variant-remove" title="Eliminar resolución" aria-label="Eliminar resolución"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
 holder.append(row);syncRecommendedOptions();return row;
}
function readVariants(group){
 if(!$(`pub-has-${group}`).checked)return [];
 const rows=[...$(`pub-${group}-rows`).querySelectorAll('[data-variant-row]')],seen=new Set(),result=[];
 for(const row of rows){
  const size=row.querySelector('[data-variant-size]').value.trim().replaceAll('×','x').replace(/\s+/g,'').toLowerCase();
  const url=row.querySelector('[data-variant-url]').value.trim();
  if(!size&&!url)continue;
  if(!/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(size))throw Error(`Indica dimensiones correctas en ${group==='desktop'?'PC':'Móviles'} (ejemplo: 1080x1080).`);
  if(!externalUrl(url))throw Error(`Indica un enlace completo para ${size}.`);
  if(seen.has(size))throw Error(`La resolución ${size} está repetida en ${group==='desktop'?'PC':'Móviles'}.`);
  seen.add(size);result.push({size,url});
 }
 return result;
}
async function addToQueue(e){
 e.preventDefault();
 const title=$('pub-title').value.trim(),author=$('pub-author').value.trim(),categorySlug=$('pub-category').value;
 const category=CATEGORIES.find(x=>x[1]===categorySlug)?.[0];
 const tags=parseTags($('pub-tags').value);
 const pubEcchi=$('pub-ecchi').checked||categorySlug==='fanart-ecchi'||categorySlug==='ecchi';
 for(const [flag,tag] of [['pub-ecchi','Ecchi'],['pub-ai','IA']]){
  if((flag==='pub-ecchi'?pubEcchi:$(flag).checked)&&!tags.some(t=>t.replace(/^#/,'').toLowerCase()===tag.toLowerCase()))tags.push('#'+tag);
 }
 const authorUrl=$('pub-author-url').value.trim();
 const originalUrl=$('pub-original-url').value.trim();
 const originalDimensions=$('pub-original-size').value.trim().toLowerCase().replaceAll('×','x').replace(/\s+/g,'');
 const coverUrl=$('pub-cover-url').value.trim();
 const thumbUrl=$('pub-thumb-url').value.trim();
 const ogImageUrl=$('pub-og-image-url').value.trim();
 const hasDesktopVersion=$('pub-has-desktop').checked,hasMobileVersion=$('pub-has-mobile').checked;
 const description=$('pub-description').value.trim();
 if(!uploaded&&!originalUrl){msg('Para publicar solo con enlaces, pega la URL del original y sus dimensiones. La subida local es opcional.',true);return;}
 for(const [label,url] of [['Original',originalUrl],['Portada',coverUrl],['Miniatura',thumbUrl],['Link preview (OG)',ogImageUrl]]){
  if(url&&!safeImageLink(url)){msg(`El enlace de ${label} debe ser una URL pública HTTPS completa.`,true);return;}
 }
 if(originalUrl&&!/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(originalDimensions)){
  msg('Escribe las dimensiones reales del original externo, por ejemplo 3840x2160.',true);return;
 }
 if(authorUrl&&!/^https?:\/\/[^\s/]+/i.test(authorUrl)){msg('La URL del artista debe comenzar por https:// o http://',true);return;}
 if(!title||!category||!tags.length){msg('Completa título, categoría y al menos una etiqueta.',true);return;}
 let versions;
 try{versions={desktop:readVariants('desktop'),mobile:readVariants('mobile')}}
 catch(error){msg(error.message,true);return;}
 const actualW=originalUrl?Number(originalDimensions.split('x')[0]):uploaded.dims.width;
 const actualH=originalUrl?Number(originalDimensions.split('x')[1]):uploaded.dims.height;
 if(hasMobileVersion&&!versions.mobile.length&&actualW>=actualH){
  msg('Para habilitar Móviles con un original horizontal, añade al menos una resolución móvil con su enlace.',true);return;
 }
 const recommendationChoice=$('pub-recommended').value;
 const recommended=recommendationChoice==='original'?{group:'original',size:`${actualW}x${actualH}`}:(()=>{const [group,size]=recommendationChoice.split(':');return {group,size};})();
 if(recommended.group!=='original'&&!versions[recommended.group]?.some(v=>v.size===recommended.size)){
  msg('El archivo recomendado debe corresponder a una resolución con enlace.',true);return;
 }
 // Un número consecutivo global por publicación: titulo-1, titulo-2, etc.
 // Se conserva en el manifiesto para que borrar una publicación no lo reutilice.
 const base=slugify(title),existing=[...catalog,...queued.map(q=>q.record)];
 let publicationNumber=Math.max(lastPublicationNumber,...existing.map(x=>Number.isSafeInteger(Number(x.publicationNumber))&&Number(x.publicationNumber)>0?Number(x.publicationNumber):0),0)+1;
 if(!Number.isSafeInteger(publicationNumber))throw Error('El contador de publicaciones no es válido.');
 let slug=`${base}-${publicationNumber}`;
 while(existing.some(x=>x.categorySlug===categorySlug&&x.slug===slug))slug=`${base}-${++publicationNumber}`;
 const needsLocalOriginal=!!uploaded&&(!originalUrl||!coverUrl||!thumbUrl||!ogImageUrl);
 const localOriginal=needsLocalOriginal?`assets/wallpapers/${slug}.${TYPES.get(uploaded.file.type)}`:null;
 const image=coverUrl||localOriginal||originalUrl;
 const originalDownloadUrl=originalUrl||((image!==localOriginal&&localOriginal)||null);
 const thumbnail=thumbUrl|| (uploaded?`assets/thumbs/${slug}.webp`:image);
 const ogImage=ogImageUrl||(uploaded?`assets/og/${slug}.jpg`:thumbUrl||image);
 // Para servidores externos se leen las dimensiones de las miniaturas sin convertirlas ni descargar los archivos.
 const [coverDims,thumbDims]=await Promise.all([
  coverUrl?imageDimensions(coverUrl).catch(()=>null):Promise.resolve(uploaded?.dims||null),
  thumbUrl?imageDimensions(thumbUrl).catch(()=>null):Promise.resolve(null)
 ]);
 const displayedDims=coverDims||uploaded?.dims||{width:actualW,height:actualH};
 const miniatureDims=thumbDims||displayedDims;
 const id=`fx-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.floor(Math.random()*1e9)}`;
 const record={id,slug,publicationNumber,title,category,categorySlug,author:author||'Desconocido',
  ...(authorUrl?{authorUrl}:{}),...(originalDownloadUrl?{originalUrl:originalDownloadUrl}:{}),
  ...(description?{description}:{}),ogImage,thumbnail,recommended,
  hasDesktopVersion,hasMobileVersion,versions,ecchi:pubEcchi,ai:$('pub-ai').checked,tags,
  image,width:actualW,height:actualH,previewWidth:displayedDims.width,previewHeight:displayedDims.height,
  thumbnailWidth:miniatureDims.width,thumbnailHeight:miniatureDims.height,
  vector:false,date:dateToday()};
 const displayPreview=coverUrl||preview||originalUrl;
 queued.push({record,file:uploaded?.file||null,localOriginal,preview:displayPreview,localPreview:preview});
 // No se libera el object URL hasta quitar el elemento de la lista o exportar el ZIP.
 uploaded=null;preview=null;$('drop-image').src='';$('drop-image').hidden=true;
 $('publish-form').reset();$('pub-author').value='Desconocido';$('pub-desktop-rows').innerHTML='';$('pub-mobile-rows').innerHTML='';syncDeviceFields();refreshQueue();
 msg(`«${title}» añadido con la URL /${categorySlug}/${slug}/. ${originalUrl?'Enlaces externos listos.':'Imagen local preparada.'}`);
}
function xmlEscape(value){return String(value).replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));}
function sitemap(records){const fixed=['','search/','favoritos/','ecchi/','ai/','moviles/','escritorio/','donaciones/','privacy/','tos/','copyright/','contact-us/','upload/'];
 const urls=new Set([...fixed,...CATEGORIES.map(x=>x[1]+'/'),...records.map(x=>`${x.categorySlug}/${x.slug}/`)]);
 return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(url=>`  <url><loc>${xmlEscape('https://fraxinami.com/'+url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
async function exportPackage(){
 if(!queued.length)return;const button=$('export-package');button.disabled=true;button.textContent='Preparando archivos…';
 try{
  const files=[];
  for(const item of queued){
   const rec=item.record;
   // Las URL externas se guardan tal cual, sin intentar copiar contenidos de Catbox u otro proveedor.
   if(rec.thumbnail?.startsWith('assets/thumbs/')){
    if(!item.localPreview)throw Error('Falta la imagen local para crear la miniatura.');
    const thumbnail=await makeThumbnail(item.localPreview);
    if(!thumbnail)throw Error('No se pudo exportar la miniatura WEBP.');
    files.push({name:rec.thumbnail,data:thumbnail});
   }
   if(rec.ogImage?.startsWith('assets/og/')){
    if(!item.localPreview)throw Error('Falta la imagen local para crear Open Graph.');
    const og=await makeOgImage(item.localPreview);
    if(!og)throw Error('No se pudo generar la miniatura OG.');
    files.push({name:rec.ogImage,data:og});
   }
   if(item.localOriginal&&item.file){files.push({name:item.localOriginal,data:new Uint8Array(await item.file.arrayBuffer())});}
   // Las fichas se construyen después de los índices para integrar datos y relacionados.
  }
  const records=[...queued.map(x=>x.record),...catalog];
  if(incrementalMode){
   // Lotes para decenas de miles: el navegador no descarga ni reconstruye toda la base.
   files.push({name:`data/imports/lote-${Date.now()}.json`,data:JSON.stringify(queued.map(x=>x.record),null,2)+'\n'});
  }else{
   if(records.length>2000)throw Error('El editor del navegador genera índices de hasta 2000 entradas; usa el modo lotes para cantidades grandes.');
   const indexFiles=buildIndexFiles(records,{lastPublicationNumber});
   const detailData=new Map(indexFiles.filter(f=>f.name.startsWith('data/index/items/')).map(f=>[f.name,JSON.parse(f.data)]));
   files.push({name:'data/wallpapers.json',data:JSON.stringify(records,null,2)+'\n'},{name:'sitemap.xml',data:sitemap(records)},...indexFiles.filter(f=>!f.name.startsWith('data/index/items/')));
   // Las recomendaciones pueden cambiar: regenerar las fichas de todos los registros.
   for(const rec of records){
    const key=`data/index/items/${rec.categorySlug}/${rec.slug}.json`;
    files.push({name:`${rec.categorySlug}/${rec.slug}/index.html`,data:renderDetailDocument(templateDetail,rec,'../../',detailData.get(key))});
   }
  }
  const zip=crearZip(files),url=URL.createObjectURL(zip);const a=document.createElement('a');
  a.href=url;a.download='fraxinami-publicaciones.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
  msg(incrementalMode?`Lote de ${queued.length} wallpapers preparado. Descomprímelo y ejecuta npm run importar para actualizar la fuente de datos; en modo API reimporta SQLite.`:`Paquete listo: ${queued.length} wallpapers, imágenes, fichas e índices actualizados. Descomprime en la raíz.`);
  toast('ZIP de publicaciones preparado');
 }catch(error){console.error(error);msg('Error al generar el ZIP: '+error.message,true);}
 finally{button.disabled=!queued.length;button.innerHTML=`${icon('download')} Descargar paquete ZIP`;}
}
export async function initPublisher(original,{incremental=false,lastNumber=0}={}){
 incrementalMode=incremental;catalog=original;
 lastPublicationNumber=Math.max(Number.isSafeInteger(Number(lastNumber))&&Number(lastNumber)>0?Number(lastNumber):0,...original.map(x=>Number.isSafeInteger(Number(x.publicationNumber))&&Number(x.publicationNumber)>0?Number(x.publicationNumber):0),0);
 // This is an unlisted static admin convenience panel, not an authentication layer.
 document.querySelector('meta[name="robots"]')?.setAttribute('content','noindex,nofollow');
 document.getElementById('app').innerHTML=`<section class="publish-heading"> <div class="section-title"><h1>Publicar wallpapers</h1></div><p class="publish-note">Este panel no aparece en el menú público. Prepara wallpapers con enlaces externos de Catbox u otros proveedores, o con imágenes locales. El panel genera el catálogo y las páginas para GitHub Pages en un ZIP: no modifica el servidor por sí solo.</p></section>
 <p class="publish-note"><a href="${path('editar/')}">Editar wallpapers</a> · <a href="${path('borrar/')}">Borrar wallpapers</a></p>
 <div class="publish-grid"><section class="publish-panel"><h2>Nueva publicación</h2>
 <form id="publish-form"><label class="drop-area" id="drop-area"><input id="pub-file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" aria-label="Archivo local opcional para publicar"/><div>${icon('upload')}<p><strong>Archivo local (opcional)</strong></p><small>Puedes combinarlo con URLs externas · JPG, PNG, WEBP o AVIF · Máximo 60 MB</small></div><img class="drop-preview" id="drop-image" hidden alt="Vista previa"/></label>
 <div class="field"><label for="pub-title">Título del wallpaper</label><input id="pub-title" type="text" required maxlength="95" placeholder="MiSide Mita Wallpaper"/></div>
 <div class="field-grid"><div class="field"><label for="pub-author">Artista</label><input id="pub-author" type="text" maxlength="60" value="Desconocido" /></div><div class="field"><label for="pub-category">Categoría</label><select id="pub-category">${PUBLISH_CATEGORIES.map(([title,slug])=>`<option value="${slug}">${escapeHtml(title)}</option>`).join('')}</select></div></div>
 <div class="field"><label for="pub-author-url">Enlace del artista (opcional)</label><input id="pub-author-url" type="url" placeholder="https://..." /></div>
 <div class="field"><label for="pub-description">Descripción de la publicación (opcional)</label><textarea id="pub-description" rows="3" maxlength="650" placeholder="Obtén este genial fondo de pantalla de MiSide Mita Wallpaper en resolución 964x542. Puedes descargarlo para tu computadora y celular, eligiendo entre las resoluciones disponibles."></textarea></div>
 <div class="publish-asset-box publish-image-links"><h3>Imágenes de visualización · Catbox / CDN</h3>
 <p class="publish-asset-help">Estas tres URLs son independientes y no se utilizan para descargar el original. Pega enlaces HTTPS públicos que abran directamente la imagen.</p>
 <div class="field"><label for="pub-og-image-url">Imagen · Link preview (Open Graph)</label><input id="pub-og-image-url" type="url" inputmode="url" placeholder="https://files.catbox.moe/preview.jpg" /><small>Miniatura para compartir en WhatsApp, Discord y redes. Puedes usar JPG/WebP liviano. Opcional: con archivo local se genera JPG automáticamente; sin archivo se utiliza la miniatura.</small></div>
 <div class="field"><label for="pub-thumb-url">Imagen · Thumb miniaturas</label><input id="pub-thumb-url" type="url" inputmode="url" placeholder="https://files.catbox.moe/thumb.webp" /><small>Imagen pequeña para el inicio, búsqueda, favoritos y wallpapers relacionados. Recomendada: WEBP optimizado. Si lo dejas vacío y no subes archivo local, se usará la imagen de portada (menos eficiente).</small></div>
 <div class="field"><label for="pub-cover-url">Imagen · Thumb portada</label><input id="pub-cover-url" type="url" inputmode="url" placeholder="https://files.catbox.moe/portada-720p.jpg" /><small>Imagen visible al abrir la ficha (normalmente 720p); el botón de descargar original utiliza un enlace distinto. Si la dejas vacía, se usa el archivo local o el enlace del original (que puede pesar más).</small></div>
 </div>
 <div class="publish-asset-box"><h3>Descargas · Original y más resoluciones</h3>
 <div class="field"><label for="pub-original-url">Enlace del archivo ORIGINAL (descarga)</label><input id="pub-original-url" type="url" inputmode="url" placeholder="https://archivos.tudominio.com/original.jpg" /></div>
 <div class="field"><label for="pub-original-size">Resolución real del original</label><input id="pub-original-size" type="text" placeholder="3840x2160" pattern="[0-9]{2,5}[xX][0-9]{2,5}" /><small>Obligatorio si utilizas un enlace externo. El original se descarga desde esta URL, no desde la portada.</small></div>
 <div class="variant-group"><label class="publish-checkbox"><input id="pub-has-desktop" type="checkbox" checked /><span>Mostrar resoluciones para PC</span></label><div id="pub-desktop-fields"><div class="variant-rows" id="pub-desktop-rows"></div><button class="variant-add" id="pub-add-desktop" data-add-variant="desktop" type="button"><i class="fa-solid fa-plus" aria-hidden="true"></i> Añadir resolución PC</button></div></div>
 <div class="variant-group"><label class="publish-checkbox"><input id="pub-has-mobile" type="checkbox" /><span>Mostrar resoluciones para Móviles</span></label><div id="pub-mobile-fields" hidden><div class="variant-rows" id="pub-mobile-rows"></div><button class="variant-add" id="pub-add-mobile" data-add-variant="mobile" type="button"><i class="fa-solid fa-plus" aria-hidden="true"></i> Añadir resolución móvil</button></div></div>
 <div class="field"><label for="pub-recommended">Descarga recomendada (botón principal)</label><select id="pub-recommended"><option value="original">Original</option></select><small>El original y el recomendado también estarán dentro de «Más resoluciones», además de sus botones de descarga.</small></div>
 </div>
 <label class="publish-checkbox"><input id="pub-ecchi" type="checkbox" /><span>Contenido Ecchi (visible por defecto; el visitante puede ocultarlo)</span></label>
 <label class="publish-checkbox"><input id="pub-ai" type="checkbox" /><span>Generado con IA (los visitantes pueden ocultarlo)</span></label>
 <div class="field"><label for="pub-tags">Hashtags / etiquetas</label><textarea id="pub-tags" required placeholder="#Anime, #MiSide, #Mita, #Dark purple"></textarea></div>
 <button type="submit" class="button">${icon('check')} Añadir a la lista</button><p class="publish-status" id="publish-status" role="status">${incrementalMode?'Catálogo remoto: modo lotes activo.':`Catálogo actual: ${catalog.length} publicaciones.`} ${incrementalMode?'Modo lotes: aplica los cambios en tu servidor con npm run importar.':'Los índices se regeneran al exportar.'}</p></form></section>
 <aside class="publish-panel"><h2>Publicaciones preparadas (<span id="queue-count">0</span>)</h2><div id="queued-list"><div class="queue-empty">Todavía no hay imágenes preparadas.</div></div><div class="publish-hint">${incrementalMode?'Modo lotes: el ZIP contiene las imágenes y los datos nuevos. Después de extraerlo, ejecuta <strong>npm run importar</strong> y actualiza el índice o la API.':'Al exportar se crearán <strong>índices paginados</strong>, las imágenes y cada carpeta <strong>/categoría/nombre-del-wallpaper/index.html</strong>.'}</div><button type="button" id="export-package" class="button button--primary" disabled>${icon('download')} Descargar paquete ZIP</button></aside></div>`;
 const det=await fetch(path('templates/detail.html'));
 if(!det.ok)throw new Error('No se encuentra la plantilla de publicación.');
 templateDetail=await det.text();
 document.querySelector('head').insertAdjacentHTML('beforeend','<meta name="robots" content="noindex,nofollow"/>');
 $('pub-file').addEventListener('change',e=>choose(e.target.files?.[0]));
 $('drop-area').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('dragover');});
 $('drop-area').addEventListener('dragleave',e=>e.currentTarget.classList.remove('dragover'));
 $('drop-area').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('dragover');choose(e.dataTransfer.files?.[0]);});
 $('publish-form').addEventListener('submit',addToQueue);
 $('pub-has-mobile').addEventListener('change',syncDeviceFields);$('pub-has-desktop').addEventListener('change',syncDeviceFields);syncDeviceFields();
 document.querySelectorAll('.publish-asset-box').forEach(panel=>panel.addEventListener('input',event=>{if(event.target.matches('[data-variant-size],[data-variant-url]'))syncRecommendedOptions();}));
 document.querySelectorAll('[data-add-variant]').forEach(b=>b.addEventListener('click',()=>appendVariant(b.dataset.addVariant)));
 document.querySelectorAll('.publish-asset-box').forEach(panel=>panel.addEventListener('click',e=>{const btn=e.target.closest('.variant-remove');if(btn){btn.closest('[data-variant-row]').remove();syncRecommendedOptions();}}));
 $('queued-list').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;const i=Number(b.dataset.remove);const removed=queued.splice(i,1)[0];if(removed?.localPreview)URL.revokeObjectURL(removed.localPreview);refreshQueue();});
 $('export-package').addEventListener('click',exportPackage);
}
