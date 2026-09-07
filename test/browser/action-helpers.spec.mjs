import { test, expect } from '@playwright/test';

async function open(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.evaluate(async () => {
    window.helpers = await import('/interactions.js');
    window.particleAPI = await import('/particles.js');
    document.body.innerHTML = '<section id="card" style="width:340px;height:240px;background:#123;border-radius:12px"><button id="button">Hold</button><input id="swipe" type="range" min="0" max="100" value="0"><div id="drag" tabindex="0" style="width:300px;height:80px">Drag</div></section>';
    window.light = api.brightenSurface(document.querySelector('#card'), { press: false });
    await light.ready;
    window.calls = [];
    const flash = light.flash.bind(light);
    light.flash = kind => { calls.push(kind); return flash(kind); };
  });
}

test('action tracking preserves values/errors and gives only the newest request the outcome', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(async () => {
    let first, second;
    const a = helpers.trackAction(light, new Promise(resolve => first = resolve));
    const b = helpers.trackAction(light, new Promise(resolve => second = resolve));
    first(41); const value = await a;
    const pending = light.loading;
    second(42); const latest = await b;
    const failure = new Error('application failure');
    let unchanged = false;
    try { await helpers.trackAction(light, Promise.reject(failure)); } catch (error) { unchanged = error === failure; }
    return { value, latest, pending, loading: light.loading, calls, unchanged };
  })).toEqual({ value: 41, latest: 42, pending: true, loading: false, calls: ['success', 'error'], unchanged: true });
});

test('aborting visual tracking leaves application work intact and suppresses late feedback', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(async () => {
    const abort = new AbortController(); let complete;
    const tracked = helpers.trackAction(light, new Promise(resolve => complete = resolve), { signal: abort.signal });
    abort.abort(); const loading = light.loading; complete('saved');
    return { value: await tracked, loading, calls };
  })).toEqual({ value: 'saved', loading: false, calls: [] });
  await page.evaluate(() => {
    window.result = helpers.trackAction(light, new Promise(resolve => window.complete = resolve));
    document.querySelector('#card').hidden = true;
  });
  await expect.poll(() => page.evaluate(() => light.loading)).toBe(false);
  expect(await page.evaluate(async () => { complete(7); return { value: await result, calls }; })).toEqual({ value: 7, calls: [] });
});

test('hold completes once on charged release and cancels movement, disabled and detached targets', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.completed = 0; window.cancelled = 0;
    window.hold = helpers.bindHold(document.querySelector('#button'), { surface: light, duration: 150, onComplete: () => completed++, onCancel: () => cancelled++ });
  });
  const button = page.locator('#button'), box = await button.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 8); await page.mouse.down();
  await expect.poll(() => page.evaluate(() => hold.progress)).toBe(1);
  expect(await page.evaluate(() => completed)).toBe(0);
  await page.mouse.up();
  expect(await page.evaluate(() => [completed, hold.active, light.charge])).toEqual([1, false, 0]);
  await page.mouse.down(); await page.mouse.move(box.x + 70, box.y + 8); await page.mouse.up();
  expect(await page.evaluate(() => [completed, cancelled])).toEqual([1, 1]);
  await button.dispatchEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 8 });
  await page.evaluate(() => document.querySelector('#button').disabled = true);
  await expect.poll(() => page.evaluate(() => hold.active)).toBe(false);
  await page.evaluate(() => { document.querySelector('#button').disabled = false; });
  await button.dispatchEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 9 });
  await page.evaluate(() => document.querySelector('#button').remove());
  await expect.poll(() => page.evaluate(() => [hold.active, light.charge])).toEqual([false, 0]);
  expect(await page.evaluate(() => completed)).toBe(1);
});

test('hold supports keyboard and assistive activation, abort removes bindings', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.abort = new AbortController(); window.completed = 0;
    window.hold = helpers.bindHold(document.querySelector('#button'), { duration: 150, signal: abort.signal, onComplete: () => completed++ });
  });
  await page.locator('#button').focus(); await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => hold.progress)).toBe(1);
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => completed)).toBe(1);
  await page.evaluate(() => document.querySelector('#button').click());
  expect(await page.evaluate(() => completed)).toBe(2);
  await page.evaluate(() => { abort.abort(); document.querySelector('#button').click(); });
  expect(await page.evaluate(() => [completed, hold.active])).toEqual([2, false]);
});

