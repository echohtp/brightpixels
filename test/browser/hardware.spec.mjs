import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/hardware.html');
  await expect(page.locator('#report-json')).not.toHaveValue('');
});
const report = (page) => page.locator('#report-json').inputValue().then(JSON.parse);

test('hardware controls and report preserve honest manual observations', async ({ page }) => {
  expect((await report(page)).observations.whiteObservation).toBe('not-tested');
  await page.locator('#hdr-enabled').uncheck();
  expect((await report(page)).settings.enabled).toBe(false);
  await page.locator('#intensity').evaluate((el) => { el.value = '8'; el.dispatchEvent(new Event('input')); });
  expect((await report(page)).settings.requestedIntensity).toBe(8);
  await page.locator('[name=notes]').fill('<script>example</script>');
  await page.locator('[name=whiteObservation]').selectOption('same');
  await page.locator('#loading').check();
  await expect(page.locator('#motion-ring')).toHaveAttribute('data-loading');
  await page.locator('#progress').click();
  await expect(page.locator('#loading')).not.toBeChecked();
  await expect(page.locator('#progress-label')).toHaveText('85%');
  await page.locator('#stop').click();
  await page.locator('#reset').click();
  const result = await report(page);
  expect(result.settings).toMatchObject({ enabled: true, brightness: 1, requestedIntensity: 4, continuousLoading: false, progress: 65 });
  expect(result.observations).toMatchObject({ notes: '<script>example</script>', whiteObservation: 'same' });
  expect(result.capabilities.webgpuApi).toBe(false);
  expect(result.components.every((item) => item.mode === 'fallback')).toBe(true);
});

test('copy success, denied clipboard fallback, and valid JSON download', async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedReport = text; } } }));
  await page.locator('#copy').click();
  await expect(page.locator('#report-status')).toHaveText('Diagnostic report copied.');
  expect(await page.evaluate(() => JSON.parse(window.copiedReport).schemaVersion)).toBe(1);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } }));
  await page.locator('#copy').click();
  await expect(page.locator('#report-status')).toContainText('Report selected');
  expect(await page.locator('#report-json').evaluate((el) => el.selectionEnd - el.selectionStart)).toBeGreaterThan(100);
  const downloaded = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloaded;
  const json = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(json.observations.whiteObservation).toBe('not-tested');
  expect(download.suggestedFilename()).toMatch(/^brightpixels-hardware-.*\.json$/);
});

test('mobile page fits and reduced motion is reported', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#refresh').click();
  expect((await report(page)).capabilities.reducedMotion).toBe(true);
  await page.locator('#loading').check();
  expect(await page.locator('#motion-ring').evaluate((el) => getComputedStyle(el.shadowRoot.querySelector('bright-image')).animationName)).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
