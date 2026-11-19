/* Metadatos de vista previa compatibles con páginas estáticas y el editor.
   Se generan en el HTML: los bots sociales NO ejecutan JavaScript. */
const escapeAttr=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const publicUrl=relative=>'https://fraxinami.com/'+String(relative||'').replace(/^\/+/, '');
export function detailDescription(item){
 const text=typeof item.description==='string'&&item.description.trim()?item.description.trim():null;
 if(text)return text;
 const mobile=item.hasMobileVersion===true||(item.hasMobileVersion==null&&Number(item.height)>Number(item.width));
 return `Obtén este genial fondo de pantalla de ${item.title} en resolución ${item.width}x${item.height}. Puedes descargarlo para tu computadora${mobile?' y celular':''}, eligiendo entre las resoluciones disponibles.`;
}
export function renderDetailDocument(template,item,depth='../../'){
 const title=`${item.title} | Fraxinami Wallpapers`;
 const canonical=publicUrl(`${item.categorySlug}/${item.slug}/`);
 const ogAsset=typeof item.ogImage==='string'&&item.ogImage.trim()?item.ogImage.trim():item.thumbnail||item.image;
 const image=/^https?:\/\/[^\s]+$/i.test(ogAsset)?ogAsset:publicUrl(ogAsset);
 const description=detailDescription(item);
 const meta=`<link rel="canonical" href="${escapeAttr(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Fraxinami" />
  <meta property="og:url" content="${escapeAttr(canonical)}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="og:image:alt" content="${escapeAttr(item.title)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />`;
 return template
  .replaceAll('__TITLE__',escapeAttr(item.title))
  .replaceAll('__CATEGORY__',escapeAttr(item.categorySlug))
  .replaceAll('__SLUG__',escapeAttr(item.slug))
  .replaceAll('__META_DESCRIPTION__',escapeAttr(description))
  .replaceAll('__SEO_META__',meta)
  .replaceAll('../../',depth);
}
