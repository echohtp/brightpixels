import { createParticleEffects } from '../particles.js';
let effects;
export const getConfettiEffects = () => effects ?? null;

// Both cannons and the portal reuse one HDR particle engine and one canvas.
export function fireConfetti(origin, { count = 120 } = {}) {
  effects ??= createParticleEffects({ maxParticles: 1024, intensity: 8 });
  const rect = origin.getBoundingClientRect();
  const reducedMotion = document.documentElement.hasAttribute('data-still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return effects.burst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, reducedMotion: true });
  const amount = Number.isFinite(Number(count)) ? Math.max(0, Math.min(1024, Math.round(Number(count)))) : 120;
  for (let side = 0; side < 2; side++) effects.burst({
    x: innerWidth * (side ? .86 : .14), y: innerHeight * .9,
    count: side ? Math.floor(amount / 2) : Math.ceil(amount / 2),
    angle: side ? -115 : -65, spread: 60, speed: innerHeight * 1.1,
    gravity: innerHeight * .85, lifetime: 2300, size: 6,
  });
  return amount;
}
new MutationObserver(() => { if (document.documentElement.hasAttribute('data-still')) effects?.clear(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-still'] });
