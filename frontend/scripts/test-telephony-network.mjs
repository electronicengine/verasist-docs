import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const base=process.env.DOCS_LAB_TEST_URL||'http://localhost:7332';
try{for(const lang of ['tr','en']){
 const en=lang==='en',page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/ogren/telefon-santrali?lang=${lang}`);await page.locator('.story-webgl canvas').waitFor();
 const button=name=>page.getByRole('button',{name,exact:true}),slider=page.getByRole('slider'),router=()=>button('Modem / router · NAT');
 const close=async()=>{await button(en?'Close details':'Ayrıntıyı kapat').click();await page.getByRole('dialog').waitFor({state:'hidden'});};
 const step=async i=>{await slider.focus();await page.keyboard.press('Home');for(let n=0;n<i;n++)await page.keyboard.press('ArrowRight');await page.waitForFunction(i=>document.querySelector('[data-testid="story-canvas"]').dataset.step===String(i),i);};
 for(const id of ['pbx','registration','reception','extension','direct']){
  await page.locator('#tab-'+id).click();await page.waitForFunction(id=>document.querySelector('main').dataset.scenario===id,id);await router().waitFor();assert.ok(await button('Ethernet switch').isVisible());
  await router().click();const nat=page.getByTestId('nat-details');await nat.waitFor();assert.ok(await nat.locator('.story-nat-body').isVisible());assert.ok((await nat.innerText()).includes('CGNAT'));assert.ok((await nat.innerText()).includes('RTP'));assert.ok((await nat.innerText()).includes('port'));assert.equal(await nat.getByRole('link').count(),1);await close();
 }
 await page.locator('#tab-pbx').click();await page.waitForFunction(()=>document.querySelector('main').dataset.scenario==='pbx'&&document.querySelector('[data-testid="story-canvas"]').dataset.step==='0');await step(1);await button(en?'Open step explanation':'Adım açıklamasını aç').click();await page.getByTestId('nat-details').locator('summary').click();assert.match(await page.getByTestId('nat-details').innerText(),en?/crosses the office router/:/kurum router’ından geçer/);assert.ok((await page.getByTestId('nat-details').innerText()).includes('external_media_address'));await close();
 await step(2);await button(en?'Open step explanation':'Adım açıklamasını aç').click();await page.getByTestId('nat-details').locator('summary').click();assert.match(await page.getByTestId('nat-details').innerText(),en?/does not cross/:/sınırından geçmiyor/);await close();
 await slider.focus();await page.keyboard.press('End');await page.waitForTimeout(150);const paths=JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths'));assert.ok(paths.some(p=>JSON.stringify(p.route)===JSON.stringify([0,1,16,3,2,3,4])));
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:width<650?844:1000});await page.waitForTimeout(300);await page.locator('.story-webgl canvas').waitFor();assert.ok(await router().isVisible());assert.equal(await page.locator('main').evaluate(e=>e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight),false);assert.ok(await page.locator('.story-webgl canvas').evaluate(e=>e.getBoundingClientRect().height)>(width<650?500:650));
 }
 await page.screenshot({path:`/tmp/telephony-network-${lang}-mobile.png`});await button(en?'Toggle theme':'Temayı değiştir').click();await router().click();assert.ok(await page.getByTestId('nat-details').locator('.story-nat-body').isVisible());await page.screenshot({path:`/tmp/telephony-network-${lang}-panel.png`});await close();
 await page.locator('#tab-public-line').click();await page.waitForFunction(()=>document.querySelector('main').dataset.scenario==='public-line');assert.equal(await router().count(),0);
 assert.deepEqual(errors,[]);await page.close();console.log('PASS',lang,'separate switch/router, local and WAN flows, NAT/SDP/CGNAT controls, six IP scenarios, public-line exclusion, themes and responsive scene');
}}finally{await browser.close();}
