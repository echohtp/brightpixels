import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/dreamnet.html');
}

test('background Tron trails render, fade and respect motion controls', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const freeze = await page.addStyleTag({ content: '.dn-tron-segment{animation-play-state:paused}' });
  for (const [x, y] of [[16, 120], [64, 120], [64, 250], [32, 250], [32, 380]]) {
    await page.mouse.move(x, y);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  const segments = page.locator('.dn-tron-segment');
  await expect(segments).toHaveCount(4);
  await expect(page.locator('.dn-tron-trail')).toHaveCSS('pointer-events', 'none');
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/dreamnet-tron.png' });
  await freeze.evaluate(el => el.remove());
  await expect(segments).toHaveCount(0);
  await page.mouse.move(64, 400);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(segments).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(segments).toHaveCount(0);
  await expect(page.locator('.dn-tron-trail')).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#motion').uncheck();
  await page.mouse.move(32, 500);
  await page.mouse.move(64, 550);
  await expect(segments).toHaveCount(0);
});

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

test('mouse spotlight is painted over the opaque night-drive scene', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#motion').uncheck();
  await page.locator('#scene').hover({ position: { x: 150, y: 150 } });
  const card = page.locator('#night-drive');
  await expect(card).toHaveAttribute('data-tracking', '');
  await expect.poll(() => card.evaluate(el => {
    const glow = getComputedStyle(el, '::before');
    const scene = getComputedStyle(el.querySelector('#scene'));
    return glow.opacity === '1' && Number(glow.zIndex) > (Number(scene.zIndex) || 0) && glow.pointerEvents === 'none';
  })).toBe(true);
  if (info.project.name === 'chromium') await card.screenshot({ path: 'test-results/dreamnet-spotlight.png' });
  await page.locator('#drive').click();
  await expect(page.locator('#drive-status')).toContainText('Cruising');
});
