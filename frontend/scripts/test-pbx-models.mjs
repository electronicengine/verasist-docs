import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const b=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of (process.env.PBX_TEST_LANGS||'tr,en').split(',')){
 const en=lang==='en',context=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await context.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
 if(process.env.DOCS_LAB_REAL_API!=='1')await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Guide</h2><p>Phone guide.</p>'}:[]});});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/verasistLAB/pbx?lang='+lang);await p.locator('.story-webgl canvas').waitFor();
 assert.equal(await p.locator('.story-tabs [role="tab"]').count(),4);for(const id of ['registration','reception','extension'])assert.equal(await p.locator('#tab-'+id).count(),0);
 const button=name=>p.getByRole('button',{name,exact:true}),close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await p.getByRole('dialog').waitFor({state:'hidden'});};
 const selectStep=async i=>{await button(en?'Steps':'Adımlar').click();await p.locator('.story-timeline button').nth(i).click();await p.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);};
 for(const [mode,location,target] of [['local-sip','cloud','201'],['remote-sip','cloud','202'],['vpn-sip','cloud','301'],['ari','local','201'],['ari','cloud','301'],['sip-number','cloud','202']]){
  await button(en?'Scenario settings':'Senaryo ayarları').click();const model=p.getByRole('dialog').getByRole('combobox',{name:en?'Connection model':'Bağlantı modeli'});assert.equal(await model.locator('option').count(),5);await model.selectOption(mode);
  if(mode==='ari')await p.getByRole('combobox',{name:en?'Verasist location':'Verasist konumu'}).selectOption(location);
  await p.getByRole('combobox',{name:en?'Target extension':'Hedef dahili'}).selectOption(target);await close();
  await p.waitForFunction(mode=>document.querySelector('main').dataset.pbxMode===mode,mode);
  const names=await p.locator('.story-node-labels button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));for(const name of [en?'Sales · 201':'Satış · 201',en?'Support · 202':'Destek · 202'])assert.ok(names.includes(name),names.join(','));assert.ok(names.some(n=>/301/.test(n)));
  if(mode==='vpn-sip')assert.ok(names.includes(en?'VPN tunnel':'VPN tüneli'));if(mode==='ari')assert.ok(!names.includes('Verasist · SIP'));
  const max=Number(await p.getByRole('slider').getAttribute('max'));
  for(let i=0;i<=max;i++){
   await selectStep(i);await button(en?'Open step explanation':'Adım açıklamasını aç').click();assert.ok(await p.getByTestId('step-setup').isVisible());assert.ok((await p.getByRole('dialog').innerText()).length>100);await close();
   if(i===1||i===max-1){await button(en?'Details':'Ayrıntı').click();assert.ok((await p.getByTestId('packet-stack').count())>0);await close();}
  }
  let bridgeIndex=max-1;if(mode==='sip-number'){await button(en?'Steps':'Adımlar').click();const titles=await p.locator('.story-timeline button').allTextContents();bridgeIndex=titles.findIndex(t=>en?/Customer and staff talk through Verasist/.test(t):/Müşteri ve personel Verasist üzerinden konuşur/.test(t));await close();assert.ok(bridgeIndex>0);}
  await selectStep(bridgeIndex);const paths=JSON.parse(await p.getByTestId('story-canvas').getAttribute('data-audio-paths'));assert.ok(paths.length===2);
  if(mode==='ari')for(const path of paths)assert.ok(!path.route.includes(8));
  await button(en?'Play':'Oynat').click();await p.waitForTimeout(250);await button(en?'Pause':'Duraklat').click();
  await p.screenshot({path:`/tmp/pbx-model-${lang}-${mode}-${location}.png`});
  await button(en?'Steps':'Adımlar').click();await p.getByRole('tab',{name:en?'Mermaid messages':'Mermaid mesaj akışı'}).click();await p.getByRole('combobox',{name:en?'Diagram scope':'Diyagram kapsamı'}).selectOption('all');await p.getByTestId('sequence-svg').locator('svg').waitFor({timeout:60000});assert.equal(await p.getByRole('alert').count(),0);const source=await p.locator('.story-sequence-source pre').innerText();assert.ok(!source.includes('Note over'));await close();
  console.log('PASS',lang,mode,location,target,'every phase, setup/packet panels, audio, Mermaid');
 }
 for(const width of [390,320]){await p.setViewportSize({width,height:844});await p.waitForTimeout(250);assert.equal(await p.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);await button(en?'Scenario settings':'Senaryo ayarları').click();assert.equal(await p.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);await p.screenshot({path:`/tmp/pbx-model-${lang}-${width}.png`});await close();}
 await button(en?'Toggle theme':'Temayı değiştir').click();await p.setViewportSize({width:1440,height:1000});await p.locator('.story-webgl canvas').waitFor();await p.screenshot({path:`/tmp/pbx-model-${lang}-theme.png`});
 for(const path of ['ip-pbx','sip-trunk']){await p.goto(base+'/guides/integrations/telephony/'+path);await p.getByTestId('telephony-embed').scrollIntoViewIfNeeded();const f=p.frameLocator('[data-testid="telephony-embed"] iframe');await f.locator('.story-webgl canvas').waitFor();assert.equal(await f.locator('.story-tabs [role="tab"]').count(),4);await f.locator('#tab-pbx').click();await f.getByRole('button',{name:en?'Scenario settings':'Senaryo ayarları'}).click();assert.equal(await f.getByRole('dialog').getByRole('combobox',{name:en?'Connection model':'Bağlantı modeli'}).locator('option').count(),5);}
 assert.deepEqual(errors,[]);await context.close();console.log('PASS',lang,'mobile, theme, two embedded document pages');
}}finally{await b.close();}
