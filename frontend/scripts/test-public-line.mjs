import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{for(const lang of ['tr','en']){
 const en=lang==='en',page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/verasistLAB/landline-mobile?lang=${lang}`);await page.locator('.story-webgl canvas').waitFor();
 const button=name=>page.getByRole('button',{name,exact:true}),close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 const settings=()=>button(en?'Scenario settings':'Senaryo ayarları').click(),slider=page.getByRole('slider');
 for(const line of ['fixed','mobile'])for(const staff of ['mobile','fixed']){
  await settings();await page.getByRole('combobox',{name:en?'Office line / scenario':'Kurum hattı / senaryo',exact:true}).selectOption(line);await page.getByRole('combobox',{name:en?'Transfer destination':'Aktarım hedefi',exact:true}).selectOption(staff);
  await page.getByTestId('public-line-sources').locator('summary').click();assert.equal(await page.getByTestId('public-line-sources').getByRole('link').count(),4);await close();
  assert.equal(await slider.inputValue(),'0');await slider.focus();
  const max=Number(await slider.getAttribute('max'));
  for(let step=0;step<=max;step++){
   if(step)await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),step);
   assert.ok((await page.locator('.story-current-title').innerText()).length>4);
   if([9,14,22].includes(step)){
    await button(en?'Details':'Ayrıntı').click();assert.equal(await page.getByTestId('packet-stack').getAttribute('data-kind'),step===9?'sip':'rtp');await close();await slider.focus();
   }
  }
  await button(en?'Open step explanation':'Adım açıklamasını aç').click();assert.ok(await page.getByTestId('step-setup').isVisible());await close();
  const names=await page.locator('.story-node-labels button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
  assert.ok(!names.some(n=>/ATA|PBX|santrali|Ethernet|201|202/.test(n)));assert.ok(names.includes(en?(line==='fixed'?'Main landline':'Main mobile'):(line==='fixed'?'Ana sabit hat':'Ana mobil hat')));
 }
 await page.getByRole('slider').focus();await page.keyboard.press('Home');await settings();await page.getByRole('combobox',{name:en?'Office line / scenario':'Kurum hattı / senaryo',exact:true}).selectOption('fixed');await close();
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:width<650?844:1000});await page.waitForTimeout(300);await page.locator('.story-webgl canvas').waitFor({state:'visible'});
  assert.equal(await page.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);
  assert.ok(await page.locator('.story-webgl canvas').evaluate(e=>e.getBoundingClientRect().height)>(width<650?500:650));
  await page.getByRole('tab',{name:en?/Landline \/ mobile/:/Sabit \/ mobil hat/}).scrollIntoViewIfNeeded();
 }
 await page.screenshot({path:`/tmp/public-line-${lang}-mobile.png`});
 await button(en?'Toggle theme':'Temayı değiştir').click();await settings();await page.getByRole('combobox',{name:en?'Office line / scenario':'Kurum hattı / senaryo',exact:true}).selectOption('mobile');await close();
 await page.screenshot({path:`/tmp/public-line-${lang}-theme.png`});assert.deepEqual(errors,[]);await page.close();console.log('PASS',lang,'four line/target combinations, all phases, packet layers, setup, sources, devices, themes and responsive scene');
}}finally{await browser.close();}
