import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base=process.env.DOCS_LAB_TEST_URL || 'http://localhost:7317';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  for(const lang of ['tr','en']) for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width:1440,height:1000},locale:lang==='tr'?'tr-TR':'en-US',reducedMotion:'reduce'});
    await context.addInitScript(({lang,theme})=>{localStorage.setItem('dokuman_lang',lang);localStorage.setItem('dokuman_theme',theme);},{lang,theme});
    if(process.env.DOCS_LAB_REAL_API!=='1') await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname.split('/documents/by-path/')[1];return r.fulfill({json:path?{id:path,path,slug:path.split('/').at(-1),title:'Telephony',content:'<h2>Setup</h2><p>Connection guide.</p>'}:[]})});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/ogren/telefon-santrali?senaryo=direct&lang='+lang);
    await page.locator('.story-webgl canvas').waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('.story-node-labels button').length===5);
    assert.equal(await page.getByRole('tab').count(),6);
    assert.equal(await page.locator('.story-node-labels [data-kind="analog"]').count(),0);
    assert.equal(await page.locator('.story-node-labels [data-kind="phone"]').count(),2);
    assert.ok(await page.locator('.story-notice').isVisible());
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('main')).backgroundColor===getComputedStyle(document.body).backgroundColor),true);
    const labels=await page.locator('.story-node-labels').textContent();
    assert.doesNotMatch(labels,/Kurum santrali|Office PBX|Verasist/);
    const count=await page.locator('.story-timeline button').count();
    for(let i=0;i<count;i++) {
      await page.locator('.story-timeline button').nth(i).click();
      await page.waitForFunction(i=>Number(document.querySelector('[data-testid="story-canvas"]').dataset.step)===i,i);
      const audio=JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths'));
      for(const path of audio) assert.equal(path.route.includes(2),false);
      if(i<11) assert.equal(audio.length,0);
      const expectedStage=i<14?'operator':'verasist';
      await page.waitForFunction(stage=>document.querySelector('[data-testid="story-canvas"]').dataset.stage===stage,expectedStage);
      assert.equal(await page.locator('.story-node-labels button').count(),i<14?5:6);
      assert.equal(await page.locator('.story-node-labels [data-kind="agent"]').count(),i<14?0:1);
      if(i===11) { assert.deepEqual(audio[0].route,[0,1,3,4]); await page.screenshot({path:`/tmp/telephony-operator-first-${lang}-${theme}.png`}); }
      if(i===24) assert.equal(audio[0].route.includes(4),false);
      if(i===27) {
        assert.deepEqual(audio[0].route,[0,1,8,1,3,4]);
        assert.deepEqual(audio[1].route,[4,3,1,8,1,0]);
        await page.getByRole('button',{name:lang==='en'?'Play':'Oynat',exact:true}).click();
        await page.waitForFunction(()=>Number(document.querySelector('[data-testid="story-canvas"]').dataset.audioFrame)>200);
        await page.getByRole('button',{name:lang==='en'?'Pause':'Duraklat',exact:true}).click();
        await page.screenshot({path:`/tmp/telephony-direct-${lang}-${theme}.png`});
      }
      await page.getByRole('button',{name:lang==='en'?'Details':'Ayrıntı',exact:true}).click();
      const text=await page.getByRole('dialog').textContent();
      if(lang==='en') assert.doesNotMatch(text,/[çğıöşüÇĞİÖŞÜ]/);
      if(i===2) assert.match(text,/CSeq: 1 REGISTER/);
      if(i===17) assert.match(text,/Call-ID: direct-customer-demo/);
      if(i===22) assert.match(text,/Call-ID: direct-staff-demo/);
      if(i===23) assert.match(text,/Call-ID: direct-staff-phone-demo/);
      await page.getByRole('button',{name:lang==='en'?'Close details':'Ayrıntıyı kapat',exact:true}).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
    }
    assert.equal(JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths')).length,0);
    if(lang==='en') {
      for(let tab=0;tab<6;tab++) {
        await page.getByRole('tab').nth(tab).click();
        await page.waitForFunction(tab=>document.querySelectorAll('[role="tab"]')[tab].getAttribute('aria-selected')==='true',tab);
        assert.doesNotMatch(await page.getByTestId('telephony-story').innerText(),/[çğıöşüÇĞİÖŞÜ]/);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('tab').nth(4).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="story-canvas"]').dataset.view?.startsWith('0.00,23.00'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`/tmp/telephony-direct-mobile-${lang}-${theme}.png`});
    // A real document embeds the workshop in its selected language, and can update it without resetting the step.
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/guides/integrations/telephony/sip-trunk');
    const iframe=page.locator('[data-testid="telephony-embed"] iframe');await iframe.scrollIntoViewIfNeeded();
    const workshop=page.frameLocator('[data-testid="telephony-embed"] iframe');
    await workshop.getByTestId('telephony-story').waitFor();
    assert.equal(await workshop.getByTestId('telephony-story').getAttribute('lang'),lang);
    await workshop.getByRole('tab').nth(4).click();
    await workshop.locator('.story-timeline button').nth(2).click();
    const other=lang==='en'?'tr':'en';
    await page.evaluate(lang=>document.querySelector('[data-testid="telephony-embed"] iframe').contentWindow.postMessage({type:'verasist-docs-theme',lang},location.origin),other);
    await page.waitForFunction(lang=>document.querySelector('iframe').contentDocument.querySelector('main').lang===lang,other);
    assert.equal(await workshop.locator('.story-timeline button[aria-current="step"]').textContent(),'3');
    await page.screenshot({path:`/tmp/telephony-locale-embed-${lang}-${theme}.png`});
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS',lang,theme,'operator-only first, then single-object Verasist, complete call/audio, translated details, docs palette, mobile and embedded locale sync');
  }
} finally {await browser.close();}
