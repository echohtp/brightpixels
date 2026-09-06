import { brightenFeedback, configureBrightpixels } from '../index.js';
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const colors = { cyan: 'color(display-p3 0.1 0.9 1)', pink: 'color(display-p3 1 0.15 0.6)', acid: 'color(display-p3 0.7 1 0.05)' };
let controllers = [];
let panelControllers = [];
let theme = 'cyan', powered = false, timer = 0;
function wireFeedback() {
  for (const control of controllers) control.destroy();
  for (const control of panelControllers) control.destroy();
  controllers = brightenFeedback(document.querySelectorAll('button'), { color: colors[theme] });
  for (const control of controllers) if (control.target.getAttribute('aria-pressed') === 'true') control.select(true);
  panelControllers = brightenFeedback(document.querySelectorAll('.cp-glow-panel, .cp-reactor'), { color: colors[theme], thickness: 2.5 });
}
function signal() {
  const value = Number($('intensity').value);
  $('intensity-output').textContent = `${value}×`; $('signal-number').textContent = String(value).padStart(2, '0');
  for (const id of ['hero-light', 'reactor-ring', 'transfer-bar']) $(id).intensity = value;
}
function palette(value) {
  theme = value; root.dataset.cpTheme = value;
  for (const button of document.querySelectorAll('[data-theme]')) button.setAttribute('aria-pressed', String(button.dataset.theme === value));
  for (const id of ['hero-light', 'reactor-ring', 'transfer-bar']) $(id).color = colors[value];
  wireFeedback();
}
for (const button of document.querySelectorAll('[data-theme]')) button.addEventListener('click', () => palette(button.dataset.theme));
$('intensity').addEventListener('input', signal);
function setPower(value) {
  powered = value; $('power').setAttribute('aria-pressed', String(value));
  $('reactor').dataset.powered = String(value); $('reactor-state').textContent = value ? 'SIGNAL LIVE' : 'STANDBY';
  $('power-status').textContent = value ? 'Afterhours is online.' : 'Ready when you are.';
  $('reactor-ring').value = value ? 100 : 78;
  if (value) { $('reactor-ring').pulse({ intensity: 16, duration: 1000 }); panelControllers.at(-1)?.flash('complete'); }
}
$('power').addEventListener('click', () => setPower(!powered));
$('pulse').addEventListener('click', () => { $('reactor-ring').pulse({ intensity: 16, duration: 1000 }); for (const panel of panelControllers) panel.flash('notify'); $('power-status').textContent = 'Pulse sent. Your signal, amplified.'; });
$('hdr-toggle').addEventListener('click', () => {
  const enabled = $('hdr-toggle').getAttribute('aria-checked') !== 'true';
  $('hdr-toggle').setAttribute('aria-checked', String(enabled)); configureBrightpixels({ enabled });
});
$('reset').addEventListener('click', () => {
  $('intensity').value = '8'; signal(); palette('cyan'); setPower(false);
  $('hdr-toggle').setAttribute('aria-checked', 'true'); configureBrightpixels({ enabled: true, brightness: 1 });
});
$('favorite').addEventListener('click', () => {
  const selected = $('favorite').getAttribute('aria-pressed') !== 'true';
  $('favorite').setAttribute('aria-pressed', String(selected));
  // Keep the enhancement node in place while updating the text.
  const text = [...$('favorite').childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
  text.textContent = selected ? '★ FREQUENCY SAVED' : '☆ SAVE FREQUENCY';
  controllers.find((control) => control.target === $('favorite'))?.select(selected);
});
$('callsign-form').addEventListener('submit', (event) => {
  event.preventDefault(); const name = $('callsign').value.trim();
  $('callsign-status').textContent = name ? `${name.toUpperCase()} — signal recognized.` : 'Enter a callsign first.';
  if (name) panelControllers[1]?.flash('success');
});
$('transfer').addEventListener('click', () => {
  if (timer) return;
  let progress = 0; $('transfer').disabled = true; $('transfer-bar').value = 0;
  $('transfer-value').textContent = '0%'; $('transfer-status').textContent = 'Simulating transfer…';
  timer = setInterval(() => {
    progress += 10; $('transfer-bar').value = progress; $('transfer-value').textContent = `${progress}%`;
    if (progress === 100) { clearInterval(timer); timer = 0; $('transfer').disabled = false; $('transfer-status').textContent = 'Transfer complete. No files were uploaded.'; panelControllers[1]?.flash('complete'); }
  }, 160);
});
function stopTransfer() { if (timer) { clearInterval(timer); timer = 0; $('transfer').disabled = false; $('transfer-status').textContent = 'Paused. Start again to retry.'; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) stopTransfer(); });
window.addEventListener('pagehide', stopTransfer);
wireFeedback(); signal();
