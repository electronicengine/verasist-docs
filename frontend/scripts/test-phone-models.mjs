import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const b=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const en=lang==='en',c=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await c.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
 if(process.env.DOCS_LAB_REAL_API!=='1')await c.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Guide</h2>'}:[]});});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/verasistLAB/ip-phone?lang='+lang);await p.locator('.story-webgl canvas').waitFor();
 const button=name=>p.getByRole('button',{name,exact:true}),close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await p.getByRole('dialog').waitFor({state:'hidden'});};
 const canvas=p.getByTestId('story-canvas'),slider=p.getByRole('slider');
 const selectStep=async i=>{await button(en?'Steps':'Adımlar').click();await p.locator('.story-timeline button').nth(i).click();await p.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);};
 for(const method of ['hosted','sip','forward'])for(const location of ['local','cloud']){
  await button(en?'Scenario settings':'Senaryo ayarları').click();const methodSelect=p.getByRole('combobox',{name:en?'Connection method':'Bağlantı yöntemi'}),locationSelect=p.getByRole('combobox',{name:en?'Verasist location':'Verasist konumu'});
  assert.equal(await methodSelect.locator('option').count(),3);assert.equal(await locationSelect.locator('option').count(),2);await methodSelect.selectOption(method);await locationSelect.selectOption(location);if(method==='hosted')assert.match(await p.getByRole('dialog').innerText(),en?/does not provide this automatically/:/otomatik sağlamaz/);await close();
  await p.waitForFunction(([method,location])=>document.querySelector('main').dataset.directMode===method&&document.querySelector('main').dataset.phoneLocation===location,[method,location]);
  for(const i of [0,1]){await selectStep(i);await button(en?'Open step explanation':'Adım açıklamasını aç').click();assert.ok((await p.getByTestId('step-setup').innerText()).length>150);await close();}
  const max=Number(await slider.getAttribute('max'));let ai=false,staff=false,staffStep=-1;
  await slider.focus();await p.keyboard.press('Home');
  for(let i=0;i<=max;i++){
   if(i)await p.keyboard.press('ArrowRight');await p.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);
   const audio=JSON.parse(await canvas.getAttribute('data-audio-paths'));if(audio.some(a=>a.route.includes(8)))ai=true;
   if(audio.some(a=>a.route.includes(5))){const route=audio.find(a=>a.route.includes(5)).route;if(method==='hosted'||route.includes(8)){staff=true;staffStep=i;if(method==='hosted'){const last=route.lastIndexOf(9);if(audio[0].id==='incoming')assert.deepEqual(route.slice(last),location==='local'?[9,3,5]:[9,16,3,5]);}else assert.ok(!route.includes(4));}}
  }
  assert.ok(ai&&staff);assert.ok(staffStep>0);await selectStep(staffStep);await button(en?'Play':'Oynat').click();await p.waitForTimeout(200);await button(en?'Pause':'Duraklat').click();await p.screenshot({path:`/tmp/phone-${lang}-${method}-${location}.png`});
  await button(en?'Details':'Ayrıntı').click();assert.ok(await p.getByTestId('packet-stack').isVisible());await close();
  await button(en?'Steps':'Adımlar').click();await p.getByRole('tab',{name:en?'Mermaid messages':'Mermaid mesaj akışı'}).click();await p.getByRole('combobox',{name:en?'Diagram scope':'Diyagram kapsamı'}).selectOption('all');await p.getByTestId('sequence-svg').locator('svg').waitFor({timeout:60000});assert.equal(await p.getByRole('alert').count(),0);await close();
  for(const width of [390,320]){await p.setViewportSize({width,height:844});await p.waitForTimeout(150);assert.equal(await p.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);await button(en?'Scenario settings':'Senaryo ayarları').click();assert.equal(await p.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);await p.screenshot({path:`/tmp/phone-${lang}-${method}-${location}-${width}.png`});await close();}
  await p.setViewportSize({width:1440,height:1000});console.log('PASS',lang,method,location,'all phases, setup, AI/staff media, packets, Mermaid and mobile');
 }
 await button(en?'Toggle theme':'Temayı değiştir').click();await p.screenshot({path:`/tmp/phone-${lang}-theme.png`});
 for(const path of ['ip-pbx','sip-trunk']){await p.goto(base+'/guides/integrations/telephony/'+path);await p.getByTestId('telephony-embed').scrollIntoViewIfNeeded();const f=p.frameLocator('[data-testid="telephony-embed"] iframe');await f.locator('.story-webgl canvas').waitFor();await f.locator('#tab-direct').click();await f.getByRole('button',{name:en?'Scenario settings':'Senaryo ayarları'}).click();assert.equal(await f.getByRole('combobox',{name:en?'Connection method':'Bağlantı yöntemi'}).locator('option').count(),3);assert.equal(await f.getByRole('combobox',{name:en?'Verasist location':'Verasist konumu'}).locator('option').count(),2);}
 assert.deepEqual(errors,[]);await c.close();console.log('PASS',lang,'theme and both live document embeds');
}}finally{await b.close();}
