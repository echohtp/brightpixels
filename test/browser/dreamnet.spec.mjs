import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/dreamnet.html');
}

test('AI city archive offers understandable local story branches on desktop and phone', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.dn-case')).toHaveCount(3);
  await expect(page.locator('#city-archive')).toContainText('Fiction, not a forecast.');
  const outcomes = [
    ['pause', 'The doors open. The queue gets longer.'],
    ['appeal', 'A person gets time to listen.'],
    ['measure', 'The average loses its hiding place.'],
  ];
  for (const [choice, title] of outcomes) {
    await page.locator(`[data-story-choice="${choice}"]`).click();
    await expect(page.locator('#story-outcome-title')).toHaveText(title);
    await expect(page.locator('[data-story-choice][aria-pressed=true]')).toHaveCount(1);
    await expect(page.locator(`[data-story-choice="${choice}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
  await page.locator('[data-story-choice=pause]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#story-outcome-title')).toHaveText(outcomes[0][1]);
  if (info.project.name === 'chromium') await page.locator('#city-archive').screenshot({ path: 'test-results/dreamnet-story.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-story-choice=appeal]').click();
  await expect(page.locator('#story-outcome-title')).toHaveText(outcomes[1][1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium') await page.locator('#city-archive').screenshot({ path: 'test-results/dreamnet-story-mobile.png' });
  await page.reload();
  await expect(page.locator('#story-outcome-title')).toHaveText('The record is still open.');
  expect(errors).toEqual([]);
});

test('giga mode toggles and hyperspace fires on desktop and phone', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const toggle = page.locator('#overload-toggle');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-overload', 'classic');
  await expect(toggle).toHaveText('GIGA OVERLOAD: OFF');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-overload', 'giga');
  await page.locator('#overdrive-fire').click();
  await expect(page.locator('#overdrive-status')).toContainText('JUMP 01 COMPLETE');
  await expect(page.locator('.dn-confetti-piece')).toHaveCount(14);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#overdrive-fire').click();
  await expect(page.locator('.dn-confetti-piece')).toHaveCount(144);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/dreamnet-giga.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#overdrive-fire').click();
  await expect(page.locator('#overdrive-status')).toContainText('JUMP 03 COMPLETE');
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/dreamnet-giga-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('new cannon loads fresh assets even when unversioned demo files are stale', async ({ page }) => {
  await page.route(/\/assets\/dreamnet\.js$/, route => route.fulfill({ contentType: 'application/javascript', body: '// Cached demo from before the cannon existed.' }));
  await page.route(/\/assets\/dreamnet\.css$/, route => route.fulfill({ contentType: 'text/css', body: 'body{background:black}' }));
  await open(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#confetti-fire').click();
  await expect(page.locator('#confetti-status')).toContainText('SALVO 01');
  await expect(page.locator('.dn-confetti-piece')).toHaveCount(96);
  await expect(page.locator('.dn-confetti-layer')).toHaveCSS('position', 'fixed');
  await expect(page.locator('.dn-confetti-layer')).toHaveCSS('pointer-events', 'none');
});

test('neon confetti cannon bursts, caps particles and supports reduced motion on phones', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#confetti-fire').click();
  const pieces = page.locator('.dn-confetti-piece');
  await expect(pieces).toHaveCount(96);
  await expect(page.locator('#confetti-status')).toContainText('SALVO 01');
  await expect(page.locator('.dn-confetti-layer')).toHaveCSS('pointer-events', 'none');
  await pieces.evaluateAll(items => items.forEach(item => item.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 450; })));
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/dreamnet-confetti.png' });
  await page.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('#confetti-fire').click(); });
  expect(await pieces.count()).toBeLessThanOrEqual(192);
  await expect(page.locator('#confetti-status')).toContainText('SALVO 05');
  await pieces.evaluateAll(items => items.forEach(item => item.getAnimations().forEach(animation => animation.finish())));
  await expect(pieces).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#confetti-fire').click();
  await expect(pieces).toHaveCount(14);
  expect(await pieces.evaluateAll(items => items.every(item => item.getAnimations().every(animation => animation.effect.getKeyframes().every(frame => frame.transform === undefined))))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(pieces).toHaveCount(0);
  expect(errors).toEqual([]);
});

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
  const card = page.locator('#night-drive');
  await card.scrollIntoViewIfNeeded();
  await page.locator('#scene').hover({ position: { x: 150, y: 150 } });
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
