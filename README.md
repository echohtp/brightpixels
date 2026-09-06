# Brightpixels

Dependency-free JavaScript web components for HDR text, image highlights, and native shapes. Brightpixels uses an extended-range WebGPU canvas and preserves fallback content when rendering is unavailable.

[Demo](https://echohtp.github.io/brightpixels/) · [Image comparisons](https://echohtp.github.io/brightpixels/#images) · [Hardware test](https://echohtp.github.io/brightpixels/hardware.html)

## What's new in 1.0

- Stable public API for HDR text, images, shapes, progress and status indicators.
- Viewport-aware rendering and auto/high/low quality controls.
- Capability snapshots, fallback reasons and copyable hardware diagnostics.
- Chromium/WebKit browser checks and React / TypeScript integration checks.

[Try the hardware demo](https://echohtp.github.io/brightpixels/hardware.html).

## Installation

Install version 1.0.0 from the GitHub release tarball while registry publication is deferred:

```bash
npm install https://github.com/echohtp/brightpixels/releases/download/v1.0.0/brightpixels-1.0.0.tgz
```

The following installs the currently published registry version, which may be older:

```bash
npm install brightpixels
```

Import the package once to register `<bright-text>` and `<bright-image>`:

```js
import "brightpixels";
```

For a page without a bundler, copy `index.js` from this repository and load it as a module:

```html
<script type="module" src="./index.js"></script>
```

## Text

Wrap a short text fragment:

```html
<h1><bright-text intensity="12">HDR text</bright-text></h1>
<p>An example of <bright-text intensity="8">inline emphasis</bright-text>.</p>
```

New in 0.2.0: add a CSS `color` to brighten colored text, including Display P3:

```html
<bright-text color="color(display-p3 1 0.35 0)" intensity="4">Orange, brighter.</bright-text>
```

Or use `brighten(".headline", { color: "#ff5900", intensity: 4 })`.
Color defaults to white. `intensity` multiplies linear light, preserving the color
ratios before the display's tone mapping. P3 output requires compatible browser
and display support. Without HDR, text keeps its chosen color at normal brightness.

Apply typography with CSS:

```css
h1 {
  font-family: system-ui, sans-serif;
  font-size: clamp(2rem, 8vw, 6rem);
  font-weight: 700;
}
```

To wrap an existing element's content:

```js
import { brighten } from "brightpixels";

const [heading] = brighten(".headline", { intensity: 12 });
heading.intensity = 8;
```

Text remains selectable. The current renderer handles plain-text fragments of up to 128 characters on a single line; split longer content into shorter wrappers.

## Images

`<bright-image>` takes an ordinary `<img>`. It increases the image's brightest pixels, with a stronger multiplier toward white. The original image supplies layout, alternative text, and fallback content.

The previews below link to running comparisons that use the same source image with and without Brightpixels.

| Sunlit water | Reflective metal | Night lights |
| --- | --- | --- |
| [![Sunlight reflected on dark blue water](https://raw.githubusercontent.com/echohtp/brightpixels/main/assets/examples/ocean.png)](https://echohtp.github.io/brightpixels/#image-ocean) | [![Polished chrome reflecting white studio lights](https://raw.githubusercontent.com/echohtp/brightpixels/main/assets/examples/chrome.png)](https://echohtp.github.io/brightpixels/#image-chrome) | [![White streetlights reflected on wet pavement](https://raw.githubusercontent.com/echohtp/brightpixels/main/assets/examples/night.png)](https://echohtp.github.io/brightpixels/#image-night) |
| `intensity="6"` | `intensity="8"` | `intensity="12"` |

### HTML wrapper

To brighten every color in an image, icon, or illustration, use `boost="all"`:

```html
<bright-image boost="all" intensity="4">
  <img src="./icon.svg" alt="Orange icon" />
</bright-image>
```

Or use `brightenImages(".icon", { boost: "all", intensity: 4 })`.
The default `boost="highlights"` preserves the existing highlight-only behavior.
Image color is preserved in Display P3 where the browser supports it. This wraps
an `<img>`, including SVG image files; it does not render arbitrary HTML children.

Use an image URL from your application. The sample files are in this repository's `assets/examples/` directory.

```html
<bright-image intensity="6">
  <img
    src="./assets/examples/ocean.png"
    alt="Sunlight reflected on dark blue water"
    width="1536"
    height="1024"
  />
</bright-image>

<bright-image intensity="8">
  <img src="./assets/examples/chrome.png" alt="Reflective chrome ring" />
</bright-image>

<bright-image intensity="12">
  <img src="./assets/examples/night.png" alt="Streetlights on wet pavement" />
</bright-image>
```

Preserve the image's aspect ratio in responsive layouts:

```css
bright-image,
bright-image img {
  display: block;
  width: 100%;
}

bright-image img {
  height: auto;
}
```

### JavaScript wrapper

Wrap matching `<img>` elements in place:

```html
<img class="hdr-photo" src="./assets/examples/chrome.png" alt="Reflective chrome ring" />
```

```js
import { brightenImages } from "brightpixels";

const [photo] = brightenImages(".hdr-photo", { intensity: 8 });
photo.intensity = 6;
```

### Remote images

Images hosted on another origin need CORS permission to be read by the renderer:

```html
<bright-image intensity="8">
  <img
    crossorigin="anonymous"
    src="https://images.example.com/photo.jpg"
    alt="Image description"
  />
</bright-image>
```

The image server must send an appropriate `Access-Control-Allow-Origin` header. Same-origin images need no CORS configuration. If the original image loads but cannot be read by the canvas, it remains visible as the fallback.

## Shapes

`<bright-shape>` draws native SVG shapes through the existing HDR image renderer.
No charting, animation, or other third-party library is needed.

```html
<bright-shape shape="ring" color="#ff5900" intensity="4" aria-hidden="true"></bright-shape>

<bright-shape shape="outline" color="color(display-p3 1 0.35 0)" intensity="4">
  <button>Selected action</button>
</bright-shape>

<bright-shape shape="bar" value="65" color="#26df8b" intensity="4"
  role="progressbar" aria-label="Upload" aria-valuemin="0" aria-valuemax="100"
  aria-valuenow="65"></bright-shape>
```

Set `value` from 0–100 for a partial ring or progress bar; omit it for a full shape.
Update the `.value` property from your app, and keep `aria-valuenow` synchronized
when using progress semantics. Decorative shapes can use `aria-hidden="true"`.
Outlines leave their HTML children interactive and at normal brightness.

Use CSS `width` and `height` for dimensions, `thickness` for ring/outline/line stroke
width (default 4 CSS pixels), and `radius` for outline/bar corners (default 12).
Without HDR, the same colored SVG remains visible. Shapes update on demand with
no continuous animation loop. Content Security Policy must allow `data:` images.

### Dots and lines

```html
<!-- A status light; unequal CSS width/height makes an ellipse. -->
<bright-shape shape="dot" color="#26df8b" intensity="4" aria-hidden="true"></bright-shape>

<!-- A horizontal divider or underline. -->
<bright-shape shape="line" thickness="2" color="#ff5900" intensity="4" aria-hidden="true"></bright-shape>

<!-- A sparkline without a charting library. -->
<bright-shape shape="line" points="0,80 25,55 50,65 75,30 100,10"
  style="width:12rem;height:4rem" color="#26df8b" intensity="4"
  role="img" aria-label="Activity increased overall"></bright-shape>
```

`points` uses space-separated `x,y` pairs in a 0–100 coordinate system, with
`0,0` at the top left. Coordinates are clamped to that range, and stroke padding
keeps round caps inside the element. Empty or invalid points produce a horizontal
line. Update `.points` to change a series. These are visual primitives, so provide
labels or accompanying data for meaningful charts and status indicators.

### Loading and status presets

```html
<bright-shape id="upload-state" status="loading" track intensity="3"
  aria-hidden="true"></bright-shape>
<span id="upload-label" role="status">Uploading…</span>

<bright-shape shape="bar" indeterminate track intensity="3"
  role="progressbar" aria-label="Upload in progress"></bright-shape>
```

```js
const indicator = document.querySelector("#upload-state");
indicator.setStatus("success", { pulse: true });
document.querySelector("#upload-label").textContent = "Uploaded";
```

`status` supports `loading`, `success`, `warning`, and `error`. Each supplies a
default shape, color, and path where appropriate. Explicit `shape`, `color`, or
`d` attributes override those defaults. Clear `.status` with an empty string.
`setStatus()` cancels any old pulse; its optional `pulse` runs only for a terminal
status. Plain attribute/property status updates do not pulse automatically.

`indeterminate` enables native loading motion on rings, arcs, and bars. Loading
presets imply it; changing the preset away from loading stops it unless an
explicit `indeterminate` attribute remains. The SVG and GPU texture stay cached
while CSS animates their transform. Reduced-motion users see a steady indicator,
and hidden pages pause it. `value` is ignored while indeterminate. Omit
`aria-valuenow` for unknown progress; provide visible labels so color or motion
is never the only signal.

### Background tracks and smooth progress

```html
<bright-shape shape="ring" value="25" track="#25252b" duration="500"
  color="#26df8b" intensity="4" role="progressbar" aria-label="Upload"
  aria-valuemin="0" aria-valuemax="100" aria-valuenow="25"></bright-shape>
```

```js
const progress = document.querySelector("bright-shape");
progress.value = 80; // Glides from its current displayed value to 80%.
progress.setAttribute("aria-valuenow", "80");
```

`track` adds a full background rail to rings, arcs, and bars. A bare `track`
attribute uses dark gray; a CSS color customizes it. The track is rendered as
ordinary SVG behind the HDR foreground, so intensity changes and pulses do not
brighten it. Omit `track` or set `.track = ""` to disable it. Tracks are solid even
when the foreground has dashes.

`duration` enables smooth progress changes in milliseconds (0–5000; default 0).
The initial value appears immediately. Later attribute or property updates ease
from the currently displayed value, including when an update interrupts another.
The `.value` property always reports the latest target. Reduced motion, hidden
pages, and disconnected elements settle immediately without an animation loop.
Changing shape or duration also settles the current transition. Pulse brightness
and progress motion can run together.

### More primitives and paint options

The [interactive playground](https://echohtp.github.io/brightpixels/#playground)
includes a shape picker, color and gradient controls, progress, stroke settings,
editable paths, and a generated HTML example.

| Shapes | Use |
| --- | --- |
| `ring`, `arc`, `bar` | Progress and gauges; `value` controls completion. |
| `outline`, `line` | Borders, dividers, and polylines. |
| `dot`, `rect`, `pill` | Filled ellipses, rectangles, and capsules. |
| `triangle`, `diamond`, `star` | Filled symbols. |
| `polygon`, `path` | Custom geometry, using `points` or SVG `d`. |

```html
<!-- Gauge: clockwise from 135 degrees, across a 270-degree sweep. -->
<bright-shape shape="arc" start-angle="135" sweep="270" value="75"
  color="#ff5900" color-end="#ffca36" intensity="3"></bright-shape>

<!-- Segmented indicator. -->
<bright-shape shape="ring" dash="6 8" linecap="butt"
  thickness="5" color="#26df8b" intensity="3"></bright-shape>

<!-- Native checkmark. Path coordinates use a 0–100 viewBox. -->
<bright-shape shape="path" d="M15 50 L40 75 L85 20"
  color="#26df8b" intensity="3"></bright-shape>

<!-- A filled gradient badge. -->
<bright-shape shape="pill" color="#ff5900" color-end="#ffca36"
  angle="0" intensity="3"></bright-shape>
```

`color-end` enables a two-color linear gradient; omit it for a solid color.
`angle="0"` runs left to right and `angle="90"` runs top to bottom. Both colors
accept CSS colors, including Display P3 where supported.

`dash` accepts nonnegative lengths separated by spaces or commas. `linecap` is
`round` (default), `butt`, or `square`. On partially filled rings, the progress
arc takes precedence over decorative dashes. Arcs support dashes at any value.
Arc `start-angle` defaults to -90 (top), `sweep` to 270 degrees, and `value` to 100.

Polygons need at least three `points`; invalid polygons draw nothing. Custom
paths use SVG `d` in a 0–100 viewBox stretched to the element's dimensions. They
are stroked by default; add the boolean `filled` attribute to fill them too.
Invalid path syntax follows the browser's SVG rendering behavior. Attribute
values are escaped before SVG generation.

### One-shot brightness pulses

```js
const indicator = document.querySelector("bright-shape");
indicator.pulse({ intensity: 8, duration: 1200 });
// Optional: cancel early and restore the base intensity.
indicator.stopPulse();
```

The pulse rises smoothly from the element's base intensity to the requested peak
and back. It never lowers a brighter base, clamps peak intensity to 1–16 and
duration to 250–5000 milliseconds, and cancels a previous pulse when retriggered.
It skips reduced-motion users and hidden pages, stops on disconnect or a base
intensity change, and leaves no animation loop running afterward. Only the HDR
signal changes; fallback SVG stays at ordinary brightness. Use a visible label
or state change as well when communicating task completion.

## Wide-gamut color experiment

The [color demo](https://echohtp.github.io/brightpixels/#color) compares sRGB orange,
Display P3 orange, and the P3 color at four times the encoded light level. This is
a standalone 16-bit BT.2020/PQ PNG displayed directly by the browser, separate from the web components. Display and browser support determine the
visible result. Regenerate it with `node assets/examples/color-comparison.mjs`.

## React

The React 19 entry registers the web components and provides TypeScript JSX declarations:

```tsx
import "brightpixels/react";

export function Example() {
  return (
    <article>
      <h1><bright-text intensity={12}>HDR text</bright-text></h1>
      <bright-image intensity={8}>
        <img src="/photos/chrome.png" alt="Reflective chrome ring" />
      </bright-image>
    </article>
  );
}
```

`brightpixels/react` re-exports the package API and has no React runtime dependency. Import it from client-side application code when using a framework with server rendering.

## API

### Page-wide HDR control

```js
import { configureBrightpixels, getBrightpixelsConfig } from "brightpixels";

configureBrightpixels({ brightness: 0.5 }); // Half the extra light above reference.
configureBrightpixels({ enabled: false }); // Release HDR renderers; keep fallbacks.
configureBrightpixels({ enabled: true, brightness: 1 });
console.log(getBrightpixelsConfig()); // { enabled: true, brightness: 1 }
```

Settings apply to current and future components created by this imported module.
`brightness` is clamped to 0–1: zero returns HDR signals to reference intensity;
it does not make content black. `enabled: false` releases GPU resources and shows
normal text, original images, and SVG shapes. Re-enabling attempts HDR again.
The setting does not suppress loading-state communication. Reads return a copy,
and imports/configuration remain safe without a browser DOM. Use one package
instance for a page-wide setting; independently loaded copies have separate state.

| Export | Description |
| --- | --- |
| `brighten(targets, settings?)` | Wraps element contents and returns `BrightTextElement[]`. |
| `brightenImages(targets, settings?)` | Wraps images and returns `BrightImageElement[]`. |
| `defineBrightpixels()` | Registers the custom elements; registration also runs on browser import. |
| `version` | Package version string. |
| `configureBrightpixels(options?)` | Applies global `enabled` and `brightness` settings and returns their current values. |
| `getBrightpixelsConfig()` | Returns a copy of the current global settings. |

Both helpers accept a CSS selector, an element, or an iterable of elements. Existing Brightpixels wrappers are reused. Imports are safe in environments without a DOM; helpers return empty arrays there.

### Settings and element properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `intensity` | `number` | `16` | HDR signal multiplier, clamped to `1`–`16`. Available as an attribute or property. |
| `mode` | `"hdr" \| "fallback" \| null` | `null` | Read-only renderer state. |
| `image` | `HTMLImageElement \| null` | `null` | Read-only source image on `<bright-image>`. |

`intensity: 1` uses reference white. Higher values request more light; physical screen brightness is determined by the browser, operating system, and display.

### Events

Elements dispatch a bubbling `brightpixelsready` event when their rendering mode changes:

```js
document.addEventListener("brightpixelsready", (event) => {
  const { kind, mode, version } = event.detail;
  console.log(kind, mode, version);
});
```

`kind` is `"text"`, `"image"`, or `"shape"`; `mode` is `"hdr"` or `"fallback"`. The `"hdr"` value indicates that the WebGPU renderer initialized. It does not measure the display's brightness.

## Rendering requirements

HDR output requires HTTPS or localhost, WebGPU with extended-range canvas output, and a compatible display and operating system configuration. Standard-range screens may show no brightness difference.

The renderer uploads a text mask or image to WebGPU and renders to an `rgba16float` canvas with extended tone mapping. Text falls back to ordinary white; images fall back to their original `<img>`.

Demo assets are kept in the repository and excluded from the runtime package.

## Contributing

See [CONTRIBUTING.md](https://github.com/echohtp/brightpixels/blob/main/CONTRIBUTING.md) for development and maintenance.

## License

[MIT](./LICENSE.txt)

### Rendering performance and diagnostics

```js
import { configureBrightpixels, getBrightpixelsCapabilities } from "brightpixels";

configureBrightpixels({ quality: "auto" }); // default
console.log(getBrightpixelsCapabilities());
console.log(document.querySelector("bright-text").fallbackReason);
```

`quality` accepts `auto`, `high`, or `low`. High uses device pixel ratio up to 2×;
low uses up to 1×. Auto preserves that detail for small samples and caps larger
canvases near one million pixels, with a minimum scale of 1×. Quality changes
resize existing canvases; they do not change the requested HDR intensity.

HDR setup is deferred until elements come within 200 CSS pixels of the viewport.
Offscreen shape animations pause, pulses stop, and progress settles to its latest
value. Existing GPU resources are retained for returning elements and released
on disconnect or global disable. Without IntersectionObserver, rendering remains
eager. Static samples do not run a continuous render loop.

`getBrightpixelsCapabilities()` returns fresh boolean browser signals: `webgpu`,
`hdr`, `p3`, `reducedMotion`, and `intersectionObserver`. It is safe to call during
SSR and does not request a GPU. These signals do not prove physical HDR output.

All elements expose `fallbackReason`: `disabled`, `offscreen`,
`webgpu-unavailable`, `device-lost`, `missing-image`, or `renderer-error` (or `null`
when no fallback reason is set). The `brightpixelsready` event includes `reason`
and fires when the reason changes, even if the mode stays `fallback`.


### Version 1.0 compatibility

The documented custom elements, configuration functions, capability snapshot and
TypeScript/React entry points form the 1.x public API. Breaking public API changes
require a major version. Underscore-prefixed members are internal; browser capability
signals and physical HDR output remain device-dependent.

See [release notes](https://github.com/echohtp/brightpixels/blob/main/CHANGELOG.md) and [hardware validation status](https://github.com/echohtp/brightpixels/blob/main/HARDWARE_VALIDATION.md)
for tested behavior and compatibility details.

### Existing-element edges (unreleased)

[Try the edge demo](https://echohtp.github.io/brightpixels/edges.html). This helper
is in repository source; it is not included in the tagged 1.0.0 package.

```js
import { brightenEdges } from './index.js';

const [edge] = brightenEdges('.my-card', {
  color: 'color(display-p3 0.2 1 0.65)',
  intensity: 4,
  thickness: 2,
  trigger: 'always', // or 'hover' / 'focus' (includes focus within)
});
edge.update({ offset: 4, trigger: 'focus' });
edge.refresh(); // re-read styles after external stylesheet changes
edge.destroy();
```

The helper appends an absolutely positioned, pointer-inert, accessibility-hidden
`bright-edge` overlay. It preserves existing children, handlers and focus styles.
Repeated calls update the existing enhancement. Static targets temporarily receive
`position: relative`; removing the enhancement restores the prior inline value
if it has not been changed by the application. Positioning can affect existing
absolutely positioned descendants, so use an existing positioned container where
that matters.

Use block or inline-block HTML containers such as cards, buttons and links.
Replaced elements and controls that cannot contain an overlay are skipped; enhance
a containing element for inputs, images and SVGs. Hover-triggered edges also appear while pressing with touch. The demo’s “Show all
edges” control makes interaction examples visible without hover or keyboard focus.
Existing overflow clipping still
applies to outward offsets. The default uses the top border color/width and a
uniform pixel corner radius; set `radius` explicitly for percentage or asymmetric
corners. Host class/style changes and resizing refresh the edge automatically.

This enhances an edge only; fills, arbitrary SVG strokes, and text decorations are
not part of this helper. HDR still depends on the renderer and display, with an
ordinary-color edge fallback when HDR is unavailable.
