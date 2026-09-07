import { createParticleEffects } from './particles.js';

const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const defaults = {
  numberOfPieces: 200, recycle: true, run: true, colors: ['#54efff', '#ff4ace', '#caff60', '#af78ff', '#ffb74c'],
  confettiSource: undefined, gravity: 0.1, wind: 0,
  initialVelocityX: 4, initialVelocityY: 10, opacity: 1,
  intensity: 8, tweenDuration: 1500, lifetime: 5000, size: 5, shape: 'confetti',
  onConfettiComplete: undefined, onReady: undefined,
};
function optionsWithDefaults(input) {
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, input[key] === undefined ? value : input[key]]));
}
function velocity(value, vertical) {
  if (value && typeof value === 'object') {
    const a = clamp(value.min, -50, 50, 0), b = clamp(value.max, -50, 50, 0);
    return (Math.min(a, b) + Math.random() * Math.abs(b - a)) * 60;
  }
  const n = clamp(value, 0, 50, vertical ? 10 : 4);
  return (vertical ? -Math.random() * n : (Math.random() * 2 - 1) * n) * 60;
}

/** A viewport confetti shower using the existing HDR particle renderer. */
export function createConfetti(options = {}) {
  return new ConfettiController(options);
}

class ConfettiController {
  constructor(options) {
    this._effects = createParticleEffects({ maxParticles: 2048 });
    this._options = optionsWithDefaults(options);
    this._listeners = []; this._timer = 0; this._emitted = 0; this._budget = 1;
    this._ready = false; this._destroyed = false; this._completed = false; this._focused = true;
    this._motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listen = (target, event, callback) => {
      target.addEventListener(event, callback);
      this._listeners.push(() => target.removeEventListener(event, callback));
    };
    listen(window, 'blur', () => { this._focused = false; this._interrupt(); });
    listen(window, 'focus', () => { this._focused = true; this._return(); });
    listen(document, 'visibilitychange', () => document.hidden ? this._interrupt() : this._return());
    listen(window, 'pagehide', () => this._interrupt());
    listen(window, 'pageshow', () => this._return());
    listen(window, 'resize', () => { this._interrupt(); this._return(); });
    listen(this._motion, 'change', () => this.restart());
    this.ready = this._effects.ready.then(() => {
      if (this._destroyed) return this.mode;
      this._ready = true; this._sync();
      this._options.onReady?.(this);
      return this.mode;
    });
  }
  get canvas() { return this._effects.canvas; }
  get mode() { return this._effects.mode; }
  get fallbackReason() { return this._effects.fallbackReason; }
  get activeCount() { return this._effects.activeCount; }
  get emittedCount() { return this._emitted; }
  get running() { return Boolean(this._timer || this._effects.running); }
  get _count() { return Math.round(clamp(this._options.numberOfPieces, 0, this._motion.matches ? 12 : 2048, 200)); }
  get _recycle() { return this._options.recycle !== false && !this._motion.matches; }
  _stopTimer() { clearTimeout(this._timer); this._timer = 0; }
  _interrupt() {
    this._stopTimer(); this._effects.clear();
    // A cancelled one-shot must not report successful completion or replay on focus.
    if (!this._recycle) this._completed = true;
  }
  _return() {
    if (document.hidden || !this._focused || this._destroyed) return;
    if (this._recycle) this.restart();
    else this._sync();
  }
  _sync() {
    if (this._destroyed || !this._ready) return;
    if (this._options.run === false) { this._stopTimer(); this._effects.pause(); return; }
    if (document.hidden || !this._focused || this._completed) return;
    this._effects.resume();
    if (this._timer) return;
    this._last = performance.now(); this._tick();
  }
  _emit(count) {
    const o = this._options;
    if (this._motion.matches) {
      return this._effects.burst({ count, x: innerWidth / 2, y: innerHeight / 3, colors: o.colors,
        intensity: o.intensity, shape: o.shape, size: o.size, opacity: o.opacity, reducedMotion: true });
    }
    const source = o.confettiSource || {};
    const x = clamp(source.x, -innerWidth, innerWidth * 2, 0);
    const y = clamp(source.y, -innerHeight, innerHeight * 2, -10);
    const width = clamp(source.w, 0, innerWidth * 3, innerWidth);
    const height = clamp(source.h, 0, innerHeight * 3, 0);
    const colors = Array.isArray(o.colors) && o.colors.length ? o.colors.slice(0, 16) : defaults.colors;
    let emitted = 0;
    for (let i = 0; i < count; i++) {
      emitted += this._effects.burst({
        count: 1, x: x + Math.random() * width, y: y + Math.random() * height,
        velocityX: velocity(o.initialVelocityX, false), velocityY: velocity(o.initialVelocityY, true),
        gravity: clamp(o.gravity, -0.8, 0.8, 0.1) * 3600, wind: clamp(o.wind, -0.8, 0.8, 0) * 3600,
        colors: [colors[(this._emitted + i) % colors.length]],
        intensity: o.intensity, opacity: o.opacity, size: o.size, shape: o.shape,
        lifetime: o.lifetime, flutter: true,
      });
    }
    return emitted;
  }
  _tick() {
    this._timer = 0;
    if (this._destroyed || document.hidden || !this._focused || this._options.run === false) return;
    const now = performance.now(), count = this._count;
    const duration = this._motion.matches ? 0 : clamp(this._options.tweenDuration, 0, 60000, 1500);
    this._budget = Math.min(count, this._budget + (duration ? Math.max(0, now - this._last) * count / duration : count));
    this._last = now;
    const capacity = this.mode === 'hdr' ? 2048 : 256;
    const remaining = this._recycle ? count : Math.max(0, count - this._emitted);
    const amount = Math.min(Math.floor(this._budget), remaining, Math.max(0, Math.min(count, capacity) - this.activeCount));
    if (amount > 0) { const added = this._emit(amount); this._emitted += added; this._budget -= added; }
    if (!this.activeCount && (!count || (!this._recycle && this._emitted >= count))) {
      this._completed = true;
      if (this._emitted) this._options.onConfettiComplete?.(this);
      return;
    }
    this._timer = setTimeout(() => this._tick(), 1000 / 30);
  }
  /** Replace options, as a React prop update would; omitted values use defaults. */
  update(options = {}) {
    if (this._destroyed) return this;
    const previousCount = this._count, previousRecycle = this._recycle;
    this._options = optionsWithDefaults(options);
    if (this._count > previousCount || (this._recycle && !previousRecycle)) this._completed = false;
    this._sync(); return this;
  }
  restart() {
    if (this._destroyed) return this;
    this._stopTimer(); this._effects.clear(); this._emitted = 0; this._budget = 1; this._completed = false;
    this._sync(); return this;
  }
  clear() {
    this._stopTimer(); this._effects.clear(); this._completed = true;
    return this;
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true; this._stopTimer();
    for (const remove of this._listeners) remove();
    this._listeners.length = 0; this._effects.destroy();
  }
}
