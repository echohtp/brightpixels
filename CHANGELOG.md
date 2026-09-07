# Changelog

## 1.3.0 — 2026-09-07

- Add `brightenSurface` for real HDR pointer spotlights, touch-origin ripples, connected container feedback and travelling border lights.
- Add optional `brightpixels/react-surface` with semantic server markup, live options, ref controls and StrictMode cleanup.
- Share GPU devices and animation scheduling with the core; bound waves, suspend offscreen/hidden work, and provide static reduced-motion feedback and canvas fallbacks.
- Coordinate positioning between independent edge and surface enhancements.
- Add the interactive surface demo, API documentation, browser lifecycle checks and HDR pixel readback coverage.

## 1.2.0 — 2026-09-07

- Add `brightpixels/confetti` and optional `brightpixels/react-confetti` with a
  falling HDR shower, recycling, pause/resume, source rectangles, colors, wind,
  completion callbacks, and a restart handle.
- Add tumbling paper, exact initial velocities, horizontal acceleration, opacity,
  and pause/resume to the existing particle engine. TypeGPU generates its updated layout.
- Preserve SSR safety and React Strict Mode cleanup. React 18/19 is an optional
  peer; the vanilla entries keep zero runtime dependencies.
- Add the React confetti demo, migration notes, bounded fallback emission, and
  reduced-motion behavior.

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
