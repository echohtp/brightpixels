import { test, expect } from '@playwright/test';
async function open(page, fallback = false) {
  if (fallback) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.waitForFunction(() => Boolean(window.api));
}
test('fallback loading, presets, reduced motion, and accessible content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, true);
  await page.evaluate(() => {
    document.body.innerHTML = '<bright-shape id="state" status="loading" track intensity="3"><span>Uploading</span></bright-shape><bright-shape id="bar" shape="bar" indeterminate track></bright-shape>';
  });
  await expect(page.locator('#state')).toHaveAttribute('data-brightpixels-mode', 'fallback');
  await expect(page.getByText('Uploading')).toBeVisible();
  expect(await page.locator('#state').evaluate((el) => getComputedStyle(el.shadowRoot.querySelector('bright-image')).animationName)).toBe('none');
  await page.evaluate(() => { const el = document.querySelector('#state'); el.setStatus('success'); el.querySelector('span').textContent = 'Uploaded'; });
  await expect(page.locator('#state')).not.toHaveAttribute('data-loading');
  expect(await page.locator('#state').evaluate((el) => [el.shape, el.color, el.d])).toEqual(['path', '#26df8b', 'M15 50 L40 75 L85 20']);
  await expect(page.getByText('Uploaded')).toBeVisible();
  expect(await page.locator('#state').evaluate((el) => el.shadowRoot.querySelector('img.track').hidden)).toBe(true);
  await expect.poll(() => page.locator('#state').evaluate((el) => el.shadowRoot.querySelector('bright-image img').complete)).toBe(true);
});

test('progress retargets and track remains separate from foreground', async ({ page }) => {
  await open(page, true);
  await page.evaluate(() => { document.body.innerHTML = '<bright-shape id="progress" shape="bar" value="0" duration="400" track intensity="3" role="progressbar" aria-label="Upload" aria-valuenow="0"></bright-shape>'; });
  await expect(page.locator('#progress')).toHaveAttribute('data-brightpixels-mode', 'fallback');
  await page.evaluate(() => { const el = document.querySelector('#progress'); el.value = 100; el.setAttribute('aria-valuenow', '100'); });
  await expect.poll(() => page.locator('#progress').evaluate((el) => el._displayValue)).toBeGreaterThan(0);
  await page.evaluate(() => document.querySelector('#progress').value = 30);
  await expect.poll(() => page.locator('#progress').evaluate((el) => el._displayValue)).toBe(30);
  expect(await page.locator('#progress').evaluate((el) => el._transition)).toBe(null);
  const trackSource = await page.locator('#progress').evaluate((el) => el.shadowRoot.querySelector('.track').src);
  await page.evaluate(() => document.querySelector('#progress').intensity = 9);
  expect(await page.locator('#progress').evaluate((el) => el.shadowRoot.querySelector('.track').src)).toBe(trackSource);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.querySelector('#progress').value = 80);
  expect(await page.locator('#progress').evaluate((el) => el._displayValue)).toBe(80);
});

test('loading caches its image and responds to hidden pages', async ({ page }) => {
  await open(page, true);
  await page.evaluate(() => { document.body.innerHTML = '<bright-shape id="loader" status="loading" track></bright-shape>'; });
  await expect(page.locator('#loader')).toHaveAttribute('data-loading', 'ring');
  const before = await page.locator('#loader').evaluate((el) => el.shadowRoot.querySelector('bright-image img').src);
  await expect.poll(() => page.locator('#loader').evaluate((el) => getComputedStyle(el.shadowRoot.querySelector('bright-image')).transform)).not.toBe('none');
  expect(await page.locator('#loader').evaluate((el) => el.shadowRoot.querySelector('bright-image img').src)).toBe(before);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#loader')).toHaveAttribute('data-paused', '');
  expect(await page.locator('#loader').evaluate((el) => getComputedStyle(el.shadowRoot.querySelector('bright-image')).animationPlayState)).toBe('paused');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#loader')).not.toHaveAttribute('data-paused');
});

test('demo controls operate without script errors', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/#playground');
  await page.locator('#play-kind').selectOption('bar');
  await page.locator('#play-progress').click();
  await expect(page.locator('#play-shape')).toHaveAttribute('value', '20');
  await expect(page.locator('#play-code')).toContainText('duration="500"');
  expect(errors).toEqual([]);
});

