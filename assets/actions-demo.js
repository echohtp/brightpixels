import { brightenSurface, createSurfaceGroup, configureBrightpixels } from '../index.js';
import { createParticleEffects } from '../particles.js';
import { bindHold, bindSwipe, bindDrag, trackAction, createEffectSequence } from '../interactions.js';

const $ = selector => document.querySelector(selector);
const reactor = brightenSurface($('#reactor'), { intensity: 12, color: '#55eeff', colorEnd: '#ff55c8', press: false });
const relays = [...document.querySelectorAll('.relay')].map((el, i) => brightenSurface(el, { intensity: 12, color: ['#ff55c8','#d4ff64','#55eeff'][i], selected: true }));
const saveLight = brightenSurface($('#save-card'), { color: '#d4ff64', intensity: 10 });
const swipeLight = brightenSurface($('#swipe-card'), { color: '#ff55c8', intensity: 12 });
const dragLight = brightenSurface($('#drag-card'), { color: '#55eeff', colorEnd: '#ff55c8', intensity: 12, press: false });
const sparkLight = brightenSurface($('#spark-card'), { color: '#d4ff64', intensity: 10 });
const lights = [reactor, ...relays, saveLight, swipeLight, dragLight, sparkLight];
const group = createSurfaceGroup(relays);
const particles = createParticleEffects({ maxParticles: 512, intensity: 12 });
const launch = $('#hold-launch'), status = $('#action-status');
let enabled = true, request = null, busy = false, saveRequest = null;
const sequence = createEffectSequence([
  { effect: 'charge', surface: reactor, value: 1, duration: 180 },
  { effect: 'sweep', surface: reactor, options: { angle: -20 }, duration: 350 },
  { effect: 'group', group, options: { from: 'start', stagger: 100 }, duration: 250 },
  { effect: 'particles', engine: particles, target: launch, options: { count: 180, speed: 500, flutter: true, spread: 120, lifetime: 1800 } },
  { effect: 'charge', surface: reactor, value: 0, duration: 220 },
]);
function simulatedSave(signal, fail = false) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); fail ? reject(new Error('Demo rejection')) : resolve(); }, 800);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
async function fire() {
  if (busy) return;
  busy = true; request = new AbortController(); $('#reactor').setAttribute('aria-busy', 'true');
  status.textContent = 'Saving a simulated request. The border is on the job.';
  launch.textContent = 'PROCESSING YOUR BRILLIANCE…';
  try {
    await trackAction(reactor, simulatedSave(request.signal), { signal: request.signal });
    if (request.signal.aborted) return;
    status.textContent = 'Approved. Deploying an unreasonable amount of light.';
    const result = enabled ? await sequence.play({ signal: request.signal }) : 'completed';
    status.textContent = result === 'completed' ? 'CHAIN REACTION COMPLETE. The machine would like a raise.' : 'Light sequence cancelled. Ready when you are.';
  } catch (error) {
    status.textContent = error.name === 'AbortError' ? 'Cancelled. Human authority restored.' : 'The demo request failed.';
  } finally { busy = false; $('#reactor').setAttribute('aria-busy', 'false'); launch.textContent = 'HOLD TO OVERLOAD ↗'; }
}
const hold = bindHold(launch, {
  surface: reactor, duration: 700,
  onProgress(value) { $('#hold-value').textContent = `${Math.round(value * 100)}%`; if (value === 1) status.textContent = 'FULLY CHARGED. Release to overload.'; },
  onComplete: fire,
  onCancel() { if (!busy) status.textContent = 'Hold a little longer, then release.'; },
});
// Prevent a second gesture while the current application action runs, without changing button focus.
launch.addEventListener('pointerdown', () => { if (busy) hold.cancel(); });
launch.addEventListener('keydown', () => { if (busy) hold.cancel(); });
const swipe = bindSwipe($('#swipe-confirm'), {
  surface: swipeLight,
  onComplete() { swipeLight.flash('success').sweep(); if (enabled) particles.burstFrom($('#swipe-confirm'), { count: 60, shape: 'spark' }); $('#swipe-status').textContent = 'CONFIRMED. Your thumb outranks the algorithm.'; },
  onCancel() { $('#swipe-status').textContent = 'Not confirmed. Slide all the way right.'; },
});
const drag = bindDrag($('#drag-control'), {
  surface: dragLight,
  onProgress(value) { const percent = Math.round(value * 100); $('#drag-value').textContent = `${percent}%`; $('#drag-control').setAttribute('aria-valuenow', String(percent)); },
  onComplete() { dragLight.sweep({ angle: 0 }); },
});
$('#cancel-action').addEventListener('click', () => { hold.cancel(); request?.abort(); sequence.cancel(); group.cancel(); particles.clear(); reactor.cancel().setCharge(0); status.textContent = 'Cancelled. Human authority restored.'; });
for (const fail of [false, true]) $(fail ? '#save-error' : '#save-success').addEventListener('click', async () => {
  saveRequest?.abort(); const current = new AbortController(); saveRequest = current;
  $('#save-status').textContent = 'Saving a simulated request…'; $('#save-card').setAttribute('aria-busy', 'true');
  try { await trackAction(saveLight, simulatedSave(current.signal, fail), { signal: current.signal }); if (saveRequest === current) $('#save-status').textContent = 'SAVED. An actual promise. A fictional responsibility.'; }
  catch (error) { if (saveRequest === current) $('#save-status').textContent = error.name === 'AbortError' ? 'Request cancelled.' : 'REJECTED. Try Save for a happier ending.'; }
  finally { if (saveRequest === current) $('#save-card').setAttribute('aria-busy', 'false'); }
});
for (const edge of ['left','top','right']) $(`#spark-${edge}`).addEventListener('click', () => {
  sparkLight.flash('press');
  if (enabled) particles.burstFrom($('#spark-card'), { edge, shape: 'spark', count: 70, speed: 300, gravity: 100, lifetime: 1000 });
});
$('#effects-enabled').addEventListener('change', event => {
  enabled = event.target.checked;
  hold.cancel(); swipe.cancel(); drag.cancel(); sequence.cancel(); group.cancel(); particles.clear();
  for (const light of lights) light.update({ enabled });
});
$('#hdr-enabled').addEventListener('change', event => { configureBrightpixels({ enabled: event.target.checked }); updateMode(); });
function updateMode() { $('#renderer-status').textContent = reactor.mode === 'hdr' ? 'HDR RENDERER' : 'NEON FALLBACK'; }
reactor.ready.then(updateMode);
window.addEventListener('pagehide', () => { request?.abort(); saveRequest?.abort(); sequence.cancel(); hold.cancel(); swipe.cancel(); drag.cancel(); });
// Leave controllers intact for back/forward cache; they resume on pageshow.
window.addEventListener('pageshow', () => reactor.ready.then(updateMode));
