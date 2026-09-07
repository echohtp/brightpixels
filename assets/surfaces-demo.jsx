import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BrightSurface from '../react-surface.js';
import { brightenSurface, createSurfaceGroup, configureBrightpixels } from '../index.js';

const palettes = {
  electric: ['#55eeff','#ff55c8'], acid: ['#d4ff64','#20ffc2'], inferno: ['#ffb845','#ff3b74'],
};

function useCompactLayout() {
  const [compact,setCompact] = useState(()=>window.matchMedia('(max-width: 700px)').matches);
  useEffect(()=>{
    const query = window.matchMedia('(max-width: 700px)');
    const update = ()=>setCompact(query.matches);
    update(); query.addEventListener('change',update);
    return ()=>query.removeEventListener('change',update);
  },[]);
  return compact;
}

function ExpansionLab({ intensity, enabled, compact }) {
  const pads = useRef([]), group = useRef(null), members = useRef([]), drawing = useRef(null), charge = useRef(null);
  const [palette,setPalette] = useState('electric'), [direction,setDirection] = useState('center');
  const [salvos,setSalvos] = useState(0), [energy,setEnergy] = useState(0), [armed,setArmed] = useState(false);
  const [tuningOpen,setTuningOpen] = useState(false), [tapped,setTapped] = useState('');
  const [color,colorEnd] = palettes[palette];
  useEffect(() => {
    members.current = pads.current.map((element,index)=>brightenSurface(element,{
      color: palettes.electric[index%2], colorEnd: palettes.electric[(index+1)%2], selected:true, intensity,
    }));
    group.current = createSurfaceGroup(members.current);
    return () => { group.current?.destroy(); for(const member of members.current)member.destroy(); };
  }, []);
  useEffect(() => {
    members.current.forEach((member,index)=>member.update({color:palettes[palette][index%2],colorEnd:palettes[palette][(index+1)%2],intensity,enabled}));
  }, [palette,intensity,enabled]);
  function fire() {
    group.current?.burst({from:direction,stagger:100});
    setTapped('');
    setSalvos(value=>value+1);
  }
  function fireCell(index,label) {
    members.current[index]?.ripple().sweep({duration:900}).flash('press');
    setTapped(`${label} lit. Tap another tile, or fire all four.`);
  }
  return <section className="expansion-lab" aria-labelledby="expansion-title">
    <div className="lab-heading"><div><p className="eyebrow">NEW / MORE THAN A HOVER EFFECT</p><h2 id="expansion-title">LIGHT THE<br/><em>WHOLE BLOCK.</em></h2></div><p>Four surfaces. One signal.<br/>Absolutely no need for this much enthusiasm.</p></div>
    <div className="lab-options">
      <button className="tuning-toggle" aria-label="Colors and direction" aria-expanded={tuningOpen} aria-controls="light-tuning" onClick={()=>setTuningOpen(!tuningOpen)}>Tune glow <span aria-hidden="true">{tuningOpen?'−':'+'}</span></button>
      <div id="light-tuning" className="light-tuning" hidden={compact&&!tuningOpen}><label>Light palette<select id="light-palette" value={palette} onChange={e=>setPalette(e.target.value)}><option value="electric">Electric / cyan + pink</option><option value="acid">Acid / lime + mint</option><option value="inferno">Inferno / amber + rose</option></select></label><label>Wave direction<select id="burst-direction" value={direction} onChange={e=>setDirection(e.target.value)}><option value="center">From the middle</option><option value="start">First to last</option><option value="end">Last to first</option></select></label></div>
      <button id="group-burst" className="primary overdrive-fire" onClick={fire}>FIRE THE WHOLE BLOCK ↗</button>
    </div>
    <div className="neon-block">{['INPUT','THOUGHT','DOUBT','OUTPUT'].map((label,index)=><button type="button" key={label} ref={el=>pads.current[index]=el} className="signal-cell" aria-label={`Light up ${label.toLowerCase()}`} onClick={()=>fireCell(index,label)}><span className="cell-number">0{index+1}</span><span className="cell-glyph" aria-hidden="true">{['↗','✳','≋','◈'][index]}</span><strong>{label}</strong><small>{['Tap detected.','Thinking, allegedly.','Quietly suppressed.','Confidence: excessive.'][index]}</small></button>)}</div>
    <p id="burst-status" className="lab-status" role="status">{tapped||(salvos?`NEON SALVO ${String(salvos).padStart(2,'0')} · Every surface got the memo.`:'Tap a tile. Or fire all four at once.')}</p>
    <div className="hands-on">
      <div className="draw-example"><div className="mini-heading"><h3>DRAW WITH LIGHT.</h3><span>TRAILS + SWEEPS</span></div>
        <BrightSurface ref={drawing} id="draw-pad" className="draw-pad" tabIndex={0} aria-label="Light drawing pad. Drag inside to draw temporary neon trails, or use the Sweep button." options={{color,colorEnd,intensity,enabled,trail:true,trailLifetime:1100,spotlight:false,press:false}}>
          <span className="pad-cross" aria-hidden="true">＋</span><strong>DRAG YOUR FINGER<br/>THROUGH THE FUTURE.</strong><span className="pad-caption">It clears itself. Unlike your browser tabs.</span>
        </BrightSurface>
        <div className="mini-actions"><button id="sweep-light" onClick={()=>drawing.current?.sweep({angle:25,duration:900})}>Sweep light ↗</button><button id="reverse-sweep" onClick={()=>drawing.current?.sweep({angle:180,duration:900})}>Reverse ←</button><button id="clear-trails" onClick={()=>drawing.current?.cancel()}>Clear</button></div>
      </div>
      <div className="charge-example"><div className="mini-heading"><h3>TURN IT UP.</h3><span>CHARGE + TOGGLES</span></div>
        <BrightSurface ref={charge} id="charge-pad" className="charge-pad" options={{color,colorEnd,intensity,enabled,charge:energy/100,selected:armed,spotlight:false}}>
          <div className="charge-readout"><output htmlFor="energy-charge">{energy}<span>%</span></output><span>VISUAL CHARGE<br/>NO ACTUAL RESPONSIBILITY</span></div>
          <label className="charge-slider">Charge the whole card<input id="energy-charge" type="range" min="0" max="100" value={energy} onChange={e=>setEnergy(Number(e.target.value))}/></label>
          <button id="arm-neon" role="switch" aria-checked={armed} className="neon-switch" onClick={()=>{setArmed(!armed);setEnergy(armed?0:100);charge.current?.sweep({angle:armed?180:0,duration:500});}}><span className="switch-track" aria-hidden="true"><span/></span>{armed?'NEON ARMED':'ARM THE NEON'}</button>
        </BrightSurface>
        <p id="charge-status" className="lab-status" role="status">{armed?'Armed. This was a lighting decision.':energy?`${energy}% charged. Your app owns the number; we add the light.`:'Slide to charge. Flip the switch to fill the container.'}</p>
      </div>
    </div>
  </section>;
}

function App() {
  const compact = useCompactLayout();
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
      <h1>LIGHT.<br/><em>EVERYTHING.</em></h1>
      <div className="intro-bottom"><p>Draw it. Charge it. Send it across the room.<br/>Your pixels have been promoted.</p><span className="edition">REAL HDR.<br/>REAL BUTTONS.<br/>QUESTIONABLE RESTRAINT.</span></div>
    </section>
    <div className="settings"><label><input id="effects-enabled" type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Effects</label><label><input id="hdr-enabled" type="checkbox" checked={hdr} onChange={e=>{setHDR(e.target.checked); configureBrightpixels({enabled:e.target.checked});}}/> HDR</label><label className="intensity">Intensity <input id="surface-intensity" type="range" min="1" max="16" value={intensity} onChange={e=>setIntensity(Number(e.target.value))}/><output>{intensity}</output></label></div>
    <ExpansionLab intensity={intensity} enabled={enabled} compact={compact}/>
    <BrightSurface ref={stage} as="section" id="touch-stage" className="touch-stage" options={{color:'#55eeff',colorEnd:'#ff55c8',intensity,enabled,selected}}>
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
