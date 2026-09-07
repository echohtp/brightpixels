import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/dreamnet.html');
}

test('dreamnet moods, driving, star adoption and local guestbook work', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await page.locator('[data-sky-choice=sunset]').click();
  await expect(page.locator('html')).toHaveAttribute('data-sky', 'sunset');
  await page.locator('#motion').uncheck();
  await expect(page.locator('html')).toHaveAttribute('data-still');
  await page.locator('#drive').click();
  await expect(page.locator('#drive-status')).toContainText('Cruising');
  await page.locator('#adopt').click();
  await expect(page.locator('.dn-adopted-star')).toHaveCount(1);
  await page.locator('#clear-stars').click();
  await expect(page.locator('.dn-adopted-star')).toHaveCount(0);
  await page.locator('#guest-name').fill('moon walker');
  await page.locator('#guest-note').fill('<script>hello future me</script>');
  await page.locator('#guest-form button').click();
  await expect(page.locator('#guest-entries')).toContainText('<script>hello future me</script>');
  await page.reload();
  await expect(page.locator('#guest-entries')).toContainText('moon walker');
  await page.locator('#clear-guest').click();
  await expect(page.locator('.dn-entry')).toHaveCount(0);
  await page.locator('.dn-collapse').click();
  await expect(page.locator('.dn-collapse')).toHaveAttribute('aria-expanded', 'false');
  const download = page.waitForEvent('download');
  await page.locator('.dn-download').click();
  expect((await download).suggestedFilename()).toBe('brightpixels-dreamnet.zip');
  expect(errors).toEqual([]);
});

test('dreamnet desktop and phone previews preserve layout', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/dreamnet-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/dreamnet-mobile.png', fullPage: true });
  await page.locator('#adopt').click();
  await expect(page.locator('#adopt-status')).toHaveText('1 star in your sky.');
});
