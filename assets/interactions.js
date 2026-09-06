import { brightenFeedback, configureBrightpixels } from '../index.js';
const $ = (id) => document.getElementById(id);
const bind = (id, options) => brightenFeedback($(id), options)[0];
const controls = ['bloom', 'save', 'error', 'warning', 'select', 'hold', 'upload', 'notify'];
const feedback = Object.fromEntries(controls.map((id) => [id, bind(id)]));
$('hdr').addEventListener('change', () => configureBrightpixels({ enabled: $('hdr').checked }));
for (const [id, kind, message] of [['save', 'success', 'Demo saved.'], ['error', 'error', 'Demo error: please try again.'], ['warning', 'warning', 'Demo warning: review before continuing.']]) {
  $(id).addEventListener('click', () => { $(id + '-status').textContent = message; feedback[id].flash(kind); });
}
$('select').addEventListener('click', () => {
  const selected = $('select').getAttribute('aria-pressed') !== 'true';
  $('select').setAttribute('aria-pressed', String(selected));
  $('select').textContent = selected ? 'Selected' : 'Select this option';
  feedback.select.select(selected);
});
const drag = bind('drag-zone', { press: false });
$('level').addEventListener('input', () => {
  $('level-output').textContent = `${$('level').value}%`;
  $('level-bar').value = Number($('level').value); drag.select(true);
});
$('level').addEventListener('change', () => { drag.select(false); if (Number($('level').value) === 100) drag.flash('complete'); });
$('level').addEventListener('blur', () => drag.select(false));
const field = bind('field-zone', { press: false });
$('field').addEventListener('focus', () => field.select(true));
$('field').addEventListener('blur', () => field.select(false));
const notification = bind('notification', { press: false });
let notificationCount = 0;
$('notify').addEventListener('click', () => {
  $('notification').textContent = `Demo notification ${++notificationCount}: your report is ready.`;
  notification.flash('notify');
});
let holdFrame = 0, holding = false, holdComplete = false, holdPointer = null, holdKey = null;
function cancelHold() {
  if (!holding) return;
  holding = false; holdPointer = null; holdKey = null;
  cancelAnimationFrame(holdFrame); holdFrame = 0;
  if (!holdComplete) { $('hold-ring').value = 0; $('hold-status').textContent = 'Cancelled. Hold for one second.'; }
}
function beginHold() {
  if (holding) return;
  holding = true; holdComplete = false;
  $('hold-ring').value = 0; $('hold-status').textContent = 'Keep holding…';
  const start = performance.now();
  function tick(now) {
    holdFrame = 0;
    if (!holding) return;
    const progress = Math.min(100, (now - start) / 10);
    $('hold-ring').value = progress;
    if (progress === 100) {
      holdComplete = true; $('hold-status').textContent = 'Confirmed (demo).'; feedback.hold.flash('success');
    } else holdFrame = requestAnimationFrame(tick);
  }
  holdFrame = requestAnimationFrame(tick);
}
$('hold').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || holding) return;
  holdPointer = event.pointerId; $('hold').setPointerCapture(event.pointerId); beginHold();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('hold').addEventListener(type, (event) => { if (event.pointerId === holdPointer) cancelHold(); });
$('hold').addEventListener('keydown', (event) => {
  if (![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault(); if (event.repeat || holding) return;
  holdKey = event.key; beginHold();
});
$('hold').addEventListener('keyup', (event) => { if (event.key === holdKey) { event.preventDefault(); cancelHold(); } });
$('hold').addEventListener('blur', cancelHold);
window.addEventListener('blur', cancelHold);
let uploadTimer = 0;
function cancelUpload() {
  if (!uploadTimer) return;
  clearInterval(uploadTimer); uploadTimer = 0; $('upload').disabled = false;
  $('upload-status').textContent = 'Demo paused. Start again to retry.';
}
$('upload').addEventListener('click', () => {
  if (uploadTimer) return;
  let progress = 0; $('upload-bar').value = 0; $('upload').disabled = true; $('upload-status').textContent = 'Simulating upload…';
  uploadTimer = setInterval(() => {
    progress += 20; $('upload-bar').value = progress; $('upload-status').textContent = `${progress}%`;
    if (progress >= 100) { clearInterval(uploadTimer); uploadTimer = 0; $('upload').disabled = false; $('upload-status').textContent = 'Demo upload complete.'; feedback.upload.flash('complete'); }
  }, 240);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelHold(); cancelUpload(); } });
window.addEventListener('pagehide', () => { cancelHold(); cancelUpload(); });

import { glowCards } from './card-glow.js';
glowCards('.feedback-card');
