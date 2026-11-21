/* Panel web: exporta un ZIP de archivos modificados y una lista de borrados.
   Funciona en móvil/PC, sin Node ni escritura directa en GitHub Pages. */
import {readCatalog,escapeHtml,path,icon} from './site.js?v=10.7';
import {prepareAdminPackage} from './paquetes-gestion.js?v=10.9.6';
import {readManifest} from './servicio.js?v=10.9.4';
const $=id=>document.getElementById(id);
const copy=x=>JSON.parse(JSON.stringify(x));
const safeUrl=s=>{try{return new URL(s).protocol==='https:'}catch{return false}};
const sizeOk=s=>/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(s);
const slugText=s=>String(s??'').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const tagsOf=text=>{
 const parts=text.includes(',')||text.includes('\n')?text.split(/[,\n]+/):text.match(/#[\p{L}\p{N}_-]+|[\p{L}\p{N}_-]+/gu)||[];
 return [...new Set(parts.map(x=>x.trim().replace(/^#+/,'')).filter(Boolean).map(t=>'#'+t))].slice(0,24);
};
let records=[],pending=new Map(),selected=null,mode='edit',templateDetail='',lastPackage=null,lastPublicationNumber=0;
function status(text,error=false){const e=$('manager-status');e.textContent=text;e.classList.toggle('manager-error',error);}
function shown(rec){return pending.get(rec.id)?.after||rec;}
function urlOf(rec){return `${rec.categorySlug}/${rec.slug}/`;}
function itemRow(rec){
 const item=shown(rec),op=pending.get(rec.id);
 const title=escapeHtml(item.title||'(Sin título)');
 const mark=op?.type==='delete'?' · Preparado para borrar':op?.type==='edit'?' · Editado':'';
 const picture=item.thumbnail||item.image||'';
 return `<button class="manager-result ${selected===rec.id?'selected':''}" type="button" data-pick="${escapeHtml(rec.id)}">
  ${picture?`<img loading="lazy" alt="" src="${escapeHtml(path(picture))}"/>`:'<span class="manager-placeholder">▧</span>'}
  <span><strong>${title}</strong><small>${escapeHtml(urlOf(rec))}${mark}</small></span></button>`;
}
function drawList(){
 const q=slugText($('manager-search').value.trim()).replace(/^https?:\/\/[^/]+\//,'').replace(/\/$/,'');
 const found=!q?records:records.filter(x=>{const r=shown(x);return [r.title,r.id,r.slug,r.categorySlug,urlOf(r),...(r.tags||[])].some(y=>slugText(y).includes(q));});
 $('manager-count').textContent=`${found.length} resultados${found.length>40?' · mostrando 40':''}`;
 $('manager-results').innerHTML=found.slice(0,40).map(itemRow).join('')||'<p class="publish-note">No se encontraron publicaciones.</p>';
}
function drawQueue(){
 lastPackage=null;
 const preview=$('manager-file-preview');if(preview)preview.hidden=true;
 const ops=[...pending.values()];
 $('manager-pending-count').textContent=String(ops.length);
 $('manager-export').disabled=!ops.length;
 $('manager-preview').disabled=!ops.length;
 $('manager-pending').innerHTML=ops.length?ops.map(op=>`<div class="manager-pending-row"><span>${op.type==='delete'?'Eliminar':'Editar'}: ${escapeHtml(op.before.title)}</span><button type="button" data-undo="${escapeHtml(op.before.id)}">Deshacer</button></div>${op.type==='delete'?`<code class="manager-delete-path">Borrar: ${escapeHtml(urlOf(op.before)+'index.html')}</code>`:''}`).join(''):'<p class="queue-empty">Ningún cambio preparado.</p>';
}
function makeRow(group,v={}){
 const row=document.createElement('div');row.className='variant-row manager-variant-row';row.dataset.variantRow=group;
 row.innerHTML=`<div class="field"><label>Resolución</label><input data-variant-size value="${escapeHtml(v.size||'')}" placeholder="1920x1080" /></div><div class="field"><label>URL del archivo</label><input data-variant-url type="url" value="${escapeHtml(v.url||'')}" placeholder="https://files.catbox.moe/..." /></div><button class="variant-remove" type="button" data-remove-version aria-label="Eliminar resolución">×</button>`;
 $(`manager-${group}-rows`).append(row);
}
function readRows(group){
 const ret=[],seen=new Set();
 for(const row of $(`manager-${group}-rows`).querySelectorAll('.manager-variant-row')){
  const size=row.querySelector('[data-variant-size]').value.toLowerCase().trim().replaceAll('×','x').replaceAll(' ','');
  const url=row.querySelector('[data-variant-url]').value.trim();
  if(!size&&!url)continue;
  if(!sizeOk(size)||!safeUrl(url))throw Error(`Comprueba la resolución y URL HTTPS de ${group==='desktop'?'PC':'Móviles'}.`);
  if(seen.has(size))throw Error(`Resolución duplicada: ${size}`);
  seen.add(size);ret.push({size,url});
 }
 return ret;
}
function variantsSelect(){
 const select=$('manager-recommended'),old=select.value,options=[['original','Original']];
 for(const group of ['desktop','mobile']){
  if(!$(`manager-has-${group}`).checked)continue;
  for(const row of $(`manager-${group}-rows`).querySelectorAll('.manager-variant-row')){
   const size=row.querySelector('[data-variant-size]').value.trim().toLowerCase().replaceAll('×','x');
   const url=row.querySelector('[data-variant-url]').value.trim();
   if(sizeOk(size)&&safeUrl(url))options.push([`${group}:${size}`,`${group==='desktop'?'PC':'Móviles'} · ${size}`]);
  }
 }
 select.innerHTML=options.map(([value,label])=>`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
 select.value=options.some(x=>x[0]===old)?old:'original';
}
function renderSelected(){
 const original=records.find(x=>x.id===selected);
 if(!original){$('manager-editor').innerHTML='<p class="publish-note">Selecciona una publicación para continuar.</p>';return;}
 const op=pending.get(original.id),rec=shown(original);
 const editing=mode==='edit';
 $('manager-editor').innerHTML=`<div class="manager-selected-heading"><h2>${editing?'Editar':'Eliminar'} · ${escapeHtml(rec.title)}</h2><p class="publish-note">${escapeHtml('https://fraxinami.com/'+urlOf(rec))}</p></div>
 ${!editing?`<div class="manager-danger"><p>Se quitará de las galerías, búsquedas, tags, relacionados y sitemap. El ZIP incluirá todos los índices actualizados y una lista con las rutas exactas que debes borrar en GitHub. <strong>No se eliminará la imagen externa en Catbox.</strong></p>
  <button class="button manager-delete-button" type="button" id="manager-delete">${op?.type==='delete'?'Cancelar eliminación':'Preparar eliminación'}</button></div>`:
 `<form id="manager-edit-form">
  <p class="publish-note">La URL pública y la categoría se conservan para no romper enlaces existentes. Puedes reemplazar cualquier enlace externo y editar los hashtags.</p>
  <div class="field"><label>Título</label><input id="manager-title" maxlength="95" required value="${escapeHtml(rec.title||'')}" /></div>
  <div class="field-grid"><div class="field"><label>Artista</label><input id="manager-author" maxlength="60" value="${escapeHtml(rec.author||'')}" /></div><div class="field"><label>Enlace del artista</label><input id="manager-author-url" type="url" value="${escapeHtml(rec.authorUrl||'')}" /></div></div>
  <div class="field"><label>Descripción (opcional)</label><textarea id="manager-description" maxlength="650" rows="3">${escapeHtml(rec.description||'')}</textarea></div>
  <div class="publish-asset-box"><h3>Imágenes externas</h3>
   <div class="field"><label>Imagen Open Graph (compartir)</label><input id="manager-og" type="url" value="${escapeHtml(rec.ogImage||'')}" /></div>
   <div class="field"><label>Thumb miniaturas (galerías)</label><input id="manager-thumb" type="url" value="${escapeHtml(rec.thumbnail||'')}" /></div>
   <div class="field"><label>Thumb portada (ficha)</label><input id="manager-cover" type="url" value="${escapeHtml(rec.image||'')}" /></div>
  </div>
  <div class="field-grid"><div class="field"><label>Dimensiones de portada</label><input id="manager-preview-size" value="${Number(rec.previewWidth||rec.width)}x${Number(rec.previewHeight||rec.height)}" /></div><div class="field"><label>Dimensiones de miniatura</label><input id="manager-thumbnail-size" value="${Number(rec.thumbnailWidth||rec.width)}x${Number(rec.thumbnailHeight||rec.height)}" /></div></div>
  <div class="publish-asset-box"><h3>Descargas</h3>
   <div class="field"><label>URL del original</label><input id="manager-original" type="url" value="${escapeHtml(rec.originalUrl||rec.image||'')}" /></div>
   <div class="field"><label>Resolución real del original (ancho × alto)</label><input id="manager-size" value="${Number(rec.width)}x${Number(rec.height)}" /></div>
   <label class="publish-checkbox"><input type="checkbox" id="manager-has-desktop" ${rec.hasDesktopVersion!==false?'checked':''} /> Mostrar para PC</label>
   <div id="manager-desktop-rows" class="variant-rows"></div><button type="button" class="variant-add" data-add-group="desktop">+ Añadir resolución PC</button>
   <label class="publish-checkbox"><input type="checkbox" id="manager-has-mobile" ${rec.hasMobileVersion?'checked':''} /> Mostrar para móviles</label>
   <div id="manager-mobile-rows" class="variant-rows"></div><button type="button" class="variant-add" data-add-group="mobile">+ Añadir resolución móvil</button>
   <div class="field"><label>Descarga recomendada</label><select id="manager-recommended"></select></div>
  </div>
  <div class="field"><label>Hashtags / etiquetas</label><textarea rows="3" id="manager-tags" required>${escapeHtml((rec.tags||[]).join(', '))}</textarea></div>
  <label class="publish-checkbox"><input type="checkbox" id="manager-ecchi" ${rec.ecchi?'checked':''} /> Contenido Ecchi</label>
  <label class="publish-checkbox"><input type="checkbox" id="manager-ai" ${rec.ai?'checked':''} /> Generado con IA</label>
  <button class="button button--primary" type="submit">${icon('check')} Preparar edición</button>
 </form>`}
 `;
 if(!editing){$('manager-delete').addEventListener('click',()=>{
   if(op?.type==='delete'){pending.delete(original.id);status('Eliminación cancelada.');}
   else if(confirm(`¿Preparar para eliminar «${original.title}»? Después deberás borrar el archivo indicado de tu repositorio de GitHub.`)){
    pending.set(original.id,{type:'delete',before:copy(original)});status('Eliminación preparada. Puedes ver las rutas y descargar los archivos actualizados.');
   }
   drawQueue();drawList();renderSelected();
  });return;}
 for(const group of ['desktop','mobile'])for(const v of (rec.versions?.[group]||[]))makeRow(group,v);
 variantsSelect();
 const reco=rec.recommended||{};
 const target=reco.group==='original'||!reco.group?'original':`${reco.group}:${reco.size}`;
 if([...$('manager-recommended').options].some(x=>x.value===target))$('manager-recommended').value=target;
 $('manager-edit-form').addEventListener('input',e=>{if(e.target.matches('[data-variant-size],[data-variant-url],#manager-has-desktop,#manager-has-mobile'))variantsSelect();});
 $('manager-edit-form').addEventListener('click',e=>{
  const add=e.target.closest('[data-add-group]');if(add){makeRow(add.dataset.addGroup);variantsSelect();}
  const rm=e.target.closest('[data-remove-version]');if(rm){rm.closest('.variant-row').remove();variantsSelect();}
 });
 $('manager-edit-form').addEventListener('submit',e=>{
  e.preventDefault();
  try{
   const size=$('manager-size').value.trim().toLowerCase().replaceAll('×','x').replaceAll(' ','');
   if(!sizeOk(size))throw Error('La resolución original debe tener el formato 3840x2160.');
   const values={title:$('manager-title').value.trim(),author:$('manager-author').value.trim()||'Desconocido',authorUrl:$('manager-author-url').value.trim(),description:$('manager-description').value.trim(),ogImage:$('manager-og').value.trim(),thumbnail:$('manager-thumb').value.trim(),image:$('manager-cover').value.trim(),originalUrl:$('manager-original').value.trim()};
   if(!values.title)throw Error('El título es obligatorio.');
   for(const [label,url] of Object.entries(values)){if(['ogImage','thumbnail','image','originalUrl'].includes(label)&&!safeUrl(url))throw Error(`La URL ${label} debe ser HTTPS.`);}
   if(values.authorUrl&&!/^https?:\/\//.test(values.authorUrl))throw Error('El enlace del artista debe ser HTTP(S).');
   const previewSize=$('manager-preview-size').value.trim().toLowerCase().replaceAll('×','x').replaceAll(' ','');
   const thumbnailSize=$('manager-thumbnail-size').value.trim().toLowerCase().replaceAll('×','x').replaceAll(' ','');
   if(!sizeOk(previewSize)||!sizeOk(thumbnailSize))throw Error('Las dimensiones de portada y miniatura deben usar 1280x720, por ejemplo.');
   const versions={desktop:readRows('desktop'),mobile:readRows('mobile')};
   const hasDesktopVersion=$('manager-has-desktop').checked,hasMobileVersion=$('manager-has-mobile').checked;
   if(!hasDesktopVersion&&!hasMobileVersion)throw Error('Habilita PC o Móviles.');
   if(hasMobileVersion&&!versions.mobile.length&&Number(size.split('x')[0])>=Number(size.split('x')[1]))throw Error('Necesitas una resolución móvil si el original es horizontal.');
   const choice=$('manager-recommended').value;const recommended=choice==='original'?{group:'original',size}:((arr)=>({group:arr[0],size:arr[1]}))(choice.split(':'));
   if(recommended.group!=='original'&&!versions[recommended.group]?.some(x=>x.size===recommended.size))throw Error('La resolución recomendada ya no está disponible.');
   const tags=tagsOf($('manager-tags').value);if(!tags.length)throw Error('Indica al menos un hashtag.');
   for(const [flag,tag] of [['manager-ecchi','Ecchi'],['manager-ai','IA']])if($(flag).checked&&!tags.some(x=>x.slice(1).toLowerCase()===tag.toLowerCase()))tags.push('#'+tag);
   const after=copy(rec);
   Object.assign(after,values,{width:Number(size.split('x')[0]),height:Number(size.split('x')[1]),previewWidth:Number(previewSize.split('x')[0]),previewHeight:Number(previewSize.split('x')[1]),thumbnailWidth:Number(thumbnailSize.split('x')[0]),thumbnailHeight:Number(thumbnailSize.split('x')[1]),versions,recommended,tags,hasDesktopVersion,hasMobileVersion,ecchi:$('manager-ecchi').checked,ai:$('manager-ai').checked});
   // Los tamaños de miniatura existentes pueden conservarse: no se redescargan enlaces remotos.
   if(!values.authorUrl)delete after.authorUrl;
   if(!values.description)delete after.description;
   pending.set(original.id,{type:'edit',before:copy(original),after});
   status('Edición preparada. El ZIP contendrá las páginas y los índices que necesiten reemplazo.');drawQueue();drawList();
  }catch(err){status(err.message,true);}
 });
}
function getPackage(){
 if(lastPackage)return lastPackage;
 if(!pending.size)throw Error('Prepara al menos un cambio primero.');
 lastPackage=prepareAdminPackage({original:records,operations:[...pending.values()],template:templateDetail,lastPublicationNumber});
 return lastPackage;
}
function showFiles(){
 try{
  const pack=getPackage(),box=$('manager-file-preview');
  box.hidden=false;
  box.innerHTML=`<h3>Archivos preparados</h3>
   <p class="publish-note"><strong>${pack.uploadPaths.length}</strong> archivo(s) para reemplazar · <strong>${pack.deletePaths.length}</strong> para borrar.</p>
   <details open><summary>Subir / Reemplazar (${pack.uploadPaths.length})</summary>
   <div class="manager-paths">${pack.uploadPaths.map(x=>`<code>${escapeHtml(x)}</code>`).join('')}</div></details>
   <details open><summary>Borrar en GitHub (${pack.deletePaths.length})</summary>
   ${pack.deletePaths.length?`<div class="manager-paths">${pack.deletePaths.map(x=>`<code>${escapeHtml(x)}</code>`).join('')}</div>`:'<p class="publish-note">Nada que borrar. Solo debes reemplazar archivos.</p>'}</details>
   <div class="manager-copy-actions"><button type="button" class="button" id="manager-copy-upload">Copiar rutas para subir</button>
   <button type="button" class="button" id="manager-copy-delete" ${!pack.deletePaths.length?'disabled':''}>Copiar rutas para borrar</button></div>
   <p class="publish-note">El ZIP incluye la carpeta <code>SUBIR/</code> con los archivos ya actualizados y las instrucciones paso a paso. Copia el CONTENIDO de SUBIR a la raíz del repositorio.</p>`;
  $('manager-copy-upload').addEventListener('click',()=>copyPaths(pack.uploadPaths));
  $('manager-copy-delete').addEventListener('click',()=>copyPaths(pack.deletePaths));
  status('Rutas calculadas. Puedes descargar el ZIP con los archivos listos para GitHub.');
 }catch(error){console.error(error);status(error.message,true);}
}
async function copyPaths(items){
 try{await navigator.clipboard.writeText(items.join('\n'));status('Rutas copiadas.');}
 catch{status('No se pudo copiar automáticamente. Las rutas están visibles arriba.',true);}
}
function downloadPackage(){
 try{
  const pack=getPackage();
  const url=URL.createObjectURL(pack.zip),a=document.createElement('a');
  a.href=url;a.download=mode==='delete'?'fraxinami-borrar-wallpapers.zip':'fraxinami-editar-wallpapers.zip';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  showFiles();
  status(`ZIP descargado: ${pack.uploadPaths.length} archivos para reemplazar y ${pack.deletePaths.length} rutas para borrar. No necesitas npm ni CMD.`);
 }catch(error){console.error(error);status(error.message,true);}
}
export async function initManager(kind){
 mode=kind==='borrar'?'delete':'edit';pending=new Map();selected=null;
 document.getElementById('app').innerHTML=`<section class="publish-heading"><div class="section-title"><h1>${mode==='delete'?'Borrar wallpapers':'Editar wallpapers'}</h1></div><p class="publish-note"><a href="${path('publicar/')}">Publicar</a> · <a href="${path('editar/')}">Editar</a> · <a href="${path('borrar/')}">Borrar</a></p><p class="publish-note">Desde tu PC o celular: busca, edita o prepara eliminaciones. Al terminar recibirás un ZIP como en Publicar, con los archivos ya corregidos. <strong>No necesitas CMD ni Node.</strong> El ZIP no escribe directamente en GitHub.</p></section>
 <div class="publish-grid"><section class="publish-panel"><div class="field"><label for="manager-search">Buscar publicación</label><input id="manager-search" type="search" placeholder="Título, enlace o ID..." /></div><p class="publish-note" id="manager-count"></p><div id="manager-results" class="manager-results"></div><div id="manager-editor"><p class="publish-note">Selecciona una publicación.</p></div><p id="manager-status" class="publish-status" role="status"></p></section>
 <aside class="publish-panel"><h2>Cambios preparados (<span id="manager-pending-count">0</span>)</h2><div id="manager-pending"></div><button type="button" class="button button--primary" id="manager-export" disabled>${icon('download')} Descargar ZIP listo</button>
 <button type="button" class="button manager-check-button" id="manager-preview" disabled>Ver qué reemplazar o borrar</button>
 <div id="manager-file-preview" class="manager-file-preview" hidden></div>
 <div class="manager-help"><h3>Desde el celular o PC</h3><p><strong>1.</strong> Prepara una edición o eliminación y descarga el ZIP.</p><p><strong>2.</strong> Dentro del ZIP abre <code>SUBIR/</code> y copia su contenido a la raíz de tu sitio en GitHub, reemplazando las rutas indicadas.</p><p><strong>3.</strong> Si vas a borrar, sigue <code>BORRAR-EN-GITHUB.txt</code> para eliminar los archivos antiguos (el ZIP no puede eliminarlos a distancia).</p><p><strong>4.</strong> Confirma los cambios en GitHub. No hace falta ejecutar comandos.</p></div></aside></div>`;
 try{
  const [items,template,manifest]=await Promise.all([readCatalog(),fetch(path('templates/detail.html')).then(r=>{if(!r.ok)throw Error('No se encuentra la plantilla de fichas.');return r.text();}),readManifest()]);
  records=items;templateDetail=template;
  lastPublicationNumber=Number.isSafeInteger(Number(manifest.lastPublicationNumber))&&Number(manifest.lastPublicationNumber)>0?Number(manifest.lastPublicationNumber):0;
 }catch(error){status('No se pudo cargar el catálogo o la plantilla. Abre esta página desde un servidor web: '+error.message,true);return;}
 $('manager-search').addEventListener('input',drawList);
 $('manager-results').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(b){selected=b.dataset.pick;drawList();renderSelected();}});
 $('manager-pending').addEventListener('click',e=>{const b=e.target.closest('[data-undo]');if(!b)return;pending.delete(b.dataset.undo);status('Cambio deshecho.');drawList();drawQueue();renderSelected();});
 $('manager-export').addEventListener('click',downloadPackage);
 $('manager-preview').addEventListener('click',showFiles);
 drawList();drawQueue();status(`Catálogo cargado: ${records.length} publicaciones. El editor prepara los archivos para reemplazar, sin modificar tu sitio automáticamente.`);
}
