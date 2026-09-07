import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import BrightConfetti, { BrightConfetti as NamedConfetti } from '../react-confetti.js';
import { createConfetti } from '../confetti.js';

test('React confetti renders nothing during SSR and vanilla creation requires a document', () => {
  assert.equal(BrightConfetti, NamedConfetti);
  assert.equal(renderToString(createElement(BrightConfetti, { recycle: false })), '');
  assert.throws(() => createConfetti(), /browser document/);
});
test('React confetti has its own optional entry point without changing the core React entry', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.exports['./react-confetti'].import, './react-confetti.js');
  assert.equal(pkg.exports['./confetti'].import, './confetti.js');
  assert.equal(pkg.peerDependenciesMeta.react.optional, true);
  assert.equal(pkg.dependencies, undefined);
  assert.equal('BrightConfetti' in await import('../react.js'), false);
});
