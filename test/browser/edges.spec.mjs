import { test, expect } from '@playwright/test';

async function open(page, fallback = true) {
  if (fallback) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.waitForFunction(() => window.api);
}

test('enhancement preserves layout, children and click handlers, and is reversible', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(() => {
    document.body.innerHTML = '<button id="target" style="border:2px solid red;border-radius:12px;padding:20px"><span>Original</span></button><input id="input">';
    const target = document.querySelector('#target');
    window.originalChild = target.firstChild;
    window.clicks = 0; target.addEventListener('click', () => window.clicks++);
    const before = target.getBoundingClientRect().toJSON();
    [window.edge] = window.api.brightenEdges(target, { thickness: 2, intensity: 4 });
    const after = target.getBoundingClientRect().toJSON();
    return { before, after, sameChild: target.firstChild === window.originalChild,
      duplicate: window.api.brightenEdges(target)[0] === window.edge,
      unsupported: window.api.brightenEdges('#input').length };
  });
  expect(result.before).toEqual(result.after);
  expect(result.sameChild).toBe(true); expect(result.duplicate).toBe(true); expect(result.unsupported).toBe(0);
  await page.locator('#target').click();
  expect(await page.evaluate(() => window.clicks)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.edge.mode)).toBe('fallback');
  await page.evaluate(() => window.edge.destroy());
  await expect(page.locator('bright-edge')).toHaveCount(0);
  expect(await page.locator('#target').evaluate((el) => [el.style.position, el.firstChild === window.originalChild])).toEqual(['', true]);
});

test('hover, focus, updates and removal respect existing styles', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    document.body.innerHTML = '<button id="target" style="position:relative;border:2px solid red;border-radius:12px">Focus me</button><button id="other">Other</button>';
    [window.edge] = window.api.brightenEdges('#target', { trigger: 'hover', offset: 3 });
  });
  await expect(page.locator('bright-edge')).toBeHidden();
  await page.locator('#target').hover();
  await expect(page.locator('bright-edge')).toBeVisible();
  await page.locator('#other').hover();
  await expect(page.locator('bright-edge')).toBeHidden();
  await page.evaluate(() => window.edge.update({ trigger: 'focus', color: 'blue', thickness: 3 }));
  await page.locator('#target').focus();
  await expect(page.locator('bright-edge')).toBeVisible();
  expect(await page.evaluate(() => window.edge._shape.color)).toBe('blue');
  await page.locator('#other').focus();
  await expect(page.locator('bright-edge')).toBeHidden();
  await page.evaluate(() => { window.target = document.querySelector('#target'); window.target.remove(); document.body.append(window.target); });
  expect(await page.evaluate(() => window.edge.target === window.target)).toBe(true);
  await page.evaluate(() => { window.target.style.position = 'absolute'; window.edge.destroy(); });
  expect(await page.evaluate(() => window.target.style.position)).toBe('absolute');
});

test('edge initializes real HDR and follows global disable', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Real GPU covered in Chromium.');
  await open(page, false);
  await page.evaluate(() => {
    document.body.innerHTML = '<div id="target" style="width:240px;height:100px;border:1px solid white">Content</div>';
    [window.edge] = window.api.brightenEdges('#target', { color: 'white' });
  });
  await expect.poll(() => page.evaluate(() => window.edge.mode)).toBe('hdr');
  await expect.poll(() => page.evaluate(() => Boolean(window.edge._shape._bright._gpu?.sourceTexture))).toBe(true);
  await page.evaluate(() => window.api.configureBrightpixels({ enabled: false }));
  await expect.poll(() => page.evaluate(() => window.edge.fallbackReason)).toBe('disabled');
  await page.evaluate(() => window.edge.destroy());
  expect(await page.evaluate(() => window.edge._shape._bright._gpu)).toBe(null);
});

test('edge geometry matches small mobile targets without outline padding', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => {
    document.body.innerHTML = '<button id="target" style="width:120px;height:32px;padding:0;border:2px solid red;border-radius:8px">Small</button>';
    [window.edge] = window.api.brightenEdges('#target');
  });
  const geometry = await page.evaluate(() => {
    const target = document.querySelector('#target').getBoundingClientRect();
    const shape = window.edge._shape.getBoundingClientRect();
    return { target: [target.x, target.y, target.width, target.height], shape: [shape.x, shape.y, shape.width, shape.height] };
  });
  expect(geometry.shape).toEqual(geometry.target);
});

test('touch press activates hover edges and cancellation clears them', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    document.body.innerHTML = '<button id="target">Touch</button>';
    [window.edge] = window.api.brightenEdges('#target', { trigger: 'hover' });
  });
  await page.locator('#target').dispatchEvent('pointerenter', { pointerType: 'touch' });
  await expect(page.locator('bright-edge')).toBeHidden();
  await page.locator('#target').dispatchEvent('pointerdown', { pointerType: 'touch' });
  await expect(page.locator('bright-edge')).toBeVisible();
  await page.locator('#target').dispatchEvent('pointercancel', { pointerType: 'touch', bubbles: true });
  await expect(page.locator('bright-edge')).toBeHidden();
  await page.locator('#target').dispatchEvent('pointerdown', { pointerType: 'touch' });
  await page.locator('#target').dispatchEvent('pointerup', { pointerType: 'touch', bubbles: true });
  await expect(page.locator('bright-edge')).toBeHidden();
});

test('mobile demo exposes all edges without hover and keeps toggles reversible', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/edges.html');
  await page.locator('#show-all-edges').check();
  for (const id of ['edge-card', 'edge-button', 'edge-link']) await expect(page.locator(`#${id} bright-edge`)).toBeVisible();
  await page.locator('#enable-edges').uncheck();
  await expect(page.locator('bright-edge')).toHaveCount(0);
  await page.locator('#enable-edges').check();
  await expect(page.locator('#edge-link bright-edge')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