test('real WebGPU initializes, reuses textures, disables, reconnects, and cleans up', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'WebKit fallback is tested separately.');
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.gpuErrors = [];
    const original = navigator.gpu.requestAdapter.bind(navigator.gpu);
    navigator.gpu.requestAdapter = async (...args) => {
      const adapter = await original(...args);
      if (adapter) {
        const requestDevice = adapter.requestDevice.bind(adapter);
        adapter.requestDevice = async (...deviceArgs) => {
          const device = await requestDevice(...deviceArgs);
          device.addEventListener('uncapturederror', (event) => window.gpuErrors.push(event.error.message));
          return device;
        };
      }
      return adapter;
    };
  });
  await open(page);
  await page.evaluate(() => {
    document.body.innerHTML = '<bright-text id="text" color="color(display-p3 1 0.35 0)" intensity="4">HDR text</bright-text><bright-shape id="gpu" shape="bar" value="10" duration="250" track intensity="4"></bright-shape>';
  });
  await expect(page.locator('#text')).toHaveAttribute('data-brightpixels-mode', 'hdr');
  await expect(page.locator('#gpu')).toHaveAttribute('data-brightpixels-mode', 'hdr');
  await expect.poll(() => page.locator('#gpu').evaluate((el) => Boolean(el._bright._gpu?.sourceTexture))).toBe(true);
  await page.evaluate(() => { const el = document.querySelector('#gpu'); window.originalTexture = el._bright._gpu.sourceTexture; el.value = 90; });
  await expect.poll(() => page.locator('#gpu').evaluate((el) => el._displayValue)).toBe(90);
  expect(await page.locator('#gpu').evaluate((el) => el._bright._gpu.sourceTexture === window.originalTexture)).toBe(true);
  await page.evaluate(() => window.api.configureBrightpixels({ brightness: 0 }));
  expect(await page.locator('#text').evaluate((el) => Math.max(...el._textColor().slice(0, 3)))).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.api.configureBrightpixels({ enabled: false }));
  await expect(page.locator('#gpu')).toHaveAttribute('data-brightpixels-mode', 'fallback');
  expect(await page.locator('#gpu').evaluate((el) => el._bright._gpu)).toBe(null);
  await page.evaluate(() => window.api.configureBrightpixels({ enabled: true, brightness: 1 }));
  await expect(page.locator('#gpu')).toHaveAttribute('data-brightpixels-mode', 'hdr');
  await page.evaluate(() => { window.detached = document.querySelector('#gpu'); window.detached.remove(); });
  expect(await page.evaluate(() => [window.detached._frame, window.detached._bright._animationFrame, window.detached._bright._gpu])).toEqual([0, 0, null]);
  await page.evaluate(() => document.body.append(window.detached));
  await expect(page.locator('#gpu')).toHaveAttribute('data-brightpixels-mode', 'hdr');
  await expect.poll(() => page.locator('#gpu').evaluate((el) => Boolean(el._bright._gpu?.sourceTexture))).toBe(true);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => window.gpuErrors)).toEqual([]);
});

test('many active components stay responsive and release scheduled work', async ({ page }, testInfo) => {
  await open(page, testInfo.project.name !== 'chromium');
  await page.evaluate(() => {
    document.body.innerHTML = Array.from({ length: 16 }, (_, i) => `<bright-shape shape="ring" value="${i}" duration="250" intensity="2"></bright-shape>`).join('');
  });
  await page.waitForFunction(() => [...document.querySelectorAll('bright-shape')].every((el) => el.mode));
  await page.evaluate(() => { for (const el of document.querySelectorAll('bright-shape')) { el.value = 100; el.pulse({ duration: 250 }); } });
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('bright-shape')].every((el) => el._displayValue === 100 && !el._transition && !el._pulsing))).toBe(true);
  const cleanup = await page.evaluate(() => { const els = [...document.querySelectorAll('bright-shape')]; for (const el of els) el.remove(); return els.every((el) => el._frame === 0 && el._pulseFrame === 0 && el._bright._animationFrame === 0); });
  expect(cleanup).toBe(true);
});
