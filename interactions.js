// Optional orchestration helpers. Importing this module creates no browser resources.
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const actionOwners = new WeakMap();
const browser = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('Interactions require a browser document.');
};
const visible = target => target?.isConnected && !target.closest('[hidden], [inert]') && target.getClientRects().length > 0 && getComputedStyle(target).visibility !== 'hidden';
const available = target => visible(target) && !target.matches(':disabled, [aria-disabled="true"]') && !document.hidden;
function element(target) {
  browser();
  if (!(target instanceof HTMLElement) || !target.isConnected) throw new TypeError('Expected a connected HTML element.');
}
function surface(light) {
  if (!light || typeof light.setLoading !== 'function' || typeof light.flash !== 'function' || !light.target) throw new TypeError('Expected a surface controller.');
}
function listen(removers, target, type, callback, options) {
  target.addEventListener(type, callback, options);
  removers.push(() => target.removeEventListener(type, callback, options));
}
function lifecycle(cancel, targets, signal) {
  const removers = [];
  for (const event of ['blur', 'pagehide', 'resize']) listen(removers, window, event, cancel);
  listen(removers, document, 'scroll', cancel, true);
  listen(removers, document, 'visibilitychange', () => { if (document.hidden) cancel(); });
  if (signal) listen(removers, signal, 'abort', cancel, { once: true });
  const observer = new MutationObserver(records => {
    // Ignore ordinary text/canvas updates; only inspect layout after an ancestor moves.
    const moved = records.some(record => [...record.removedNodes, ...record.addedNodes].some(node => targets.some(target => node === target || node.contains(target))));
    if (moved && targets.some(target => !available(target))) cancel();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const ancestors = new Set();
  for (const target of targets) for (let node = target; node; node = node.parentElement) ancestors.add(node);
  const attributes = new MutationObserver(() => { if (targets.some(target => !available(target))) cancel(); });
  for (const node of ancestors) attributes.observe(node, { attributes: true, attributeFilter: ['hidden', 'inert', 'disabled', 'aria-disabled', 'style', 'class'] });
  return () => { observer.disconnect(); attributes.disconnect(); for (const remove of removers) remove(); };
}

/** Follow a promise without changing its result or invoking the application action. */
export function trackAction(light, promise, options = {}) {
  browser(); surface(light);
  if (!promise || typeof promise.then !== 'function') throw new TypeError('trackAction expects a promise. Start the action in your app.');
  actionOwners.get(light)?.();
  let active = !options.signal?.aborted && available(light.target);
  let remove = () => {};
  const release = () => {
    if (!active) return;
    active = false; remove();
    if (actionOwners.get(light) === release) { actionOwners.delete(light); light.setLoading(false); }
  };
  if (active) {
    actionOwners.set(light, release);
    light.setLoading(true);
    remove = lifecycle(release, [light.target], options.signal);
  }
  const finish = kind => {
    const show = active && available(light.target);
    release();
    if (show && kind !== false) light.flash(kind);
  };
  return Promise.resolve(promise).then(value => {
    finish(options.success ?? 'success'); return value;
  }, error => {
    finish(error?.name === 'AbortError' ? false : (options.error ?? 'error')); throw error;
  });
}

function binding(target, options, setup) {
  element(target);
  if (options.surface) surface(options.surface);
  let destroyed = false, progress = 0, active = false, removeActive = () => {};
  const removers = [];
  const light = options.surface;
  const set = value => {
    progress = clamp(value, 0, 1, 0);
    light?.setCharge(progress); options.onProgress?.(progress);
  };
  const end = (completed = false) => {
    if (!active) return;
    active = false; removeActive(); removeActive = () => {};
    controller.stop?.();
    const value = progress;
    set(0);
    if (completed) options.onComplete?.(value);
    else options.onCancel?.();
  };
  const start = () => {
    if (destroyed || active || options.signal?.aborted || !available(target)) return false;
    active = true;
    removeActive = lifecycle(() => end(), [target, ...(light ? [light.target] : [])], options.signal);
    return true;
  };
  const controller = {
    get active() { return active; }, get progress() { return progress; },
    cancel() { end(); return controller; },
    destroy() { if (destroyed) return; destroyed = true; end(); for (const remove of removers) remove(); },
  };
  const on = (node, event, callback, opts) => listen(removers, node, event, callback, opts);
  setup({ on, set, start, end, controller, isActive: () => active, canUse: () => !destroyed && !options.signal?.aborted && available(target) });
  on(target, 'keydown', event => { if (event.key === 'Escape' && active) { event.preventDefault(); end(); } });
  if (options.signal) on(options.signal, 'abort', () => controller.destroy(), { once: true });
  if (options.signal?.aborted) controller.destroy();
  return controller;
}

/** Hold a native button, then release at full charge. Assistive click activates directly. */
export function bindHold(target, options = {}) {
  element(target);
  if (target.localName !== 'button') throw new TypeError('bindHold expects a native button.');
  const duration = clamp(options.duration, 150, 5000, 700);
  const tolerance = clamp(options.tolerance, 4, 100, 18);
  return binding(target, options, ({ on, set, start, end, controller, isActive, canUse }) => {
    let frame = 0, pointer = null, key = null, x = 0, y = 0, began = 0;
    controller.stop = () => {
      cancelAnimationFrame(frame); frame = 0;
      const captured = pointer; pointer = null; key = null;
      if (captured !== null && target.hasPointerCapture(captured)) target.releasePointerCapture(captured);
    };
    const tick = now => {
      frame = 0;
      if (!isActive()) return;
      if (!canUse()) { end(); return; }
      set((now - began) / duration);
      if (isActive() && controller.progress < 1) frame = requestAnimationFrame(tick);
    };
    const begin = () => { began = performance.now(); set(0); frame = requestAnimationFrame(tick); };
    const finish = () => end(canUse() && controller.progress >= 1);
    on(target, 'pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !start()) return;
      pointer = event.pointerId; x = event.clientX; y = event.clientY;
      try { target.setPointerCapture(pointer); } catch { /* Synthetic pointer events need no capture. */ }
      begin();
    });
    on(window, 'pointermove', event => { if (event.pointerId === pointer && Math.hypot(event.clientX - x, event.clientY - y) > tolerance) end(); }, { passive: true });
    on(window, 'pointerup', event => { if (event.pointerId === pointer) finish(); });
    on(window, 'pointercancel', event => { if (event.pointerId === pointer) end(); });
    on(target, 'lostpointercapture', event => { if (event.pointerId === pointer) end(); });
    on(target, 'keydown', event => {
      if (![' ', 'Enter'].includes(event.key) || event.target !== target) return;
      event.preventDefault();
      if (!event.repeat && start()) { key = event.key; begin(); }
    });
    on(target, 'keyup', event => { if (event.key === key) { event.preventDefault(); finish(); } });
    on(target, 'blur', () => end());
    on(target, 'click', event => {
      if (event.detail === 0 && canUse() && !isActive() && start()) { set(1); end(true); }
    });
  });
}

/** Swipe a native range to its maximum and release; partial gestures reset. */
export function bindSwipe(target, options = {}) {
  element(target);
  if (target.localName !== 'input' || target.type !== 'range') throw new TypeError('bindSwipe expects an input[type="range"].');
  return binding(target, options, ({ on, set, start, end, controller, isActive }) => {
    let keyboard = false;
    const minimum = () => Number(target.min || 0);
    const read = () => (target.valueAsNumber - minimum()) / Math.max(1, Number(target.max || 100) - minimum());
    controller.stop = () => { keyboard = false; target.value = String(minimum()); };
    on(target, 'pointerdown', () => { if (keyboard) end(); keyboard = false; });
    on(target, 'keydown', event => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)) keyboard = true;
      if (event.key === 'Enter' && isActive()) { event.preventDefault(); end(read() >= 1); }
    });
    on(target, 'input', () => { if (isActive() || start()) set(read()); });
    on(target, 'change', () => { if (isActive() && !keyboard) end(available(target) && read() >= 1); });
    on(target, 'pointercancel', () => end());
    on(target, 'blur', () => end());
  });
}

