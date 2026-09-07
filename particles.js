import { getBrightpixelsConfig } from './index.js';
import { PARTICLE_SHADER, PARTICLE_FLOATS, FRAME_FLOATS, OFFSETS } from './particles-shader.js';

const palette = ['#54efff', '#ff4ace', '#caff60', '#af78ff', '#ffb74c'];
const limit = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

/** One reusable viewport layer for bursts and pointer trails. No resources on import. */
export function createParticleEffects(options = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') throw new Error('Particle effects require a browser document.');
  return new ParticleEffects(options);
}

class ParticleEffects {
  constructor(options) {
    this.maxParticles = Math.round(limit(options.maxParticles, 1, 2048, 1024));
    this.intensity = limit(options.intensity, 1, 16, 6);
    this._particles = []; this._stops = new Set(); this._listeners = [];
    this._frame = 0; this._generation = 0; this._destroyed = false; this._gpu = null; this._dirty = true;
    this._mode = 'fallback'; this._reason = 'webgpu-unavailable';
    this._data = new Float32Array(this.maxParticles * PARTICLE_FLOATS);
    this._uniforms = new Float32Array(FRAME_FLOATS);
    this._colorCanvas = document.createElement('canvas'); this._colorCanvas.width = this._colorCanvas.height = 1;
    this._colorContext = this._colorCanvas.getContext('2d', { willReadFrequently: true });
    this._colors = new Map();
    this._makeFallback();
    const listen = (target, event, callback, options) => {
      target.addEventListener(event, callback, options);
      this._listeners.push(() => target.removeEventListener(event, callback, options));
    };
    listen(window, 'resize', () => { this.clear(); this._resize(); });
    listen(window, 'blur', () => this.clear());
    listen(window, 'pagehide', () => this.clear());
    listen(document, 'visibilitychange', () => { if (document.hidden) this.clear(); });
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    listen(motion, 'change', () => this.clear());
    listen(window, 'brightpixels-config-change', () => {
      if (!getBrightpixelsConfig().enabled) { this._fallback('disabled'); this.ready = Promise.resolve(this.mode); }
      else if (!this._gpu) this.ready = this._initialize();
      this._resize();
    });
    this.ready = this._initialize();
  }
  get canvas() { return this._destroyed ? null : this._canvas; }
  get mode() { return this._mode; }
  get fallbackReason() { return this._reason; }
  get activeCount() { return this._particles.length; }
  get running() { return Boolean(this._frame); }
  _newCanvas() {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true'); canvas.dataset.brightpixelsParticles = this._mode;
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;visibility:hidden;dynamic-range-limit:no-limit;';
    return canvas;
  }
  _mount(canvas) {
    if (this._canvas?.isConnected) this._canvas.replaceWith(canvas);
    else (document.body || document.documentElement).append(canvas);
    this._canvas = canvas; this._resize();
    canvas.style.visibility = this._particles.length ? 'visible' : 'hidden';
  }
  _makeFallback() {
    const canvas = this._newCanvas(); this._context = canvas.getContext('2d'); this._mount(canvas);
  }
  _resize() {
    const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
    const config = getBrightpixelsConfig(), dpr = Math.min(devicePixelRatio || 1, 2);
    this._scale = config.quality === 'low' ? Math.min(1, dpr) : config.quality === 'high' ? dpr : Math.min(dpr, Math.max(1, Math.sqrt(1_000_000 / (width * height))));
    this._width = width; this._height = height;
    const w = Math.max(1, Math.round(width * this._scale)), h = Math.max(1, Math.round(height * this._scale));
    if (this._canvas.width !== w) this._canvas.width = w;
    if (this._canvas.height !== h) this._canvas.height = h;
  }
  _release() {
    const gpu = this._gpu; this._gpu = null;
    if (!gpu) return;
    gpu.context.unconfigure(); gpu.buffer.destroy(); gpu.uniform.destroy(); gpu.device.destroy();
  }
  _fallback(reason) {
    this._generation++;
    this._release(); this._mode = 'fallback'; this._reason = reason;
    if (!this._context) this._makeFallback();
    this._canvas.dataset.brightpixelsParticles = 'fallback';
    if (this._particles.length > 256) { this._particles.splice(0, this._particles.length - 256); this._dirty = true; }
    this._wake();
  }
  async _initialize() {
    const generation = ++this._generation;
    if (!getBrightpixelsConfig().enabled) { this._reason = 'disabled'; return this.mode; }
    if (!navigator.gpu) { this._reason = 'webgpu-unavailable'; return this.mode; }
    let device, context, buffer, uniform;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
      if (this._destroyed || generation !== this._generation) return this.mode;
      if (!adapter) { this._reason = 'webgpu-unavailable'; return this.mode; }
      device = await adapter.requestDevice();
      if (this._destroyed || generation !== this._generation) { device.destroy(); return this.mode; }
      const shader = device.createShaderModule({ code: PARTICLE_SHADER });
      const pipeline = await device.createRenderPipelineAsync({
        layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' },
        fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format: 'rgba16float', blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        } }] }, primitive: { topology: 'triangle-list' },
      });
      if (this._destroyed || generation !== this._generation) { device.destroy(); return this.mode; }
      buffer = device.createBuffer({ size: this._data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      uniform = device.createBuffer({ size: this._uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer } }, { binding: 1, resource: { buffer: uniform } },
      ] });
      const canvas = this._newCanvas(); context = canvas.getContext('webgpu');
      if (!context) throw new Error('WebGPU canvas unavailable');
      context.configure({ device, format: 'rgba16float', alphaMode: 'premultiplied', colorSpace: 'srgb', toneMapping: { mode: 'extended' } });
      this._gpu = { device, pipeline, buffer, uniform, bindGroup, context };
      device.addEventListener('uncapturederror', () => {
        if (!this._destroyed && this._gpu?.device === device) this._fallback('renderer-error');
      });
      this._context = null; this._mode = 'hdr'; this._reason = null; this._dirty = true;
      canvas.dataset.brightpixelsParticles = 'hdr'; this._mount(canvas);
      device.lost.then(() => {
        if (!this._destroyed && this._gpu?.device === device) this._fallback('device-lost');
      });
      this._wake();
    } catch {
      context?.unconfigure(); buffer?.destroy(); uniform?.destroy(); device?.destroy();
      if (!this._destroyed && generation === this._generation) this._fallback('renderer-error');
    }
    return this.mode;
  }
  _color(value) {
    const key = String(value);
    if (this._colors.has(key)) return this._colors.get(key);
    const ctx = this._colorContext;
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillStyle = key; ctx.fillRect(0, 0, 1, 1);
    const bytes = ctx.getImageData(0, 0, 1, 1).data;
    const color = { gpu: [linear(bytes[0] / 255), linear(bytes[1] / 255), linear(bytes[2] / 255), bytes[3] / 255], css: `rgb(${bytes[0]},${bytes[1]},${bytes[2]})` };
    if (this._colors.size >= 64) this._colors.delete(this._colors.keys().next().value);
    this._colors.set(key, color); return color;
  }
  burst(options = {}) {
    if (this._destroyed || document.hidden) return 0;
    const reduced = options.reducedMotion === true || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const capacity = this.mode === 'hdr' ? this.maxParticles : Math.min(256, this.maxParticles);
    const count = Math.round(limit(options.count, 0, reduced ? Math.min(12, capacity) : capacity, reduced ? Math.min(12, capacity) : Math.min(120, capacity)));
    if (!count) return 0;
    const x = limit(options.x, -innerWidth, innerWidth * 2, innerWidth / 2);
    const y = limit(options.y, -innerHeight, innerHeight * 2, innerHeight * .75);
    const speed = reduced ? 0 : limit(options.speed, 0, 3000, 320);
    const spread = limit(options.spread, 0, 360, 100) * Math.PI / 180;
    const angle = limit(options.angle, -3600, 3600, -90) * Math.PI / 180;
    const gravity = reduced ? 0 : limit(options.gravity, -3000, 3000, 420);
    const lifetime = (reduced ? 700 : limit(options.lifetime, 100, 10000, 1800)) / 1000;
    const size = limit(options.size, 1, 24, 5);
    const intensity = limit(options.intensity, 1, 16, this.intensity);
    const kind = options.shape === 'spark' ? 1 : options.shape === 'dot' ? 2 : 0;
    const colors = Array.isArray(options.colors) && options.colors.length ? options.colors.slice(0, 16) : palette;
    const now = performance.now() / 1000;
    for (let i = 0; i < count; i++) {
      const direction = angle + (Math.random() - .5) * spread, velocity = speed * (.6 + Math.random() * .4);
      const color = this._color(colors[i % colors.length]);
      const p = { x: x + (reduced ? Math.cos(i / count * Math.PI * 2) * 30 : 0), y: y + (reduced ? Math.sin(i / count * Math.PI * 2) * 30 : 0),
        vx: Math.cos(direction) * velocity, vy: Math.sin(direction) * velocity, birth: now, life: lifetime * (.8 + Math.random() * .2), gravity,
        spin: reduced ? 0 : (Math.random() - .5) * 10, size: size * (.6 + Math.random() * .4), angle: Math.random() * Math.PI * 2, kind, intensity, color };
      this._particles.push(p);
    }
    if (this._particles.length > capacity) this._particles.splice(0, this._particles.length - capacity);
    this._dirty = true; this._wake(); return count;
  }
  trail(target = window, options = {}) {
    if (this._destroyed) return () => {};
    let previous = 0;
    const move = event => {
      if (event.pointerType !== 'mouse' || options.reducedMotion === true || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const now = performance.now(); if (now - previous < 16) return; previous = now;
      this.burst({ lifetime: 600, speed: 40, gravity: 30, shape: 'spark', ...options, count: Math.round(limit(options.count, 1, 8, 3)), x: event.clientX, y: event.clientY });
    };
    target.addEventListener('pointermove', move, { passive: true });
    const stop = () => { target.removeEventListener('pointermove', move); this._stops.delete(stop); };
    this._stops.add(stop); return stop;
  }
  _wake() {
    if (this._destroyed || !this._particles.length || this._frame || document.hidden) return;
    this._canvas.style.visibility = 'visible';
    this._frame = requestAnimationFrame(now => this._draw(now / 1000));
  }
  _draw(now) {
    this._frame = 0;
    if (this._destroyed || document.hidden) { this.clear(); return; }
    const count = this._particles.length;
    this._particles = this._particles.filter(p => now - p.birth < p.life);
    if (!this._particles.length) { this.clear(); return; }
    if (count !== this._particles.length) this._dirty = true;
    if (this._gpu) {
      try { this._drawGPU(now); } catch { this._fallback('renderer-error'); }
    } else this._drawFallback(now);
    this._wake();
  }
  _drawGPU(now) {
    const gpu = this._gpu;
    if (this._dirty) {
      this._particles.forEach((p, i) => {
        const start = i * PARTICLE_FLOATS;
        this._data.set([p.x, p.y, p.vx, p.vy], start + OFFSETS.origin);
        this._data.set([p.birth, p.life, p.gravity, p.spin], start + OFFSETS.motion);
        this._data.set([p.size, p.kind, p.angle, p.intensity], start + OFFSETS.style);
        this._data.set(p.color.gpu, start + OFFSETS.color);
      });
      gpu.device.queue.writeBuffer(gpu.buffer, 0, this._data, 0, this._particles.length * PARTICLE_FLOATS);
      this._dirty = false;
    }
    this._uniforms.set([this._width, this._height, now, getBrightpixelsConfig().brightness]);
    gpu.device.queue.writeBuffer(gpu.uniform, 0, this._uniforms);
    const encoder = gpu.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: gpu.context.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }] });
    pass.setPipeline(gpu.pipeline); pass.setBindGroup(0, gpu.bindGroup); pass.draw(6, this._particles.length); pass.end();
    gpu.device.queue.submit([encoder.finish()]);
  }
  _drawFallback(now) {
    const ctx = this._context; if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.scale(this._scale, this._scale);
    for (const p of this._particles) {
      const age = now - p.birth, t = Math.max(0, Math.min(1, (age / p.life - .55) / .45));
      ctx.save(); ctx.globalAlpha = (1 - t * t * (3 - 2 * t)) * p.color.gpu[3];
      ctx.translate(p.x + p.vx * age, p.y + p.vy * age + p.gravity * age * age / 2); ctx.rotate(p.angle + p.spin * age);
      ctx.fillStyle = p.color.css; ctx.shadowColor = p.color.css; ctx.shadowBlur = p.size * 3;
      if (p.kind === 0) ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
      else { ctx.beginPath(); if (p.kind === 2) ctx.arc(0, 0, p.size * .7, 0, Math.PI * 2); else { ctx.moveTo(0, -p.size); ctx.lineTo(p.size, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size, 0); ctx.closePath(); } ctx.fill(); }
      ctx.restore();
    }
  }
  clear() {
    cancelAnimationFrame(this._frame); this._frame = 0; this._particles.length = 0; this._dirty = true;
    if (this._canvas) this._canvas.style.visibility = 'hidden';
  }
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true; this._generation++; this.clear();
    for (const stop of [...this._stops]) stop();
    for (const remove of this._listeners) remove(); this._listeners.length = 0;
    this._release(); this._canvas.remove(); this._colors.clear();
  }
}
