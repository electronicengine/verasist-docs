import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL || 'http://localhost:7317';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
for(const lang of ['tr','en']) {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
 if(process.env.DOCS_LAB_REAL_API!=='1') await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Guide</h2>'}:[]})});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ogren/telefon-santrali?senaryo=direct&lang='+lang);
 const choice=page.getByRole('combobox',{name:lang==='en'?'Connection method':'Bağlantı yöntemi'});
 await choice.selectOption('forward');
 await page.locator('.story-webgl canvas').waitFor();
 const hint=page.getByTestId('operator-hint');await hint.locator('summary').click();
 assert.ok(await hint.getByRole('link',{name:'Türk Telekom',exact:true}).isVisible());
 assert.ok(await hint.getByRole('link',{name:'Vodafone Türkiye',exact:true}).isVisible());
 assert.match(await hint.innerText(),lang==='en'?/not verified/:/doğrulanmış değil/);
 assert.ok(await hint.getByRole('link',{name:'Netgsm',exact:true}).getAttribute('href'));
 await hint.locator('summary').click();
 const steps=page.locator('.story-timeline button');assert.equal(await steps.count(),34);
 let bridge;
 for(let i=0;i<await steps.count();i++) {
   await steps.nth(i).click();await page.waitForFunction(i=>Number(document.querySelector('[data-testid="story-canvas"]').dataset.step)===i,i);
   const canvas=page.getByTestId('story-canvas');
   const nodes=await page.locator('.story-node-labels button').count();assert.equal(nodes,i<14?5:7);
   if(i>=14) {assert.ok(await page.getByRole('button',{name:lang==='en'?'Verasist number carrier · B':'Verasist numara operatörü · B',exact:true}).isVisible());}
   assert.ok(await page.getByTestId('step-setup').isVisible());
   if((await steps.nth(i).getAttribute('title')).includes(lang==='en'?'Customer and staff talk through':'Müşteri ve personel Verasist üzerinden')) {
      bridge=i;const audio=JSON.parse(await canvas.getAttribute('data-audio-paths'));
      assert.ok(audio.some(p=>JSON.stringify(p.route)===JSON.stringify([0,1,12,8,12,1,16,3,5])));
      await page.getByRole('button',{name:lang==='en'?'Details':'Ayrıntı',exact:true}).click();
      assert.ok(await page.locator('.story-drawer').isVisible());await page.getByRole('button',{name:lang==='en'?'Close details':'Ayrıntıyı kapat',exact:true}).click();
   }
 }
 assert.ok(bridge);await steps.nth(bridge).click();
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:width<650?844:1000});
  assert.equal(await page.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  assert.equal(await choice.evaluate(e=>e.getBoundingClientRect().right>innerWidth),false);
  await page.getByRole('button',{name:lang==='en'?'Play':'Oynat',exact:true}).click();await page.waitForTimeout(250);
  await page.getByRole('button',{name:lang==='en'?'Pause':'Duraklat',exact:true}).click();
  await page.screenshot({path:`/tmp/telephony-forward-${lang}-${width}.png`});
 }
 await choice.selectOption('sip');await page.waitForFunction(()=>document.querySelectorAll('.story-timeline button').length===32);
 assert.equal(await page.locator('.story-timeline button[aria-current]').innerText(),'1');
 await hint.locator('summary').click();assert.match(await hint.innerText(),lang==='en'?/not verified/:/doğrulanmış değil/);
 await page.getByRole('tab').first().click();assert.equal(await page.getByRole('combobox').count(),1);
 assert.equal(await page.getByRole('button',{name:lang==='en'?'Verasist number carrier · B':'Verasist numara operatörü · B',exact:true}).count(),0);
 await page.goto(base+'/guides/integrations/telephony/sip-trunk');await page.locator('[data-testid="telephony-embed"] iframe').scrollIntoViewIfNeeded();
 const frame=page.frameLocator('[data-testid="telephony-embed"] iframe');await frame.getByRole('tab').nth(4).click();
 await frame.getByRole('combobox').selectOption('forward');await frame.locator('.story-timeline button').nth(19).click();
 assert.equal(await frame.locator('.story-node-labels button').count(),7);
 assert.deepEqual(errors,[]);await context.close();
 console.log('PASS',lang,'two methods, sourced conditional operator hints, all 34 forwarding steps, separate carrier topology, bidirectional media, details, 320–1440px, playback, reset, other tabs and docs iframe');
}
} finally {await browser.close();}