test('native swipe preserves keyboard range behavior and requires explicit completion', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.completed = 0;
    window.swipe = helpers.bindSwipe(document.querySelector('#swipe'), { surface: light, onComplete: () => completed++ });
  });
  const input = page.locator('#swipe');
  await input.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  expect(Number(await input.inputValue())).toBeGreaterThan(1);
  expect(await page.evaluate(() => completed)).toBe(0);
  await page.keyboard.press('End');
  expect(await page.evaluate(() => light.charge)).toBe(1);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => [completed, swipe.active, light.charge])).toEqual([1, false, 0]);
  await expect(input).toHaveValue('0');
  await input.evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  expect(await page.evaluate(() => completed)).toBe(1);
  await expect(input).toHaveValue('0');
});

test('drag supports cumulative keyboard charge, pointer cancellation and touch-action restoration', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.completions = [];
    document.querySelector('#drag').style.touchAction = 'manipulation';
    window.abort = new AbortController();
    window.drag = helpers.bindDrag(document.querySelector('#drag'), { surface: light, signal: abort.signal, onComplete: value => completions.push(value) });
  });
  await page.locator('#drag').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => drag.progress)).toBeCloseTo(.2);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => [completions, light.charge])).toEqual([[.2], 0]);
  await page.locator('#drag').dispatchEvent('pointerdown', { pointerId: 7, isPrimary: true, button: 0, clientX: 80, clientY: 60 });
  await page.locator('#drag').dispatchEvent('pointercancel', { pointerId: 7 });
  expect(await page.evaluate(() => [drag.active, light.charge])).toEqual([false, 0]);
  expect(await page.evaluate(() => { abort.abort(); return document.querySelector('#drag').style.touchAction; })).toBe('manipulation');
});

test('element particles use current transformed bounds and reject invisible emitters', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(async () => {
    const engine = particleAPI.createParticleEffects({ maxParticles: 32 }); await engine.ready;
    const target = document.querySelector('#card'); target.style.transform = 'translate(20px, 30px) scale(.8)';
    const rect = target.getBoundingClientRect();
    const count = engine.burstFrom(target, { edge: 'right', count: 3, speed: 0, gravity: 0 });
    const correct = engine._particles.every(p => p.x === rect.right && p.y === rect.top + rect.height / 2);
    engine.clear(); target.hidden = true; const hidden = engine.burstFrom(target);
    target.hidden = false; target.style.transform = 'translateY(3000px)'; const offscreen = engine.burstFrom(target);
    target.remove(); const detached = engine.burstFrom(target); engine.destroy();
    return { count, correct, hidden, offscreen, detached };
  })).toEqual({ count: 3, correct: true, hidden: 0, offscreen: 0, detached: 0 });
});

test('sequences cancel queued effects, restore charge and replay without destroying borrowed surfaces', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    light.setCharge(.25);
    window.sequence = helpers.createEffectSequence([{ effect: 'charge', surface: light, value: 1, duration: 200 }, { effect: 'wait', duration: 200 }, { effect: 'flash', surface: light, kind: 'complete' }]);
    window.run = sequence.play();
  });
  await expect.poll(() => page.evaluate(() => light.charge)).toBeGreaterThan(.25);
  expect(await page.evaluate(async () => { sequence.cancel(); return [await run, light.charge, sequence.running, calls]; })).toEqual(['cancelled', .25, false, []]);
  expect(await page.evaluate(async () => { const status = await sequence.play(); sequence.destroy(); return { status, charge: light.charge, calls, connected: light.overlay.isConnected }; })).toEqual({ status: 'completed', charge: 1, calls: ['complete'], connected: true });
});

test('sequence abort, detach and reduced motion stop stale or animated work', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(async () => {
    const sequence = helpers.createEffectSequence([{ effect: 'charge', surface: light, value: 1, duration: 4000 }, { effect: 'sweep', surface: light, duration: 1000 }]);
    const start = performance.now(); const result = await sequence.play(); sequence.destroy();
    return { result, quick: performance.now() - start < 500, charge: light.charge, sweep: light._sweep };
  })).toEqual({ result: 'completed', quick: true, charge: 1, sweep: null });
  await page.evaluate(() => {
    window.sequence = helpers.createEffectSequence([{ effect: 'wait', duration: 1000 }, { effect: 'flash', surface: light }]);
    window.run = sequence.play(); document.querySelector('#card').remove();
  });
  expect(await page.evaluate(async () => await run)).toBe('cancelled');
});

