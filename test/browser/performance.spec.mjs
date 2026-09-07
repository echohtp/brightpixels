import { test, expect } from '@playwright/test';

test.use({ deviceScaleFactor: 2 });

test('offscreen motion settles and resumes when visible', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.waitForFunction(() => window.api);
  await page.evaluate(() => {
    document.body.innerHTML = '<div style="height:2400px"></div><bright-shape id="shape" shape="ring" indeterminate duration="300" value="20"></bright-shape>';
  });
  await expect(page.locator('#shape')).toHaveAttribute('data-paused');
  await page.evaluate(() => { const el = document.querySelector('#shape'); el.value = 90; el.pulse(); });
  // Attribute changes can queue one static redraw; wait for that frame to settle.
  await expect.poll(() => page.locator('#shape').evaluate((el) => [el._transition, el._pulsing, el._frame])).toEqual([null, false, 0]);
  await page.locator('#shape').scrollIntoViewIfNeeded();
  await expect(page.locator('#shape')).not.toHaveAttribute('data-paused');
  await expect.poll(() => page.locator('#shape').evaluate((el) => el._displayValue)).toBe(90);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator('#shape')).toHaveAttribute('data-paused');
  await page.evaluate(() => { const el = document.querySelector('#shape'); el.remove(); document.body.prepend(el); });
  await expect(page.locator('#shape')).not.toHaveAttribute('data-paused');
});

test('real GPU defers setup, applies quality, and stays idle while scrolling', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Real WebGPU coverage uses Chromium.');
  await page.goto('/test/browser/fixture.html');
  await page.waitForFunction(() => window.api);
  await page.evaluate(() => {
    document.body.innerHTML = '<div style="height:2400px"></div><bright-image id="image" style="display:block;width:700px"><img style="width:100%;height:auto;display:block" src="/assets/examples/chrome.png"></bright-image>';
  });
  await expect(page.locator('#image')).toHaveAttribute('data-brightpixels-reason', 'offscreen');
  expect(await page.locator('#image').evaluate((el) => el._gpu)).toBe(null);
  await page.locator('#image').scrollIntoViewIfNeeded();
  await expect(page.locator('#image')).toHaveAttribute('data-brightpixels-mode', 'hdr');
  await expect.poll(() => page.locator('#image').evaluate((el) => Boolean(el._gpu?.sourceTexture))).toBe(true);
  const autoWidth = await page.locator('#image').evaluate((el) => el._canvas.width);
  await page.evaluate(() => window.api.configureBrightpixels({ quality: 'high' }));
  await expect.poll(() => page.locator('#image').evaluate((el) => el._gpu.sourceTexture.width)).toBe(1400);
  expect(autoWidth).toBeLessThan(1400);
  await page.evaluate(() => window.api.configureBrightpixels({ quality: 'low' }));
  await expect.poll(() => page.locator('#image').evaluate((el) => el._gpu.sourceTexture.width)).toBe(700);
  await page.evaluate(() => {
    const el = document.querySelector('#image'); window.submissions = 0;
    const submit = el._gpu.device.queue.submit.bind(el._gpu.device.queue);
    el._gpu.device.queue.submit = (...args) => { window.submissions++; return submit(...args); };
    scrollBy(0, -30);
  });
  // Allow compositor/observer delivery; a static visible canvas needs no new GPU submissions.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.submissions)).toBe(0);
  await page.evaluate(() => window.api.configureBrightpixels({ enabled: false }));
  await expect(page.locator('#image')).toHaveAttribute('data-brightpixels-reason', 'disabled');
});

test('capabilities and fallback reasons are exposed without GPU permission requests', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.waitForFunction(() => window.api);
  await page.evaluate(() => { document.body.innerHTML = '<bright-text id="text">Fallback</bright-text>'; });
  await expect(page.locator('#text')).toHaveAttribute('data-brightpixels-reason', 'webgpu-unavailable');
  expect(await page.evaluate(() => window.api.getBrightpixelsCapabilities().webgpu)).toBe(false);
  expect(await page.locator('#text').evaluate((el) => el.fallbackReason)).toBe('webgpu-unavailable');
});
