import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/cyberpunk.html');
}

test('cyberpunk controls and local component demos work', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await page.locator('#power').click();
  await expect(page.locator('#power')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#reactor-state')).toHaveText('SIGNAL LIVE');
  await page.locator('[data-theme=pink]').click();
  await expect(page.locator('html')).toHaveAttribute('data-cp-theme', 'pink');
  await page.locator('#intensity').focus(); await page.keyboard.press('End');
  await expect(page.locator('#intensity-output')).toHaveText('16×');
  await page.locator('#hdr-toggle').click();
  await expect(page.locator('#hdr-toggle')).toHaveAttribute('aria-checked', 'false');
  await page.locator('#reset').click();
  await expect(page.locator('html')).toHaveAttribute('data-cp-theme', 'cyan');
  await expect(page.locator('#intensity-output')).toHaveText('8×');
  await page.locator('#favorite').click();
  await expect(page.locator('#favorite')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-theme=acid]').click();
  await expect(page.locator('#favorite')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#callsign').fill('night runner');
  await page.locator('#callsign').press('Enter');
  await expect(page.locator('#callsign-status')).toContainText('NIGHT RUNNER');
  await page.locator('#transfer').click();
  await expect(page.locator('#transfer-status')).toContainText('Transfer complete');
  await expect(page.locator('#transfer')).toBeEnabled();
  const pending = page.waitForEvent('download');
  await page.locator('.cp-download').click();
  expect((await pending).suggestedFilename()).toBe('brightpixels-cyberpunk.zip');
  expect(errors).toEqual([]);
});

test('cyberpunk desktop and mobile layout previews', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#hero-light')).toHaveAttribute('data-brightpixels-mode', 'fallback');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/cyberpunk-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/cyberpunk-mobile.png', fullPage: true });
  await page.locator('[data-theme=acid]').click();
  await expect(page.locator('html')).toHaveAttribute('data-cp-theme', 'acid');
});
