import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL || 'http://localhost:7317';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const ids=['pbx','registration','reception','extension','direct','mechanism'];
const tr=['Normal santral','Verasist ile santral','Verasist IVR','Dahili Verasist','Santralsiz IP telefon ile Verasist','Verasist nasıl çalışır?'];
async function inspectTabs(pageOrFrame) {
  const checks=await pageOrFrame.getByRole('tab').evaluateAll(tabs=>tabs.map(el=>{
    const box=el.getBoundingClientRect();
    const ranges=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()).flatMap(n=>{const range=document.createRange();range.selectNodeContents(n);return [...range.getClientRects()].map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom}))});
    return {id:el.id,overflow:el.scrollWidth>el.clientWidth+1,textOutside:ranges.some(r=>r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1),height:box.height};
  }));
  assert.deepEqual(checks.map(c=>c.id),ids.map(id=>'tab-'+id));
  assert.ok(checks.every(c=>!c.overflow&&!c.textOutside&&c.height>=44),JSON.stringify(checks));
}
try {
  for(const lang of ['tr','en']) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:lang==='tr'?'tr-TR':'en-US',reducedMotion:'reduce'});
    await context.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
    if(process.env.DOCS_LAB_REAL_API!=='1') await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Connection</h2><p>Setup guide.</p>'}:[]})});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/ogren/telefon-santrali?lang='+lang);
    await page.locator('.story-webgl canvas').waitFor();
    if(lang==='tr') assert.deepEqual(await page.getByRole('tab').evaluateAll(t=>t.map(e=>[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim())),tr);
    assert.equal(await page.getByRole('tab').first().getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.story-guide').count(),0);
    assert.equal(await page.locator('.story-help').count(),1);
    const fonts=await page.evaluate(()=>({body:getComputedStyle(document.body).fontFamily,main:getComputedStyle(document.querySelector('main')).fontFamily,title:getComputedStyle(document.querySelector('.story-scenario-heading h1')).fontFamily,caption:getComputedStyle(document.querySelector('.story-caption p')).fontFamily}));
    assert.equal(fonts.body,fonts.main);assert.equal(fonts.body,fonts.caption);assert.match(fonts.title,/Outfit/);assert.doesNotMatch(JSON.stringify(fonts),/Handrawn|cursive|Arial/);
    for(const width of [1440,1024,768,620,390,320]) {
      await page.setViewportSize({width,height:width<651?844:1000});
      await inspectTabs(page);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const columns=await page.locator('.story-tabs').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);assert.equal(columns,width>1100?6:3);
      await page.getByRole('tab').nth(4).click();
      await page.waitForFunction(()=>document.querySelector('main').dataset.scenario==='direct');
      await page.locator('.story-help summary').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('.story-help').getAttribute('open'),'');
      assert.ok(await page.locator('.story-help-body').isVisible());
      await page.keyboard.press('Space');
      assert.equal(await page.locator('.story-help').getAttribute('open'),null);
      await page.screenshot({path:`/tmp/telephony-layout-${lang}-${width}.png`});
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/guides/integrations/telephony/ip-pbx');
    await page.locator('[data-testid="telephony-embed"] iframe').scrollIntoViewIfNeeded();
    const frame=page.frameLocator('[data-testid="telephony-embed"] iframe');
    await frame.getByTestId('telephony-story').waitFor();await inspectTabs(frame);
    const docFonts=await page.locator('h1').first().evaluate(e=>getComputedStyle(e).fontFamily);
    assert.equal(await frame.locator('.story-scenario-heading h1').evaluate(e=>getComputedStyle(e).fontFamily),docFonts);
    await frame.getByRole('tab').last().click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="telephony-embed"] iframe').contentDocument.querySelector('main').dataset.scenario==='mechanism');
    await page.screenshot({path:`/tmp/telephony-layout-embed-${lang}.png`});
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/ogren/telefon-santrali?senaryo=direct&lang='+lang);
    await page.waitForFunction(()=>document.querySelectorAll('.story-node-labels button').length===5);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.screenshot({path:`/tmp/telephony-layout-fresh-${lang}.png`});
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS',lang,'six ordered renamed tabs, no clipped labels at 320–1440px, matching docs fonts, footer help and keyboard interaction, embedded layout');
  }
} finally {await browser.close();}
