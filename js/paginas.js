import {sectionTitle,path,escapeHtml,toast} from './site.js?v=10.7';
import {CONTACT_EMAIL} from './config.js?v=10.7';
const pages={
 'privacy':{title:'Política de privacidad',html:`
 <p>Fraxinami Wallpapers es una galería estática de fondos de pantalla. Puedes explorarla sin crear una cuenta.</p>
 <h2>Preferencias del navegador</h2><p>Los favoritos, el tema claro u oscuro y los filtros Ecchi e IA se guardan en el almacenamiento local de tu navegador. Puedes borrar esos datos desde la configuración del navegador.</p>
 <h2>Servicios externos</h2><p>Usamos fuentes de Google Fonts e iconos de Font Awesome mediante servicios externos. Estos proveedores y el alojamiento web pueden recibir información técnica habitual, como tu dirección IP. Esta versión no utiliza cuentas de usuario.</p>
 <h2>Contacto</h2><p>Si tienes consultas, visita <a href="${path('contact-us/')}">Contacto</a>.</p>`},
 'tos':{title:'Términos de uso',html:`
 <p>Al utilizar Fraxinami Wallpapers, aceptas usar el sitio y su contenido conforme a la normativa aplicable.</p>
 <h2>Uso de imágenes</h2><p>Las imágenes pueden pertenecer a sus respectivos creadores. Su disponibilidad para descargar no transfiere derechos de autor ni concede permiso para redistribuirlas o utilizarlas comercialmente. Comprueba los permisos de cada obra antes de reutilizarla.</p>
 <h2>Disponibilidad</h2><p>Las publicaciones, formatos y versiones pueden cambiar o retirarse. Una resolución descargable no significa necesariamente que exista un original capturado o creado en ese tamaño.</p>
 <h2>Publicaciones</h2><p>No se admiten subidas públicas directas. Consulta <a href="${path('upload/')}">Publicaciones</a> para más información.</p>
 <h2>Dudas</h2><p>Escríbenos desde <a href="${path('contact-us/')}">Contacto</a>.</p>`},
 'copyright':{title:'Política de derechos de autor',html:`
 <p>Fraxinami Wallpapers reúne imágenes para su visualización y uso como fondos de pantalla. Sus creadores y titulares conservan sus derechos, salvo licencia o autorización expresa.</p>
 <p>Buscamos publicar imágenes con la autorización o fundamento legal correspondiente. La presencia de una imagen en la galería no significa que pueda usarse comercialmente o redistribuirse.</p>
 <p>Si consideras que una publicación vulnera tus derechos de autor, indícanos la URL exacta, los motivos de la reclamación y los datos necesarios para revisarla.</p>
 <p>También puedes informar de problemas de atribución, clasificación o contenido inapropiado. Revisaremos los avisos y podremos corregir o retirar imágenes cuando corresponda.</p>
 <p>¿Eres titular de derechos? <a href="${path('contact-us/')}?topic=copyright">Reportar imagen</a>.</p>`},
 'donaciones':{title:'Apoya Fraxinami',html:`
 <p>Fraxinami Wallpapers es una galería gratuita. Si te gusta el proyecto, puedes contribuir de manera completamente voluntaria a su mantenimiento.</p>
 <p>Las donaciones ayudan a cubrir alojamiento, almacenamiento de imágenes y mejoras del sitio. No son necesarias para descargar wallpapers y no otorgan derechos sobre las imágenes.</p>
 <p><a class="button button--primary" href="https://ko-fi.com/fraxinami" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-mug-hot" aria-hidden="true"></i> Apoyar en Ko-fi</a></p>`},
 'upload':{title:'Enviar wallpapers',html:`
 <p>Gracias por tu interés en compartir wallpapers con Fraxinami.</p>
 <p>Las subidas públicas no están habilitadas. El panel de publicación es una herramienta de gestión; los visitantes no pueden añadir archivos al catálogo directamente.</p>
 <p>Si deseas proponer una imagen, incluye el título, el creador original, la fuente y el permiso o licencia que permite compartirla.</p>
 <p><a href="${path('contact-us/')}?topic=submission">Contactar</a></p>`}
};
const topics={copyright:'Derechos de autor / Reportar imagen',submission:'Proponer un wallpaper',privacy:'Consulta de privacidad',other:'Consulta general'};
function contactHTML(){const qs=new URLSearchParams(location.search),topic=topics[qs.get('topic')]||topics.other;
return `<p>¿Tienes alguna consulta, sugerencia o aviso sobre una imagen? Escríbenos a <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> o prepara tu mensaje aquí.</p>
 <form id="contact-form" class="contact-form">
 <div><label for="contact-name">Nombre</label><input id="contact-name" name="name" autocomplete="name" maxlength="100" required></div>
 <div><label for="contact-topic">Asunto</label><select id="contact-topic" name="topic">${Object.values(topics).map(t=>`<option ${t===topic?'selected':''}>${escapeHtml(t)}</option>`).join('')}</select></div>
 <div><label for="contact-wallpaper">Enlace del wallpaper (opcional)</label><input id="contact-wallpaper" name="wallpaper" type="url" placeholder="https://fraxinami.com/games/..."></div>
 <div><label for="contact-message">Mensaje</label><textarea id="contact-message" name="message" minlength="15" maxlength="5000" required></textarea></div>
 <div class="contact-actions"><button type="submit" class="button button--primary">${CONTACT_EMAIL?'Abrir correo':'Copiar mensaje'} <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></button></div>
 <p class="contact-status" id="contact-status" role="status">${CONTACT_EMAIL?'Se abrirá tu aplicación de correo.':'Todavía no se ha configurado un correo de contacto; puedes copiar el mensaje.'}</p>
 </form>`;
}
export function renderStaticPage(page){
 const app=document.getElementById('app'),value=page==='contact-us'?{title:'Contacto',html:contactHTML()}:pages[page];
 if(!value){app.textContent='Página no encontrada';return;}
 document.title=value.title+' | Fraxinami Wallpapers';app.classList.add('info-page');app.innerHTML=sectionTitle(value.title,'h1')+`<section class="info-content">${value.html}</section>`;
 if(page!=='contact-us')return;
 document.getElementById('contact-form').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;
  const data=new FormData(f),str=`Nombre: ${data.get('name')}\nAsunto: ${data.get('topic')}\nWallpaper: ${data.get('wallpaper')||'N/D'}\n\n${data.get('message')}`;
  if(CONTACT_EMAIL){location.href=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(String(data.get('topic')))}&body=${encodeURIComponent(str)}`;}
  else{
   try{await navigator.clipboard.writeText(str);document.getElementById('contact-status').textContent='Mensaje copiado. Configura un correo de contacto para permitir envíos.';toast('Mensaje copiado');}
   catch{const field=document.getElementById('contact-message');field.value=str;field.focus();field.select();document.getElementById('contact-status').textContent='Selecciona y copia el mensaje; no hay un correo configurado.';}
  }
 });
}
