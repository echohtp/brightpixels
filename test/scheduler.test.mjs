import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureBrightpixels, getBrightpixelsConfig } from '../index.js';
test('global configuration clamps values and returns detached snapshots', () => {
  assert.deepEqual(configureBrightpixels({ brightness: 9 }), { enabled: true, brightness: 1 });
  configureBrightpixels({ enabled: false, brightness: -1 });
  assert.deepEqual(getBrightpixelsConfig(), { enabled: false, brightness: 0 });
  const snapshot = getBrightpixelsConfig(); snapshot.enabled = true;
  assert.equal(getBrightpixelsConfig().enabled, false);
  configureBrightpixels({ brightness: NaN });
  assert.equal(getBrightpixelsConfig().brightness, 0);
  configureBrightpixels({ enabled: true, brightness: 1 });
});
test('scheduler batches components into one frame and cancels detached work', async () => {
  const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8') + '\nexport {scheduleFrame,cancelFrame};';
  const { scheduleFrame, cancelFrame } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const pending = new Map(); let calls = 0; const seen = [];
  globalThis.requestAnimationFrame = (callback) => { pending.set(++calls, callback); return calls; };
  globalThis.cancelAnimationFrame = (id) => pending.delete(id);
  const tick = (now) => { const [id, callback] = pending.entries().next().value; pending.delete(id); callback(now); };
  try {
    scheduleFrame((now) => { seen.push(['a', now]); scheduleFrame((next) => seen.push(['next', next])); });
    const canceled = scheduleFrame(() => seen.push(['canceled']));
    scheduleFrame((now) => seen.push(['b', now]));
    cancelFrame(canceled);
    assert.equal(calls, 1);
    tick(10);
    assert.deepEqual(seen, [['a', 10], ['b', 10]]);
    assert.equal(pending.size, 1);
    tick(20);
    assert.deepEqual(seen.at(-1), ['next', 20]);
    assert.equal(pending.size, 0);
    const last = scheduleFrame(() => {}); cancelFrame(last);
    assert.equal(pending.size, 0);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