/** Drag within an existing focusable region. Arrow keys step by 10%; Home/End set bounds. */
export function bindDrag(target, options = {}) {
  const axis = options.axis === 'y' ? 'y' : 'x';
  const previousAction = target?.style?.getPropertyValue('touch-action') || '';
  const previousPriority = target?.style?.getPropertyPriority('touch-action') || '';
  const touchAction = axis === 'x' ? 'pan-y' : 'pan-x';
  const result = binding(target, options, ({ on, set, start, end, controller, isActive }) => {
    let pointer = null;
    controller.stop = () => {
      const captured = pointer; pointer = null;
      if (captured !== null && target.hasPointerCapture(captured)) target.releasePointerCapture(captured);
    };
    const move = event => {
      const rect = target.getBoundingClientRect();
      set(axis === 'x' ? (event.clientX - rect.left) / Math.max(1, rect.width) : (event.clientY - rect.top) / Math.max(1, rect.height));
    };
    on(target, 'pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !start()) return;
      pointer = event.pointerId;
      try { target.setPointerCapture(pointer); } catch { /* Synthetic event. */ }
      move(event);
    });
    on(window, 'pointermove', event => { if (event.pointerId === pointer && isActive()) move(event); }, { passive: true });
    on(window, 'pointerup', event => { if (event.pointerId === pointer) { move(event); end(true); } });
    on(window, 'pointercancel', event => { if (event.pointerId === pointer) end(); });
    on(target, 'lostpointercapture', event => { if (event.pointerId === pointer) end(); });
    on(target, 'keydown', event => {
      if (event.target !== target || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (isActive() || start()) set(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : controller.progress + (['ArrowRight','ArrowDown'].includes(event.key) ? .1 : -.1));
    });
    on(target, 'keydown', event => { if (event.key === 'Enter' && isActive()) { event.preventDefault(); end(true); } });
    on(target, 'blur', () => end());
  });
  if (!options.signal?.aborted) target.style.setProperty('touch-action', touchAction);
  const destroy = result.destroy;
  result.destroy = () => {
    destroy();
    if (target.style.getPropertyValue('touch-action') === touchAction) {
      if (previousAction) target.style.setProperty('touch-action', previousAction, previousPriority);
      else target.style.removeProperty('touch-action');
    }
  };
  return result;
}

