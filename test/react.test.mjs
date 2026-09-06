import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../react.js';
test('React 19 renders the documented loading and progress elements', () => {
  const html = renderToString(createElement('bright-shape', { status: 'loading', track: '', duration: 400, 'aria-label': 'Loading' }));
  assert.match(html, /status="loading"/);
  assert.match(html, /track=""/);
  assert.match(html, /duration="400"/);
  assert.match(html, /aria-label="Loading"/);
});
