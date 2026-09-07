// A bounded, event-driven light-cycle trail behind the page content.
const ns = 'http://www.w3.org/2000/svg';
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const layer = document.createElementNS(ns, 'svg');
layer.classList.add('dn-tron-trail');
layer.setAttribute('aria-hidden', 'true');
document.body.prepend(layer);
let previous = null, pending = null, frame = 0;
const clear = () => {
  cancelAnimationFrame(frame); frame = 0; previous = pending = null;
  layer.replaceChildren();
};
const disabled = () => reduced.matches || root.hasAttribute('data-still') || document.hidden;
function draw() {
  frame = 0;
  if (disabled() || !pending) { clear(); return; }
  const next = pending; pending = null;
  if (!previous) { previous = next; return; }
  if (next.x === previous.x && next.y === previous.y) return;
  const horizontal = Math.abs(next.x - previous.x) >= Math.abs(next.y - previous.y);
  const corner = horizontal ? `${next.x} ${previous.y}` : `${previous.x} ${next.y}`;
  const d = `M ${previous.x} ${previous.y} L ${corner} L ${next.x} ${next.y}`;
  const segment = document.createElementNS(ns, 'g');
  segment.classList.add('dn-tron-segment');
  for (const [width, opacity] of [[16, .08], [8, .2], [3, 1], [1, 1]]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d); path.setAttribute('fill', 'none');
    path.setAttribute('stroke', width === 1 ? '#efffff' : 'var(--dn-cyan)');
    path.setAttribute('stroke-width', width); path.setAttribute('opacity', opacity);
    segment.append(path);
  }
  segment.addEventListener('animationend', () => segment.remove(), { once: true });
  layer.append(segment);
  while (layer.childElementCount > 48) layer.firstElementChild.remove();
  previous = next;
}
window.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || disabled()) return;
  if (event.target.closest?.('.dn-window,button,a,input,textarea')) {
    previous = pending = null; return;
  }
  pending = { x: Math.round(event.clientX / 16) * 16, y: Math.round(event.clientY / 16) * 16 };
  if (!frame) frame = requestAnimationFrame(draw);
}, { passive: true });
window.addEventListener('blur', clear);
window.addEventListener('pagehide', clear);
window.addEventListener('scroll', clear, { passive: true, capture: true });
document.documentElement.addEventListener('pointerleave', clear);
document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
reduced.addEventListener('change', clear);
new MutationObserver(() => { if (disabled()) clear(); }).observe(root, { attributes: true, attributeFilter: ['data-still'] });
