/* Fraxinami V10.9.5 · Paquetes de edición y borrado totalmente en navegador.
   Usa los mismos índices, HTML y rutas que /publicar/. No necesita Node ni API.
   Nunca modifica archivos locales ni el repositorio remoto desde el navegador. */
import {buildIndexFiles} from './indexador.js?v=10.9.6';
import {renderDetailDocument} from './seo.js?v=10.9.4';
import {crearZip} from './zip.js?v=10.7';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const validRoute=rec=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rec.categorySlug||'')&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rec.slug||'');
const htmlPath=rec=>`${rec.categorySlug}/${rec.slug}/index.html`;
const detailPath=rec=>`data/index/items/${rec.categorySlug}/${rec.slug}.json`;
const summaryMap=files=>new Map(files.map(file=>[file.name,file.data]));
const routesText=paths=>[...new Set(paths)].sort().join('\n');
const routesCategory=rec=>`${rec.categorySlug}/${rec.slug}/`;
const SITE_URL='https://fraxinami.com/';
const CATEGORIES=['moviles','escritorio','anime','waifus','cosplay','ecchi','paisajes-anime','cielos','nubes','paisajes','nature','cute','black-dark','games','cars','bikes','space'];
const XML_FIXED=['','search/','favoritos/','ecchi/','ai/','moviles/','escritorio/','donaciones/','privacy/','tos/','copyright/','contact-us/','upload/'];
const xmlEscape=value=>String(value).replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&quot;',"'":'&apos;'}[ch]));
// Mismo sitemap de /publicar/, con rutas de categoría preservadas.
function makeSitemap(records){
 const urls=new Set([...XML_FIXED,...CATEGORIES.map(x=>x+'/'),...records.map(routesCategory)]);
 return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(url=>`  <url><loc>${xmlEscape(SITE_URL+url)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
function safeRecords(original,operations){
 if(!Array.isArray(original)||!Array.isArray(operations)||!operations.length)throw Error('No hay cambios preparados.');
 if(original.length>2000)throw Error('Para evitar saturar el navegador, este editor permite reconstruir hasta 2000 publicaciones, igual que /publicar/.');
 const records=original.map(rec=>JSON.parse(JSON.stringify(rec)));
 const byId=new Map(records.map((rec,i)=>[rec.id,i]));
 if(byId.size!==records.length)throw Error('El catálogo contiene identificadores duplicados.');
 const applied=new Set();
 for(const op of operations){
  if(!['edit','delete'].includes(op?.type)||!op.before?.id)throw Error('Operación desconocida.');
  const id=op.before.id,i=byId.get(id);
  if(i===undefined||applied.has(id))throw Error('La publicación no existe o está repetida: '+id);
  if(!same(original[i],op.before))throw Error('El catálogo ha cambiado desde que abriste esta página. Actualiza antes de exportar: '+id);
  if(!validRoute(op.before))throw Error('La ruta original no es válida: '+id);
  if(op.type==='edit'){
   if(!op.after||op.after.id!==id||op.after.slug!==op.before.slug||op.after.categorySlug!==op.before.categorySlug)throw Error('No se puede cambiar la ruta al editar; retira y vuelve a publicar.');
   if(!validRoute(op.after))throw Error('La nueva ruta no es válida: '+id);
   if(same(op.before,op.after))throw Error('No se ha modificado ningún campo de «'+op.before.title+'».');
   records[i]=JSON.parse(JSON.stringify(op.after));
  }else records[i]=null;
  applied.add(id);
 }
 const updated=records.filter(Boolean);
 const routes=new Set(updated.map(htmlPath));
 if(routes.size!==updated.length)throw Error('Hay rutas duplicadas después de editar.');
 return updated;
}
// Se devuelve una vista previa y el ZIP. El archivo ZIP contiene SOLO los
// archivos nuevos/modificados, dentro de SUBIR/, y las listas de instrucciones.
export function prepareAdminPackage({original,operations,template,lastPublicationNumber=0}){
 if(!template||!template.includes('__DETAIL_INLINE__'))throw Error('No se pudo cargar la plantilla original de fichas.');
 const updated=safeRecords(original,operations);
 const oldIndex=buildIndexFiles(original,{lastPublicationNumber}),newIndex=buildIndexFiles(updated,{lastPublicationNumber});
 const oldMap=summaryMap(oldIndex),newMap=summaryMap(newIndex);
 const removed=new Set(),upload=new Map();
 const touch=(path,data)=>{
  if(!path||path.includes('..')||path.startsWith('/')||path.includes('\\'))throw Error('Ruta de salida inválida.');
  upload.set(path,data);
 };
 // Índices: diferencia real por archivo. Los índices existentes no se duplican.
 for(const [name,data] of newMap){
  if(name.startsWith('data/index/items/'))continue;
  const previous=oldMap.get(name);
  // El timestamp es informativo; no volver a subir manifest solo por fecha.
  let changed=previous!==data;
  if(name==='data/index/manifest.json'&&previous){
   const old=JSON.parse(previous),current=JSON.parse(data);
   delete old.generated;delete current.generated;
   changed=!same(old,current);
  }
  if(changed)touch(name,data);
 }
 for(const name of oldMap.keys()){
  if(name.startsWith('data/index/items/'))continue; // Ya eliminado de V10.9.4.
  if(!newMap.has(name))removed.add(name);
 }
 // Los datos originales de todas las publicaciones quedan sincronizados.
 touch('data/wallpapers.json',JSON.stringify(updated,null,2)+'\n');
 if(makeSitemap(original)!==makeSitemap(updated))touch('sitemap.xml',makeSitemap(updated));
 // Regenerar una ficha SOLO si sus propios datos o sus relacionados cambiaron.
 const oldIds=new Set(original.map(x=>x.id)),updatedIds=new Set(updated.map(x=>x.id));
 const edited=new Set(operations.filter(x=>x.type==='edit').map(x=>x.before.id));
 for(const rec of updated){
  const key=detailPath(rec),before=oldMap.get(key),after=newMap.get(key);
  if(!oldIds.has(rec.id)||edited.has(rec.id)||before!==after){
   if(!after)throw Error('No se generaron los datos de detalle de: '+rec.title);
   touch(htmlPath(rec),renderDetailDocument(template,rec,'../../',JSON.parse(after)));
  }
 }
 for(const rec of original)if(!updatedIds.has(rec.id))removed.add(htmlPath(rec));
 // Al editar URLs antiguas no se borran imágenes externas ni carpetas compartidas.
 const deletePaths=[...removed].sort();
 const uploadPaths=[...upload.keys()].sort();
 const deletedTitles=operations.filter(x=>x.type==='delete').map(x=>x.before.title);
 const editedTitles=operations.filter(x=>x.type==='edit').map(x=>x.before.title);
 const instructions=[
  'FRAXINAMI · EDITAR / BORRAR (V10.9.5)',
  '===================================',
  '',
  'Paquete generado en la web. NO necesita CMD, npm ni Node.',
  '',
  'PASO 1 — REEMPLAZAR / SUBIR',
  'Abre la carpeta SUBIR de este ZIP. Copia SUS CONTENIDOS en la raíz de tu',
  'repositorio de GitHub Pages, CONSERVANDO la misma estructura de carpetas.',
  'Cuando un archivo ya exista, reemplázalo. No subas la carpeta SUBIR como',
  'subcarpeta nueva de la web: copia su CONTENIDO.',
  '',
  'PASO 2 — BORRAR (solo si BORRAR-EN-GITHUB.txt tiene rutas)',
  'Elimina exactamente los archivos enumerados en BORRAR-EN-GITHUB.txt.',
  'Estos archivos no desaparecen solo por copiar el ZIP: GitHub Pages es',
  'un alojamiento estático y el navegador no tiene permisos para borrarlos.',
  'Si borras un wallpaper, borra su archivo index.html de la ruta indicada.',
  'Después puedes borrar su carpeta personal si queda vacía.',
  'NO borres la carpeta de categoría, CSS, JS ni índices compartidos completos.',
  '',
  'PASO 3 — PUBLICAR',
  'Confirma los cambios en el repositorio; espera la publicación de Pages.',
  'Si trabajas con GitHub Desktop, eliminar los archivos en tu copia clonada',
  'y hacer commit/push también registra las eliminaciones.',
  '',
  `Publicaciones editadas: ${editedTitles.length}`,
  ...editedTitles.map(x=>'  EDITADA: '+x),
  `Publicaciones retiradas: ${deletedTitles.length}`,
  ...deletedTitles.map(x=>'  ELIMINADA: '+x),
  `Archivos para subir: ${uploadPaths.length}`,
  `Archivos para borrar: ${deletePaths.length}`,
  '',
  'No se cambia la URL pública al editar.',
  'Las imágenes almacenadas en Catbox se gestionan por separado.',
  'Las vistas previas en WhatsApp pueden seguir en caché algún tiempo.',
  'Para evitar sobrescribir cambios nuevos, abre /editar/ o /borrar/',
  'sobre el catálogo más reciente de tu sitio antes de preparar otro paquete.'
 ].join('\n')+'\n';
 const zipFiles=[
  ...uploadPaths.map(name=>({name:'SUBIR/'+name,data:upload.get(name)})),
  {name:'BORRAR-EN-GITHUB.txt',data:deletePaths.length?routesText(deletePaths)+'\n':'No hay archivos que borrar.\n'},
  {name:'SUBIR-A-GITHUB.txt',data:routesText(uploadPaths)+'\n'},
  {name:'LEEME-PRIMERO.txt',data:instructions}
 ];
 return {zip:crearZip(zipFiles),uploadPaths,deletePaths,updated,deletedTitles,editedTitles};
}
