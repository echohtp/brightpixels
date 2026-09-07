import { createParticleEffects } from '../particles.js';
import { configureBrightpixels } from '../index.js';
const $ = id => document.getElementById(id);
const effects = createParticleEffects({ maxParticles: 1024, intensity: 8 });
let stopTrail = null;
const report = message => { $('particle-status').textContent = `${effects.mode === 'hdr' ? 'HDR renderer' : 'Canvas fallback'} · ${message}`; };
const settings = () => ({ count: Number($('particle-count').value), intensity: Number($('particle-intensity').value) });
function fire(shape, origin) {
  const rect = origin.getBoundingClientRect();
  const count = effects.burst({ ...settings(), x: rect.left + rect.width / 2, y: rect.top, shape, spread: shape === 'spark' ? 360 : 100 });
  report(`${count} particles emitted`);
}
$('particle-burst').addEventListener('click', event => fire('confetti', event.currentTarget));
$('particle-sparks').addEventListener('click', event => fire('spark', event.currentTarget));
$('particle-stage').addEventListener('click', event => { effects.burst({ ...settings(), count: 40, shape: 'spark', spread: 360, x: event.clientX, y: event.clientY }); });
$('particle-trail').addEventListener('click', () => {
  if (stopTrail) { stopTrail(); stopTrail = null; } else stopTrail = effects.trail($('particle-stage'), { intensity: settings().intensity });
  $('particle-trail').setAttribute('aria-pressed', String(Boolean(stopTrail))); report(stopTrail ? 'Move over the stage' : 'Trail stopped');
});
$('particle-clear').addEventListener('click', () => { effects.clear(); report('Cleared'); });
for (const [input, output] of [['particle-count', 'count-label'], ['particle-intensity', 'intensity-label']]) $(input).addEventListener('input', () => { $(output).textContent = $(input).value; });
$('particle-hdr').addEventListener('change', async () => { configureBrightpixels({ enabled: $('particle-hdr').checked }); await effects.ready; report('Ready'); });
effects.ready.then(() => report('Ready'));
