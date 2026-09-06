import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/mobile.html');
});

test('touch favorite and dock retain selection without page overflow', async ({ page }) => {
  await page.locator('#favorite').tap();
  await expect(page.locator('#favorite')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#heart')).toHaveAttribute('filled');
  await page.locator('#favorite').tap();
  await expect(page.locator('#heart')).not.toHaveAttribute('filled');
  await page.locator('[data-dock=Saved]').tap();
  await expect(page.locator('[data-dock=Saved]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-dock=Home]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#dock-status')).toHaveText('Saved preview selected.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.thumb-dock').evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
});

test('swipe threshold resets partial values and confirms keyboard completion', async ({ page }) => {
  await page.locator('#swipe').evaluate((el) => { el.value = '40'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await expect(page.locator('#swipe')).toHaveValue('0');
  await expect(page.locator('#swipe-status')).toContainText('Not confirmed');
  await page.locator('#swipe').focus(); await page.keyboard.press('End');
  await expect(page.locator('#swipe')).toBeDisabled();
  await expect(page.locator('#swipe-status')).toHaveText('Confirmed (demo).');
  await page.locator('#swipe-reset').tap();
  await expect(page.locator('#swipe')).toBeEnabled();
  await expect(page.locator('#swipe')).toHaveValue('0');
  await page.locator('#choice').focus(); await page.keyboard.press('End');
  await expect(page.locator('[data-choice="2"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-choice="0"]').tap();
  await expect(page.locator('#choice')).toHaveValue('0');
  await expect(page.locator('#choice')).toHaveAttribute('aria-valuetext', 'Economy');
});

test('long press opens actions, finger movement cancels pending hold', async ({ page }) => {
  await page.clock.install();
  await page.locator('#hold-card').scrollIntoViewIfNeeded();
  await page.locator('#hold-card').dispatchEvent('pointerdown', { button: 0, pointerId: 10, pointerType: 'touch', clientX: 100, clientY: 200 });
  await page.locator('#hold-card').dispatchEvent('pointermove', { pointerId: 10, pointerType: 'touch', clientX: 100, clientY: 230, bubbles: true });
  await page.clock.runFor(700);
  await expect(page.locator('#actions')).not.toBeVisible();
  await page.locator('#hold-card').dispatchEvent('pointerdown', { button: 0, pointerId: 11, pointerType: 'touch', clientX: 100, clientY: 200 });
  await page.clock.runFor(700);
  await expect(page.locator('#actions')).toBeVisible();
  await page.locator('[data-action=Saved]').tap();
  await expect(page.locator('#action-status')).toHaveText('Saved (demo only).');
  await page.locator('#close-actions').tap();
  await expect(page.locator('#actions')).not.toBeVisible();
});

test('sheet has a direct tap path and supports Escape', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('#open-actions').tap();
  await expect(page.locator('#actions')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#actions')).not.toBeVisible();
  await page.locator('#hold-card').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#actions')).toBeVisible();
  expect(errors).toEqual([]);
});

test('touch highlight is transparent while keyboard focus remains visible', async ({ page }) => {
  await page.locator('[data-dock=Saved]').tap();
  expect(await page.locator('[data-dock=Saved]').evaluate((el) => getComputedStyle(el).webkitTapHighlightColor)).toBe('rgba(0, 0, 0, 0)');
  expect(await page.locator('[data-dock=Saved]').evaluate((el) => el.matches(':focus-visible') || getComputedStyle(el).outlineStyle === 'none')).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.matches(':focus-visible'))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).not.toBe('none');
});
