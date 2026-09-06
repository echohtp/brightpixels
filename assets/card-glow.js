import { brightenFeedback } from '../index.js';

// Demo composition: an HDR perimeter plus a broad neon aura on the containing card.
export function glowCards(selector) {
  const controls = [];
  const palette = [
    ['color(display-p3 0.15 0.75 1)', '40, 190, 255'], ['color(display-p3 0.1 1 0.5)', '30, 255, 130'],
    ['color(display-p3 1 0.15 0.6)', '255, 40, 155'], ['color(display-p3 1 0.65 0.05)', '255, 165, 20'],
    ['color(display-p3 0.65 0.3 1)', '170, 80, 255'],
  ];
  for (const [index, card] of [...document.querySelectorAll(selector)].entries()) {
    const [color, rgb] = palette[index % palette.length];
    card.classList.add('demo-card-glow');
    card.style.setProperty('--card-glow-rgb', rgb);
    let enabled = true;
    let [light] = brightenFeedback(card, { color, thickness: 2.5 });
    const neon = document.createElement('bright-shape');
    neon.className = 'demo-neon-frame'; neon.shape = 'outline'; neon.color = color;
    neon.intensity = 16; neon.thickness = 3.5; neon.hidden = true;
    neon.setAttribute('aria-hidden', 'true'); card.append(neon);
    let timer = 0, retire = 0, pressed = false;
    const show = () => {
      clearTimeout(timer); clearTimeout(retire);
      neon.radius = (parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0) + 4;
      neon.hidden = false; card.dataset.glowing = '';
    };
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete card.dataset.glowing;
        retire = setTimeout(() => { neon.hidden = true; }, 850);
      }, 650);
    };
    card.addEventListener('pointerdown', (event) => {
      if (!enabled || event.button !== 0 || event.target.closest(':disabled,[aria-disabled="true"]')) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--card-glow-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--card-glow-y', `${event.clientY - rect.top}px`);
      pressed = true; show();
    });
    window.addEventListener('pointerup', () => { if (pressed) { pressed = false; settle(); } });
    window.addEventListener('pointercancel', () => { pressed = false; clearTimeout(timer); clearTimeout(retire); neon.hidden = true; delete card.dataset.glowing; light.cancel(); });
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
    const cancel = () => { pressed = false; clearTimeout(timer); clearTimeout(retire); neon.hidden = true; delete card.dataset.glowing; light.cancel(); };
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
