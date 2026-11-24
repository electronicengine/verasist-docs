import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "@playwright/test");
const base = process.env.DOCS_VIDEO_TEST_URL || "https://docs.verasist.ai";
const apiBase = process.env.DOCS_VIDEO_API_URL || "https://docs.verasist.ai";
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext();
  const response = await context.request.get(apiBase + "/api/videos");
  assert.equal(response.status(), 200);
  const records = await response.json(); assert.ok(records.length > 0);
  for (const record of records) {
    const url = base + "/videos/" + encodeURIComponent(record.filename);
    const media = await context.request.get(url, { headers: { Range: "bytes=0-31" } });
    assert.equal(media.status(), 206, record.filename);
    assert.match(media.headers()["content-type"], /^video\/mp4/, record.filename);
    assert.match(media.headers()["content-range"], /^bytes 0-31\//, record.filename);
    assert.equal((await media.body()).subarray(4, 8).toString(), "ftyp", record.filename);
  }
  const page = await context.newPage(); const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/videos", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(count => {
    const videos = [...document.querySelectorAll("video")];
    return videos.length === count && videos.every(video => !video.error && Number.isFinite(video.duration) && video.duration > 0);
  }, records.length, { timeout: 45000 });
  for (let index = 0; index < records.length; index++) {
    const video = page.locator("video").nth(index);
    await video.evaluate(async element => { element.muted = true; await element.play(); });
    await page.waitForFunction(index => document.querySelectorAll("video")[index].currentTime > .1, index, { timeout: 15000 });
    await video.evaluate(element => element.pause());
  }
  assert.deepEqual(errors, []);
  console.log(`PASS: ${records.length} published tutorials serve MP4 bytes with range support, load metadata and play in the browser (${base})`);
} finally { await browser.close(); }
