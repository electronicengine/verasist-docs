import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
try{for(const lang of ['tr','en']){
 const en=lang==='en',page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ogren/telefon-santrali?senaryo=direct&lang='+lang);await page.locator('.story-webgl canvas').waitFor();
 const button=name=>page.getByRole('button',{name,exact:true}),slider=page.getByRole('slider');
 const close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 const step=async i=>{await slider.focus();await page.keyboard.press('Home');for(let n=0;n<i;n++)await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);};
 const audio=async()=>JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths'));
 for(const mode of ['sip','forward']){
  await button(en?'Scenario settings':'Senaryo ayarları').click();await page.getByRole('combobox',{name:en?'Connection method':'Bağlantı yöntemi'}).selectOption(mode);await close();
  await step(11);assert.ok((await audio()).some(p=>JSON.stringify(p.route)===JSON.stringify([0,1,16,3,4])));
  await step(mode==='sip'?23:25);await button(en?'Details':'Ayrıntı').click();
  assert.equal(await page.getByTestId('packet-stack').getAttribute('data-kind'),'sip');const text=await page.getByTestId('packet-stack').innerText();assert.ok(text.includes('office-a-202@198.51.100.24:62002'));assert.ok(!text.includes('office-a-201'));await close();
  await step(mode==='sip'?27:29);assert.ok(await button(en?'Main phone · 201':'Ana telefon · 201').isVisible());const expected=mode==='sip'?[0,1,8,1,16,3,5]:[0,1,12,8,12,1,16,3,5],paths=await audio();
  assert.ok(paths.some(p=>JSON.stringify(p.route)===JSON.stringify(expected)));assert.ok(paths.every(p=>!p.route.includes(4)));
  await button(en?'Staff phone · 202':'Personel telefonu · 202').click();assert.ok((await page.getByRole('dialog').innerText()).includes('office-a-202'));await close();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.locator('.story-webgl canvas').waitFor();assert.equal(await page.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth),false);
  await page.screenshot({path:`/tmp/separate-ip-${lang}-${mode}.png`});await page.setViewportSize({width:1440,height:1000});
 }
 assert.deepEqual(errors,[]);await page.close();console.log('PASS',lang,'baseline phone 201; both SIP/number forwarding modes transfer signaling and bidirectional media to distinct phone 202');
}}finally{await browser.close();}
