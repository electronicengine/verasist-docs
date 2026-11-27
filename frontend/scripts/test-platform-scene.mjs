import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const en=lang==='en',page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/verasistLAB/how-verasist-works?lang='+lang);await page.locator('.story-webgl canvas').waitFor();
 const button=name=>page.getByRole('button',{name,exact:true}),slider=page.getByRole('slider');
 const close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 for(const mode of ['pipeline','live']){
  await button(en?'Scenario settings':'Senaryo ayarları').click();await page.getByRole('combobox',{name:en?'Model pipeline':'Model pipeline’ı',exact:true}).selectOption(mode);await close();
  const names=await page.locator('.story-node-labels button').evaluateAll(items=>items.map(e=>e.getAttribute('aria-label')));
  assert.ok(!names.some(n=>/PBX|santrali|ATA|201|202|NAT|Ethernet/.test(n)));assert.ok(names.includes(en?'Speaker':'Konuşmacı'));assert.ok(names.includes(en?'Organization':'Organizasyon'));
  assert.equal(await page.locator('.story-node-labels [data-kind="server"],.story-node-labels [data-kind="cloud"],.story-node-labels [data-kind="gateway"]').count(),0);assert.ok(names.includes(en?'Inbound workflow':'Gelen iş akışı'));
  if(mode!=='pipeline')assert.ok(!names.some(n=>/^STT|^TTS/.test(n)));
  await slider.focus();await page.keyboard.press('Home');const max=Number(await slider.getAttribute('max'));
  for(let i=0;i<=max;i++){
   if(i)await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);
   await button(en?'Open step explanation':'Adım açıklamasını aç').click();assert.ok(await page.getByTestId('step-setup').isVisible());assert.equal(await page.getByTestId('nat-details').count(),0);await close();await slider.focus();
   if([3,5,6,10].includes(i)){await button(en?'Details':'Ayrıntı').click();assert.equal(await page.getByTestId('packet-stack').getAttribute('data-kind'),'event');assert.ok(await page.getByRole('link',{name:en?'Workflow and agent guide':'İş akışı ve ajan rehberi',exact:true}).isVisible());await close();await slider.focus();}
  }
  await slider.focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),max-1);
  const paths=JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths'));assert.ok(paths.some(p=>JSON.stringify(p.route)===JSON.stringify(mode==='pipeline'?[31,8,24,25]:[31,8,24,29])));assert.ok(paths.some(p=>JSON.stringify(p.route)===JSON.stringify(mode==='pipeline'?[27,28,31]:[29,28,31])));
  await page.screenshot({path:`/tmp/platform-${lang}-${mode}-desktop.png`});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.locator('.story-webgl canvas').waitFor();
  assert.equal(await page.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);await page.screenshot({path:`/tmp/platform-${lang}-${mode}-mobile.png`});await page.setViewportSize({width:1440,height:1000});
 }
 assert.deepEqual(errors,[]);console.log('PASS',lang,'three platform model modes, every phase, scoped configuration, structured frames, isolated audio paths and responsive views');await page.close();
}}finally{await browser.close();}
