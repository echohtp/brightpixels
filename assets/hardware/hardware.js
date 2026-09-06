import { version, configureBrightpixels, getBrightpixelsConfig } from '../../index.js';

const $ = (id) => document.getElementById(id);
const samples = [...document.querySelectorAll('.hdr-target')];
const ring = $('motion-ring');
const bar = $('motion-bar');
const queries = Object.fromEntries(Object.entries({
  hdr: '(dynamic-range: high)', videoHdr: '(video-dynamic-range: high)',
  p3: '(color-gamut: p3)', rec2020: '(color-gamut: rec2020)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
}).map(([key, query]) => [key, matchMedia(query)]));
let progress = 65;
let pending = false;
$('version').textContent = `v${version}`;

function collectReport() {
  return {
    schemaVersion: 1, capturedAt: new Date().toISOString(), brightpixelsVersion: version,
    measurement: 'Browser signals and user observations only; physical luminance is not measured.',
    browser: { userAgent: navigator.userAgent, language: navigator.language },
    screen: { width: screen.width, height: screen.height, availableWidth: screen.availWidth,
      availableHeight: screen.availHeight, colorDepth: screen.colorDepth, pixelDepth: screen.pixelDepth },
    window: { width: innerWidth, height: innerHeight, devicePixelRatio },
    capabilities: { webgpuApi: Boolean(navigator.gpu), displayP3Css: CSS.supports('color', 'color(display-p3 1 0.35 0)'),
      ...Object.fromEntries(Object.entries(queries).map(([key, query]) => [key, query.matches])) },
    settings: { ...getBrightpixelsConfig(), requestedIntensity: Number($('intensity').value),
      continuousLoading: $('loading').checked, progress },
    components: samples.map((element) => ({ id: element.id, tag: element.localName, mode: element.mode || 'initializing' })),
    observations: Object.fromEntries(new FormData($('observations'))),
  };
}

function refresh() {
  const report = collectReport();
  $('report-json').value = JSON.stringify(report, null, 2);
  $('white-mode').textContent = !report.settings.enabled ? 'HDR disabled — reference output'
    : $('white-hdr').mode === 'hdr' ? 'HDR renderer active' : 'Fallback / renderer unavailable';
  const rows = {
    'WebGPU API': report.capabilities.webgpuApi ? 'Exposed' : 'Unavailable',
    'HDR renderer samples': `${report.components.filter((item) => item.mode === 'hdr').length} / ${samples.length}`,
    'Reported HDR display': report.capabilities.hdr ? 'High dynamic range reported' : 'High dynamic range not reported',
    'Reported P3 gamut': report.capabilities.p3 ? 'P3 reported' : 'P3 not reported',
    'Display P3 CSS': report.capabilities.displayP3Css ? 'Supported' : 'Unavailable',
    'Reduced motion': report.capabilities.reducedMotion ? 'Requested' : 'Not requested',
    'Viewport / scale': `${innerWidth} × ${innerHeight} / ${devicePixelRatio}×`,
  };
  $('diagnostics').replaceChildren(...Object.entries(rows).flatMap(([label, value]) => {
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    return [term, detail];
  }));
  return $('report-json').value;
}

function scheduleRefresh() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; refresh(); });
}

function stopMotion() {
  $('loading').checked = false;
  for (const element of [ring, bar]) {
    element.indeterminate = false;
    element.stopPulse();
    element.duration = 0;
    element.value = progress;
    element.duration = 750;
  }
  refresh();
}

$('hdr-enabled').addEventListener('change', () => {
  configureBrightpixels({ enabled: $('hdr-enabled').checked }); refresh();
});
$('intensity').addEventListener('input', () => {
  for (const element of samples) element.intensity = Number($('intensity').value);
  $('intensity-label').textContent = `${$('intensity').value}×`; refresh();
});
$('loading').addEventListener('change', () => {
  for (const element of [ring, bar]) element.indeterminate = $('loading').checked;
  refresh();
});
$('progress').addEventListener('click', () => {
  stopMotion(); progress = progress === 85 ? 25 : 85;
  for (const element of [ring, bar]) element.value = progress;
  $('progress-label').textContent = `${progress}%`; refresh();
});
$('pulse').addEventListener('click', () => { ring.pulse(); refresh(); });
$('stop').addEventListener('click', stopMotion);
$('reset').addEventListener('click', () => {
  progress = 65; stopMotion();
  configureBrightpixels({ enabled: true, brightness: 1 });
  $('hdr-enabled').checked = true; $('intensity').value = '4';
  $('intensity').dispatchEvent(new Event('input'));
  $('progress-label').textContent = '65%'; refresh();
});
$('observations').addEventListener('submit', (event) => event.preventDefault());
$('observations').addEventListener('input', scheduleRefresh);
$('observations').addEventListener('change', scheduleRefresh);
$('refresh').addEventListener('click', refresh);
$('copy').addEventListener('click', async () => {
  const json = refresh();
  try {
    await navigator.clipboard.writeText(json);
    $('report-status').textContent = 'Diagnostic report copied.';
  } catch {
    $('report-json').focus(); $('report-json').select();
    $('report-status').textContent = 'Copy unavailable. Report selected; press Command+C or Ctrl+C.';
  }
});
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([refresh()], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = `brightpixels-hardware-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('report-status').textContent = 'Diagnostic report download requested.';
});
for (const query of Object.values(queries)) query.addEventListener('change', scheduleRefresh);
addEventListener('resize', scheduleRefresh);
document.addEventListener('brightpixelsready', scheduleRefresh);
refresh();
