# Changelog

## 1.1.0 — 2026-09-07

- Add the optional `brightpixels/particles` entry point with confetti, sparks and
  pointer trails sharing a reusable viewport canvas per engine.
- Compute particle motion on the GPU and render with an instanced rgba16float
  pipeline. TypeGPU generates shader structures and buffer offsets at build time;
  the npm package keeps zero runtime dependencies.
- Add a capped canvas fallback, reduced-motion sparkles, lifecycle cleanup and
  integration with global HDR, brightness and quality controls.
- Upgrade Dreamnet’s cannon and add the particle lab with TypeScript examples.


## 1.0.0 — 2026-09-06

First stable public API release for dependency-free HDR text, images and shapes.

- HDR text, image and shape elements, thirteen shape primitives, Display P3 color, tracks,
  gradients, progress transitions, loading states and one-shot pulses.
- Global HDR/brightness controls and auto/high/low rendering quality. Viewport-aware
  setup defers GPU work until nearby; offscreen animations pause or settle.
- Capability snapshots and per-element fallback reasons, with TypeScript declarations
  and an optional React typing entry point.
- Live playground and hardware comparison page with local JSON diagnostics.
- `brightenEdges` for existing containers and `brightenFeedback` for touch, mouse
  and keyboard press, outcome and selection glow.
- Mobile interaction recipes and downloadable neon themes with container lighting,
  background trails and confetti (demo source, separate from npm exports).

### Compatibility and known limitations

The documented public API follows semantic versioning for 1.x. Internal
underscore-prefixed members are not part of that contract.

HDR output depends on browser, OS, display and settings. A renderer reporting HDR
or passing software GPU tests does not establish physical luminance. Real-device
observations are tracked in HARDWARE_VALIDATION.md and remain pending.

The npm 1.0.0 package includes the edge and feedback helpers added after the
earlier GitHub v1.0.0 snapshot; the historical GitHub tag is unchanged.
