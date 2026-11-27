import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const paths={mechanism:'/verasistLAB/how-verasist-works','public-line':'/verasistLAB/landline-mobile',pbx:'/verasistLAB/pbx',direct:'/verasistLAB/ip-phone'};
const b=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const c=await b.newContext({viewport:{width:1440,height:1000}});await c.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
 if(process.env.DOCS_LAB_REAL_API!=='1')await c.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Guide</h2><a href="/ogren/telefon-santrali?senaryo=direct&lang='+lang+'#steps">Old lab link</a>'}:[]});});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const check=async(id)=>{await p.waitForURL(url=>url.pathname===paths[id]&&!url.searchParams.has('senaryo')&&!url.searchParams.has('ders'));await p.locator('main[data-scenario="'+id+'"]').waitFor();await p.locator('.story-webgl canvas').waitFor();assert.equal(await p.locator('main').getAttribute('data-scenario'),id);};
 await p.goto(base+'/verasistLAB?lang='+lang);await check('pbx');
 for(const id of Object.keys(paths)){await p.locator('#tab-'+id).click();await check(id);assert.equal(new URL(p.url()).searchParams.get('lang'),lang);await p.reload();await check(id);console.log('PASS route',lang,paths[id],'tab/reload');}
 await p.goBack();await check('pbx');await p.goForward();await check('direct');
 for(const id of Object.keys(paths)){await p.goto(base+'/ogren/telefon-santrali?senaryo='+id+'&embed=1&theme=dark&lang='+lang+'#steps');await check(id);const url=new URL(p.url());assert.equal(url.searchParams.get('embed'),'1');assert.equal(url.searchParams.get('theme'),'dark');assert.equal(url.searchParams.get('lang'),lang);assert.equal(url.hash,'#steps');assert.equal(await p.locator('main').getAttribute('data-embedded'),'true');console.log('PASS legacy',lang,id,'embed/theme/language/hash preserved');}
 await p.goto(base+'/ogren/telefon-santrali?ders=asterisk&lang='+lang);await check('mechanism');await p.goto(base+'/ogren/telefon-santrali?senaryo=reception&lang='+lang);await check('pbx');
 for(const path of ['ip-pbx','sip-trunk']){
  await p.goto(base+'/guides/integrations/telephony/'+path);const sidebar=p.getByTestId('docs-sidebar').getByRole('link',{name:'Verasist LAB',exact:true});await sidebar.waitFor();assert.equal(await sidebar.getAttribute('href'),paths.pbx);
  const section=p.getByTestId('telephony-embed');await section.scrollIntoViewIfNeeded();assert.equal(await p.getByTestId('telephony-lab-link').getAttribute('href'),paths.pbx);const frame=p.frameLocator('[data-testid="telephony-embed"] iframe');await frame.locator('.story-webgl canvas').waitFor();assert.match(await section.locator('iframe').getAttribute('src'),/^\/verasistLAB\/pbx\?embed=1/);
  await frame.locator('#tab-direct').click();await frame.locator('main[data-scenario="direct"]').waitFor();const url=await frame.locator('main').evaluate(()=>location.href);assert.equal(new URL(url).pathname,paths.direct);assert.equal(new URL(url).searchParams.get('embed'),'1');assert.equal(new URL(url).searchParams.get('lang'),lang);
  assert.equal(await p.locator('.doc-content a[href*="/ogren/telefon-santrali"]').count(),0);const links=await p.locator('.doc-content a[href^="/verasistLAB/"]').count();if(process.env.DOCS_LAB_REAL_API!=='1')assert.ok(links>0);console.log('PASS document links/iframe',lang,path);
 }
 assert.deepEqual(errors,[]);await c.close();
}}finally{await b.close();}
