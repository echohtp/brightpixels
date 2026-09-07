import { test, expect } from '@playwright/test';

test('card spotlight follows the mouse and clears on exit or disable without touch hover', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.evaluate(async () => {
    document.body.innerHTML = '<div id="card" style="width:300px;height:200px;margin:40px">Spotlight</div>';
    const { glowCards } = await import('/assets/card-glow.js');
    window.glow = glowCards('#card');
  });
  const card = page.locator('#card');
  const rect = await card.boundingBox();
  await page.mouse.move(rect.x + 30, rect.y + 40);
  await expect(card).toHaveAttribute('data-tracking', '');
  await expect.poll(() => card.evaluate(el => el.style.getPropertyValue('--card-glow-x'))).toBe('30px');
  await page.mouse.move(rect.x + 210, rect.y + 120);
  await expect.poll(() => card.evaluate(el => [el.style.getPropertyValue('--card-glow-x'), el.style.getPropertyValue('--card-glow-y')])).toEqual(['210px', '120px']);
  await page.mouse.move(0, 0);
  await expect(card).not.toHaveAttribute('data-tracking');
  await card.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 100 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(card).not.toHaveAttribute('data-tracking');
  await page.mouse.move(rect.x + 50, rect.y + 50);
  await expect(card).toHaveAttribute('data-tracking', '');
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await expect(card).not.toHaveAttribute('data-tracking');
  await page.mouse.move(rect.x + 60, rect.y + 60);
  await expect(card).toHaveAttribute('data-tracking', '');
  await page.evaluate(() => window.glow.setEnabled(false));
  await page.mouse.move(rect.x + 80, rect.y + 80);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(card).not.toHaveAttribute('data-tracking');
});
