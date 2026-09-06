import { test, expect } from '@playwright/test';

async function fixture(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.waitForFunction(() => window.api);
  await page.evaluate(() => {
    document.body.innerHTML = '<button id="target">Action</button>';
    [window.feedback] = window.api.brightenFeedback('#target');
    window.actions = 0; document.querySelector('#target').addEventListener('click', () => window.actions++);
  });
}

test('press/release decay preserves actions and selection, then cleans up', async ({ page }) => {
  await fixture(page);
  await page.locator('#target').hover();
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.feedback.edge._shape.intensity)).toBe(8);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.feedback.edge.style.visibility)).toBe('hidden');
  expect(await page.evaluate(() => window.actions)).toBe(1);
  await page.evaluate(() => window.feedback.select(true).flash('success'));
  await expect.poll(() => page.evaluate(() => window.feedback.edge._shape.intensity)).toBe(2);
  expect(await page.evaluate(() => window.feedback.edge.style.visibility)).toBe('visible');
  await page.evaluate(() => window.feedback.destroy());
  await expect(page.locator('bright-edge')).toHaveCount(0);
  expect(await page.locator('#target').evaluate((el) => el.style.position)).toBe('');
});

test('keyboard, disabled controls, reduced motion and detach cancellation', async ({ page }) => {
  await fixture(page);
  await page.locator('#target').focus();
  await page.keyboard.down('Space');
  expect(await page.evaluate(() => window.feedback.edge._shape.intensity)).toBe(8);
  await page.keyboard.up('Space');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.feedback.flash('error'));
  expect(await page.evaluate(() => window.feedback.edge.style.visibility)).toBe('hidden');
  await page.evaluate(() => { document.querySelector('#target').disabled = true; });
  await page.locator('#target').dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
  expect(await page.evaluate(() => window.feedback.edge.style.visibility)).toBe('hidden');
  await page.evaluate(() => { document.querySelector('#target').remove(); });
  expect(await page.evaluate(() => window.feedback.edge.isConnected)).toBe(false);
  expect(await page.evaluate(() => window.feedback.edge.parentElement)).toBe(null);
});

test('demo outcomes, selection, range and notification work on a narrow viewport', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/interactions.html');
  for (const id of ['save', 'error', 'warning']) {
    await page.locator('#' + id).click();
    await expect(page.locator('#' + id + '-status')).not.toBeEmpty();
  }
  await page.locator('#select').click();
  await expect(page.locator('#select')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#select').click();
  await expect(page.locator('#select')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#level').focus(); await page.keyboard.press('End');
  await expect(page.locator('#level-output')).toHaveText('100%');
  await expect(page.locator('#level-bar')).toHaveAttribute('value', '100');
  await page.locator('#field').fill('A note');
  await page.locator('#notify').click();
  await expect(page.locator('#notification')).toContainText('report is ready');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('hold confirms only after full duration and upload finishes', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/interactions.html');
  await page.locator('#hold').focus();
  await page.keyboard.down('Space'); await page.keyboard.up('Space');
  await expect(page.locator('#hold-status')).toContainText('Cancelled');
  await page.keyboard.down('Space');
  await expect(page.locator('#hold-status')).toHaveText('Confirmed (demo).');
  await page.keyboard.up('Space');
  await expect(page.locator('#hold-ring')).toHaveAttribute('value', '100');
  await page.locator('#upload').click();
  await expect(page.locator('#upload-status')).toHaveText('Demo upload complete.');
  await expect(page.locator('#upload')).toBeEnabled();
});

test('feedback uses real GPU and supports global HDR off', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Real GPU tested in Chromium.');
  await page.goto('/interactions.html');
  await page.locator('#bloom').scrollIntoViewIfNeeded();
  await page.locator('#bloom').hover(); await page.mouse.down();
  await expect.poll(() => page.locator('#bloom bright-edge').evaluate((el) => el.mode)).toBe('hdr');
  await page.mouse.up();
  await page.locator('#hdr').uncheck();
  await expect.poll(() => page.locator('#bloom bright-edge').evaluate((el) => el.fallbackReason)).toBe('disabled');
});
