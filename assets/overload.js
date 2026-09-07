import { fireConfetti } from './confetti-cannon.js?v=20260907-giga1';
const root = document.documentElement;
const toggle = document.getElementById('overload-toggle');
const portal = document.getElementById('overdrive-fire');
let timer = 0, jumps = 0;
const settle = () => { clearTimeout(timer); root.removeAttribute('data-ignited'); };
toggle.addEventListener('click', () => {
  const enabled = root.dataset.overload !== 'giga';
  root.dataset.overload = enabled ? 'giga' : 'classic';
  toggle.setAttribute('aria-pressed', String(enabled));
  // Preserve the feedback helper's appended overlay.
  toggle.firstChild.textContent = `GIGA OVERLOAD: ${enabled ? 'ON' : 'OFF'}`;
  if (!enabled) settle();
});
portal.addEventListener('click', () => {
  fireConfetti(portal, { count: 144 });
  document.querySelector('.dn-portal-ring').pulse({ intensity: 16, duration: 900 });
  document.getElementById('overdrive-status').textContent = `JUMP ${String(++jumps).padStart(2, '0')} COMPLETE · AGAIN?`;
  root.setAttribute('data-ignited', '');
  clearTimeout(timer); timer = setTimeout(settle, 900);
});
window.addEventListener('blur', settle);
window.addEventListener('pagehide', settle);
document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
