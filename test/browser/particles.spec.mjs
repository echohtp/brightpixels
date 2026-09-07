import { test, expect } from '@playwright/test';
async function open(page, fallback = true) {
  if (fallback) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/test/browser/fixture.html');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => { document.body.style.minHeight = '600px'; window.particles = await import('/particles.js'); });
}

test('fallback particle bursts share one canvas, expire, and clean up listeners', async ({ page }) => {
  await open(page);
  const initial = await page.evaluate(async () => {
    window.effects = window.particles.createParticleEffects({ maxParticles: 512 });
    await effects.ready;
    return [effects.mode, effects.fallbackReason, effects.burst({ count: 300, lifetime: 150 })];
  });
  expect(initial).toEqual(['fallback', 'webgpu-unavailable', 256]);
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(1);
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCSS('pointer-events', 'none');
  await expect.poll(() => page.evaluate(() => effects.activeCount)).toBe(0);
  expect(await page.evaluate(() => effects.running)).toBe(false);
  await page.evaluate(() => { window.stop = effects.trail(document.body); });
  await page.mouse.move(20, 20);
  await page.mouse.move(200, 60, { steps: 4 });
  await expect.poll(() => page.evaluate(() => effects.activeCount)).toBeGreaterThan(0);
  await page.evaluate(() => { stop(); effects.clear(); });
  await page.mouse.move(250, 60);
  expect(await page.evaluate(() => effects.activeCount)).toBe(0);
  await page.evaluate(() => { effects.trail(document.body); effects.destroy(); effects.destroy(); });
  await page.mouse.move(300, 60);
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(0);
  expect(await page.evaluate(() => [effects.activeCount, effects.running, effects.burst(), effects.canvas])).toEqual([0, false, 0, null]);
});

test('motion preference, disable and resize keep effects bounded', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.effects = window.particles.createParticleEffects({ maxParticles: 64 }); effects.burst(); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => effects.activeCount)).toBe(0);
  expect(await page.evaluate(() => effects.burst({ count: 100, reducedMotion: false }))).toBe(12);
  expect(await page.evaluate(() => effects._particles.every(p => p.vx === 0 && p.vy === 0 && p.gravity === 0 && p.spin === 0))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => [effects.activeCount, effects.canvas.width])).toEqual([0, 390]);
  await page.evaluate(() => window.api.configureBrightpixels({ enabled: false, quality: 'low' }));
  expect(await page.evaluate(() => [effects.mode, effects.fallbackReason, effects.canvas.width])).toEqual(['fallback', 'disabled', 390]);
  await page.evaluate(() => { effects.burst(); window.dispatchEvent(new Event('blur')); });
  expect(await page.evaluate(() => [effects.activeCount, effects.running])).toEqual([0, false]);
});

test('HDR particle shader writes values above reference white and survives disabling', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Real WebGPU renderer checked in Chromium.');
  await open(page, false);
  await page.evaluate(async () => { window.effects = window.particles.createParticleEffects(); await effects.ready; });
  expect(await page.evaluate(() => [effects.mode, effects.fallbackReason])).toEqual(['hdr', null]);
  const result = await page.evaluate(async () => {
    const { PARTICLE_FLOATS, OFFSETS } = await import('/particles-shader.js');
    const { device, pipeline } = effects._gpu;
    device.pushErrorScope('validation');
    const seed = new Float32Array(PARTICLE_FLOATS);
    seed.set([16, 16, 0, 0], OFFSETS.origin); seed.set([0, 1, 0, 0], OFFSETS.motion);
    seed.set([6, 2, 0, 8], OFFSETS.style); seed.set([1, .2, .1, 1], OFFSETS.color);
    const buffer = device.createBuffer({ size: seed.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const frame = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buffer, 0, seed); device.queue.writeBuffer(frame, 0, new Float32Array([32, 32, 0, 1]));
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer } }, { binding: 1, resource: { buffer: frame } }] });
    const texture = device.createTexture({ size: [32, 32], format: 'rgba16float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const readback = device.createBuffer({ size: 256 * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const command = device.createCommandEncoder();
    const pass = command.beginRenderPass({ colorAttachments: [{ view: texture.createView(), clearValue: [0,0,0,0], loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(6, 1); pass.end();
    command.copyTextureToBuffer({ texture }, { buffer: readback, bytesPerRow: 256 }, [32, 32]);
    device.queue.submit([command.finish()]); await readback.mapAsync(GPUMapMode.READ);
    const pixel = Array.from(new Uint16Array(readback.getMappedRange()).slice(16 * 128 + 16 * 4, 16 * 128 + 16 * 4 + 4));
    readback.unmap(); readback.destroy(); texture.destroy(); buffer.destroy(); frame.destroy();
    return { pixel, error: (await device.popErrorScope())?.message || null };
  });
  expect(result.error).toBeNull();
  expect(result.pixel[0]).toBeGreaterThan(0x3c00); // IEEE half-float 1.0
  expect(result.pixel[3]).toBeLessThanOrEqual(0x3c00);
  await page.evaluate(() => effects.burst({ count: 800 }));
  expect(await page.evaluate(() => effects.activeCount)).toBe(800);
  await page.screenshot({ path: 'test-results/particles-hdr.png' });
  await page.evaluate(() => window.api.configureBrightpixels({ enabled: false }));
  expect(await page.evaluate(() => [effects.mode, effects.fallbackReason, effects.activeCount <= 256])).toEqual(['fallback', 'disabled', true]);
  await page.evaluate(async () => { window.api.configureBrightpixels({ enabled: true }); await effects.ready; });
  expect(await page.evaluate(() => effects.mode)).toBe('hdr');
  await page.evaluate(() => effects._gpu.device.destroy());
  await expect.poll(() => page.evaluate(() => effects.fallbackReason)).toBe('device-lost');
});

test('destroy during GPU initialization does not attach a late canvas', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'GPU initialization checked in Chromium.');
  await open(page, false);
  await page.evaluate(async () => {
    window.effects = window.particles.createParticleEffects(); effects.destroy(); await effects.ready;
  });
  await expect(page.locator('[data-brightpixels-particles]')).toHaveCount(0);
  expect(await page.evaluate(() => effects.canvas)).toBeNull();
});

test('particle lab controls work on a phone viewport', async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/particles.html');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#particle-burst').click();
  await expect(page.locator('#particle-status')).toContainText('120 particles emitted');
  await page.locator('#particle-trail').click();
  await expect(page.locator('#particle-trail')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#particle-clear').click();
  await expect(page.locator('#particle-status')).toContainText('Cleared');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === 'chromium') await page.screenshot({ path: 'test-results/particles-mobile.png', fullPage: true });
});
