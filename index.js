const VERSION = "0.1.0";
const TEXT_TAG_NAME = "bright-text";
const IMAGE_TAG_NAME = "bright-image";
const DEFAULT_INTENSITY = 16;

let devicePromise;
const pipelineCache = new WeakMap();

const FRAGMENTS = {
  text: `
    let mask = pow(textureSample(sourceTexture, sourceSampler, input.uv).a, 0.82);
    return vec4f(vec3f(settings.x * mask), mask);
  `,
  image: `
    let pixel = textureSample(sourceTexture, sourceSampler, input.uv);
    let luminance = dot(pixel.rgb, vec3f(0.2126, 0.7152, 0.0722));
    let highlight = smoothstep(0.55, 1.0, luminance);
    let multiplier = mix(1.0, settings.x, highlight * highlight);
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
      return ["intensity"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
      this._frame = this.shadowRoot.querySelector(".frame");
      this._glyphs = this.shadowRoot.querySelector(".glyphs");
      this._canvas = this.shadowRoot.querySelector("canvas");
      this._mask = document.createElement("canvas");
      this._maskContext = this._mask.getContext("2d");
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
          if (!this.isConnected) return;
          this._syncText();
          this._resize();
          return this._initHDR();
        });
    }

    disconnectedCallback() {
      this._resizeObserver?.disconnect();
      this._textObserver?.disconnect();
      window.removeEventListener("resize", this._onWindowResize);
      cancelAnimationFrame(this._animationFrame);
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

    _syncText() {
      this._text = (this.textContent || "BRIGHTPIXELS").trim().slice(0, 128) || "BRIGHTPIXELS";
      this._glyphs.textContent = this._text;
      this._maskDirty = true;
      this._resize();
    }

    _resize() {
      const rect = this._frame.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
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
      if (!this._gpu || this._animationFrame) return;
      this._animationFrame = requestAnimationFrame(() => this._render());
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

      this._gpu.maskTexture?.destroy();
      this._gpu.maskTexture = this._gpu.device.createTexture({
        size: [width, height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this._gpu.device.queue.copyExternalImageToTexture(
        { source: this._mask },
        { texture: this._gpu.maskTexture },
        [width, height]
      );
      this._gpu.bindGroup = this._gpu.device.createBindGroup({
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
      if (!this.isConnected || !this._gpu) return;

      try {
        if (this._maskDirty) this._drawMask();
        if (!this._gpu.bindGroup) return;

        this._gpu.device.queue.writeBuffer(
          this._gpu.uniformBuffer,
          0,
          new Float32Array([this.intensity, 0, 0, 0])
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

    _initHDR() {
      if (this._gpu || this._initializing) return this._initializing;
      this._initializing = this._createHDR().finally(() => {
        this._initializing = null;
      });
      return this._initializing;
    }

    async _createHDR() {
      if (!navigator.gpu || !this._canvas) {
        this._setMode("fallback");
        return;
      }

      try {
        const device = await getDevice();
        if (!this.isConnected) return;
        const context = this._canvas.getContext("webgpu");
        if (!context) throw new Error("No WebGPU context");

        context.configure({
          device,
          format: "rgba16float",
          alphaMode: "premultiplied",
          toneMapping: { mode: "extended" },
        });

        const pipeline = await getPipeline(device, "text");
        if (!this.isConnected) {
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
          if (this.isConnected) this._setMode("fallback");
        });
        this._maskDirty = true;
        this._resize();
        this._setMode("hdr");
        this._requestRender();
      } catch {
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback");
      }
    }

    _setMode(mode) {
      if (this.dataset.brightpixelsMode === mode) return;
      this.dataset.brightpixelsMode = mode;
      this.dispatchEvent(new CustomEvent("brightpixelsready", {
        bubbles: true,
        detail: { kind: "text", mode, version: VERSION },
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
      return ["intensity"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
      this._canvas = this.shadowRoot.querySelector("canvas");
      this._source = document.createElement("canvas");
      this._sourceContext = this._source.getContext("2d");
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
      cancelAnimationFrame(this._animationFrame);
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
        this._setMode("fallback");
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
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
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
      if (!this._gpu || !this._image || this._animationFrame) return;
      this._animationFrame = requestAnimationFrame(() => this._render());
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

      this._gpu.sourceTexture?.destroy();
      this._gpu.sourceTexture = this._gpu.device.createTexture({
        size: [width, height, 1],
        format: "rgba8unorm-srgb",
        usage: GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this._gpu.device.queue.copyExternalImageToTexture(
        { source: this._source },
        { texture: this._gpu.sourceTexture },
        [width, height]
      );
      this._gpu.bindGroup = this._gpu.device.createBindGroup({
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
      if (!this.isConnected || !this._gpu) return;

      try {
        if (this._sourceDirty && !this._drawSource()) return;
        if (!this._gpu.bindGroup) return;

        this._gpu.device.queue.writeBuffer(
          this._gpu.uniformBuffer,
          0,
          new Float32Array([this.intensity, 0, 0, 0])
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

    _initHDR() {
      if (this._gpu || this._initializing) return this._initializing;
      this._initializing = this._createHDR().finally(() => {
        this._initializing = null;
      });
      return this._initializing;
    }

    async _createHDR() {
      if (!navigator.gpu || !this._canvas) {
        this._setMode("fallback");
        return;
      }

      try {
        const device = await getDevice();
        if (!this.isConnected) return;
        const context = this._canvas.getContext("webgpu");
        if (!context) throw new Error("No WebGPU context");

        context.configure({
          device,
          format: "rgba16float",
          alphaMode: "premultiplied",
          toneMapping: { mode: "extended" },
        });

        const pipeline = await getPipeline(device, "image");
        if (!this.isConnected) {
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
          if (this.isConnected) this._setMode("fallback");
        });
        this._sourceDirty = true;
        this._resize();
        this._setMode("hdr");
        this._requestRender();
      } catch {
        releaseGPU(this._gpu);
        this._gpu = null;
        this._setMode("fallback");
      }
    }

    _setMode(mode) {
      if (this.dataset.brightpixelsMode === mode) return;
      this.dataset.brightpixelsMode = mode;
      this.dispatchEvent(new CustomEvent("brightpixelsready", {
        bubbles: true,
        detail: { kind: "image", mode, version: VERSION },
      }));
    }
  };
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
      return bright;
    });
}

export const version = VERSION;

if (hasDOM()) defineBrightpixels();