test('sequence validates bounds, aborts immediately and rejects animation errors without leaking a run', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(async () => {
    const errors = [];
    for (const steps of [[], Array.from({length:65}, () => ({effect:'wait'})), [{effect:'unknown'}], Array.from({length:7}, () => ({effect:'wait',duration:5000}))]) {
      try { helpers.createEffectSequence(steps); } catch (error) { errors.push(error.name); }
    }
    const abort = new AbortController(); abort.abort();
    const sequence = helpers.createEffectSequence([{effect:'charge', surface:light, value:1, duration:150}]);
    const cancelled = await sequence.play({signal:abort.signal});
    const original = light.setCharge.bind(light); let count = 0;
    light.setCharge = value => { if (++count === 1) throw new Error('renderer failed'); return original(value); };
    let rejected = '';
    try { await sequence.play(); } catch (error) { rejected = error.message; }
    const running = sequence.running; sequence.destroy();
    return { errors, cancelled, rejected, running, charge:light.charge };
  })).toEqual({errors:['TypeError','TypeError','TypeError','RangeError'],cancelled:'cancelled',rejected:'renderer failed',running:false,charge:0});
});

test('charge rendering settles at the final gesture value without repeated geometry reads', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.refreshCount = 0;
    const refresh = light.refresh.bind(light);
    light.refresh = () => { refreshCount++; return refresh(); };
    for (let value = 0; value <= 1; value += .05) light.setCharge(value);
    light.setCharge(1);
  });
  await expect.poll(() => page.evaluate(() => light._uniforms[40])).toBe(1);
  await expect.poll(() => page.evaluate(() => light.running)).toBe(false);
  // An observer may deliver initial geometry, but progress must not remeasure for each input.
  expect(await page.evaluate(() => refreshCount)).toBeLessThan(5);
});

test('Action Lab works on a phone, cancels on navigation and stays compact', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/actions.html');
  await expect(page.locator('#renderer-status')).toHaveText('NEON FALLBACK');
  await page.locator('#hold-launch').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 1, button: 0, isPrimary: true, clientX: 80, clientY: 400 });
  await expect(page.locator('#hold-value')).toHaveText('100%');
  await page.screenshot({ path: `test-results/actions-phone-charged-${testInfo.project.name}.png`, fullPage: false });
  await page.locator('#hold-launch').dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 1 });
  await expect(page.locator('#action-status')).toContainText('CHAIN REACTION COMPLETE');
  await page.locator('.helper-disclosure > summary').tap();
  await page.locator('#save-error').tap();
  await expect(page.locator('#save-status')).toContainText('REJECTED');
  await page.locator('#save-success').tap();
  await expect(page.locator('#save-status')).toContainText('SAVED');
  await page.locator('.helper-disclosure > summary').tap();
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(1250);
  await page.screenshot({ path: `test-results/actions-phone-${testInfo.project.name}.png`, fullPage: true });
  await page.evaluate(() => document.querySelector('#hold-launch').click());
  await expect(page.locator('#action-status')).toContainText('Saving');
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); window.dispatchEvent(new PageTransitionEvent('pageshow')); });
  await expect(page.locator('#action-status')).toContainText('Cancelled');
  await page.evaluate(() => document.querySelector('#hold-launch').click());
  await expect(page.locator('#action-status')).toContainText('CHAIN REACTION COMPLETE');
  expect(errors).toEqual([]);
  await context.close();
});

test('Action Lab desktop primary control emits from the button', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/actions.html');
  await expect(page.locator('#renderer-status')).not.toHaveText('Starting light…');
  await page.locator('#hold-launch').focus(); await page.keyboard.down('Space');
  await expect(page.locator('#hold-value')).toHaveText('100%');
  await page.keyboard.up('Space');
  await expect(page.locator('#action-status')).toContainText('CHAIN REACTION COMPLETE');
  await expect(page.locator('[data-brightpixels-particles]')).toBeVisible();
  await page.screenshot({ path: `test-results/actions-desktop-${testInfo.project.name}.png`, fullPage: true });
});
