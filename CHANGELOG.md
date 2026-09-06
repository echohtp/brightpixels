# Changelog

## 1.0.0 — 2026-09-06

First stable public API release for dependency-free HDR text, images and shapes.

- Three custom elements, thirteen shape primitives, Display P3 color, tracks,
  gradients, progress transitions, loading states and one-shot pulses.
- Global HDR/brightness controls and auto/high/low rendering quality. Viewport-aware
  setup defers GPU work until nearby; offscreen animations pause or settle.
- Capability snapshots and per-element fallback reasons, with TypeScript declarations
  and an optional React typing entry point.
- Live playground and hardware comparison page with local JSON diagnostics.

### Compatibility and known limitations

The documented public API follows semantic versioning for 1.x. Internal
underscore-prefixed members are not part of that contract.

HDR output depends on browser, OS, display and settings. A renderer reporting HDR
or passing software GPU tests does not establish physical luminance. Real-device
observations are tracked in HARDWARE_VALIDATION.md and remain pending.

npm publication is deferred separately from the GitHub release and demo deployment.
