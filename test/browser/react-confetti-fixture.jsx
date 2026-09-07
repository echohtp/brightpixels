import React, { StrictMode, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import BrightConfetti from '../../react-confetti.js';
import { createConfetti } from '../../confetti.js';
import { configureBrightpixels } from '../../index.js';

const root = createRoot(document.getElementById('root'));
window.confettiRef = createRef();
window.readyCalls = 0; window.completeCalls = 0; window.instances = [];
let options = {};
window.renderConfetti = next => {
  options = { ...options, ...next };
  root.render(<StrictMode><BrightConfetti ref={window.confettiRef} {...options}
    onReady={controller => { window.readyCalls++; window.instances.push(controller); }}
    onConfettiComplete={() => window.completeCalls++}/></StrictMode>);
};
window.unmountConfetti = () => root.render(null);
window.createConfetti = createConfetti;
window.configureBrightpixels = configureBrightpixels;