/** Replay a finite list of light effects. No callbacks or application actions are scheduled. */
export function createEffectSequence(steps) {
  browser();
  if (!Array.isArray(steps) || !steps.length || steps.length > 64) throw new TypeError('A sequence needs 1–64 effect steps.');
  const supported = ['wait','charge','sweep','flash','ripple','group','particles'];
  const normalized = steps.map(step => {
    if (!step || !supported.includes(step.effect)) throw new TypeError('Unknown sequence effect.');
    if (['charge','sweep','flash','ripple'].includes(step.effect)) surface(step.surface);
    if (step.effect === 'group' && typeof step.group?.burst !== 'function') throw new TypeError('Expected a surface group.');
    if (step.effect === 'particles') { if (!(step.target instanceof Element) || !step.target.isConnected) throw new TypeError('Expected a connected emitter element.'); if (typeof step.engine?.burstFrom !== 'function') throw new TypeError('Expected a particle engine.'); }
    const fallback = step.effect === 'charge' ? 400 : step.effect === 'sweep' ? 500 : step.effect === 'wait' ? 100 : 0;
    return { ...step, options: { ...step.options }, duration: clamp(step.duration, 0, 5000, fallback) };
  });
  if (normalized.reduce((total, step) => total + step.duration, 0) > 30000) throw new RangeError('Sequences are limited to 30 seconds.');
  let current = null, destroyed = false;
  const controller = {
    get running() { return current !== null; },
    play({ signal } = {}) {
      controller.cancel();
      if (destroyed || signal?.aborted || document.hidden) return Promise.resolve('cancelled');
      const targets = [...new Set(normalized.flatMap(step => step.surface ? [step.surface.target] : step.target ? [step.target] : []))];
      if (targets.some(target => !available(target))) return Promise.resolve('cancelled');
      let settle, reject, timer = 0, frame = 0, cleanup = () => {}, finished = false;
      const touched = new Set(), groups = new Set(), charges = new Map();
      const promise = new Promise((resolve, fail) => { settle = resolve; reject = fail; });
      const finish = (status, error) => {
        if (finished) return;
        finished = true; clearTimeout(timer); cancelAnimationFrame(frame); cleanup();
        if (status !== 'completed') {
          const attempts = [...groups].map(group => () => group.cancel());
          attempts.push(...[...touched].map(light => () => light.cancel()));
          attempts.push(...[...charges].map(([light, charge]) => () => light.setCharge(charge)));
          for (const attempt of attempts) { try { attempt(); } catch (failure) { error ||= failure; } }
        }
        if (current === run) current = null;
        if (error) reject(error); else settle(status);
      };
      const run = { cancel: () => finish('cancelled') }; current = run;
      cleanup = lifecycle(run.cancel, targets, signal);
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      const motionChange = () => run.cancel(); motion.addEventListener('change', motionChange);
      const remove = cleanup; cleanup = () => { remove(); motion.removeEventListener('change', motionChange); };
      let index = 0;
      const next = () => {
        if (finished) return;
        if (index === normalized.length) { finish('completed'); return; }
        const step = normalized[index++], light = step.surface;
        if (targets.some(target => !available(target))) { run.cancel(); return; }
        try {
          if (light) touched.add(light);
          if (step.effect === 'charge') {
            if (!charges.has(light)) charges.set(light, light.charge);
            const from = light.charge, to = clamp(step.value, 0, 1, 1), start = performance.now();
            if (motion.matches || !step.duration) light.setCharge(to);
            else {
              const tick = now => {
                if (finished) return;
                try {
                  const progress = Math.min(1, (now - start) / step.duration);
                  light.setCharge(from + (to - from) * (1 - (1 - progress) ** 3));
                  if (progress < 1) frame = requestAnimationFrame(tick); else next();
                } catch (error) { finish('cancelled', error); }
              };
              frame = requestAnimationFrame(tick); return;
            }
          } else if (step.effect === 'sweep') {
            if (motion.matches) light.flash('press');
            else light.sweep({ ...step.options, duration: step.duration });
          }
          else if (step.effect === 'flash') light.flash(step.kind || 'success');
          else if (step.effect === 'ripple' && !motion.matches) light.ripple(step.options);
          else if (step.effect === 'group') { groups.add(step.group); step.group.burst(step.options); }
          else if (step.effect === 'particles') step.engine.burstFrom(step.target, step.options);
          const duration = motion.matches && step.effect !== 'wait' ? 0 : step.duration;
          if (duration) timer = setTimeout(next, duration); else next();
        } catch (error) { finish('cancelled', error); }
      };
      next(); return promise;
    },
    cancel() { current?.cancel(); return controller; },
    destroy() { destroyed = true; controller.cancel(); },
  };
  return controller;
}
