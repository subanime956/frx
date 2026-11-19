import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildIndexFiles} from '../js/indexador.js';
import {renderDetailDocument} from '../js/seo.js';
import {readdir,stat} from 'node:fs/promises';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const records=JSON.parse(await readFile(join(root,'data/wallpapers.json'),'utf8'));
// Limpiar únicamente los índices generados, nunca imágenes ni publicaciones.
await rm(join(root,'data/index'),{recursive:true,force:true});
const files=buildIndexFiles(records);
for(const file of files){const destination=join(root,file.name);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,file.data,'utf8');}
// Alias independientes .html, manteniendo las rutas antiguas /categoria/slug/.
const detailTemplate=await readFile(join(root,'templates/detail.html'),'utf8');
for(const rec of records){
 const target=join(root,rec.categorySlug,rec.slug+'.html');
 await mkdir(dirname(target),{recursive:true});
 const html=renderDetailDocument(detailTemplate,rec,'../');
 await writeFile(target,html,'utf8');
 // Conserva también las URL /categoria/slug/ sin depender de redirecciones.
 const folder=join(root,rec.categorySlug,rec.slug,'index.html');
 await mkdir(dirname(folder),{recursive:true});
 await writeFile(folder,renderDetailDocument(detailTemplate,rec,'../../'),'utf8');
}
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
const urls=['','search/','favoritos/','ecchi/','ai/','moviles/','escritorio/','privacy/','tos/','copyright/','contact-us/','upload/','donaciones/',...new Set(records.map(x=>x.categorySlug+'/')),...records.map(x=>x.categorySlug+'/'+x.slug+'/')];
await writeFile(join(root,'sitemap.xml'),'<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>'<url><loc>'+xml('https://fraxinami.com/'+u)+'</loc></url>').join('\n')+'\n</urlset>\n');
console.log(`Índices Fraxinami: ${records.length} wallpapers, ${files.length} archivos generados, fichas con URL limpia y alias .html.`);

// Información OG genérica para inicio, búsqueda, categorías y páginas de contenido.
const genericImage=''; // Sin wallpaper predeterminado: los metadatos sociales no apuntan a archivos borrados.
const genericDescription='Explora fondos de pantalla de anime, videojuegos y paisajes en Fraxinami. Encuentra wallpapers relacionados por sus etiquetas.';
async function visit(dir){
 const all=await readdir(dir,{withFileTypes:true});
 for(const entry of all){
  if(entry.isDirectory()){
   if(['node_modules','assets','data','backend','tools','templates'].includes(entry.name))continue;
   await visit(join(dir,entry.name));
  }else if(entry.name.endsWith('.html')){
   const fp=join(dir,entry.name),html=await readFile(fp,'utf8');
   if(html.includes('property="og:site_name"'))continue;
   if(!html.includes('</head>'))continue;
   const relative=fp.slice(root.length+1).replaceAll('\\','/');
   const route=relative==='index.html'?'':relative.endsWith('/index.html')?relative.slice(0,-10):relative;
   const publicPage='https://fraxinami.com/'+route;
   const title=(html.match(/<title>([^<]*)<\/title>/)||[])[1]||'Fraxinami Wallpapers';
   const desc=(html.match(/<meta name="description" content="([^"]*)"/i)||[])[1]||genericDescription;
   const meta=`  <link rel="canonical" href="${publicPage}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Fraxinami" />
  <meta property="og:url" content="${publicPage}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta name="twitter:card" content="summary_large_image" />
`;
   await writeFile(fp,html.replace('</head>',meta+'</head>'),'utf8');
  }
 }
}
await visit(root);
console.log('Metadatos Open Graph y Twitter listos para las rutas públicas.');
