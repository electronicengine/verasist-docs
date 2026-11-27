import {labPath,labSlugs,resolveLabRoute,canonicalLabHref} from './labRoutes';
test('each animation has an English path and path selection wins over legacy query',()=>{
 for(const id of Object.keys(labSlugs)){expect(resolveLabRoute(labPath(id)).id).toBe(id);expect(resolveLabRoute(labPath(id),'?senaryo=other&lang=tr').url).toBe(labPath(id)+'?lang=tr');}
 expect(resolveLabRoute('/verasistLAB').url).toBe('/verasistLAB/pbx');
 expect(resolveLabRoute('/verasistlab/IP-PHONE/').url).toBe('/verasistLAB/ip-phone');
});
test('old links preserve scenario, embed, theme, language and unrelated parameters',()=>{
 expect(resolveLabRoute('/ogren/telefon-santrali','?senaryo=mechanism&embed=1&theme=dark&lang=tr&foo=1').url).toBe('/verasistLAB/how-verasist-works?embed=1&theme=dark&lang=tr&foo=1');
 expect(resolveLabRoute('/ogren/telefon-santrali','?ders=asterisk&lang=en').url).toBe('/verasistLAB/how-verasist-works?lang=en');
 for(const id of ['registration','reception','extension'])expect(resolveLabRoute('/ogren/telefon-santrali','?senaryo='+id).url).toBe('/verasistLAB/pbx');
 const canonical=resolveLabRoute('/ogren/telefon-santrali','?senaryo=direct&embed=1').url;expect(resolveLabRoute(canonical.split('?')[0],'?'+canonical.split('?')[1]).url).toBe(canonical);
});
test('stored document links normalize only same-origin LAB URLs and preserve hashes',()=>{
 const origin='https://docs.verasist.ai';
 expect(canonicalLabHref('/ogren/telefon-santrali?senaryo=public-line&lang=en#steps',origin)).toBe('/verasistLAB/landline-mobile?lang=en#steps');
 for(const href of ['https://external.example/ogren/telefon-santrali','/guides/integrations/telephony/ip-pbx','#steps','mailto:hi@example.com'])expect(canonicalLabHref(href,origin)).toBe(href);
});
