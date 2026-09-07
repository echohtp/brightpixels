const VERSION = "1.1.0";
const TEXT_TAG_NAME = "bright-text";
const IMAGE_TAG_NAME = "bright-image";
const DEFAULT_INTENSITY = 16;

// One native frame request for all components, including one-shot pulses.
const frameCallbacks = new Map();
let nextFrameId = 0, nativeFrame = 0, flushingFrames = false;
function scheduleFrame(callback) {
  const id = ++nextFrameId;
  frameCallbacks.set(id, callback);
  if (!nativeFrame && !flushingFrames) nativeFrame = requestAnimationFrame(flushFrames);
  return id;
}
function cancelFrame(id) {
  frameCallbacks.delete(id);
  if (!frameCallbacks.size && nativeFrame) { cancelAnimationFrame(nativeFrame); nativeFrame = 0; }
}
function flushFrames(now) {
  nativeFrame = 0;
  flushingFrames = true;
  try {
    for (const [id, callback] of [...frameCallbacks]) {
      if (!frameCallbacks.delete(id)) continue;
      try { callback(now); } catch (error) { queueMicrotask(() => { throw error; }); }
    }
  } finally {
    flushingFrames = false;
    if (frameCallbacks.size && !nativeFrame) nativeFrame = requestAnimationFrame(flushFrames);
  }
}

const configuration = { enabled: true, brightness: 1, quality: "auto" };
const connectedRenderers = new Set();
export function getBrightpixelsConfig() { return { ...configuration }; }
export function configureBrightpixels(options = {}) {
  if (options.enabled !== undefined) configuration.enabled = Boolean(options.enabled);
  if (options.brightness !== undefined) {
    const value = Number(options.brightness);
    if (Number.isFinite(value)) configuration.brightness = Math.min(1, Math.max(0, value));
  }
  if (["auto", "high", "low"].includes(options.quality)) configuration.quality = options.quality;
  for (const element of connectedRenderers) element._applyConfig();
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event("brightpixels-config-change"));
  }
  return getBrightpixelsConfig();
}
function effectiveIntensity(value) { return 1 + (value - 1) * configuration.brightness; }


/** Browser signals only. Does not request a GPU or measure physical HDR output. */
export function getBrightpixelsCapabilities() {
  const media = (query) => hasDOM() ? Boolean(window.matchMedia?.(query).matches) : false;
  return {
    webgpu: typeof navigator !== "undefined" && Boolean(navigator.gpu),
    hdr: media("(dynamic-range: high)"),
    p3: media("(color-gamut: p3)"),
    reducedMotion: media("(prefers-reduced-motion: reduce)"),
    intersectionObserver: typeof IntersectionObserver === "function",
  };
}
function renderScale(width, height) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (configuration.quality === "low") return Math.min(dpr, 1);
  if (configuration.quality === "high") return dpr;
  // Auto limits large canvases to roughly one million pixels, never below 1x.
  return Math.min(dpr, Math.max(1, Math.sqrt(1_000_000 / Math.max(1, width * height))));
}
let viewportObserver;
function observeViewport(element) {
  element._nearViewport = typeof IntersectionObserver !== "function";
  if (!element._nearViewport) {
    viewportObserver ||= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target;
        if (!target.isConnected) continue;
        target._nearViewport = entry.isIntersecting;
        target._viewportChanged();
      }
    }, { rootMargin: "200px" });
    viewportObserver.observe(element);
  }
}
function unobserveViewport(element) { viewportObserver?.unobserve(element); }


let devicePromise;
const pipelineCache = new WeakMap();

const FRAGMENTS = {
  text: `
    let mask = pow(textureSample(sourceTexture, sourceSampler, input.uv).a, 0.82);
    return vec4f(settings.rgb * mask, settings.a * mask);
  `,
  image: `
    let pixel = textureSample(sourceTexture, sourceSampler, input.uv);
    let luminance = dot(pixel.rgb, select(vec3f(0.2126, 0.7152, 0.0722), vec3f(0.228975, 0.691739, 0.079287), settings.z > 0.5));
    let highlight = smoothstep(0.55, 1.0, luminance);
    let multiplier = select(mix(1.0, settings.x, highlight * highlight), settings.x, settings.y > 0.5);
    return vec4f(pixel.rgb * multiplier * pixel.a, pixel.a);
  `,
};

function hasDOM() {
  return typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof customElements !== "undefined";
}

function transformText(text, transform) {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") {
    return text.replace(/(^|\s)(\S)/g, (_, space, letter) => space + letter.toUpperCase());
  }
  return text;
}

function normalizeIntensity(value, fallback = DEFAULT_INTENSITY) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(16, Math.max(1, number))
    : fallback;
}

function resolveElements(targets) {
  if (typeof targets === "string") return document.querySelectorAll(targets);
  if (targets instanceof Element) return [targets];
  if (targets && typeof targets[Symbol.iterator] === "function") return targets;
  return [];
}

function releaseGPU(state) {
  state?.maskTexture?.destroy();
  state?.sourceTexture?.destroy();
  state?.uniformBuffer?.destroy();
  state?.context?.unconfigure?.();
}

function objectPositionOffset(value, freeSpace, pixelScale = 1) {
  if (value === "left" || value === "top") return 0;
  if (value === "center") return freeSpace / 2;
  if (value === "right" || value === "bottom") return freeSpace;
  if (value?.endsWith("%")) {
    return freeSpace * (parseFloat(value) / 100);
  }
  const pixels = parseFloat(value);
  return Number.isFinite(pixels) ? pixels * pixelScale : freeSpace / 2;
}

