import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { brightenSurface } from '../index.js';
import BrightSurface from '../react-surface.js';

test('surfaces preserve semantic server markup without creating browser resources',()=>{
  assert.equal(renderToString(createElement(BrightSurface,{as:'article',options:{loading:true},className:'card'},createElement('button',null,'Save'))),'<article class="card"><button>Save</button></article>');
  assert.throws(()=>brightenSurface(null),/browser document/);
});
