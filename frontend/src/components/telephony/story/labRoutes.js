export const LAB_ROOT='/verasistLAB';
export const labSlugs={mechanism:'how-verasist-works','public-line':'landline-mobile',pbx:'pbx',direct:'ip-phone'};
const legacyLessons={santral:'pbx',ses:'pbx',verasist:'pbx',aktarim:'pbx',yonlendirme:'pbx',sip:'pbx',asterisk:'mechanism'};
const retired=new Set(['registration','reception','extension']);
export const labPath=(id='pbx')=>`${LAB_ROOT}/${labSlugs[id]||labSlugs.pbx}`;
export const isLabPath=path=>/^\/verasistLAB(?:\/[^/]+)?\/?$/i.test(path)||/^\/ogren\/telefon-santrali\/?$/i.test(path);
export function resolveLabRoute(pathname,search=''){
 const params=new URLSearchParams(search),slug=pathname.match(/^\/verasistLAB\/([^/]+)\/?$/i)?.[1]?.toLowerCase();
 const pathId=Object.keys(labSlugs).find(id=>labSlugs[id]===slug);
 const old=params.get('senaryo')||legacyLessons[params.get('ders')];
 const id=pathId||(retired.has(old)?'pbx':Object.hasOwn(labSlugs,old)?old:'pbx');
 params.delete('senaryo');params.delete('ders');
 const path=labPath(id),query=params.toString(),cleanSearch=query?'?'+query:'';
 return {id,pathname:path,search:cleanSearch,url:path+cleanSearch};
}
export function canonicalLabHref(href,origin){
 try{const url=new URL(href,origin);if(url.origin!==new URL(origin).origin||!isLabPath(url.pathname))return href;return resolveLabRoute(url.pathname,url.search).url+url.hash;}catch{return href;}
}
