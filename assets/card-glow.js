import { brightenFeedback } from '../index.js';

// Demo composition: sharp HDR edge plus a soft CSS aura on the containing card.
export function glowCards(selector) {
  const controls = [];
  const palette = [
    ['#8bc9ff', '100, 185, 255'], ['#44efa5', '68, 239, 165'],
    ['#ff80ad', '255, 128, 173'], ['#ffd16c', '255, 209, 108'],
    ['#b4a0ff', '180, 160, 255'],
  ];
  for (const [index, card] of [...document.querySelectorAll(selector)].entries()) {
    const [color, rgb] = palette[index % palette.length];
    card.classList.add('demo-card-glow');
    card.style.setProperty('--card-glow-rgb', rgb);
    let enabled = true;
    let [light] = brightenFeedback(card, { color, thickness: 2.5 });
    let timer = 0, pressed = false;
    const show = () => { clearTimeout(timer); card.dataset.glowing = ''; };
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { delete card.dataset.glowing; }, 650);
    };
    card.addEventListener('pointerdown', (event) => {
      if (!enabled || event.button !== 0 || event.target.closest(':disabled,[aria-disabled="true"]')) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--card-glow-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--card-glow-y', `${event.clientY - rect.top}px`);
      pressed = true; show();
    });
    window.addEventListener('pointerup', () => { if (pressed) { pressed = false; settle(); } });
    window.addEventListener('pointercancel', () => { pressed = false; delete card.dataset.glowing; light.cancel(); });
    card.addEventListener('keydown', (event) => {
      if (enabled && ['Enter', ' '].includes(event.key) && !event.repeat && !event.target.matches(':disabled')) { show(); light.flash('press'); }
    });
    card.addEventListener('keyup', (event) => { if (['Enter', ' '].includes(event.key)) settle(); });
    card.addEventListener('input', () => { if (!enabled) return; show(); light.flash('notify'); settle(); });
    card.addEventListener('click', (event) => { if (!enabled || !event.target.closest('button,a,input')) return; show(); settle(); });
    // Outcomes arriving after the press (uploads, holds, notifications) light the card again.
    const observer = new MutationObserver(() => {
      if (enabled && !pressed && card.isConnected) { show(); light.flash('complete'); settle(); }
    });
    for (const status of card.querySelectorAll('[role="status"]')) observer.observe(status, { childList: true, characterData: true, subtree: true });
    const cancel = () => { pressed = false; clearTimeout(timer); delete card.dataset.glowing; light.cancel(); };
    controls.push((value) => {
      enabled = Boolean(value); cancel();
      if (enabled) [light] = brightenFeedback(card, { color, thickness: 2.5 });
      else light.destroy();
    });
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
    window.addEventListener('pagehide', () => { cancel(); observer.disconnect(); });
  }
  return { setEnabled(value) { for (const setEnabled of controls) setEnabled(value); } };
}
