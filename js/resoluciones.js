/* Shared data model for exact files, without guessing that a URL contains another size. */
export const dimensionText = (w,h) => `${w}x${h}`;
export function readSize(value){
 const match=String(value||'').trim().match(/^([1-9]\d{1,4})\s*[xX×]\s*([1-9]\d{1,4})$/);
 if(!match)return null;
 const w=Number(match[1]),h=Number(match[2]);
 return w>=64&&h>=64?{w,h}:null;
}
const isWebUrl=value=>{try{return ['https:','http:'].includes(new URL(value).protocol)}catch{return false}};
export const isLocalVariant = value => /^assets\/versions\/[a-z0-9/_-]+\.(?:webp|jpe?g|png|avif)$/i.test(String(value||'')) && !String(value).includes('..');
const fileEntry=(size,url,group)=>{
 const dims=readSize(size);
 if(!dims||!(isWebUrl(url)||isLocalVariant(url)))return null;
 return {...dims, url:String(url).trim(),group};
};
export function variantsFor(item){
 const out=[],seen=new Set();
 const push=entry=>{
  if(!entry)return;
  const key=`${entry.group}:${entry.w}x${entry.h}`;
  if(seen.has(key))return;
  seen.add(key);out.push(entry);
 };
 for(const group of ['desktop','mobile']){
  const allowed=group==='desktop'?item.hasDesktopVersion!==false:item.hasMobileVersion===true||(item.hasMobileVersion==null&&Number(item.height)>Number(item.width));
  if(!allowed)continue;
  for(const v of item.versions?.[group]||[]){push(fileEntry(v.size||`${v.width}x${v.height}`,v.url,group));}
 }
 // Backwards compatibility with previously published V6 records.
 if(item.hasDesktopVersion!==false && isWebUrl(item.download4kUrl)){
  const portrait=Number(item.height)>Number(item.width);
  push(fileEntry(portrait?'2160x3840':'3840x2160',item.download4kUrl,'desktop'));
 }
 if(item.hasMobileVersion===true&&isWebUrl(item.mobileUrl)){
  push(fileEntry(item.mobileDimensions,item.mobileUrl,'mobile'));
 }
 const originalW=Number(item.width),originalH=Number(item.height);
 const originalURL=isWebUrl(item.originalUrl)?item.originalUrl:null;
 // The original is offered by the main button; keep PC and Mobile lists exactly as published.
 // The screen recommendation can also consider the original file.
 if(originalW>=64&&originalH>=64)
  push({w:originalW,h:originalH,url:originalURL,group:'original',original:true});
 // For mobile-only items without a special mobile file, original is still a download.
 return out;
}
export function bestVariant(variants,screenWidth,screenHeight,dpr=1){
 if(!variants?.length)return null;
 const w=Math.max(1,screenWidth)*Math.max(.5,dpr),h=Math.max(1,screenHeight)*Math.max(.5,dpr),targetRatio=w/h;
 const score=v=>{
  const ratioPenalty=Math.abs(Math.log((v.w/v.h)/targetRatio))*9;
  // Prefer sufficient resolution, but avoid needlessly huge files.
  const shortfall=Math.max(0,Math.log(w/v.w))*4+Math.max(0,Math.log(h/v.h))*4;
  const excess=Math.max(0,Math.log(v.w/w))*.28+Math.max(0,Math.log(v.h/h))*.28;
  return ratioPenalty+shortfall+excess;
 };
 return variants.slice().sort((a,b)=>score(a)-score(b))[0];
}
export function qualityOf(item){
 const manual=String(item.qualityLabel||'').trim().toUpperCase();
 if(/^(?:HD|FHD|QHD|1080P|2K|4K|5K|8K)$/.test(manual))return manual;
 const w=Number(item.width),h=Number(item.height),max=Math.max(w,h),min=Math.min(w,h);
 if(max>=7680&&min>=4320)return '8K';
 if(max>=5120&&min>=2880)return '5K';
 if(max>=3840&&min>=2160)return '4K';
 if(max>=2560&&min>=1440)return '2K';
 // The sample catalog contains screenshot-based, small-resolution demos.
 // Their titles illustrate badges only; they do NOT certify actual 5K downloads.
 if(item.demo){const match=String(item.title||'').match(/(?:^|[^\d])(8K|5K|4K|2K)(?!\w)/i);if(match)return match[1].toUpperCase()}
 return '';
}

// The upload author selects one real file; no screen detection or inferred URL.
export function recommendedVariant(item, variants){
 const configured=item.recommended;
 if(configured && configured.group && configured.size){
  const found=variants.find(v=>v.group===configured.group && `${v.w}x${v.h}`===configured.size);
  if(found)return found;
 }
 return variants.find(v=>v.group==='original')||null;
}
export function recommendationCaption(entry){
 if(!entry)return 'Descargar original';
 const {w,h}=entry,size=`${entry.w}x${entry.h}`;
 const wide=Math.max(w,h),short=Math.min(w,h);
 const quality=(wide>=7680&&short>=4320)?'8K':(wide>=5120&&short>=2880)?'5K':(wide>=3840&&short>=2160)?'4K':(wide>=2560&&short>=1440)?'2K':(wide===1920&&short===1080)?'1080p':'';
 return `Descargar en ${quality?`${quality} (${size})`:size}`;
}
