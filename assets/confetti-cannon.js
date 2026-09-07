// Neon celebration without a particle library or a permanent render loop.
const colors = [
  ['#59f8ff', 'color(display-p3 0.1 0.95 1)'],
  ['#ff58db', 'color(display-p3 1 0.12 0.7)'],
  ['#dfff70', 'color(display-p3 0.7 1 0.1)'],
  ['#b68aff', 'color(display-p3 0.6 0.3 1)'],
  ['#ffbd64', 'color(display-p3 1 0.65 0.1)'],
];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const layer = document.createElement('div');
layer.className = 'dn-confetti-layer'; layer.setAttribute('aria-hidden', 'true');
document.body.append(layer);
const active = new Map();
const retire = (piece) => {
  const animation = active.get(piece);
  active.delete(piece); animation?.cancel(); piece.remove();
};
const clear = () => { for (const piece of active.keys()) retire(piece); };

export function fireConfetti(origin) {
  if (document.hidden) return;
  const still = reduced.matches || root.hasAttribute('data-still');
  const rect = origin.getBoundingClientRect();
  const count = still ? 14 : 96;
  for (let i = 0; i < count; i++) {
    while (active.size >= 192) retire(active.keys().next().value);
    const piece = document.createElement('span');
    const kind = i % 4;
    piece.className = `dn-confetti-piece dn-confetti-${kind}`;
    if (kind === 0) piece.textContent = '✦';
    const [color, p3] = colors[i % colors.length];
    piece.style.setProperty('--spark-color', color);
    piece.style.setProperty('--spark-p3', p3);
    let frames, duration;
    if (still) {
      const angle = i / count * Math.PI * 2;
      piece.style.transform = `translate3d(${rect.left + rect.width / 2 + Math.cos(angle) * (rect.width / 2 + 22)}px,${rect.top + rect.height / 2 + Math.sin(angle) * 48}px,0)`;
      frames = [{ opacity: 1 }, { opacity: 0 }]; duration = 1200;
    } else {
      const side = i % 2;
      const x = innerWidth * (side ? .86 : .14), y = innerHeight * .92;
      const vx = (side ? -1 : 1) * (70 + Math.random() * Math.min(innerWidth * .45, 530));
      const vy = -(innerHeight * (.8 + Math.random() * .45));
      const gravity = innerHeight * 1.1;
      duration = 1800 + Math.random() * 900;
      const spin = (Math.random() - .5) * 1000;
      frames = Array.from({ length: 21 }, (_, step) => {
        const progress = step / 20, t = progress * duration / 1000;
        return {
          transform: `translate3d(${x + vx * t + Math.sin(t * 5 + i) * 16}px,${y + vy * t + gravity * t * t / 2}px,0) rotate(${spin * t}deg)`,
          opacity: progress < .65 ? 1 : (1 - progress) / .35,
        };
      });
    }
    layer.append(piece);
    const animation = piece.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
    active.set(piece, animation);
    animation.onfinish = () => retire(piece);
  }
}

window.addEventListener('blur', clear);
window.addEventListener('pagehide', clear);
document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
reduced.addEventListener('change', clear);
new MutationObserver(() => { if (root.hasAttribute('data-still')) clear(); }).observe(root, { attributes: true, attributeFilter: ['data-still'] });
