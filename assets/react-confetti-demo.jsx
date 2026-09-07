import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BrightConfetti from '../react-confetti.js';
import { configureBrightpixels, version } from '../index.js';

function App() {
  const confetti = useRef(null);
  const [mounted, setMounted] = useState(true), [run, setRun] = useState(true), [recycle, setRecycle] = useState(false);
  const [count, setCount] = useState(200), [intensity, setIntensity] = useState(8), [wind, setWind] = useState(0);
  const [shape, setShape] = useState('confetti'), [source, setSource] = useState(undefined);
  const [mode, setMode] = useState('Connecting'), [status, setStatus] = useState('Preparing a responsible quantity of confetti.');
  function restart() {
    if (!mounted) { setMounted(true); setRun(true); }
    else { setRun(true); confetti.current?.restart(); }
    setStatus('Celebration in progress. Productivity remains unverified.');
  }
  return <>
    {mounted && <BrightConfetti ref={confetti} numberOfPieces={count} recycle={recycle} run={run}
      intensity={intensity} wind={wind} shape={shape} confettiSource={source}
      initialVelocityY={source ? { min: -13, max: -8 } : 4}
      onReady={engine => setMode(engine.mode)}
      onConfettiComplete={engine => setStatus(engine.emittedCount + ' pieces. Celebration complete.')} />}
    <section className="confetti-panel">
      <div className="confetti-controls">
        <p className="eyebrow">Brightpixels {version} / React confetti</p>
        <h1>MAKE IT <em>RAIN.</em></h1>
        <p className="lead">Real HDR confetti. Questionable restraint.</p>
        <div className="confetti-actions">
          <button id="confetti-restart" className="confetti-primary" onClick={restart}>MAKE IT RAIN ↗</button>
          <button id="confetti-pause" onClick={() => setRun(value => !value)} disabled={!mounted}>{run ? 'Pause' : 'Resume'}</button>
          <button id="confetti-clear" onClick={() => { confetti.current?.clear(); setStatus('Cleared. The pixels have returned to work.'); }}>Clear</button>
        </div>
        <details className="confetti-tuning"><summary>Tune the confetti</summary><div className="confetti-options">
          <label>Pieces <output>{count}</output><input id="confetti-count" type="range" min="12" max="1000" step="1" value={count} onChange={event => setCount(Number(event.target.value))}/></label>
          <label>HDR intensity <output>{intensity}</output><input id="confetti-intensity" type="range" min="1" max="16" value={intensity} onChange={event => setIntensity(Number(event.target.value))}/></label>
          <label>Wind <output>{wind.toFixed(2)}</output><input id="confetti-wind" type="range" min="-.1" max=".1" step=".01" value={wind} onChange={event => setWind(Number(event.target.value))}/></label>
          <label>Pieces look like<select id="confetti-shape" value={shape} onChange={event => setShape(event.target.value)}><option value="confetti">Tumbling paper</option><option value="spark">Neon sparks</option><option value="dot">Glowing dots</option></select></label>
          <label>Launch from<select id="confetti-source" onChange={event => setSource(event.target.value === 'rain' ? undefined : { x: innerWidth / 2 - 30, y: innerHeight * .8, w: 60, h: 0 })}><option value="rain">Across the sky</option><option value="cannon">Center cannon</option></select></label>
          <label className="confetti-check"><input id="confetti-recycle" type="checkbox" checked={recycle} onChange={event => setRecycle(event.target.checked)}/> Keep it raining</label>
          <label className="confetti-check"><input id="confetti-hdr" type="checkbox" defaultChecked onChange={event => configureBrightpixels({ enabled: event.target.checked })}/> Enable HDR</label>
          <label className="confetti-check"><input id="confetti-mount" type="checkbox" checked={mounted} onChange={event => { setMounted(event.target.checked); setStatus(event.target.checked ? 'Component mounted.' : 'Component unmounted. Canvas and listeners removed.'); }}/> Mount React component</label>
        </div></details>
      </div>
      <aside className="confetti-preview">
        <span className="confetti-signal">RENDERER / {mode.toUpperCase()}</span>
        <p className="confetti-big">200%<br/><span>UNNECESSARY.</span></p>
        <p id="confetti-status" role="status">{status}</p>
        <p className="note">HDR where supported. Neon fallback elsewhere. Reduced motion gives a quiet sparkle.</p>
      </aside>
    </section>
    <details className="confetti-code"><summary>Use it in React</summary>
      <pre><code>{'import BrightConfetti from "brightpixels/react-confetti";\n\n<BrightConfetti\n  numberOfPieces={200}\n  recycle={false}\n  intensity={8}\n  onConfettiComplete={() => setCelebrating(false)}\n/>'}</code></pre>
      <p>React 18 or 19. Automatic viewport sizing. <a href="https://github.com/echohtp/brightpixels#confetti-and-react">Full API ↗</a></p>
      <p>Settings affect newly emitted pieces; restart to apply them to a fresh batch. Fallback caps live particles at 256. Physical brightness depends on your display, browser and settings.</p>
    </details>
  </>;
}
createRoot(document.getElementById('confetti-app')).render(<App/>);
