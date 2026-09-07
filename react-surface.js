'use client';

import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { brightenSurface } from './index.js';

const defaults = { color: '#55eeff', colorEnd: '', trail: false, trailLifetime: 600, charge: 0, intensity: 8, thickness: 2, radius: null, spotlightSize: 180,
  spotlight: true, ripple: true, press: true, loading: false, selected: false, enabled: true };

/** A normal container in server markup; React owns its light's lifetime. */
export const BrightSurface = forwardRef(function BrightSurface({ as = 'div', options, children, ...attributes }, ref) {
  const host = useRef(null), controller = useRef(null), committedOptions = useRef(options);
  useEffect(() => {
    committedOptions.current = options;
    controller.current?.update({ ...defaults, ...options });
  }, [options]);
  useEffect(() => {
    const instance = brightenSurface(host.current, committedOptions.current);
    controller.current = instance;
    return () => { controller.current = null; instance.destroy(); };
  }, [as]);
  useImperativeHandle(ref, () => ({
    flash(kind) { controller.current?.flash(kind); },
    ripple(origin) { controller.current?.ripple(origin); },
    sweep(options) { controller.current?.sweep(options); },
    setCharge(value = 0) { controller.current?.setCharge(value); },
    setLoading(value = true) { controller.current?.setLoading(value); },
    select(value = true) { controller.current?.select(value); },
    cancel() { controller.current?.cancel(); },
    get target() { return host.current; },
    get controller() { return controller.current; },
  }), []);
  return createElement(as, { ...attributes, ref: host }, children);
});

export default BrightSurface;
