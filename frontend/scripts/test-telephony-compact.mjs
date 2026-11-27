import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {for(const lang of ['tr','en']) {
 const en=lang==='en',context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
 if(process.env.DOCS_LAB_REAL_API!=='1')await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Guide</h2><p>Phone guide.</p>'}:[]});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ogren/telefon-santrali?lang='+lang);await page.locator('.story-webgl canvas').waitFor();
 const button=name=>page.getByRole('button',{name,exact:true});
 const slider=page.getByRole('slider',{name:en?'Select step':'Adım seçimi'});
 const setStep=async i=>{await slider.focus();await page.keyboard.press('Home');for(let n=0;n<i;n++)await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);};
 const open=async kind=>{await button(({lesson:en?'Open step explanation':'Adım açıklamasını aç',steps:en?'Steps':'Adımlar',scenario:en?'Scenario settings':'Senaryo ayarları',help:en?'Diagram tips':'Şema ipuçları'})[kind]).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').getAttribute('data-panel'),kind);};
 const close=async()=>{await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});};
 for(let tab=0;tab<6;tab++){
  await page.locator('#tab-'+['pbx','registration','reception','extension','direct','mechanism'][tab]).click();await page.waitForFunction(id=>document.querySelector('main').dataset.scenario===id,['pbx','registration','reception','extension','direct','mechanism'][tab]);await slider.focus();await page.keyboard.press('Home');
  const max=Number(await slider.getAttribute('max'));
  for(let i=0;i<=max;i++) {if(i)await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);assert.ok((await page.locator('.story-current-title').innerText()).length>5);}
  await open('lesson');assert.ok(await page.getByTestId('step-setup').isVisible());await close();
  await open('steps');assert.equal(await page.locator('.story-timeline button').count(),max+1);await page.locator('.story-timeline button').first().click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await slider.inputValue(),'0');
 }
 await page.locator('#tab-direct').click();await open('scenario');await page.getByRole('combobox',{name:en?'Connection method':'Bağlantı yöntemi'}).selectOption('forward');
 assert.ok(await page.getByRole('dialog').isVisible());await page.getByTestId('operator-hint').locator('summary').click();assert.ok(await page.getByTestId('operator-hint').getByRole('link',{name:'Türk Telekom',exact:true}).isVisible());await close();assert.equal(await slider.getAttribute('max'),'33');
 await setStep(14);await button(en?'Play':'Oynat').click();await open('lesson');await close();assert.ok(await button(en?'Play':'Oynat').isVisible());assert.equal(await slider.inputValue(),'14');
 await open('help');assert.ok(await page.getByRole('dialog').getByRole('link',{name:en?'IP PBX guide':'IP santral rehberi'}).isVisible());await close();
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:width<650?844:1000});await page.waitForTimeout(100);
  await page.locator('.story-webgl canvas').waitFor({state:'visible'});const box=await page.locator('.story-webgl canvas').evaluate(e=>({height:e.getBoundingClientRect().height}));assert.ok(box.height> (width<650?500:650),`Scene too small at ${width}: ${box.height}`);
  assert.equal(await page.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);
  assert.equal(await page.locator('.story-step-scroll').count(),0);assert.equal(await page.locator('.story-timeline').count(),0);
  for(const tab of await page.getByRole('tab').all())assert.equal(await tab.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await page.screenshot({path:`/tmp/telephony-compact-${lang}-${width}.png`});
  await open('lesson');const dialog=await page.getByRole('dialog').boundingBox();if(width<650)assert.ok(dialog.y>844*.2);
  const reader=page.locator('.story-control-body');await reader.evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await page.getByTestId('step-setup').isVisible());await page.screenshot({path:`/tmp/telephony-compact-panel-${lang}-${width}.png`});
  await page.getByRole('dialog').getByRole('button',{name:en?'Next step':'Sonraki adım',exact:true}).click();assert.equal(await reader.evaluate(e=>e.scrollTop),0);await close();await setStep(14);
 }
 await page.setViewportSize({width:1440,height:1000});await button(en?'Toggle theme':'Temayı değiştir').click();await page.screenshot({path:`/tmp/telephony-compact-${lang}-light.png`});
 await button(en?'Details':'Ayrıntı').click();assert.ok(await page.locator('.packet-stack').count() || await page.locator('.story-drawer-path').isVisible());await close();
 await page.locator('#tab-pbx').click();await open('scenario');await page.getByRole('combobox',{name:en?'Target extension':'Hedef dahili'}).selectOption('301');await close();await setStep(Number(await slider.getAttribute('max')));await open('lesson');assert.match(await page.getByRole('dialog').innerText(),en?/analog|ATA/:/analog|ATA/);await close();
 await page.setViewportSize({width:320,height:844});
 for(let tab=0;tab<6;tab++) {await page.locator('#tab-'+['pbx','registration','reception','extension','direct','mechanism'][tab]).click();await slider.focus();await page.keyboard.press('End');await page.waitForTimeout(100);assert.equal(await page.locator('.story-player-main').evaluate(e=>e.scrollWidth>e.clientWidth),false,'Final-step controls overflow at 320px');}
 await page.setViewportSize({width:1440,height:1000});
 for(const path of ['ip-pbx','sip-trunk']){
  await page.goto(base+'/guides/integrations/telephony/'+path);await page.getByTestId('telephony-embed').scrollIntoViewIfNeeded();const frame=page.frameLocator('[data-testid="telephony-embed"] iframe');await frame.getByTestId('telephony-story').waitFor();
  await frame.locator('.story-webgl canvas').waitFor({state:'visible'});const scene=await frame.locator('.story-webgl canvas').evaluate(e=>({height:e.getBoundingClientRect().height})),body=await frame.locator('main').boundingBox();assert.ok(scene.height/body.height>.6);
  await frame.getByRole('button',{name:en?'Open step explanation':'Adım açıklamasını aç'}).click();assert.ok(await frame.getByTestId('step-setup').isVisible());await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);console.log('PASS',lang,'all six scenarios and every step, modal controls, forwarding sources, pause/preserve, 320–1440px scene space, scroll reset, analog, packets, themes and both document embeds');await context.close();
}}finally{await browser.close();}
