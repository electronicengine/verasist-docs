import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const en=lang==='en',page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ogren/telefon-santrali?lang='+lang);await page.locator('.story-webgl canvas').waitFor();
 const button=name=>page.getByRole('button',{name,exact:true}),close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 const scope=()=>page.getByRole('combobox',{name:en?'Diagram scope':'Diyagram kapsamı'}),phase=()=>page.getByRole('combobox',{name:en?'Animation step':'Animasyon adımı'});
 const render=async()=>{await page.getByTestId('sequence-svg').locator('svg').waitFor({timeout:45000});assert.equal(await page.getByRole('alert').count(),0);};
 const diagrams=async label=>{
  await button(en?'Steps':'Adımlar').click();await page.getByRole('tab',{name:en?'Mermaid messages':'Mermaid mesaj akışı',exact:true}).click();await render();
  const viewport=page.getByRole('region',{name:en?'Scrollable Mermaid message diagram':'Kaydırılabilir Mermaid mesaj diyagramı'});
  await scope().selectOption('all');await render();assert.ok((await page.getByTestId('sequence-svg').innerText()).length>40);assert.ok(await viewport.evaluate(e=>e.scrollHeight>0));
  const last=Number(await page.getByRole('slider',{includeHidden:true}).getAttribute('max'));await scope().selectOption('step');await phase().selectOption(String(Math.max(0,last-1)));await render();assert.equal(await page.getByRole('slider',{includeHidden:true}).inputValue(),String(Math.max(0,last-1)));
  const panel=await page.getByRole('dialog').boundingBox();assert.ok(panel.width>900);
  await page.getByRole('tab',{name:en?'Step list':'Adım listesi',exact:true}).click();assert.equal(await page.locator('.story-timeline button').count(),last+1);
  await page.getByRole('tab',{name:en?'Mermaid messages':'Mermaid mesaj akışı',exact:true}).click();await render();await close();console.log('PASS',lang,label);
 };
 for(const id of ['public-line','pbx','registration','reception','extension','direct','mechanism']){
  await page.locator('#tab-'+id).click();await page.waitForFunction(id=>document.querySelector('main')?.dataset.scenario===id,id);await diagrams(id);
 }
 for(const [id,field,value] of [['pbx',en?'Call route':'Çağrı rotası','sip-number'],['registration',en?'Connection scenario':'Bağlantı senaryosu','pbx'],['direct',en?'Connection method':'Bağlantı yöntemi','forward'],['mechanism',en?'Model pipeline':'Model pipeline’ı','live']]){
  await page.locator('#tab-'+id).click();await button(en?'Scenario settings':'Senaryo ayarları').click();await page.getByRole('dialog').getByRole('combobox',{name:field,exact:true}).selectOption(value);await close();await diagrams(id+' / '+value);
 }
 await page.locator('#tab-pbx').click();await button(en?'Scenario settings':'Senaryo ayarları').click();await page.getByRole('combobox',{name:en?'Target extension':'Hedef dahili',exact:true}).selectOption('301');await close();await diagrams('analog / 301');
 await button(en?'Steps':'Adımlar').click();await page.getByRole('tab',{name:en?'Mermaid messages':'Mermaid mesaj akışı'}).click();await render();await scope().selectOption('all');await render();
 await page.screenshot({path:`/tmp/message-sequence-${lang}-desktop.png`});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(250);assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false);assert.equal(await page.getByRole('dialog').evaluate(e=>e.getBoundingClientRect().right>innerWidth),false);
 }
 await page.screenshot({path:`/tmp/message-sequence-${lang}-mobile.png`});await close();await button(en?'Toggle theme':'Temayı değiştir').click();await button(en?'Steps':'Adımlar').click();await page.getByRole('tab',{name:en?'Mermaid messages':'Mermaid mesaj akışı'}).click();await render();await page.screenshot({path:`/tmp/message-sequence-${lang}-theme.png`});await close();
 assert.deepEqual(errors,[]);await page.close();console.log('PASS',lang,'all scenario options, analog, current/all scopes, step synchronization, list tabs, themes and mobile scrolling');
}}finally{await browser.close();}