function drawImageIntoCanvas(context, image, width, height, hostRect) {
  const imageRect = image.getBoundingClientRect();
  const scaleX = width / Math.max(hostRect.width, 1);
  const scaleY = height / Math.max(hostRect.height, 1);
  const boxX = (imageRect.left - hostRect.left) * scaleX;
  const boxY = (imageRect.top - hostRect.top) * scaleY;
  const boxWidth = imageRect.width * scaleX;
  const boxHeight = imageRect.height * scaleY;
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const style = getComputedStyle(image);
  const fit = style.objectFit || "fill";

  let drawWidth = boxWidth;
  let drawHeight = boxHeight;
  if (fit !== "fill") {
    const containScale = Math.min(
      boxWidth / Math.max(naturalWidth, 1),
      boxHeight / Math.max(naturalHeight, 1)
    );
    const coverScale = Math.max(
      boxWidth / Math.max(naturalWidth, 1),
      boxHeight / Math.max(naturalHeight, 1)
    );
    let fitScale = fit === "cover" ? coverScale : containScale;
    if (fit === "none") fitScale = Math.min(scaleX, scaleY);
    if (fit === "scale-down") fitScale = Math.min(Math.min(scaleX, scaleY), containScale);
    drawWidth = naturalWidth * fitScale;
    drawHeight = naturalHeight * fitScale;
  }

  const position = (style.objectPosition || "50% 50%").trim().split(/\s+/);
  const positionX = position[0] || "50%";
  const positionY = position[1] || "50%";
  const drawX = boxX + objectPositionOffset(positionX, boxWidth - drawWidth, scaleX);
  const drawY = boxY + objectPositionOffset(positionY, boxHeight - drawHeight, scaleY);

  context.save();
  context.beginPath();
  context.rect(boxX, boxY, boxWidth, boxHeight);
  context.clip();
  context.drawImage(
    image,
    0,
    0,
    naturalWidth,
    naturalHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  context.restore();
}

function getDevice() {
  if (devicePromise) return devicePromise;
  devicePromise = navigator.gpu
    .requestAdapter({ powerPreference: "high-performance" })
    .then((adapter) => {
      if (!adapter) throw new Error("No WebGPU adapter");
      return adapter.requestDevice();
    })
    .then((device) => {
      device.lost.then(() => {
        devicePromise = undefined;
      });
      return device;
    })
    .catch((error) => {
      devicePromise = undefined;
      throw error;
    });
  return devicePromise;
}

function getPipeline(device, kind) {
  let pipelines = pipelineCache.get(device);
  if (!pipelines) {
    pipelines = new Map();
    pipelineCache.set(device, pipelines);
  }
  if (pipelines.has(kind)) return pipelines.get(kind);

  const shader = device.createShaderModule({
    code: `
      @group(0) @binding(0) var sourceTexture: texture_2d<f32>;
      @group(0) @binding(1) var sourceSampler: sampler;
      @group(0) @binding(2) var<uniform> settings: vec4f;

      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) uv: vec2f,
      };

      @vertex
      fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
        var positions = array<vec2f, 3>(
          vec2f(-1.0, -1.0),
          vec2f(3.0, -1.0),
          vec2f(-1.0, 3.0)
        );
        var uvs = array<vec2f, 3>(
          vec2f(0.0, 1.0),
          vec2f(2.0, 1.0),
          vec2f(0.0, -1.0)
        );
        var output: VertexOutput;
        output.position = vec4f(positions[index], 0.0, 1.0);
        output.uv = uvs[index];
        return output;
      }

      @fragment
      fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
        ${FRAGMENTS[kind]}
      }
    `,
  });

  const descriptor = {
    layout: "auto",
    vertex: { module: shader, entryPoint: "vertexMain" },
    fragment: {
      module: shader,
      entryPoint: "fragmentMain",
      targets: [{
        format: "rgba16float",
        blend: {
          color: {
            srcFactor: "one",
            dstFactor: "one-minus-src-alpha",
            operation: "add",
          },
          alpha: {
            srcFactor: "one",
            dstFactor: "one-minus-src-alpha",
            operation: "add",
          },
        },
      }],
    },
    primitive: { topology: "triangle-list" },
  };

  const pipeline = device.createRenderPipelineAsync
    ? device.createRenderPipelineAsync(descriptor)
    : Promise.resolve(device.createRenderPipeline(descriptor));
  pipelines.set(kind, pipeline);
  pipeline.catch(() => {
    if (pipelines.get(kind) === pipeline) pipelines.delete(kind);
  });
  return pipeline;
}

function makeTextTemplate() {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        display: inline-block;
        max-width: 100%;
        color: #fff;
        font-family: inherit;
        font-size: inherit;
        font-style: inherit;
        font-variant: inherit;
        font-weight: inherit;
        font-stretch: inherit;
        font-kerning: inherit;
        font-optical-sizing: inherit;
        font-feature-settings: inherit;
        font-variation-settings: inherit;
        letter-spacing: inherit;
        line-height: inherit;
        text-transform: inherit;
        vertical-align: baseline;
        contain: layout style paint;
        dynamic-range-limit: no-limit;
      }

      .frame {
        position: relative;
        display: inline-grid;
        max-width: 100%;
        place-items: center;
      }

      .glyphs {
        grid-area: 1 / 1;
        color: #fff;
        font: inherit;
        font-size: 1em;
        letter-spacing: inherit;
        line-height: inherit;
        text-transform: inherit;
        white-space: nowrap;
        user-select: text;
        -webkit-user-select: text;
        cursor: text;
      }

      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none;
        dynamic-range-limit: no-limit;
      }

      :host([data-brightpixels-mode="hdr"]) canvas {
        opacity: 1;
      }

      :host([data-brightpixels-mode="hdr"]) .glyphs {
        opacity: 0.18;
      }

      .accessible {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        white-space: nowrap;
        pointer-events: none;
      }

      .glyphs::selection {
        color: #001014;
        background: #9cecff;
      }
    </style>
    <span class="accessible"><slot></slot></span>
    <span class="frame" aria-hidden="true">
      <span class="glyphs"></span>
      <canvas></canvas>
    </span>
  `;
  return template;
}

function makeTextElementClass() {
  const template = makeTextTemplate();

  return class BrightTextElement extends HTMLElement {
    static get observedAttributes() {
      return ["intensity", "color"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
      this._frame = this.shadowRoot.querySelector(".frame");
      this._glyphs = this.shadowRoot.querySelector(".glyphs");
      this._canvas = this.shadowRoot.querySelector("canvas");
      this._mask = document.createElement("canvas");
      this._maskContext = this._mask.getContext("2d");
      const colorCanvas = document.createElement("canvas");
      colorCanvas.width = colorCanvas.height = 1;
      this._colorContext = colorCanvas.getContext("2d", { colorSpace: "display-p3", willReadFrequently: true });
      this._colorSpace = this._colorContext?.getContextAttributes?.().colorSpace || "srgb";
      this._gpu = null;
      this._maskDirty = true;
      this._animationFrame = 0;
      this._initializing = null;
      this._resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(() => this._resize())
        : null;
      this._textObserver = typeof MutationObserver === "function"
        ? new MutationObserver(() => this._syncText())
        : null;
      this._onWindowResize = () => this._resize();

      this._glyphs.addEventListener("copy", (event) => {
        if (!event.clipboardData) return;
        event.clipboardData.setData("text/plain", this._text || "");
        event.preventDefault();
      });
    }

    connectedCallback() {
      connectedRenderers.add(this);
      observeViewport(this);
      if (!configuration.enabled) this._setMode("fallback", "disabled");
      this._syncText();
      if (this._resizeObserver) this._resizeObserver.observe(this._frame);
      else window.addEventListener("resize", this._onWindowResize);
      this._textObserver?.observe(this, {
        childList: true,
        characterData: true,
        subtree: true,
      });

      Promise.resolve(document.fonts?.ready)
        .catch(() => undefined)
        .then(() => {
          if (!this.isConnected || !configuration.enabled || this._nearViewport === false) return;
          this._syncText();
          this._resize();
          return this._initHDR();
        });
    }

    disconnectedCallback() {
      this._resizeObserver?.disconnect();
      this._textObserver?.disconnect();
      window.removeEventListener("resize", this._onWindowResize);
      connectedRenderers.delete(this);
      unobserveViewport(this);
      cancelFrame(this._animationFrame);
      this._animationFrame = 0;
      releaseGPU(this._gpu);
      this._gpu = null;
    }

    attributeChangedCallback(name) {
      if (name === "color") {
        this._glyphs.style.color = "";
        this._glyphs.style.color = this.color;
      } else if (name !== "intensity" && name !== "boost") return;
      this._requestRender();
    }

    get intensity() {
      const attribute = this.getAttribute("intensity");
      if (attribute === null || attribute.trim() === "") return DEFAULT_INTENSITY;
      return normalizeIntensity(attribute);
    }

    set intensity(value) {
      this.setAttribute("intensity", String(normalizeIntensity(value)));
    }

    get color() {
      return this.getAttribute("color") || "white";
    }

    set color(value) {
      this.setAttribute("color", String(value));
    }

    _textColor() {
      const context = this._colorContext;
      if (!context) return new Float32Array([effectiveIntensity(this.intensity), effectiveIntensity(this.intensity), effectiveIntensity(this.intensity), 1]);
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "white";
      context.fillStyle = getComputedStyle(this._glyphs).color;
      context.fillRect(0, 0, 1, 1);
      const rgba = context.getImageData(0, 0, 1, 1, { colorSpace: this._colorSpace }).data;
      const alpha = rgba[3] / 255;
      const rgb = Array.from(rgba.subarray(0, 3), (byte) => {
        const v = byte / 255;
        const linear = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        return linear * effectiveIntensity(this.intensity) * alpha;
      });
      return new Float32Array([...rgb, alpha]);
    }

    get mode() {
      return this.dataset.brightpixelsMode || null;
    }

    _syncText() {
      this._text = (this.textContent || "BRIGHTPIXELS").trim().slice(0, 128) || "BRIGHTPIXELS";
      this._glyphs.textContent = this._text;
      this._maskDirty = true;
      this._resize();
    }

    _resize() {
      const rect = this._frame.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = renderScale(rect.width, rect.height);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (this._canvas.width !== width || this._canvas.height !== height) {
        this._canvas.width = width;
        this._canvas.height = height;
        this._maskDirty = true;
      }
      this._requestRender();
    }

    _requestRender() {
      if (this._nearViewport === false || !this._gpu || this._animationFrame) return;
      this._animationFrame = scheduleFrame(() => this._render());
    }

    _drawMask() {
      const width = this._canvas.width;
      const height = this._canvas.height;
      if (!width || !height || !this._maskContext) return;

      this._mask.width = width;
      this._mask.height = height;
      const context = this._maskContext;
      context.clearRect(0, 0, width, height);

      const style = getComputedStyle(this._glyphs);
      const cssSize = parseFloat(style.fontSize) || 96;
      const scale = width / Math.max(this._frame.clientWidth, 1);
      const fontSize = cssSize * scale;
      const fontVariant = style.fontVariantCaps || "normal";
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.font = `${style.fontStyle} ${fontVariant} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
      if ("fontKerning" in context) context.fontKerning = style.fontKerning;
      if ("fontStretch" in context) context.fontStretch = style.fontStretch;
      if ("fontVariantCaps" in context) context.fontVariantCaps = style.fontVariantCaps;
      if ("letterSpacing" in context) {
        const spacing = parseFloat(style.letterSpacing);
        context.letterSpacing = Number.isFinite(spacing) ? `${spacing * scale}px` : "0px";
      }
      const renderedText = transformText(this._text, style.textTransform);
      const metric = context.measureText(renderedText);
      const ascent = metric.actualBoundingBoxAscent || fontSize * 0.72;
      const descent = metric.actualBoundingBoxDescent || fontSize * 0.06;
      const y = (height - ascent - descent) / 2 + ascent;
      context.fillStyle = "#fff";
      context.fillText(renderedText, width / 2, y);

      const resized = !this._gpu.maskTexture || this._gpu.maskTexture.width !== width || this._gpu.maskTexture.height !== height;
      if (resized) {
        this._gpu.maskTexture?.destroy();
        this._gpu.maskTexture = this._gpu.device.createTexture({
          size: [width, height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
        });
      }
      this._gpu.device.queue.copyExternalImageToTexture(
        { source: this._mask },
        { texture: this._gpu.maskTexture },
        [width, height]
      );
      if (resized || !this._gpu.bindGroup) this._gpu.bindGroup = this._gpu.device.createBindGroup({
        layout: this._gpu.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this._gpu.maskTexture.createView() },
          { binding: 1, resource: this._gpu.sampler },
          { binding: 2, resource: { buffer: this._gpu.uniformBuffer } },
        ],
      });
      this._maskDirty = false;
    }

    _render() {
      this._animationFrame = 0;
      if (!this.isConnected || this._nearViewport === false || !this._gpu) return;

      try {
        if (this._maskDirty) this._drawMask();
        if (!this._gpu.bindGroup) return;

        this._gpu.device.queue.writeBuffer(
          this._gpu.uniformBuffer,
          0,
          this._textColor()
        );
        const encoder = this._gpu.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this._gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.setPipeline(this._gpu.pipeline);
        pass.setBindGroup(0, this._gpu.bindGroup);
        pass.draw(3);
        pass.end();
        this._gpu.device.queue.submit([encoder.finish()]);
      } catch {
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback");
      }
    }

    _viewportChanged() {
      if (this._nearViewport) { this._resize(); this._initHDR(); }
      else { cancelFrame(this._animationFrame); this._animationFrame = 0; }
    }

    _applyConfig() {
      if (!configuration.enabled) {
        cancelFrame(this._animationFrame);
        this._animationFrame = 0;
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback", "disabled");
      } else {
        this._resize();
        this._initHDR();
      }
    }

    _initHDR() {
      if (!configuration.enabled) { this._setMode("fallback", "disabled"); return Promise.resolve(); }
      if (this._nearViewport === false) {
        if (!this._gpu) this._setMode("fallback", "offscreen");
        return Promise.resolve();
      }
      if (this._gpu || this._initializing) return this._initializing;
      this._initializing = this._createHDR().finally(() => {
        this._initializing = null;
      });
      return this._initializing;
    }

    async _createHDR() {
      if (!navigator.gpu || !this._canvas) {
        this._setMode("fallback", "webgpu-unavailable");
        return;
      }

      let context;
      try {
        const device = await getDevice();
        if (!this.isConnected || !configuration.enabled || this._nearViewport === false) return;
        context = this._canvas.getContext("webgpu");
        if (!context) throw new Error("No WebGPU context");

        context.configure({
          device,
          format: "rgba16float",
          colorSpace: this._colorSpace,
          alphaMode: "premultiplied",
          toneMapping: { mode: "extended" },
        });

        const pipeline = await getPipeline(device, "text");
        if (!this.isConnected || !configuration.enabled || this._nearViewport === false) {
          context.unconfigure?.();
          return;
        }
        const sampler = device.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
        });
        const uniformBuffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this._gpu = {
          device,
          context,
          pipeline,
          sampler,
          uniformBuffer,
          maskTexture: null,
          bindGroup: null,
        };
        device.lost.then(() => {
          if (this._gpu?.device !== device) return;
          this._gpu = null;
          if (this.isConnected) this._setMode("fallback", "device-lost");
        });
        this._maskDirty = true;
        this._resize();
        this._setMode("hdr");
        this._requestRender();
      } catch {
        context?.unconfigure?.();
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback");
      }
    }

    get fallbackReason() { return this.dataset.brightpixelsReason || null; }

    _setMode(mode, reason = mode === "fallback" ? "renderer-error" : null) {
      if (this.dataset.brightpixelsMode === mode && this.fallbackReason === reason) return;
      this.dataset.brightpixelsMode = mode;
      if (reason) this.dataset.brightpixelsReason = reason;
      else delete this.dataset.brightpixelsReason;
      this.dispatchEvent(new CustomEvent("brightpixelsready", {
        bubbles: true,
        detail: { kind: "text", mode, reason, version: VERSION },
      }));
    }
  };
}

