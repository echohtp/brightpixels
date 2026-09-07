import { test, expect } from '@playwright/test';

async function fixture(page, fallback = true) {
  if (fallback) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/test/browser/react-confetti-fixture.html');
  await page.waitForFunction(() => window.renderConfetti);
}

test('Strict Mode mounts one engine, completes once, restarts and unmounts cleanly', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await fixture(page);
  await page.evaluate(() => renderConfetti({ numberOfPieces: 24, recycle: false, tweenDuration: 0, lifetime: 150 }));
  await expect.poll(() => page.evaluate(() => readyCalls)).toBe(1);
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => completeCalls)).toBe(1);
  expect(await page.evaluate(() => [confettiRef.current.emittedCount, confettiRef.current.running])).toEqual([24, false]);
  await page.evaluate(() => renderConfetti({ colors: ['red'] }));
  expect(await page.evaluate(() => readyCalls)).toBe(1);
  await page.evaluate(() => confettiRef.current.restart());
  await expect.poll(() => page.evaluate(() => completeCalls)).toBe(2);
  await page.evaluate(() => unmountConfetti());
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(0);
  expect(await page.evaluate(() => [instances[0].canvas, instances[0].running, instances[0]._listeners.length])).toEqual([null, false, 0]);
  expect(errors).toEqual([]);
});

test('run pauses both emission and particle age; prop updates keep the same engine', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => renderConfetti({ numberOfPieces: 40, recycle: true, tweenDuration: 0, lifetime: 800 }));
  await expect.poll(() => page.evaluate(() => confettiRef.current?.activeCount)).toBe(40);
  await page.evaluate(() => renderConfetti({ run: false }));
  await expect.poll(() => page.evaluate(() => confettiRef.current.running)).toBe(false);
  const paused = await page.evaluate(() => [confettiRef.current.activeCount, confettiRef.current.emittedCount]);
  // Wait beyond the particle lifetime to prove paused particles do not expire.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => [confettiRef.current.activeCount, confettiRef.current.emittedCount])).toEqual(paused);
  await page.evaluate(() => renderConfetti({ run: true, colors: ['#ff0000'] }));
  await expect.poll(() => page.evaluate(() => confettiRef.current.emittedCount)).toBeGreaterThan(40);
  expect(await page.evaluate(() => readyCalls)).toBe(1);
  await page.evaluate(() => renderConfetti({ numberOfPieces: 0 }));
  await expect.poll(() => page.evaluate(() => completeCalls)).toBe(1);
  expect(await page.evaluate(() => confettiRef.current.running)).toBe(false);
});

test('source, velocities and fallback caps apply to a full one-shot batch', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    window.shower = createConfetti({
      numberOfPieces: 300, recycle: false, tweenDuration: 0, lifetime: 150,
      confettiSource: { x: 120, y: 160, w: 40, h: 20 },
      initialVelocityX: { min: 2, max: 2 }, initialVelocityY: { min: 3, max: 3 },
      wind: .01, opacity: .5, colors: ['#ff0000', '#00ff00'],
      onConfettiComplete: () => window.completeCalls++,
    });
    await shower.ready;
    const particles = shower._effects._particles;
    return { active: shower.activeCount,
      source: particles.every(p => p.x >= 120 && p.x <= 160 && p.y >= 160 && p.y <= 180),
      physics: particles.every(p => p.vx === 120 && p.vy === 180 && p.wind === 36 && p.opacity === .5 && p.flutter > 0),
      colors: [particles[0].color.css, particles[1].color.css] };
  });
  expect(result).toEqual({ active: 256, source: true, physics: true, colors: ['rgb(255,0,0)', 'rgb(0,255,0)'] });
  await expect.poll(() => page.evaluate(() => completeCalls)).toBe(1);
  expect(await page.evaluate(() => [shower.emittedCount, shower.activeCount, shower.running])).toEqual([300, 0, false]);
  await page.evaluate(() => shower.destroy());
});

