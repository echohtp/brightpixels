import { brightenEdges, configureBrightpixels } from '../index.js';
const specifications = [
  ['#edge-card', { color: 'color(display-p3 0.2 1 0.65)', thickness: 2 }],
  ['#edge-button', { color: '#8bc9ff', thickness: 2, trigger: 'hover' }],
  ['#edge-link', { color: '#ffd47a', thickness: 2, offset: 5, trigger: 'focus' }],
];
let edges = [];
function enable() {
  const showAll = document.querySelector('#show-all-edges').checked;
  edges = specifications.flatMap(([target, options]) => brightenEdges(target, { ...options, trigger: showAll ? 'always' : options.trigger || 'always' }));
}
enable();
let clicks = 0;
document.querySelector('#edge-button').addEventListener('click', () => {
  document.querySelector('#click-status').textContent = `Original click handler: ${++clicks} clicks.`;
});
document.querySelector('#enable-edges').addEventListener('change', (event) => {
  if (event.target.checked) enable();
  else { for (const edge of edges) edge.destroy(); edges = []; }
});
document.querySelector('#enable-hdr').addEventListener('change', (event) => configureBrightpixels({ enabled: event.target.checked }));

document.querySelector('#show-all-edges').addEventListener('change', () => {
  if (document.querySelector('#enable-edges').checked) enable();
});

import { glowCards } from './card-glow.js';
const cardGlow = glowCards('#edge-action-card');
document.querySelector('#enable-edges').addEventListener('change', (event) => cardGlow.setEnabled(event.target.checked));
