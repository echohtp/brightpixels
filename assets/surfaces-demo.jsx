import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import BrightSurface from '../react-surface.js';
import { brightenSurface, createSurfaceGroup, configureBrightpixels, version } from '../index.js';

const palettes = {
  electric: ['#55eeff','#ff55c8'], acid: ['#d4ff64','#20ffc2'], inferno: ['#ffb845','#ff3b74'],
};
const demos = [{id:'burst',label:'Burst'},{id:'draw',label:'Draw & charge'},{id:'feedback',label:'Feedback'}];
const demoFromHash = () => demos.some(demo=>demo.id===location.hash.slice(1)) ? location.hash.slice(1) : 'burst';

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

function ExpansionLab({ intensity, enabled, compact, active }) {
  const pads = useRef([]), group = useRef(null), members = useRef([]), drawing = useRef(null), charge = useRef(null);
  const [palette,setPalette] = useState('electric'), [direction,setDirection] = useState('center');
  const [salvos,setSalvos] = useState(0), [energy,setEnergy] = useState(0), [armed,setArmed] = useState(false);
  const [tuningOpen,setTuningOpen] = useState(false), [tapped,setTapped] = useState('');
  const [color,colorEnd] = palettes[palette];
  useEffect(() => {
    members.current = pads.current.map((element,index)=>brightenSurface(element,{
      color: palettes.electric[index%2], colorEnd: palettes.electric[(index+1)%2], selected:true, intensity, enabled:enabled&&active==='burst',
    }));
    group.current = createSurfaceGroup(members.current);
    return () => { group.current?.destroy(); for(const member of members.current)member.destroy(); };
  }, []);
  useEffect(() => {
    group.current?.cancel();
    members.current.forEach((member,index)=>member.update({color:palettes[palette][index%2],colorEnd:palettes[palette][(index+1)%2],intensity,enabled:enabled&&active==='burst'}));
  }, [palette,intensity,enabled,active]);
  function fire() {
    group.current?.burst({from:direction,stagger:100});
    setTapped('');
    setSalvos(value=>value+1);
  }
  function fireCell(index,label) {
    members.current[index]?.ripple().sweep({duration:900}).flash('press');
    setTapped(`${label} lit. Tap another tile, or fire all four.`);
  }
  return <section className="expansion-lab" hidden={active==='feedback'} aria-label={active==='draw'?'Draw and charge':'Coordinated bursts'}>
    <div className="burst-example" hidden={active!=='burst'}>
    <div className="lab-heading"><h2 id="expansion-title">LIGHT THE <em>WHOLE BLOCK.</em></h2><p>One tap. Four opinions.</p></div>
    <div className="lab-options">
      <button className="tuning-toggle" aria-label="Colors and direction" aria-expanded={tuningOpen} aria-controls="light-tuning" onClick={()=>setTuningOpen(!tuningOpen)}>Tune glow <span aria-hidden="true">{tuningOpen?'−':'+'}</span></button>
      <div id="light-tuning" className="light-tuning" hidden={compact&&!tuningOpen}><label>Light palette<select id="light-palette" value={palette} onChange={e=>setPalette(e.target.value)}><option value="electric">Electric / cyan + pink</option><option value="acid">Acid / lime + mint</option><option value="inferno">Inferno / amber + rose</option></select></label><label>Wave direction<select id="burst-direction" value={direction} onChange={e=>setDirection(e.target.value)}><option value="center">From the middle</option><option value="start">First to last</option><option value="end">Last to first</option></select></label></div>
      <button id="group-burst" className="primary overdrive-fire" onClick={fire}>FIRE THE WHOLE BLOCK ↗</button>
    </div>
    <div className="neon-block">{['INPUT','THOUGHT','DOUBT','OUTPUT'].map((label,index)=><button type="button" key={label} ref={el=>pads.current[index]=el} className="signal-cell" aria-label={`Light up ${label.toLowerCase()}`} onClick={()=>fireCell(index,label)}><span className="cell-number">0{index+1}</span><span className="cell-glyph" aria-hidden="true">{['↗','✳','≋','◈'][index]}</span><strong>{label}</strong><small>{['Tap detected.','Thinking, allegedly.','Quietly suppressed.','Confidence: excessive.'][index]}</small></button>)}</div>
    <p id="burst-status" className="lab-status" role="status">{tapped||(salvos?`NEON SALVO ${String(salvos).padStart(2,'0')} · Every surface got the memo.`:'Tap a tile. Or fire all four at once.')}</p>
    </div>
    <div className="hands-on" hidden={active!=='draw'}>
      <div className="draw-example"><div className="mini-heading"><h3>DRAW WITH LIGHT.</h3><span>TRAILS + SWEEPS</span></div>
        <BrightSurface ref={drawing} id="draw-pad" className="draw-pad" tabIndex={0} aria-label="Light drawing pad. Drag inside to draw temporary neon trails, or use the Sweep button." options={{color,colorEnd,intensity,enabled:enabled&&active==='draw',trail:true,trailLifetime:1100,spotlight:false,press:false}}>
          <span className="pad-cross" aria-hidden="true">＋</span><strong>DRAG YOUR FINGER<br/>THROUGH THE FUTURE.</strong><span className="pad-caption">It clears itself. Unlike your browser tabs.</span>
        </BrightSurface>
        <div className="mini-actions"><button id="sweep-light" onClick={()=>drawing.current?.sweep({angle:25,duration:900})}>Sweep light ↗</button><button id="reverse-sweep" onClick={()=>drawing.current?.sweep({angle:180,duration:900})}>Reverse ←</button><button id="clear-trails" onClick={()=>drawing.current?.cancel()}>Clear</button></div>
      </div>
      <div className="charge-example"><div className="mini-heading"><h3>TURN IT UP.</h3><span>CHARGE + TOGGLES</span></div>
        <BrightSurface ref={charge} id="charge-pad" className="charge-pad" options={{color,colorEnd,intensity,enabled:enabled&&active==='draw',charge:energy/100,selected:armed,spotlight:false}}>
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
  const [active,setActive] = useState(demoFromHash);
  const stage = useRef(null), receive = useRef(null), send = useRef(null), loader = useRef(null);
  const [intensity,setIntensity] = useState(10), [hdr,setHDR] = useState(true), [enabled,setEnabled] = useState(true);
  const [loading,setLoading] = useState(false), [selected,setSelected] = useState(false), [status,setStatus] = useState('Go on. Touch it.');
  const [signal,setSignal] = useState('Waiting for a highly important button.');
  const [tab,setTab] = useState('vanilla');
  useEffect(() => {
    const light = brightenSurface(receive.current, { color: '#ff55c8', intensity, enabled:enabled&&active==='feedback' });
    const unlink = light.link(send.current, { kind: 'notify' });
    return () => { unlink(); light.destroy(); };
  }, []);
  useEffect(() => { brightenSurface(receive.current).update({ intensity, enabled:enabled&&active==='feedback' }); }, [intensity,enabled,active]);
  useEffect(()=>{
    const navigate=()=>setActive(demoFromHash());
    window.addEventListener('hashchange',navigate);
    return ()=>window.removeEventListener('hashchange',navigate);
  },[]);
  function chooseDemo(id) {
    setActive(id);
    history.replaceState(null,'',`#${id}`);
  }
  function moveTab(event,index) {
    const next = event.key==='Home'?0:event.key==='End'?demos.length-1:event.key==='ArrowRight'?(index+1)%demos.length:event.key==='ArrowLeft'?(index+demos.length-1)%demos.length:null;
    if(next===null)return;
    event.preventDefault(); chooseDemo(demos[next].id);
    document.getElementById(`demo-${demos[next].id}`).focus();
  }
  function outcome(kind, text) { stage.current?.flash(kind); setStatus(text); }
  return <>
    <section className="intro">
      <p className="eyebrow"><span className="signal-dot"/> BRIGHTPIXELS {version} / SURFACE LAB</p>
      <h1>LIGHT. <em>EVERYTHING.</em></h1>
      <div className="intro-bottom"><p>Pick an effect. Touch something.</p></div>
    </section>
    <div className="settings"><label><input id="effects-enabled" type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Effects</label><label><input id="hdr-enabled" type="checkbox" checked={hdr} onChange={e=>{setHDR(e.target.checked); configureBrightpixels({enabled:e.target.checked});}}/> HDR</label><label className="intensity">Intensity <input id="surface-intensity" type="range" min="1" max="16" value={intensity} onChange={e=>setIntensity(Number(e.target.value))}/><output>{intensity}</output></label></div>
    <div className="demo-tabs" role="tablist" aria-label="Surface demos">{demos.map((demo,index)=><button key={demo.id} role="tab" id={`demo-${demo.id}`} aria-controls="surface-panel" aria-selected={active===demo.id} tabIndex={active===demo.id?0:-1} onClick={()=>chooseDemo(demo.id)} onKeyDown={event=>moveTab(event,index)}>{demo.label}</button>)}</div>
    <div id="surface-panel" role="tabpanel" aria-labelledby={`demo-${active}`}>
    <ExpansionLab intensity={intensity} enabled={enabled} compact={compact} active={active}/>
    <section className="feedback-gallery" hidden={active!=='feedback'} aria-label="Press, connected glow and loading">
    <BrightSurface ref={stage} as="section" id="touch-stage" className="touch-stage" options={{color:'#55eeff',colorEnd:'#ff55c8',intensity,enabled:enabled&&active==='feedback',selected}}>
      <div className="stage-top"><span>PRESS + OUTCOMES</span></div>
      <div className="stage-center"><h2>A LITTLE BUTTON.<br/><em>A BIG REACTION.</em></h2><p>Press anywhere. The whole card responds.</p></div>
      <div className="stage-actions"><button id="success" className="primary" onClick={()=>outcome('success','Approved. The machine is feeling generous.')}>APPROVE SOMETHING ↗</button><button id="error" onClick={()=>outcome('error','Denied. Have you tried being more profitable?')}>Try rejection</button><button id="select" aria-pressed={selected} onClick={()=>{setSelected(!selected);setStatus(selected?'Selection cleared.':'Selected. A lasting impression.');}}>{selected?'Deselect':'Keep the glow'}</button></div>
      <p id="surface-status" className="status" role="status">{status}</p>
    </BrightSurface>
    <section className="connections">
      <div className="send"><p className="eyebrow">CONNECTED GLOW</p><h2>PRESS HERE. <em>LIGHT THERE.</em></h2><button id="send-signal" ref={send} className="pink" onClick={()=>setSignal('Signal received. Your click has been escalated.')}>SEND A SIGNAL →</button></div>
      <article id="receiver" ref={receive} className="receiver"><span>RECEIVER</span><div className="receiver-mark" aria-hidden="true">(( • ))</div><p id="signal-status" role="status">{signal}</p></article>
    </section>
    <BrightSurface ref={loader} as="section" id="loading-stage" className="loading-stage" options={{color:'#d4ff64',intensity,enabled:enabled&&active==='feedback',loading,spotlight:false}}>
      <div><h2>{loading?'BUSY LOOKING BUSY.':'LOADING, BUT BRIGHTER.'}</h2><p id="loading-status" role="status">{loading?'Your app works. The border circulates.':'Start a travelling edge light.'}</p></div>
      <button id="loading-toggle" className="lime" onClick={()=>{setLoading(!loading);if(loading) loader.current?.flash('success');}}>{loading?'COMPLETE ✓':'START LOADING ↗'}</button>
    </BrightSurface>
    </section>
    </div>
    <details className="code-disclosure"><summary>Use it in your project <span>JavaScript / React</span></summary><section className="code-section"><div><p>Your markup. More light.</p><div className="code-tabs" role="group" aria-label="Code language"><button aria-pressed={tab==='vanilla'} onClick={()=>setTab('vanilla')}>JavaScript</button><button aria-pressed={tab==='react'} onClick={()=>setTab('react')}>React</button></div></div><pre><code>{tab==='vanilla'?`import { brightenSurface } from 'brightpixels';\n\nconst glow = brightenSurface(card, {\n  color: '#55eeff', intensity: 10,\n  trail: true, colorEnd: '#ff55c8',\n});\n\nglow.sweep();\nglow.setCharge(0.65);\n\nglow.destroy(); // Clean up on removal.`:`import BrightSurface from\n  'brightpixels/react-surface';\n\n<BrightSurface\n  as="section"\n  options={{ intensity: 10, loading }}\n>\n  <button onClick={save}>Save</button>\n</BrightSurface>`}</code></pre></section></details>
    <p className="support-note">HDR on compatible displays. Neon fallback elsewhere. Reduced motion respected. <a href="https://github.com/echohtp/brightpixels#interactive-surfaces">Full API ↗</a></p>
  </>;
}
createRoot(document.getElementById('surfaces-app')).render(<App/>);