function makeImageTemplate() {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        position: relative;
        display: inline-grid;
        max-width: 100%;
        vertical-align: middle;
        dynamic-range-limit: no-limit;
      }

      slot,
      canvas {
        grid-area: 1 / 1;
      }

      slot {
        display: block;
        min-width: 0;
      }

      ::slotted(img) {
        display: block;
        max-width: 100%;
      }

      canvas {
        position: absolute;
        inset: 0;
        align-self: stretch;
        justify-self: stretch;
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none;
        dynamic-range-limit: no-limit;
      }

      :host([data-brightpixels-mode="hdr"]) canvas {
        opacity: 1;
      }

      :host([data-brightpixels-mode="hdr"]) ::slotted(img) {
        opacity: 0;
      }
    </style>
    <slot></slot>
    <canvas aria-hidden="true"></canvas>
  `;
  return template;
}

function makeImageElementClass() {
  const template = makeImageTemplate();

  return class BrightImageElement extends HTMLElement {
    static get observedAttributes() {
      return ["intensity", "boost"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
      this._canvas = this.shadowRoot.querySelector("canvas");
      this._source = document.createElement("canvas");
      this._sourceContext = this._source.getContext("2d", { colorSpace: "display-p3" });
      this._colorSpace = this._sourceContext?.getContextAttributes?.().colorSpace || "srgb";
      this._image = null;
      this._gpu = null;
      this._sourceDirty = true;
      this._animationFrame = 0;
      this._initializing = null;
      this._resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(() => this._resize())
        : null;
      this._imageObserver = typeof MutationObserver === "function"
        ? new MutationObserver(() => this._syncImage())
        : null;
      this._onWindowResize = () => this._resize();
      this._onImageLoad = () => {
        this._sourceDirty = true;
        this._resize();
      };
    }

    connectedCallback() {
      connectedRenderers.add(this);
      observeViewport(this);
      this._syncImage();
      if (this._resizeObserver) this._resizeObserver.observe(this);
      else window.addEventListener("resize", this._onWindowResize);
      this._imageObserver?.observe(this, {
        attributes: true,
        attributeFilter: ["src", "srcset", "sizes"],
        childList: true,
        subtree: true,
      });
      this._resize();
      if (this._image) this._initHDR();
    }

    disconnectedCallback() {
      this._resizeObserver?.disconnect();
      this._imageObserver?.disconnect();
      window.removeEventListener("resize", this._onWindowResize);
      this._image?.removeEventListener("load", this._onImageLoad);
      connectedRenderers.delete(this);
      unobserveViewport(this);
      cancelFrame(this._animationFrame);
      this._animationFrame = 0;
      releaseGPU(this._gpu);
      this._gpu = null;
    }

    attributeChangedCallback(name) {
      if (name !== "intensity") return;
      this._requestRender();
    }

    get intensity() {
      const attribute = this.getAttribute("intensity");
      if (attribute === null || attribute.trim() === "") return DEFAULT_INTENSITY;
      return normalizeIntensity(attribute);
    }

    set intensity(value) {
      this.setAttribute("intensity", String(normalizeIntensity(value)));
    }

    get mode() {
      return this.dataset.brightpixelsMode || null;
    }

    get boost() {
      return this.getAttribute("boost") === "all" ? "all" : "highlights";
    }

    set boost(value) {
      this.setAttribute("boost", value === "all" ? "all" : "highlights");
    }

    get image() {
      return this._image;
    }

    _syncImage() {
      const image = this.querySelector("img");
      if (image !== this._image) {
        this._image?.removeEventListener("load", this._onImageLoad);
        this._image = image;
        this._image?.addEventListener("load", this._onImageLoad);
      }

      if (!this._image) {
        this._setMode("fallback", "missing-image");
        return;
      }

      const style = getComputedStyle(this._image);
      this._canvas.style.borderRadius = style.borderRadius;
      this._sourceDirty = true;
      this._resize();
      if (this.isConnected && !this._gpu) this._initHDR();
    }

    _resize() {
      const rect = this.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (this._image) {
        this._canvas.style.borderRadius = getComputedStyle(this._image).borderRadius;
      }
      const ratio = renderScale(rect.width, rect.height);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (this._canvas.width !== width || this._canvas.height !== height) {
        this._canvas.width = width;
        this._canvas.height = height;
        this._sourceDirty = true;
      }
      this._requestRender();
    }

    _requestRender() {
      if (this._nearViewport === false || !this._gpu || !this._image || this._animationFrame) return;
      this._animationFrame = scheduleFrame(() => this._render());
    }

    _drawSource() {
      const width = this._canvas.width;
      const height = this._canvas.height;
      if (!width || !height || !this._sourceContext) return false;
      if (!this._image?.complete || !this._image.naturalWidth) return false;

      this._source.width = width;
      this._source.height = height;
      this._sourceContext.clearRect(0, 0, width, height);
      this._sourceContext.imageSmoothingEnabled = true;
      this._sourceContext.imageSmoothingQuality = "high";
      drawImageIntoCanvas(
        this._sourceContext,
        this._image,
        width,
        height,
        this.getBoundingClientRect()
      );

      const resized = !this._gpu.sourceTexture || this._gpu.sourceTexture.width !== width || this._gpu.sourceTexture.height !== height;
      if (resized) {
        this._gpu.sourceTexture?.destroy();
        this._gpu.sourceTexture = this._gpu.device.createTexture({
          size: [width, height, 1],
        format: "rgba8unorm-srgb",
        usage: GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
        });
      }
      this._gpu.device.queue.copyExternalImageToTexture(
        { source: this._source },
        { texture: this._gpu.sourceTexture, colorSpace: this._colorSpace },
        [width, height]
      );
      if (resized || !this._gpu.bindGroup) this._gpu.bindGroup = this._gpu.device.createBindGroup({
        layout: this._gpu.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this._gpu.sourceTexture.createView() },
          { binding: 1, resource: this._gpu.sampler },
          { binding: 2, resource: { buffer: this._gpu.uniformBuffer } },
        ],
      });
      this._sourceDirty = false;
      return true;
    }

    _render() {
      this._animationFrame = 0;
      if (!this.isConnected || this._nearViewport === false || !this._gpu) return;

      try {
        if (this._sourceDirty && !this._drawSource()) return;
        if (!this._gpu.bindGroup) return;

        this._gpu.device.queue.writeBuffer(
          this._gpu.uniformBuffer,
          0,
          new Float32Array([effectiveIntensity(this.intensity), this.boost === "all" ? 1 : 0, this._colorSpace === "display-p3" ? 1 : 0, 0])
        );
        const encoder = this._gpu.device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: this._gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          }],
        });
        pass.setPipeline(this._gpu.pipeline);
        pass.setBindGroup(0, this._gpu.bindGroup);
        pass.draw(3);
        pass.end();
        this._gpu.device.queue.submit([encoder.finish()]);
      } catch {
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback");
      }
    }

    _viewportChanged() {
      if (this._nearViewport) { this._resize(); this._initHDR(); }
      else { cancelFrame(this._animationFrame); this._animationFrame = 0; }
    }

    _applyConfig() {
      if (!configuration.enabled) {
        cancelFrame(this._animationFrame);
        this._animationFrame = 0;
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback", "disabled");
      } else {
        this._resize();
        this._initHDR();
      }
    }

    _initHDR() {
      if (!configuration.enabled) { this._setMode("fallback", "disabled"); return Promise.resolve(); }
      if (this._nearViewport === false) {
        if (!this._gpu) this._setMode("fallback", "offscreen");
        return Promise.resolve();
      }
      if (this._gpu || this._initializing) return this._initializing;
      this._initializing = this._createHDR().finally(() => {
        this._initializing = null;
      });
      return this._initializing;
    }

    async _createHDR() {
      if (!navigator.gpu || !this._canvas) {
        this._setMode("fallback", "webgpu-unavailable");
        return;
      }

      let context;
      try {
        const device = await getDevice();
        if (!this.isConnected || !configuration.enabled || this._nearViewport === false) return;
        context = this._canvas.getContext("webgpu");
        if (!context) throw new Error("No WebGPU context");

        context.configure({
          device,
          format: "rgba16float",
          colorSpace: this._colorSpace,
          alphaMode: "premultiplied",
          toneMapping: { mode: "extended" },
        });

        const pipeline = await getPipeline(device, "image");
        if (!this.isConnected || !configuration.enabled || this._nearViewport === false) {
          context.unconfigure?.();
          return;
        }
        const sampler = device.createSampler({
          magFilter: "linear",
          minFilter: "linear",
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
        });
        const uniformBuffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this._gpu = {
          device,
          context,
          pipeline,
          sampler,
          uniformBuffer,
          sourceTexture: null,
          bindGroup: null,
        };
        device.lost.then(() => {
          if (this._gpu?.device !== device) return;
          this._gpu = null;
          if (this.isConnected) this._setMode("fallback", "device-lost");
        });
        this._sourceDirty = true;
        this._resize();
        this._setMode("hdr");
        this._requestRender();
      } catch {
        context?.unconfigure?.();
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback");
      }
    }

    get fallbackReason() { return this.dataset.brightpixelsReason || null; }

    _setMode(mode, reason = mode === "fallback" ? "renderer-error" : null) {
      if (this.dataset.brightpixelsMode === mode && this.fallbackReason === reason) return;
      this.dataset.brightpixelsMode = mode;
      if (reason) this.dataset.brightpixelsReason = reason;
      else delete this.dataset.brightpixelsReason;
      this.dispatchEvent(new CustomEvent("brightpixelsready", {
        bubbles: true,
        detail: { kind: "image", mode, reason, version: VERSION },
      }));
    }
  };
}

function shapeNumber(element, name, fallback, min, max) {
  const raw = element.getAttribute(name);
  const value = raw === null || raw.trim() === "" ? fallback : Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

const STATUS_PRESETS = {
  loading: { shape: "ring", color: "#68bfff", d: "" },
  success: { shape: "path", color: "#26df8b", d: "M15 50 L40 75 L85 20" },
  warning: { shape: "path", color: "#ffca36", d: "M50 15 L90 85 L10 85 Z M50 40 L50 58 M50 72 L50 73" },
  error: { shape: "path", color: "#ff6677", d: "M25 25 L75 75 M75 25 L25 75" },
};

function makeShapeElementClass() {
  return class BrightShapeElement extends HTMLElement {
    static get observedAttributes() {
      return ["shape", "color", "intensity", "value", "thickness", "radius", "points", "start-angle", "sweep", "d", "filled", "color-end", "angle", "dash", "linecap", "track", "duration", "status", "indeterminate"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" }).innerHTML = `
        <style>
          :host { display:inline-grid; position:relative; width:6rem; height:6rem;
            vertical-align:middle; color:white; dynamic-range-limit:no-limit; }
          :host([shape="bar"]) { width:16rem; height:0.75rem; }
          :host([shape="dot"]) { width:1rem; height:1rem; }
          :host([shape="pill"]) { width:8rem; height:2rem; }
          :host([shape="rect"]) { width:8rem; height:4rem; }
          :host([shape="line"]) { width:12rem; height:0.5rem; }
          :host([shape="outline"]) { width:auto; height:auto; min-width:3rem;
            min-height:3rem; padding:1rem; }
          bright-image { position:absolute; inset:0; width:100%; height:100%;
            pointer-events:none; dynamic-range-limit:no-limit; }
          img { display:block; width:100%; height:100%; }
          .track { position:absolute; inset:0; pointer-events:none; }
          .track[hidden] { display:none; }
          :host([data-loading="ring"]) bright-image { animation:brightpixels-spin 1.2s linear infinite; }
          :host([data-loading="bar"]) bright-image { animation:brightpixels-slide 1.2s ease-in-out infinite alternate; }
          :host([data-paused]) bright-image { animation-play-state:paused; }
          @keyframes brightpixels-spin { to { transform:rotate(360deg); } }
          @keyframes brightpixels-slide { to { transform:translateX(75%); } }
          @media (prefers-reduced-motion:reduce) { :host([data-loading]) bright-image { animation:none; } }
          slot { position:relative; display:grid; place-items:center; min-width:0; }
          .color { position:absolute; visibility:hidden; pointer-events:none; }
        </style>
        <img class="track" alt="" aria-hidden="true" hidden />
        <bright-image boost="all" aria-hidden="true"><img alt="" /></bright-image>
        <slot></slot><span class="color" aria-hidden="true"></span>`;
      this._bright = this.shadowRoot.querySelector("bright-image");
      this._image = this._bright.querySelector("img");
      this._track = this.shadowRoot.querySelector(".track");
      this._probe = this.shadowRoot.querySelector(".color");
      this._frame = 0;
      this._pulseFrame = 0;
      this._pulsing = false;
      this._displayValue = null;
      this._transition = null;
      this._onVisibility = () => {
        this._syncLoading();
        if (document.hidden) { this.stopPulse(); this._finishTransition(); }
      };
      this._resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(() => this._requestRender()) : null;
      this._onResize = () => this._requestRender();
      this._bright.addEventListener("brightpixelsready", (event) => {
        event.stopPropagation();
        this._setMode(event.detail.mode, event.detail.reason);
      });
    }

    connectedCallback() {
      observeViewport(this);
      if (this._bright.mode) this._setMode(this._bright.mode, this._bright.fallbackReason);
      this._displayValue = this.value;
      this._syncLoading();
      document.addEventListener("visibilitychange", this._onVisibility);
      this._resizeObserver?.observe(this);
      if (!this._resizeObserver) window.addEventListener("resize", this._onResize);
      this._requestRender();
    }

    disconnectedCallback() {
      this._resizeObserver?.disconnect();
      window.removeEventListener("resize", this._onResize);
      document.removeEventListener("visibilitychange", this._onVisibility);
      unobserveViewport(this);
      this.stopPulse();
      this._transition = null;
      this._displayValue = this.value;
      cancelFrame(this._frame);
      this._frame = 0;
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (["shape", "status", "indeterminate"].includes(name)) this._syncLoading();
      if (name === "intensity") this.stopPulse();
      else if (name === "value") this._transitionToValue();
      else {
        if (["shape", "duration", "status", "indeterminate"].includes(name)) this._finishTransition();
        this._requestRender();
      }
    }

    get shape() {
      const value = this.getAttribute("shape");
      return ["ring", "outline", "bar", "dot", "line", "arc", "rect", "pill", "triangle", "diamond", "star", "polygon", "path"].includes(value) ? value : STATUS_PRESETS[this.status]?.shape || "ring";
    }
    set shape(value) { this.setAttribute("shape", value); }
    get color() { return this.getAttribute("color") || STATUS_PRESETS[this.status]?.color || "white"; }
    set color(value) { this.setAttribute("color", value); }
    get intensity() { return shapeNumber(this, "intensity", DEFAULT_INTENSITY, 1, 16); }
    set intensity(value) { this.setAttribute("intensity", normalizeIntensity(value)); }
    get value() { return shapeNumber(this, "value", 100, 0, 100); }
    set value(value) { this.setAttribute("value", value); }
    get thickness() { return shapeNumber(this, "thickness", 4, 0.5, 1000); }
    set thickness(value) { this.setAttribute("thickness", value); }
    get radius() { return shapeNumber(this, "radius", 12, 0, 10000); }
    set radius(value) { this.setAttribute("radius", value); }
    get startAngle() { return shapeNumber(this, "start-angle", -90, -360, 360); }
    set startAngle(value) { this.setAttribute("start-angle", value); }
    get sweep() { return shapeNumber(this, "sweep", 270, 0, 360); }
    set sweep(value) { this.setAttribute("sweep", value); }
    get d() { return this.getAttribute("d") || STATUS_PRESETS[this.status]?.d || ""; }
    set d(value) { this.setAttribute("d", value); }
    get filled() { return this.hasAttribute("filled"); }
    set filled(value) { if (value) this.setAttribute("filled", ""); else this.removeAttribute("filled"); }
    get colorEnd() { return this.getAttribute("color-end") || ""; }
    set colorEnd(value) { this.setAttribute("color-end", value); }
    get angle() { return shapeNumber(this, "angle", 0, -360, 360); }
    set angle(value) { this.setAttribute("angle", value); }
    get dash() { return this.getAttribute("dash") || ""; }
    set dash(value) { this.setAttribute("dash", value); }
    get linecap() { return ["butt", "round", "square"].includes(this.getAttribute("linecap")) ? this.getAttribute("linecap") : "round"; }
    set linecap(value) { this.setAttribute("linecap", value); }
    get status() { const value = this.getAttribute("status"); return Object.hasOwn(STATUS_PRESETS, value) ? value : ""; }
    set status(value) { if (value) this.setAttribute("status", value); else this.removeAttribute("status"); }
    get indeterminate() { return this.hasAttribute("indeterminate") || this.status === "loading"; }
    set indeterminate(value) { if (value) this.setAttribute("indeterminate", ""); else this.removeAttribute("indeterminate"); }
    setStatus(status, { pulse = false } = {}) {
      this.stopPulse();
      this.status = status;
      if (pulse && this.status && this.status !== "loading") this.pulse();
    }
    _viewportChanged() {
      this._syncLoading();
      if (!this._nearViewport) { this.stopPulse(); this._finishTransition(); }
      else this._requestRender();
    }
    _syncLoading() {
      const loading = this.indeterminate && ["ring", "arc", "bar"].includes(this.shape);
      if (loading) this.dataset.loading = this.shape === "bar" ? "bar" : "ring";
      else delete this.dataset.loading;
      if (document.hidden || this._nearViewport === false) this.dataset.paused = "";
      else delete this.dataset.paused;
    }
    get track() { return this.hasAttribute("track") ? this.getAttribute("track") || "#25252b" : ""; }
    set track(value) { if (value) this.setAttribute("track", value); else this.removeAttribute("track"); }
    get duration() { return shapeNumber(this, "duration", 0, 0, 5000); }
    set duration(value) { this.setAttribute("duration", value); }
    get points() { return this.getAttribute("points") || ""; }
    set points(value) { this.setAttribute("points", value); }
    get mode() { return this.dataset.brightpixelsMode || null; }

    get fallbackReason() { return this.dataset.brightpixelsReason || null; }

    _setMode(mode, reason = mode === "fallback" ? "renderer-error" : null) {
      if (this.dataset.brightpixelsMode === mode && this.fallbackReason === reason) return;
      this.dataset.brightpixelsMode = mode;
      if (reason) this.dataset.brightpixelsReason = reason;
      else delete this.dataset.brightpixelsReason;
      this.dispatchEvent(new CustomEvent("brightpixelsready", {
        bubbles: true, detail: { kind: "shape", mode, reason, version: VERSION },
      }));
    }

    _requestRender() {
      if (!this.isConnected || this._nearViewport === false || this._frame) return;
      this._frame = scheduleFrame((now) => {
        this._frame = 0;
        this._advanceValue(now);
        this._render();
        if (this._transition) this._requestRender();
      });
    }

    _finishTransition() {
      this._transition = null;
      this._displayValue = this.value;
      this._requestRender();
    }

    _transitionToValue() {
      const target = this.value;
      if (!this.isConnected || this.indeterminate || this._displayValue === null || !this.duration ||
          !["ring", "arc", "bar"].includes(this.shape) || this._nearViewport === false || document.hidden ||
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        this._finishTransition();
        return;
      }
      this._transition = this._displayValue === target ? null : {
        from: this._displayValue, to: target, duration: this.duration, start: null,
      };
      this._requestRender();
    }

    _advanceValue(now) {
      const transition = this._transition;
      if (!transition) return;
      if (!this.isConnected || this._nearViewport === false || document.hidden || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        this._transition = null;
        this._displayValue = this.value;
        return;
      }
      transition.start ??= now;
      const t = Math.min(1, Math.max(0, (now - transition.start) / transition.duration));
      const eased = t * t * (3 - 2 * t);
      this._displayValue = transition.from + (transition.to - transition.from) * eased;
      if (t === 1) { this._displayValue = transition.to; this._transition = null; }
    }

    pulse({ intensity = 8, duration = 1000 } = {}) {
      this.stopPulse();
      if (!this.isConnected || this._nearViewport === false || document.hidden || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      const peak = Math.max(this.intensity, normalizeIntensity(intensity, 8));
      const milliseconds = Number.isFinite(Number(duration)) ? Math.min(5000, Math.max(250, Number(duration))) : 1000;
      const base = this.intensity;
      let start;
      this._pulsing = true;
      const tick = (now) => {
        if (!this.isConnected || this._nearViewport === false || document.hidden || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { this.stopPulse(); return; }
        start ??= now;
        const t = Math.min(1, (now - start) / milliseconds);
        this._bright.intensity = base + (peak - base) * Math.sin(Math.PI * t) ** 2;
        if (t < 1) this._pulseFrame = scheduleFrame(tick);
        else this.stopPulse();
      };
      this._pulseFrame = scheduleFrame(tick);
    }

    stopPulse() {
      cancelFrame(this._pulseFrame);
      this._pulseFrame = 0;
      this._pulsing = false;
      this._bright.intensity = this.intensity;
    }

    _svg(width, height, color, endColor = "", value = this.value, isTrack = false) {
      const escape = (value) => value.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
      })[c]);
      let safeColor = escape(color);
      let defs = "";
      if (endColor) {
        const angle = this.angle * Math.PI / 180;
        const dx = Math.cos(angle) / 2, dy = Math.sin(angle) / 2;
        const paintWidth = this.shape === "path" ? 100 : width;
        const paintHeight = this.shape === "path" ? 100 : height;
        defs = `<defs><linearGradient id="paint" gradientUnits="userSpaceOnUse" x1="${(0.5 - dx) * paintWidth}" y1="${(0.5 - dy) * paintHeight}" x2="${(0.5 + dx) * paintWidth}" y2="${(0.5 + dy) * paintHeight}"><stop stop-color="${safeColor}"/><stop offset="1" stop-color="${escape(endColor)}"/></linearGradient></defs>`;
        safeColor = "url(#paint)";
      }
      const dashValues = this.dash.trim().split(/[\s,]+/).map(Number);
      const dash = !isTrack && this.dash.trim() && dashValues.every((n) => Number.isFinite(n) && n >= 0) && dashValues.some((n) => n > 0)
        ? ` stroke-dasharray="${dashValues.join(" ")}"` : "";
      const stroke = Math.min(this.thickness, Math.min(width, height) / (this.shape === "line" ? 1 : 2));
      const inset = stroke / 2;
      const fraction = value / 100;
      let body;
      if (this.shape === "arc") {
        const radius = (Math.min(width, height) - stroke) / 2;
        const sweep = this.sweep * fraction;
        const point = (angle) => { const radians = angle * Math.PI / 180; return [width / 2 + radius * Math.cos(radians), height / 2 + radius * Math.sin(radians)].join(","); };
        const middle = point(this.startAngle + sweep / 2);
        const path = sweep === 0 ? "" : `M${point(this.startAngle)} A${radius},${radius} 0 0 1 ${middle} A${radius},${radius} 0 0 1 ${point(this.startAngle + sweep)}`;
        body = `<path d="${path}" fill="none" stroke="${safeColor}" stroke-width="${stroke}"/>`;
      } else if (this.shape === "rect" || this.shape === "pill") {
        body = `<rect width="${width}" height="${height}" rx="${this.shape === "pill" ? Math.min(width, height) / 2 : this.radius}" fill="${safeColor}"/>`;
      } else if (["triangle", "diamond", "star", "polygon"].includes(this.shape)) {
        let points;
        if (this.shape === "triangle") points = [[50, 0], [100, 100], [0, 100]];
        else if (this.shape === "diamond") points = [[50, 0], [100, 50], [50, 100], [0, 50]];
        else if (this.shape === "star") points = Array.from({ length: 10 }, (_, i) => { const a = (i * 36 - 90) * Math.PI / 180, r = i % 2 ? 22 : 50; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; });
        else {
          const pairs = this.points.trim().split(/\s+/).map((pair) => pair.split(","));
          points = pairs.length >= 3 && pairs.every((pair) => pair.length === 2 && pair.every((v) => v.trim() && Number.isFinite(Number(v)))) ? pairs.map((p) => p.map(Number)) : [];
        }
        const mapped = points.map(([x, y]) => [Math.max(0, Math.min(100, x)) / 100 * width, Math.max(0, Math.min(100, y)) / 100 * height].join(",")).join(" ");
        body = `<polygon points="${mapped}" fill="${safeColor}"/>`;
      } else if (this.shape === "path") {
        body = `<svg x="${inset}" y="${inset}" width="${width - stroke}" height="${height - stroke}" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${escape(this.d)}" fill="${this.filled ? safeColor : "none"}" stroke="${safeColor}" stroke-width="${stroke}" vector-effect="non-scaling-stroke"/></svg>`;
      } else if (this.shape === "dot") {
        body = `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${safeColor}"/>`;
      } else if (this.shape === "line") {
        const pairs = this.points.trim().split(/\s+/).map((pair) => pair.split(","));
        const valid = pairs.length >= 2 && pairs.every((pair) =>
          pair.length === 2 && pair.every((n) => n.trim() !== "" && Number.isFinite(Number(n)))
        );
        const coordinates = valid ? pairs.map((pair) => pair.map(Number)) : [[0, 50], [100, 50]];
        const points = coordinates.map(([x, y]) => {
          const px = inset + Math.min(100, Math.max(0, x)) / 100 * (width - stroke);
          const py = inset + Math.min(100, Math.max(0, y)) / 100 * (height - stroke);
          return `${px},${py}`;
        }).join(" ");
        body = `<polyline points="${points}" fill="none" stroke="${safeColor}" stroke-width="${stroke}" stroke-linejoin="round"/>`;
      } else if (this.shape === "bar") {
        const filledWidth = width * fraction;
        body = `<rect width="${filledWidth}" height="${height}" rx="${Math.min(this.radius, height / 2, filledWidth / 2)}" fill="${safeColor}"/>`;
      } else if (this.shape === "outline") {
        body = `<rect x="${inset}" y="${inset}" width="${width - stroke}" height="${height - stroke}" rx="${this.radius}" fill="none" stroke="${safeColor}" stroke-width="${stroke}"/>`;
      } else {
        const radius = (Math.min(width, height) - stroke) / 2;
        const circumference = 2 * Math.PI * radius;
        body = fraction === 0 ? "" : `<circle cx="${width / 2}" cy="${height / 2}" r="${radius}" fill="none" stroke="${safeColor}" stroke-width="${stroke}" ${dash && fraction === 1 ? "" : `stroke-dasharray="${fraction * circumference} ${circumference}"`} transform="rotate(-90 ${width / 2} ${height / 2})"/>`;
      }
      // Explicit progress dash takes precedence on rings; other strokes inherit dash.
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}<g stroke-linecap="${this.linecap}" stroke-linejoin="round"${dash}>${body}</g></svg>`;
    }

    _render() {
      const { width, height } = this.getBoundingClientRect();
      if (!width || !height) return;
      if (!this._pulsing) this._bright.intensity = this.intensity;
      this._probe.style.color = "white";
      this._probe.style.color = this.color;
      const color = getComputedStyle(this._probe).color;
      let endColor = "";
      if (this.colorEnd) {
        this._probe.style.color = "white";
        this._probe.style.color = this.colorEnd;
        endColor = getComputedStyle(this._probe).color;
      }
      const showTrack = this.track && ["ring", "arc", "bar"].includes(this.shape);
      this._track.hidden = !showTrack;
      if (showTrack) {
        this._probe.style.color = "#25252b";
        this._probe.style.color = this.track;
        const trackSvg = this._svg(width, height, getComputedStyle(this._probe).color, "", 100, true);
        const trackSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trackSvg)}`;
        if (this._track.getAttribute("src") !== trackSource) this._track.src = trackSource;
      }
      const loading = this.indeterminate && ["ring", "arc", "bar"].includes(this.shape);
      const svg = this._svg(width, height, color, endColor, loading ? 25 : this._displayValue ?? this.value);
      const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      if (this._image.getAttribute("src") !== source) this._image.src = source;
    }
  };
}

