/* Prueba del catálogo V10/V10.1 sin depender de IDs o ejemplos antiguos. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'data/wallpapers.json'),'utf8'));
const testRec=catalog.find(x=>x.categorySlug==='games')||catalog[0];
const catalogEmpty=!testRec;
const selected=testRec||{categorySlug:'anime',slug:'sin-publicaciones'};
globalThis.document={documentElement:{dataset:{root:'./',category:selected.categorySlug,slug:selected.slug}},baseURI:'http://fraxi.test/'};
globalThis.location={search:'',hash:'',href:'http://fraxi.test/'};
let requests=[],bytes=0;
globalThis.fetch=async url=>{
 const rel=String(url).split('fraxi.test/')[1]?.split('?')[0],file=path.join(root,rel||'');
 try{const buf=await fs.readFile(file);requests.push(rel);bytes+=buf.length;return {ok:true,json:async()=>JSON.parse(buf),text:async()=>buf.toString()};}
 catch{return {ok:false,status:404}};
};
const {loadListing,loadDetail}=await import('../js/servicio.js');
const home=await loadListing('home');
if(home.items.length!==Math.min(24,catalog.length)||home.total!==catalog.length)throw Error('Error inicio');
const afterHome=bytes;
globalThis.location.search='?q=miside+mita';
const results=await loadListing('search');
const expected=catalog.filter(x=>String([x.title,...(x.tags||[])].join(' ')).toLowerCase().includes('miside'));
if(expected.length && results.total<1)throw Error('Error búsqueda');
globalThis.location.search='';
const category=await loadListing('category');
const expectedCat=catalog.filter(x=>x.categorySlug===selected.categorySlug).length;
if(category.total!==expectedCat||category.items.some(x=>x.categorySlug!==selected.categorySlug))throw Error('Error categoría');
const detail=await loadDetail();
if((!catalogEmpty&&detail.item?.slug!==selected.slug)||(catalogEmpty&&detail.item!==null)||!Array.isArray(detail.related))throw Error('Error ficha');
if(requests.some(x=>x==='data/wallpapers.json'))throw Error('El público sigue descargando el catálogo completo');
console.log(JSON.stringify({home:{total:home.total,items:home.items.length,bytes:afterHome},search:{q:'miside mita',total:results.total},category:category.total,related:detail.related.length,publicRequests:requests.length,totalBytes:bytes,loadedLegacyCatalog:false},null,2));
