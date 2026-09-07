import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticleEffects } from '../particles.js';
import { readFileSync } from 'node:fs';
test('particles subpath is importable without a DOM and declares no runtime dependency', () => {
  assert.throws(() => createParticleEffects(), /browser document/);
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.exports['./particles'].import, './particles.js');
  assert.equal(pkg.dependencies, undefined);
  for (const path of ['particles.js', 'particles.d.ts', 'particles-shader.js']) assert.ok(pkg.files.includes(path));
});
