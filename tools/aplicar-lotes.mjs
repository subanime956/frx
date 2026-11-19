/* Fusiona los lotes exportados en /publicar/ sin duplicar IDs ni URLs.
   Regenera índices estáticos solamente cuando el catálogo es pequeño;
   para catálogos enormes, ejecutar también Python backend/api.py --import. */
import {readFile,readdir,mkdir,rename,writeFile,stat} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const folder=join(root,'data/imports');
await mkdir(folder,{recursive:true});
const names=(await readdir(folder)).filter(x=>x.endsWith('.json')).sort();
if(!names.length){console.log('No hay lotes pendientes.');process.exit(0);}
const src=join(root,'data/wallpapers.json'),old=JSON.parse(await readFile(src,'utf8'));
let merged=old.slice(),ids=new Set(old.map(x=>x.id)),urls=new Set(old.map(x=>x.categorySlug+'/'+x.slug)),inserted=0;
const processed=[];
for(const name of names){
 const batch=JSON.parse(await readFile(join(folder,name),'utf8'));
 if(!Array.isArray(batch))throw Error(`Lote inválido: ${name}`);
 for(const x of batch){
  if(!x.id||!x.categorySlug||!x.slug)throw Error('El lote contiene publicaciones incompletas');
  const url=x.categorySlug+'/'+x.slug;
  if(ids.has(x.id)||urls.has(url))throw Error(`Duplicado en ${name}: ${url}`);
  ids.add(x.id);urls.add(url);
 }
 merged=batch.concat(merged);inserted+=batch.length;processed.push(name);
}
// Escribir fuente primero. Solo entonces marcar lotes procesados.
await writeFile(src,JSON.stringify(merged,null,2)+'\n','utf8');
await mkdir(join(folder,'procesados'),{recursive:true});
for(const name of processed)await rename(join(folder,name),join(folder,'procesados',name));
console.log(`Importadas ${inserted} publicaciones. Total: ${merged.length}.`);
if(merged.length<=2000){
 const done=spawnSync(process.execPath,[join(root,'tools/generar-indices.mjs')],{stdio:'inherit'});
 if(done.status!==0)process.exit(done.status||1);
}else{
 console.log('Catálogo grande: actualiza SQLite con python backend/api.py --import; no se generaron miles de páginas en GitHub Pages.');
}
