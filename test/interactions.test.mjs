import test from 'node:test';
import assert from 'node:assert/strict';
import { bindHold, bindSwipe, bindDrag, trackAction, createEffectSequence } from '../interactions.js';

test('interaction entry is safe on the server and fails clearly before allocating browser resources', () => {
  for (const helper of [bindHold, bindSwipe, bindDrag, trackAction, createEffectSequence]) {
    assert.throws(() => helper(null), /browser document/);
  }
});