test('reduced motion is one stationary batch and cancelled batches do not complete', async ({ page }) => {
  await fixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const result = await page.evaluate(async () => {
    window.shower = createConfetti({ numberOfPieces: 1000, recycle: true, onConfettiComplete: () => window.completeCalls++ });
    await shower.ready;
    return [shower.activeCount, shower._effects._particles.every(p => !p.vx && !p.vy && !p.wind && !p.spin && !p.flutter)];
  });
  expect(result).toEqual([12, true]);
  await expect.poll(() => page.evaluate(() => completeCalls)).toBe(1);
  expect(await page.evaluate(() => shower.running)).toBe(false);
  await page.evaluate(() => { shower.restart(); window.dispatchEvent(new Event('blur')); });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await page.evaluate(() => [shower.activeCount, shower.running, completeCalls])).toEqual([0, false, 1]);
  await page.evaluate(() => shower.destroy());
});

test('hidden/recycled showers clear, resume and follow viewport resizing', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => renderConfetti({ numberOfPieces: 60, tweenDuration: 0 }));
  await expect.poll(() => page.evaluate(() => confettiRef.current?.activeCount)).toBe(60);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => [confettiRef.current.activeCount, confettiRef.current.running])).toEqual([0, false]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => page.evaluate(() => confettiRef.current.activeCount)).toBe(60);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => [instances[0].canvas.width, confettiRef.current.activeCount])).toEqual([390, 60]);
  await page.evaluate(() => { confettiRef.current.clear(); unmountConfetti(); });
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(0);
});

test('React confetti uses HDR and pauses through global renderer changes', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'WebGPU renderer checked in Chromium.');
  await fixture(page, false);
  await page.evaluate(() => renderConfetti({ numberOfPieces: 80, tweenDuration: 0 }));
  await expect.poll(() => page.evaluate(() => confettiRef.current?.mode)).toBe('hdr');
  await expect.poll(() => page.evaluate(() => confettiRef.current.activeCount)).toBe(80);
  await page.evaluate(() => renderConfetti({ run: false }));
  await expect.poll(() => page.evaluate(() => confettiRef.current.running)).toBe(false);
  await page.evaluate(() => configureBrightpixels({ enabled: false }));
  expect(await page.evaluate(() => [confettiRef.current.mode, confettiRef.current.running])).toEqual(['fallback', false]);
  await page.evaluate(() => configureBrightpixels({ enabled: true }));
  await expect.poll(() => page.evaluate(() => confettiRef.current.mode)).toBe('hdr');
  expect(await page.evaluate(() => confettiRef.current.running)).toBe(false);
  await page.evaluate(() => renderConfetti({ run: true }));
  await expect.poll(() => page.evaluate(() => confettiRef.current.running)).toBe(true);
  await page.evaluate(() => unmountConfetti());
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(0);
});

test('React confetti demo controls work and fit a phone', async ({ page }, info) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/confetti.html');
  await expect(page.locator('.confetti-options')).toBeHidden();
  expect(await page.locator('#confetti-restart').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(844);
  await page.locator('.confetti-tuning > summary').click();
  await page.locator('#confetti-recycle').check();
  await page.locator('#confetti-restart').click();
  await page.locator('#confetti-pause').click();
  await expect(page.locator('#confetti-pause')).toHaveText('Resume');
  await page.locator('#confetti-pause').click();
  await page.locator('#confetti-clear').click();
  await expect(page.locator('#confetti-status')).toContainText('Cleared');
  await page.locator('#confetti-mount').uncheck();
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(0);
  await page.locator('#confetti-restart').click();
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.confetti-tuning > summary').click();
  await expect(page.locator('.confetti-options')).toBeHidden();
  expect(await page.evaluate(()=>document.body.scrollHeight)).toBeLessThan(1100);
  await expect(page.locator('.confetti-code pre')).toBeHidden();
  await page.locator('.confetti-code > summary').click();
  await expect(page.locator('.confetti-code pre')).toContainText('BrightConfetti');
  await page.locator('.confetti-code > summary').click();
  if (info.project.name === 'chromium') {
    await page.screenshot({ path: 'test-results/react-confetti-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#confetti-restart').click();
    await page.screenshot({ path: 'test-results/react-confetti-desktop.png', fullPage: true });
  }
  expect(errors).toEqual([]);
});
