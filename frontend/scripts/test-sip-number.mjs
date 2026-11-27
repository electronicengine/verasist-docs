import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL || 'http://localhost:7332';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const en=lang==='en',context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/ogren/telefon-santrali?lang=${lang}`);await page.locator('.story-webgl canvas').waitFor();
 const route=page.locator('.story-scene-toolbar').getByRole('combobox');
 await route.selectOption('sip-number');await page.waitForFunction(()=>document.querySelector('main').dataset.pbxMode==='sip-number');
 const slider=page.getByRole('slider'),close=async()=>{await page.getByRole('button',{name:en?'Close details':'Ayrıntıyı kapat',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 const step=async i=>{await slider.focus();await page.keyboard.press('Home');for(let n=0;n<i;n++)await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);};
 for(const target of ['201','202','301']){
  await page.getByRole('button',{name:en?'Scenario settings':'Senaryo ayarları',exact:true}).click();
  await page.getByRole('dialog').getByRole('combobox',{name:en?'Target extension':'Hedef dahili'}).selectOption(target);await close();
  const max=Number(await slider.getAttribute('max'));
  for(let i=0;i<=max;i++){
   await step(i);assert.ok((await page.locator('.story-current-title').innerText()).length>4);
   await page.getByRole('button',{name:en?'Details':'Ayrıntı',exact:true}).click();await page.getByTestId('packet-stack').waitFor();assert.ok(await page.locator('.packet-layer').count()>0);await close();
  }
 }
 await step(4);await page.getByRole('button',{name:en?'Details':'Ayrıntı',exact:true}).click();assert.equal(await page.getByTestId('packet-stack').getAttribute('data-kind'),'sip');await page.locator('[data-field="Call-ID"] button').click();await page.locator('.packet-field-explanation').waitFor();await close();
 await page.locator('#tab-reception').click();await page.locator('#tab-pbx').click();assert.equal(await route.inputValue(),'sip-number');assert.equal(await slider.inputValue(),'0');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:width<650?844:1000});await page.waitForTimeout(300);await page.locator('.story-webgl canvas').waitFor();
  assert.equal(await page.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);
  const bounds=await route.evaluate(e=>{const r=e.getBoundingClientRect();return {right:r.right,width:r.width};});assert.ok(bounds.width>120&&bounds.right<=width);
  const height=await page.locator('.story-webgl canvas').evaluate(e=>e.getBoundingClientRect().height);assert.ok(height>(width<650?500:650));
 }
 await page.screenshot({path:`/tmp/sip-number-${lang}-mobile.png`});await route.selectOption('normal');assert.equal(await slider.inputValue(),'0');
 assert.deepEqual(errors,[]);await context.close();console.log(`${lang}: SIP number, 3 destinations, all steps/packets and responsive selection passed`);
}}finally{await browser.close();}
