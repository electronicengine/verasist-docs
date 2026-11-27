import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL || 'http://localhost:7317';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const ids=['pbx','registration','reception','extension','direct','mechanism'];
try {
  for(const lang of ['tr','en']) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:lang==='tr'?'tr-TR':'en-US',reducedMotion:'reduce'});
    await context.addInitScript(lang=>localStorage.setItem('dokuman_lang',lang),lang);
    if(process.env.DOCS_LAB_REAL_API!=='1') await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,title:'Telephony',content:'<h2>Connection</h2><p>Setup guide.</p>'}:[]})});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/ogren/telefon-santrali?lang='+lang);await page.locator('.story-webgl canvas').waitFor();
    const step=async i=>{await page.locator('.story-timeline button').nth(i).click();await page.waitForFunction(i=>Number(document.querySelector('[data-testid="story-canvas"]').dataset.step)===i,i)};
    const caption=page.locator('.story-step-scroll');
    for(const [i,phase] of [[0,0],[1,0],[2,2],[3,9],[4,14],[5,0]]) {
      await page.getByRole('tab').nth(i).click();await page.waitForFunction(id=>document.querySelector('main').dataset.scenario===id,ids[i]);await step(phase);
      assert.equal(await page.getByTestId('step-setup').getAttribute('data-mode'),'setup');
      assert.ok(await page.locator('.story-setup-location').count()>0);
      assert.equal(await caption.getAttribute('tabindex'),'0');
      assert.ok(await caption.evaluate(e=>e.scrollHeight>e.clientHeight));
      if(lang==='en') assert.doesNotMatch(await page.getByTestId('step-setup').textContent(),/[çğıöşüÇĞİÖŞÜ]/);
    }
    await page.getByRole('tab').nth(4).click();await step(14);
    assert.match(await page.getByTestId('step-setup').textContent(),/SIP Gateway IP/);
    assert.match(await page.getByTestId('step-setup').textContent(),/Enable Registration/);
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:width===390?844:1000});
      const position=await page.locator('.story-step-number').boundingBox();
      await page.getByRole('button',{name:lang==='en'?'Play':'Oynat',exact:true}).click();
      await caption.hover();await page.mouse.wheel(0,700);
      await page.waitForFunction(()=>document.querySelector('.story-step-scroll').scrollTop>0);
      assert.ok(await page.getByRole('button',{name:lang==='en'?'Play':'Oynat',exact:true}).isVisible());
      assert.equal(await page.locator('.story-timeline button[aria-current]').textContent(),'15');
      const after=await page.locator('.story-step-number').boundingBox();assert.ok(Math.abs(position.y-after.y)<2);
      await caption.focus();await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.story-timeline button[aria-current]').textContent(),'15');
      await caption.evaluate(e=>e.scrollTop=0);await page.keyboard.press('PageDown');
      await page.waitForFunction(()=>document.querySelector('.story-step-scroll').scrollTop>0);
      assert.equal(await caption.evaluate(e=>e.scrollWidth>e.clientWidth),false);
      await page.screenshot({path:`/tmp/telephony-step-setup-${lang}-${width}.png`});
      await step(15);assert.equal(await caption.evaluate(e=>e.scrollTop),0);await step(14);
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('tab').last().click();await step(5);assert.equal(await page.getByTestId('step-setup').getAttribute('data-mode'),'automatic');
    await step(8);assert.equal(await page.getByTestId('step-setup').getAttribute('data-mode'),'admin');
    await page.getByRole('tab').first().click();await page.getByRole('combobox').selectOption('301');await step(2);assert.match(await page.getByTestId('step-setup').textContent(),/ATA/);
    await page.goto(base+'/guides/integrations/telephony/sip-trunk');await page.locator('[data-testid="telephony-embed"] iframe').scrollIntoViewIfNeeded();
    const frame=page.frameLocator('[data-testid="telephony-embed"] iframe');await frame.getByTestId('telephony-story').waitFor();
    await frame.getByRole('tab').nth(4).click();await frame.locator('.story-timeline button').nth(14).click();
    await frame.locator('.story-step-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
    assert.ok(await frame.locator('.story-step-scroll').evaluate(e=>e.scrollTop>0));
    await page.screenshot({path:`/tmp/telephony-step-setup-embed-${lang}.png`});
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS',lang,'configuration locations in all six tabs, scrollable step text, fixed step number, wheel pauses playback, keyboard scrolling, reset on step change, analog setup, automatic/admin distinction and iframe');
  }
} finally {await browser.close();}
