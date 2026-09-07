import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BrightSurface from '../react-surface.js';
import { brightenSurface, configureBrightpixels } from '../index.js';

function App() {
  const stage = useRef(null), receive = useRef(null), send = useRef(null), loader = useRef(null);
  const [intensity,setIntensity] = useState(10), [hdr,setHDR] = useState(true), [enabled,setEnabled] = useState(true);
  const [loading,setLoading] = useState(false), [selected,setSelected] = useState(false), [status,setStatus] = useState('Go on. Touch it.');
  const [signal,setSignal] = useState('Waiting for a highly important button.');
  const [tab,setTab] = useState('vanilla');
  useEffect(() => {
    const light = brightenSurface(receive.current, { color: '#ff55c8', intensity });
    const unlink = light.link(send.current, { kind: 'notify' });
    return () => { unlink(); light.destroy(); };
  }, []);
  useEffect(() => { brightenSurface(receive.current).update({ intensity, enabled }); }, [intensity,enabled]);
  function outcome(kind, text) { stage.current?.flash(kind); setStatus(text); }
  return <>
    <section className="intro">
      <p className="eyebrow"><span className="signal-dot"/> BRIGHTPIXELS 1.3 / INTERACTIVE SURFACES</p>
      <h1>TOUCH<br/><em>SOMETHING<br/>BRIGHT.</em></h1>
      <div className="intro-bottom"><p>One small press.<br/>An unreasonable amount of light.</p><span className="edition">REAL HDR.<br/>REAL BUTTONS.<br/>QUESTIONABLE RESTRAINT.</span></div>
    </section>
    <div className="settings"><label><input id="effects-enabled" type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Effects</label><label><input id="hdr-enabled" type="checkbox" checked={hdr} onChange={e=>{setHDR(e.target.checked); configureBrightpixels({enabled:e.target.checked});}}/> HDR</label><label className="intensity">Intensity <input id="surface-intensity" type="range" min="1" max="16" value={intensity} onChange={e=>setIntensity(Number(e.target.value))}/><output>{intensity}</output></label></div>
    <BrightSurface ref={stage} as="section" id="touch-stage" className="touch-stage" options={{color:'#55eeff',intensity,enabled,selected}}>
      <div className="stage-top"><span>01 / THE WHOLE SURFACE RESPONDS</span><span>MOVE · PRESS · RELEASE</span></div>
      <div className="stage-center"><div className="orbit" aria-hidden="true"><span>↗</span></div><h2>A LITTLE BUTTON.<br/><em>A BIG REACTION.</em></h2><p>Move your cursor over this panel. On a phone, press anywhere.<br/>The light starts right beneath your finger.</p></div>
      <div className="stage-actions"><button id="success" className="primary" onClick={()=>outcome('success','Approved. The machine is feeling generous.')}>APPROVE SOMETHING ↗</button><button id="error" onClick={()=>outcome('error','Denied. Have you tried being more profitable?')}>Try rejection</button><button id="select" aria-pressed={selected} onClick={()=>{setSelected(!selected);setStatus(selected?'Selection cleared.':'Selected. A lasting impression.');}}>{selected?'Deselect':'Keep the glow'}</button></div>
      <p id="surface-status" className="status" role="status">{status}</p>
    </BrightSurface>
    <section className="connections">
      <div className="send"><p className="eyebrow">02 / CONNECTED GLOW</p><h2>PRESS HERE.<br/><em>LIGHT THERE.</em></h2><p>Link any button to another container.<br/>Distance is a CSS problem.</p><button id="send-signal" ref={send} className="pink" onClick={()=>setSignal('Signal received. Your click has been escalated.')}>SEND A SIGNAL →</button></div>
      <article id="receiver" ref={receive} className="receiver"><span>REMOTE CONTAINER / LISTENING</span><div className="receiver-mark" aria-hidden="true">(( • ))</div><h3>Message received<br/>in full neon.</h3><p id="signal-status" role="status">{signal}</p></article>
    </section>
    <BrightSurface ref={loader} as="section" id="loading-stage" className="loading-stage" options={{color:'#d4ff64',intensity,enabled,loading,spotlight:false}}>
      <div><p className="eyebrow">03 / TRAVELLING EDGE LIGHT</p><h2>{loading?'BUSY LOOKING BUSY.':'WAITING, BUT BRIGHTER.'}</h2><p id="loading-status" role="status">{loading?'Light travels around the border while your app works.':'A border that knows when something is happening.'}</p></div>
      <button id="loading-toggle" className="lime" onClick={()=>{setLoading(!loading);if(loading) loader.current?.flash('success');}}>{loading?'COMPLETE ✓':'START LOADING ↗'}</button>
    </BrightSurface>
    <section className="code-section"><div><p className="eyebrow">04 / YOUR MARKUP. MORE LIGHT.</p><h2>JUST ADD<br/><em>BRIGHTPIXELS.</em></h2><p>Your layout, controls and click handlers stay yours.</p><div className="code-tabs" role="group" aria-label="Code language"><button aria-pressed={tab==='vanilla'} onClick={()=>setTab('vanilla')}>JavaScript</button><button aria-pressed={tab==='react'} onClick={()=>setTab('react')}>React</button></div></div><pre><code>{tab==='vanilla'?`import { brightenSurface } from 'brightpixels';\n\nconst glow = brightenSurface(card, {\n  color: '#55eeff',\n  intensity: 10,\n});\n\nglow.setLoading(true);\n// When your action finishes:\nglow.setLoading(false).flash('success');\n\nglow.destroy(); // Clean up when you're done.`:`import BrightSurface from\n  'brightpixels/react-surface';\n\n<BrightSurface\n  as="section"\n  options={{ intensity: 10, loading }}\n>\n  <button onClick={save}>Save</button>\n</BrightSurface>`}</code></pre></section>
    <p className="support-note">HDR light on compatible browsers and displays. Neon canvas fallback elsewhere. Reduced motion keeps a steady highlight and brief feedback. <a href="https://github.com/echohtp/brightpixels#interactive-surfaces">Full API ↗</a></p>
  </>;
}
createRoot(document.getElementById('surfaces-app')).render(<App/>);
