import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const en=lang==='en',c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await c.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
 if(process.env.DOCS_LAB_REAL_API!=='1')await c.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Guide</h2>'}:[]});});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/verasistLAB/pbx?lang='+lang);await p.locator('.story-webgl canvas').waitFor();
 const button=name=>p.getByRole('button',{name,exact:true}),close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await p.getByRole('dialog').waitFor({state:'hidden'});};
 const step=async pattern=>{await button(en?'Steps':'Adımlar').click();const labels=await p.locator('.story-timeline button').allTextContents(),i=labels.findIndex(label=>pattern.test(label));assert.ok(i>=0,pattern.toString());await p.locator('.story-timeline button').nth(i).click();await p.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);};
 const canvas=p.getByTestId('story-canvas'),paths=async()=>JSON.parse(await canvas.getAttribute('data-audio-paths'));
 for(const [mode,location] of [['remote-sip','cloud'],['ari','local'],['ari','cloud']]){
  await button(en?'Scenario settings':'Senaryo ayarları').click();await p.getByRole('dialog').getByRole('combobox',{name:en?'Connection model':'Bağlantı modeli'}).selectOption(mode);if(mode==='ari')await p.getByRole('combobox',{name:en?'Verasist location':'Verasist konumu'}).selectOption(location);await close();
  if(mode==='ari'){
   await step(en?/PBX enters Stasis/:/PBX çağrıyı Stasis/);const signal=JSON.parse(await canvas.getAttribute('data-signal-path'));assert.ok(signal.includes(37));assert.ok(!signal.includes(38));
   await step(en?/separate media WSS connection/:/ayrı medya WSS bağlantısını/);assert.ok(JSON.parse(await canvas.getAttribute('data-signal-path')).includes(38));
  }
  await step(en?/Verasist greets first/:/Verasist ilk karşılamayı/);let audio=await paths();assert.equal(audio.length,2);if(mode==='ari'){assert.ok(audio[0].route.includes(38));assert.ok(!audio[0].route.includes(37));}
  await button(en?'Play':'Oynat').click();await p.waitForTimeout(250);await button(en?'Pause':'Duraklat').click();await p.screenshot({path:`/tmp/distinct-${lang}-${mode}-${location}-conversation.png`});
  await step(en?/Customer and staff talk;/:/Müşteri ve personel konuşur;/);assert.equal(await canvas.getAttribute('data-bridge-at'),mode==='ari'?'2':'9');assert.equal(await canvas.getAttribute('data-agent-detached'),'true');audio=await paths();assert.equal(audio[0].route.includes(9),mode!=='ari');assert.ok(!audio[0].route.includes(8));
  if(mode==='ari')assert.equal(await p.locator('.story-node-labels button[data-inactive="true"]').count(),1);
  assert.match(await p.getByTestId('connection-difference').innerText(),mode==='ari'?(en?/office PBX bridge/:/köprü kurum PBX’inde/):(en?/audio still traverses Verasist SIP/:/ses hâlâ Verasist SIP üzerinden/));
  await p.screenshot({path:`/tmp/distinct-${lang}-${mode}-${location}-staff.png`});
  await button(en?'Steps':'Adımlar').click();await p.getByRole('tab',{name:en?'Mermaid messages':'Mermaid mesaj akışı'}).click();await p.getByRole('combobox',{name:en?'Diagram scope':'Diyagram kapsamı'}).selectOption('all');await p.getByTestId('sequence-svg').locator('svg').waitFor({timeout:60000});assert.equal(await p.getByRole('alert').count(),0);const source=await p.locator('.story-sequence-source pre').textContent();if(mode==='ari'){assert.match(source,/WSS/);assert.ok(!/P37->>/.test(source));}await close();
  for(const width of [390,320]){await p.setViewportSize({width,height:844});await p.waitForTimeout(150);assert.equal(await p.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);await p.getByTestId('connection-difference').waitFor();await p.screenshot({path:`/tmp/distinct-${lang}-${mode}-${location}-${width}.png`});}
  await p.setViewportSize({width:1440,height:1000});console.log('PASS',lang,mode,location,'distinct controls/media, bridge owner, cloud media detach, Mermaid/mobile');
 }
 await button(en?'Toggle theme':'Temayı değiştir').click();await p.screenshot({path:`/tmp/distinct-${lang}-theme.png`});
 for(const path of ['ip-pbx','sip-trunk']){await p.goto(base+'/guides/integrations/telephony/'+path);await p.getByTestId('telephony-embed').scrollIntoViewIfNeeded();const f=p.frameLocator('[data-testid="telephony-embed"] iframe');await f.locator('.story-webgl canvas').waitFor();await f.locator('#tab-pbx').click();await f.getByTestId('connection-difference').waitFor();}
 assert.deepEqual(errors,[]);await c.close();console.log('PASS',lang,'themes, embeds, no browser errors');
}}finally{await browser.close();}
