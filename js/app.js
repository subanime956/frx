import {emptyState,initSite,readCatalog} from './site.js?v=10.7';
import {renderGallery} from './galeria.js?v=10.9.7';
import {renderDetail} from './detalle.js?v=10.9.7';
import {initPublisher} from './publicar.js?v=10.9.6';
import {renderStaticPage} from './paginas.js?v=10.7';
import {loadListing,loadDetail,readManifest} from './servicio.js?v=10.9.7';
import {API_URL} from './config.js?v=10.7';
initSite();
const page=document.documentElement.dataset.page||'home';
if(['privacy','tos','copyright','contact-us','upload','donaciones'].includes(page)){renderStaticPage(page);}
let latest=0;
async function repaint(){
 const turn=++latest;
 try{
  if(page==='detail'){
   const data=await loadDetail();if(turn!==latest)return;
   renderDetail(data.item,data.related);
  }else{
   const data=await loadListing(page);if(turn!==latest)return;
   renderGallery(page,data);
  }
 }catch(error){if(turn!==latest)return;console.error(error);document.getElementById('app').innerHTML=emptyState('No se pudo cargar la página','Verifica los índices del catálogo e inténtalo de nuevo.');}
}
(async()=>{
 if(['privacy','tos','copyright','contact-us','upload','donaciones'].includes(page))return;
 if(page==='missing'){document.getElementById('app').innerHTML=emptyState('Página no encontrada','Comprueba la dirección o vuelve a la galería.');return;}
 if(page==='editar'||page==='borrar'){
  try{const {initManager}=await import('./gestionar.js?v=10.9.6');await initManager(page);}
  catch(error){console.error(error);document.getElementById('app').innerHTML=emptyState('No se pudo iniciar el gestor',error.message);}
  return;
 }
 if(page==='publicar'){
  try{const manifest=await readManifest();const large=API_URL||(manifest.total>2000);await initPublisher(large?[]:await readCatalog(),{incremental:!!large,lastNumber:manifest.lastPublicationNumber||0});}
  catch(error){console.error(error);document.getElementById('app').innerHTML=emptyState('No se pudo iniciar el editor',error.message);}
  return;
 }
 repaint();
 document.addEventListener('contentchange',repaint);
 if(page==='home'){window.addEventListener('fraxinami-home-filter',repaint);window.addEventListener('popstate',repaint);window.addEventListener('hashchange',repaint);}
 if(page==='favorites')document.addEventListener('favoritechange',repaint);
})();
