'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createConfetti } from './confetti.js';

/** React owns the lifecycle; the optional engine owns its inert viewport canvas. */
export const BrightConfetti = forwardRef(function BrightConfetti(props, ref) {
  const controller = useRef(null);
  const committedProps = useRef(props);
  useEffect(() => {
    committedProps.current = props;
    controller.current?.update(props);
  });
  useEffect(() => {
    const instance = createConfetti(committedProps.current);
    controller.current = instance;
    return () => { controller.current = null; instance.destroy(); };
  }, []);
  useImperativeHandle(ref, () => ({
    restart() { controller.current?.restart(); },
    clear() { controller.current?.clear(); },
    get activeCount() { return controller.current?.activeCount ?? 0; },
    get emittedCount() { return controller.current?.emittedCount ?? 0; },
    get mode() { return controller.current?.mode ?? null; },
    get running() { return controller.current?.running ?? false; },
  }), []);
  return null;
});

export default BrightConfetti;
