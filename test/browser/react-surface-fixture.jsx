import React, { StrictMode, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import BrightSurface from '../../react-surface.js';
const root=createRoot(document.getElementById('root'));
window.surfaceRef=createRef(); window.actions=0;
window.renderSurface=(options={},as='section')=>root.render(<StrictMode><BrightSurface ref={window.surfaceRef} as={as} options={options} style={{width:300,height:220}}><button id="react-action" onClick={()=>window.actions++}>Action</button></BrightSurface></StrictMode>);
window.unmountSurface=()=>root.render(null);
