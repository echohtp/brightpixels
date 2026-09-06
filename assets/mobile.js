import { brightenFeedback, configureBrightpixels } from '../index.js';
const $ = (id) => document.getElementById(id);
const attach = (element, options) => brightenFeedback(element, options)[0];
$('hdr').addEventListener('change', () => configureBrightpixels({ enabled: $('hdr').checked }));
const swipeFeedback = attach($('swipe-zone'), { press: false });
function setSwipe(value) { $('swipe').value = value; $('swipe-value').textContent = `${value}%`; $('swipe-bar').value = value; }
function resetSwipe() { setSwipe(0); $('swipe').disabled = false; swipeFeedback.cancel().select(false); $('swipe-status').textContent = 'Ready to slide.'; }
$('swipe').addEventListener('input', () => { setSwipe(Number($('swipe').value)); swipeFeedback.select(true); });
$('swipe').addEventListener('change', () => {
  swipeFeedback.select(false);
  if (Number($('swipe').value) === 100) { $('swipe-status').textContent = 'Confirmed (demo).'; $('swipe').disabled = true; swipeFeedback.flash('success'); }
  else { setSwipe(0); $('swipe-status').textContent = 'Not confirmed. Slide all the way to finish.'; }
});
$('swipe').addEventListener('pointercancel', resetSwipe);
$('swipe-reset').addEventListener('click', resetSwipe);
attach($('swipe-reset'));
const choiceButtons = [...document.querySelectorAll('[data-choice]')];
const choiceFeedback = choiceButtons.map((button) => attach(button));
function choose(value) {
  $('choice').value = value;
  const name = choiceButtons[value].textContent;
  $('choice').setAttribute('aria-valuetext', name); $('choice-status').textContent = `${name} selected.`;
  choiceButtons.forEach((button, index) => { button.setAttribute('aria-pressed', String(index === value)); choiceFeedback[index].select(index === value); });
}
$('choice').addEventListener('input', () => choose(Number($('choice').value)));
choiceButtons.forEach((button, index) => button.addEventListener('click', () => choose(index)));
choose(1);
const favorite = attach($('favorite'));
$('favorite').addEventListener('click', () => {
  const selected = $('favorite').getAttribute('aria-pressed') !== 'true';
  $('favorite').setAttribute('aria-pressed', String(selected)); $('heart').filled = selected; $('heart').intensity = selected ? 4 : 1;
  $('favorite-label').textContent = selected ? 'Favorited' : 'Add favorite'; $('favorite-status').textContent = selected ? 'Added to demo favorites.' : 'Not favorited.';
  favorite.select(selected); if (selected) favorite.flash('success');
});
const dockButtons = [...document.querySelectorAll('[data-dock]')];
const dockFeedback = dockButtons.map((button) => attach(button));
dockFeedback[0].select(true);
dockButtons.forEach((button, index) => button.addEventListener('click', () => {
  dockButtons.forEach((item, i) => { item.setAttribute('aria-pressed', String(i === index)); dockFeedback[i].select(i === index); });
  $('dock-status').textContent = `${button.dataset.dock} preview selected.`;
}));
const holdFeedback = attach($('hold-card'));
attach($('open-actions')); attach($('close-actions'));
let holdTimer = 0, pointer = null, origin = null;
function cancelHold() { clearTimeout(holdTimer); holdTimer = 0; pointer = null; origin = null; holdFeedback.cancel(); }
function openActions() {
  cancelHold(); if (!$('actions').open) $('actions').showModal();
}
$('hold-card').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || pointer !== null) return;
  pointer = event.pointerId; origin = [event.clientX, event.clientY];
  holdTimer = setTimeout(openActions, 650);
});
window.addEventListener('pointermove', (event) => {
  if (event.pointerId === pointer && origin && Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 12) cancelHold();
});
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, (event) => { if (event.pointerId === pointer) cancelHold(); });
$('hold-card').addEventListener('contextmenu', (event) => event.preventDefault());
$('hold-card').addEventListener('keydown', (event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); if (!event.repeat) openActions(); } });
$('hold-card').addEventListener('blur', cancelHold);
$('open-actions').addEventListener('click', openActions);
$('close-actions').addEventListener('click', () => $('actions').close());
for (const button of document.querySelectorAll('[data-action]')) {
  const feedback = attach(button);
  button.addEventListener('click', () => { $('action-status').textContent = `${button.dataset.action} (demo only).`; feedback.flash('success'); });
}
window.addEventListener('blur', cancelHold);
window.addEventListener('pagehide', cancelHold);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelHold(); });
