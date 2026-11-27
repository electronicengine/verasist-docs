import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base = process.env.DOCS_LAB_TEST_URL || 'http://localhost:7317';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', locale: 'tr-TR' });
  if (process.env.DOCS_LAB_REAL_API !== '1') await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname.split('/documents/by-path/')[1];
    return route.fulfill({ json: path ? { id: path, slug: path.split('/').pop(), path, title: 'Telefon bağlantısı', content: '<h2>Bağlantı</h2><p>Kurulum rehberi.</p>' } : [] });
  });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/ogren/telefon-santrali', { waitUntil: 'domcontentloaded' });
  await page.locator('.story-webgl canvas').waitFor();
  assert.equal(await page.getByRole('tab').count(), 6);
  assert.equal(await page.getByRole('tab').first().getAttribute('aria-selected'), 'true');
  await page.getByRole('tab').nth(1).click();
  await page.getByRole('combobox', { name: 'Bağlantı senaryosu' }).selectOption('pbx');
  await page.getByRole('button', { name: /Verasist santrale kayıt isteği gönderir/ }).click();
  await page.getByRole('button', { name: 'Ayrıntı', exact: true }).click();
  assert.match(await page.getByRole('dialog').textContent(), /Verasist → Kurumun sanal santrali/);
  await page.getByRole('button', { name: 'Ayrıntıyı kapat', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.getByTestId('docs-sidebar').count(), 0);
  assert.equal(await page.locator('.telephony-lessons,.packet-trace,.audio-flow-panel').count(), 0);
  assert.equal(await page.evaluate(() => document.querySelector('.telephony-story').getBoundingClientRect().height), 1000);
  assert.equal(await page.locator('.story-node-labels [data-kind="phone"]').count(), 2);
  assert.equal(await page.locator('.story-node-labels [data-kind="analog"]').count(), 1);
  const selectStep = async index => {
    await page.locator('.story-timeline button').nth(index).click();
    await page.waitForFunction(index => Number(document.querySelector('[data-testid="story-canvas"]').dataset.step) === index, index);
  };
  for (let scenario = 0; scenario < 3; scenario++) {
    const tabIndex = [0,2,3][scenario];
    await page.getByRole('tab').nth(tabIndex).click();
    await page.waitForFunction(index => document.querySelectorAll('[role="tab"]')[index].getAttribute('aria-selected') === 'true', tabIndex);
    const count = await page.locator('.story-timeline button').count();
    for (let i = 0; i < count; i++) { await selectStep(i); assert.ok((await page.locator('.story-step-scroll > p').first().textContent()).length > 35); }
    const paths = JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths'));
    assert.equal(paths.length, 2);
    assert.equal(paths[0].route[0], 0);
    assert.deepEqual(paths[1].route, [...paths[0].route].reverse());
    if (scenario === 0) { assert.equal(paths[0].route.includes(8), false); assert.equal(paths[0].route.at(-1), 4); }
    if (scenario === 1) { assert.ok(paths[0].route.includes(8)); assert.equal(paths[0].route.at(-1), 4); }
    if (scenario === 2) { assert.equal(paths[0].route.at(-1), 8); assert.equal(paths[0].route.includes(4), false); }
    await page.getByRole('button', { name: 'Sesi oynat', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('[data-testid="story-canvas"]').dataset.audioFrame) > 300);
    await page.getByRole('button', { name: 'Duraklat', exact: true }).click();
    const paused = await page.getByTestId('story-canvas').getAttribute('data-audio-frame'); await page.waitForTimeout(200);
    assert.equal(await page.getByTestId('story-canvas').getAttribute('data-audio-frame'), paused);
    if (scenario === 1) await page.screenshot({ path: '/tmp/telephony-sketch-desktop.png' });
  }
  await page.getByRole('button', { name: /Personel 700’e aktarım ister/ }).click();
  await page.getByRole('button', { name: 'Ayrıntı', exact: true }).click();
  assert.match(await page.getByRole('dialog').textContent(), /Refer-To: <sip:700/);
  await page.getByRole('button', { name: 'Ayrıntıyı kapat', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('tab').nth(0).click();
  await page.getByRole('combobox', { name: 'Hedef dahili' }).selectOption('301');
  await selectStep((await page.locator('.story-timeline button').count()) - 1);
  const analogPaths = JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths'));
  assert.deepEqual(analogPaths[0].route.slice(-2), [6, 7]);
  await page.getByRole('button', { name: 'Ayrıntı', exact: true }).click();
  assert.match(await page.getByRole('dialog').textContent(), /RTP.*analog|analog.*RTP/s);
  await page.getByRole('button', { name: 'Ayrıntıyı kapat', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.locator('.story-help summary').click();
  assert.equal(await page.locator('.story-help').getAttribute('open'), '');
  assert.match(await page.locator('.story-help-body').textContent(), /Analog telefon/);
  await page.locator('.story-help summary').click();
  await page.getByRole('tab').first().focus(); await page.keyboard.press('End'); await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].at(-1)?.getAttribute('aria-selected') === 'true'); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]')[0].getAttribute('aria-selected') === 'true');
  await page.getByRole('tab').last().click();
  await page.waitForFunction(() => document.querySelectorAll('.story-node-labels button').length === 12);
  assert.equal(await page.locator('.story-node-labels button').count(), 12);
  for (let i = 0, count = await page.locator('.story-timeline button').count(); i < count; i++) await selectStep(i);
  assert.equal(JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths')).length, 0);
  await page.getByRole('button', { name: /Yanıt sesi müşteriye geri gider/ }).click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="story-canvas"]').dataset.audioPaths || '[]')[0]?.route.at(-1) === 11);
  const internalAudio = JSON.parse(await page.getByTestId('story-canvas').getAttribute('data-audio-paths'));
  assert.deepEqual(internalAudio[0].route, [0,1,2,8,10,11]);
  await page.getByRole('button', { name: 'Ayrıntı', exact: true }).click();
  assert.match(await page.getByRole('dialog').textContent(), /WebSocket.*binary raw PCMU/s);
  await page.getByRole('button', { name: 'Ayrıntıyı kapat', exact: true }).click();
  await page.screenshot({ path: '/tmp/telephony-mechanism-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => Math.abs(document.querySelector('.story-webgl canvas')?.getBoundingClientRect().width - window.innerWidth) < 2);
  await page.waitForFunction(() => document.querySelector('[data-testid="story-canvas"]').dataset.view?.startsWith('0.00,23.00'));
  await page.screenshot({ path: '/tmp/telephony-mechanism-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.ok((await page.getByTestId('story-stage').boundingBox()).height > 200);
  assert.ok((await page.locator('.story-tabs').boundingBox()).width <= 390);
  for (const box of await page.locator('.story-node-labels button').all()) { const b = await box.boundingBox(); assert.ok(b.x >= -1 && b.x + b.width <= 391); }
  await page.goto(base + '/ogren/telefon-santrali?ders=verasist');
  await page.waitForFunction(() => document.querySelectorAll('[role="tab"]')[2]?.getAttribute('aria-selected') === 'true');
  for (const document of ['ip-pbx', 'sip-trunk']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/guides/integrations/telephony/' + document);
    const iframe = page.locator('[data-testid="telephony-embed"] iframe');
    await iframe.scrollIntoViewIfNeeded();
    const workshop = page.frameLocator('[data-testid="telephony-embed"] iframe');
    await workshop.getByTestId('telephony-story').waitFor();
    assert.equal(await workshop.getByRole('tab').count(), 6);
    await workshop.getByRole('tab').nth(2).click();
    await workshop.locator('.story-timeline button').nth(2).click();
    const selectedCaption = await workshop.locator('.story-caption h2').textContent();
    const selectedTheme = await workshop.getByTestId('telephony-story').getAttribute('data-theme');
    await page.getByTestId('theme-toggle-btn').click();
    await page.waitForFunction(old => document.querySelector('[data-testid="telephony-embed"] iframe')?.contentDocument.querySelector('[data-testid="telephony-story"]')?.dataset.theme !== old, selectedTheme);
    assert.equal(await workshop.getByRole('tab').nth(2).getAttribute('aria-selected'), 'true');
    assert.equal(await workshop.locator('.story-caption h2').textContent(), selectedCaption);
    await workshop.getByRole('button', { name: 'Ayrıntı', exact: true }).click();
    await workshop.getByRole('dialog').waitFor();
    await page.screenshot({path: `/tmp/telephony-embed-${document}.png`});
    assert.equal(await page.getByTestId('telephony-lab-link').getAttribute('target'), '_blank');
  }
  assert.deepEqual(errors, []);
  console.log('PASS: fullscreen and embedded Sketch workshop, six ordered tabs, registration direction, internal Verasist mechanism and parent theme sync, all three complete call/data/audio stories, continuous bidirectional speech, analog target, 700 REFER transfer, details drawer, keyboard tabs, mobile layout, legacy links and docs entry.');
} finally { await browser.close(); }