const edgeEnhancements = new WeakMap();

function makeEdgeElementClass() {
  return class BrightEdgeElement extends HTMLElement {
    static get observedAttributes() { return ["color", "intensity", "thickness", "offset", "radius", "trigger"]; }
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<style>
        :host { position:absolute; display:block; pointer-events:none; z-index:1; dynamic-range-limit:no-limit; }
        :host([hidden]) { display:none; }
        bright-shape { position:absolute; inset:0; display:block; width:100%; height:100%;
          min-width:0; min-height:0; padding:0; box-sizing:border-box; }
      </style><bright-shape shape="outline" aria-hidden="true"></bright-shape>`;
      this._shape = this.shadowRoot.querySelector("bright-shape");
      this._refresh = () => this.refresh();
      this._hover = false;
      this._enter = (event) => { this._hover = event.pointerType !== "touch"; this.refresh(); };
      this._press = (event) => { if (event.pointerType === "touch") { this._pressed = true; this.refresh(); } };
      this._release = () => { this._pressed = false; this.refresh(); };
      this._leave = () => { this._hover = false; this.refresh(); };
      this._resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(this._refresh) : null;
      this._styleObserver = typeof MutationObserver === "function" ? new MutationObserver(this._refresh) : null;
    }
    connectedCallback() {
      this.setAttribute("aria-hidden", "true");
      const target = this.parentElement;
      if (!target) return;
      this._target = target;
      this._hover = Boolean(window.matchMedia?.("(any-hover: hover)").matches) && target.matches(":hover");
      if (getComputedStyle(target).position === "static") {
        this._position = { value: target.style.getPropertyValue("position"), priority: target.style.getPropertyPriority("position") };
        target.style.setProperty("position", "relative");
      }
      target.addEventListener("pointerenter", this._enter);
      target.addEventListener("pointerleave", this._leave);
      target.addEventListener("pointerdown", this._press);
      window.addEventListener("pointerup", this._release);
      window.addEventListener("pointercancel", this._release);
      target.addEventListener("focusin", this._refresh);
      target.addEventListener("focusout", this._refresh);
      this._resizeObserver?.observe(target);
      this._styleObserver?.observe(target, { attributes: true, attributeFilter: ["class", "style", "disabled"] });
      window.addEventListener("resize", this._refresh);
      this.refresh();
    }
    disconnectedCallback() {
      const target = this._target;
      this._resizeObserver?.disconnect();
      this._styleObserver?.disconnect();
      window.removeEventListener("resize", this._refresh);
      window.removeEventListener("pointerup", this._release);
      window.removeEventListener("pointercancel", this._release);
      if (target) {
        target.removeEventListener("pointerenter", this._enter);
        target.removeEventListener("pointerleave", this._leave);
        target.removeEventListener("pointerdown", this._press);
        target.removeEventListener("focusin", this._refresh);
        target.removeEventListener("focusout", this._refresh);
        if (this._position && target.style.position === "relative" && !target.style.getPropertyPriority("position")) {
          if (this._position.value) target.style.setProperty("position", this._position.value, this._position.priority);
          else target.style.removeProperty("position");
        }
      }
      this._position = null;
      this._target = null;
      this._hover = false;
      this._pressed = false;
      this._feedbackCleanup?.();
    }
    attributeChangedCallback() { this.refresh(); }
    get target() { return this._target || null; }
    get mode() { return this._shape.mode; }
    get fallbackReason() { return this._shape.fallbackReason; }
    update(options = {}) {
      for (const key of ["color", "intensity", "thickness", "offset", "radius", "trigger"]) {
        if (options[key] === null) this.removeAttribute(key);
        else if (options[key] !== undefined) this.setAttribute(key, String(options[key]));
      }
      return this;
    }
    refresh() {
      const target = this._target;
      if (!target || !this.isConnected) return;
      const style = getComputedStyle(target);
      const number = (name, fallback, min, max) => shapeNumber(this, name, fallback, min, max);
      const offset = number("offset", 0, 0, 32);
      this.hidden = this.getAttribute("trigger") === "hover" ? !(this._hover || this._pressed)
        : this.getAttribute("trigger") === "focus" ? !target.matches(":focus-within") : false;
      for (const side of ["top", "right", "bottom", "left"]) {
        this.style[side] = `${-(parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0) - offset}px`;
      }
      this._shape.color = this._feedbackColor ?? (this.getAttribute("color") || style.borderTopColor || style.color);
      this._shape.intensity = this._feedbackIntensity ?? number("intensity", 4, 1, 16);
      this._shape.thickness = number("thickness", Math.max(1, parseFloat(style.borderTopWidth) || 0), 0.5, 32);
      this._shape.radius = number("radius", (parseFloat(style.borderTopLeftRadius) || 0) + offset, 0, 1000);
    }
    destroy() {
      if (this._target && edgeEnhancements.get(this._target) === this) edgeEnhancements.delete(this._target);
      this.remove();
    }
  };
}

/** Add an inert HDR edge to existing non-replaced HTML containers. */
export function brightenEdges(targets, options = {}) {
  if (!hasDOM()) return [];
  defineBrightpixels();
  return Array.from(resolveElements(targets)).filter((target) => target instanceof HTMLElement &&
    !["input", "img", "textarea", "select", "option", "video", "audio", "canvas", "iframe", "hr", "br", "table", "tr", "tbody", "thead", "tfoot", "col", "colgroup", "html", "head"].includes(target.localName))
    .map((target) => {
      let edge = edgeEnhancements.get(target);
      if (!edge || edge.parentElement !== target) {
        edge = document.createElement("bright-edge");
        edge.update(options);
        edgeEnhancements.set(target, edge);
        target.append(edge);
      } else edge.update(options);
      return edge;
    });
}

const feedbackEnhancements = new WeakMap();
const FEEDBACK_COLORS = { press: '#8bc9ff', success: '#44efa5', error: '#ff6688', warning: '#ffd16c', complete: '#b4a0ff', notify: '#7cdeff' };

/** Small light responses for existing controls. Application actions stay with the caller. */
export function brightenFeedback(targets, options = {}) {
  if (!hasDOM()) return [];
  return Array.from(resolveElements(targets)).map((target) => {
    const existing = feedbackEnhancements.get(target);
    if (existing) return existing;
    const [edge] = brightenEdges(target, { color: options.color || FEEDBACK_COLORS.press, intensity: 1, thickness: options.thickness ?? 2 });
    if (!edge) return null;
    const baseColor = options.color || FEEDBACK_COLORS.press;
    let selected = false, frame = 0, pressed = false, pointerId = null, keyboardKey = null, disposed = false;
    const listeners = [];
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    function listen(object, type, callback) {
      object.addEventListener(type, callback); listeners.push(() => object.removeEventListener(type, callback));
    }
    function stop() { cancelFrame(frame); frame = 0; }
    function paint(color, intensity) {
      edge._feedbackColor = color; edge._feedbackIntensity = intensity;
      edge._shape.color = color; edge._shape.intensity = intensity;
    }
    function idle() {
      stop();
      edge.style.visibility = selected ? 'visible' : 'hidden';
      paint(baseColor, selected ? 2 : 1);
    }
    function animate(kind = 'notify', duration = 650, decay = false) {
      if (disposed || !target.isConnected || document.hidden) return;
      stop();
      edge.style.visibility = 'visible';
      const color = options.color || FEEDBACK_COLORS[kind] || FEEDBACK_COLORS.notify;
      paint(color, decay ? 8 : 1);
      if (prefersReducedMotion()) { idle(); return; }
      let start;
      const tick = (now) => {
        frame = 0;
        if (disposed || !target.isConnected || document.hidden || edge._shape._nearViewport === false || prefersReducedMotion()) { idle(); return; }
        start ??= now;
        const progress = Math.min(1, (now - start) / duration);
        const light = decay ? (1 - progress) ** 2 : Math.sin(Math.PI * progress) ** 2;
        paint(color, 1 + 7 * light);
        if (progress < 1) frame = scheduleFrame(tick);
        else idle();
      };
      frame = scheduleFrame(tick);
    }
    const disabled = () => target.matches(':disabled') || target.getAttribute('aria-disabled') === 'true';
    function down() {
      if (disposed || disabled()) return;
      stop(); pressed = true;
      edge.style.visibility = 'visible'; paint(baseColor, 8);
    }
    function release(cancelled = false) {
      if (!pressed) return;
      pressed = false; pointerId = null; keyboardKey = null;
      if (cancelled) idle(); else animate('press', 450, true);
    }
    if (options.press !== false) {
      listen(target, 'pointerdown', (event) => {
        if (event.button !== 0 || pointerId !== null || disabled()) return;
        pointerId = event.pointerId; down();
      });
      listen(window, 'pointerup', (event) => { if (event.pointerId === pointerId) release(); });
      listen(window, 'pointercancel', (event) => { if (event.pointerId === pointerId) release(true); });
      listen(target, 'keydown', (event) => {
        if (!['Enter', ' '].includes(event.key) || event.repeat || event.target !== target || disabled()) return;
        keyboardKey = event.key; down();
      });
      listen(target, 'keyup', (event) => { if (event.key === keyboardKey) release(); });
    }
    listen(target, 'blur', () => release(true));
    listen(window, 'blur', () => { pressed = false; pointerId = null; keyboardKey = null; idle(); });
    listen(document, 'visibilitychange', () => { if (document.hidden) { pressed = false; pointerId = null; keyboardKey = null; idle(); } });
    if (reduced?.addEventListener) listen(reduced, 'change', idle);
    const controller = {
      target, edge,
      flash(kind = 'notify') { pressed = false; pointerId = null; keyboardKey = null; animate(kind); return controller; },
      select(value = true) { if (disposed) return controller; selected = Boolean(value); idle(); return controller; },
      cancel() { pressed = false; pointerId = null; keyboardKey = null; idle(); return controller; },
      destroy() {
        if (disposed) return;
        disposed = true; stop(); for (const remove of listeners) remove();
        edge.destroy(); feedbackEnhancements.delete(target);
      },
    };
    edge._feedbackCleanup = () => controller.destroy();
    idle(); feedbackEnhancements.set(target, controller);
    return controller;
  }).filter(Boolean);
}

export function defineBrightpixels() {
  if (!hasDOM()) return null;

  let BrightTextElement = customElements.get(TEXT_TAG_NAME);
  if (!BrightTextElement) {
    BrightTextElement = makeTextElementClass();
    customElements.define(TEXT_TAG_NAME, BrightTextElement);
  }

  if (!customElements.get(IMAGE_TAG_NAME)) {
    customElements.define(IMAGE_TAG_NAME, makeImageElementClass());
  }

  if (!customElements.get("bright-shape")) {
    customElements.define("bright-shape", makeShapeElementClass());
  }

  if (!customElements.get("bright-edge")) customElements.define("bright-edge", makeEdgeElementClass());

  return BrightTextElement;
}

export function brighten(targets, settings = {}) {
  if (!hasDOM()) return [];
  defineBrightpixels();

  return Array.from(resolveElements(targets))
    .filter((element) => element instanceof Element)
    .map((element) => {
      let bright = element.localName === TEXT_TAG_NAME ? element : null;

      if (!bright) {
        const children = Array.from(element.children);
        bright = children.find((child) =>
          child.localName === TEXT_TAG_NAME && child.hasAttribute("data-brightpixels-wrapper")
        );
      }

      if (!bright) {
        bright = document.createElement(TEXT_TAG_NAME);
        bright.setAttribute("data-brightpixels-wrapper", "");
        while (element.firstChild) bright.append(element.firstChild);
        element.append(bright);
      }

      if (settings.intensity !== undefined) bright.intensity = settings.intensity;
      if (settings.color !== undefined) bright.color = settings.color;
      return bright;
    });
}

export function brightenImages(targets, settings = {}) {
  if (!hasDOM()) return [];
  defineBrightpixels();

  return Array.from(resolveElements(targets))
    .filter((element) => element instanceof Element)
    .map((element) => {
      if (element.localName === IMAGE_TAG_NAME) return element;
      if (element.localName !== "img") return null;

      let bright = element.parentElement?.localName === IMAGE_TAG_NAME
        ? element.parentElement
        : null;

      if (!bright) {
        bright = document.createElement(IMAGE_TAG_NAME);
        bright.setAttribute("data-brightpixels-wrapper", "");
        element.before(bright);
        bright.append(element);
      }

      return bright;
    })
    .filter(Boolean)
    .map((bright) => {
      if (settings.intensity !== undefined) bright.intensity = settings.intensity;
      if (settings.boost !== undefined) bright.boost = settings.boost;
      return bright;
    });
}

export const version = VERSION;

if (hasDOM()) defineBrightpixels();
