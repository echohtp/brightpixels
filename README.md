# Brightpixels

A tiny, dependency-free JavaScript library that lifts text and image highlights above ordinary white on supported HDR screens.

- One setting: `intensity`
- No visible controls, animation, glow, or decoration
- Keeps text selectable and copyable
- Keeps the original image and its alt text
- Inherits existing typography and layout
- Falls back to the original white text or image

[View the live HDR demo](https://echohtp.github.io/brightpixels/)

The repository root is the demo source. GitHub Pages can publish it directly
from the `main` branch with no build step.

## Install

```bash
npm install brightpixels
```

Import it once:

```js
import "brightpixels";
```

## Complete inline example

GitHub shows this as code because README pages do not run package JavaScript. Save it as `index.html` and open it from HTTPS or localhost to try the real HDR output.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Brightpixels example</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #000;
        color: #aaa;
        font-family: system-ui, sans-serif;
      }

      h1 {
        max-width: 10ch;
        font: 800 clamp(3rem, 14vw, 9rem) / 0.9 "Arial Narrow", sans-serif;
        letter-spacing: -0.05em;
      }
    </style>
    <script type="module">
      import "https://cdn.jsdelivr.net/npm/brightpixels@0.1.0/+esm";
    </script>
  </head>
  <body>
    <h1>Make <bright-text intensity="12">important words</bright-text> brighter.</h1>
  </body>
</html>
```

## Text

Wrap only the words that should become HDR:

```html
<p>
  Normal white stays calm.
  <bright-text intensity="12">This phrase rises above it.</bright-text>
</p>
```

Shape the letters with normal CSS. Brightpixels inherits the font, size, weight, stretch, spacing, line height, and text transform:

```css
.headline {
  font-family: "Arial Narrow", sans-serif;
  font-size: clamp(3rem, 12vw, 9rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 0.9;
}
```

To keep existing HTML unchanged, wrap matching elements from JavaScript:

```html
<h1 class="headline">EXTRA BRIGHT</h1>
```

```js
import { brighten } from "brightpixels";

brighten(".headline", { intensity: 12 });
```

## Images

Wrap an ordinary image. Brightpixels raises its lightest pixels into HDR while leaving shadows and midtones readable:

```html
<bright-image intensity="8">
  <img src="/sunset.jpg" alt="Sunset over the ocean" />
</bright-image>
```

Or wrap existing images from JavaScript:

```html
<img class="hdr-photo" src="/sunset.jpg" alt="Sunset over the ocean" />
```

```js
import { brightenImages } from "brightpixels";

brightenImages(".hdr-photo", { intensity: 8 });
```

Style the wrapper when an image should fill a responsive container:

```css
bright-image,
bright-image img {
  display: block;
  width: 100%;
}
```

For canvas security, remote images must opt into cross-origin use:

```html
<bright-image intensity="8">
  <img crossorigin="anonymous" src="https://images.example/photo.jpg" alt="" />
</bright-image>
```

The image server must also send a matching CORS header. Same-origin images need no extra setup.

## Setting

| Setting | Type | Default | Meaning |
| --- | --- | --- | --- |
| `intensity` | number from `1` to `16` | `16` | `1` is reference white. Higher values request a brighter HDR signal. |

Use `intensity` as an HTML attribute or JavaScript setting. Values outside the range are clamped.

```js
const [title] = brighten(".headline");
title.intensity = 8;

const [photo] = brightenImages(".hdr-photo");
photo.intensity = 6;
```

Both helpers accept a CSS selector, one element, or an iterable of elements. Repeated calls reuse an existing Brightpixels wrapper instead of nesting another one.

## React

React 19 supports custom elements directly. Import the React entry once for runtime registration and TypeScript JSX types:

```tsx
import "brightpixels/react";

export function Hero() {
  return (
    <main>
      <h1>
        Make <bright-text intensity={12}>important words</bright-text> brighter.
      </h1>

      <bright-image intensity={8}>
        <img src="/sunset.jpg" alt="Sunset over the ocean" />
      </bright-image>
    </main>
  );
}
```

The React entry re-exports `brighten()` and `brightenImages()`. It does not import React at runtime or add a React dependency.

## Status

Read `.mode` after the `brightpixelsready` event to learn whether an element is using HDR or its fallback:

```js
document.addEventListener("brightpixelsready", (event) => {
  console.log(event.detail.kind, event.detail.mode);
});
```

The event detail is `{ kind: "text" | "image", mode: "hdr" | "fallback", version }`.

## How it works

Brightpixels redraws the visible letters or image into a transparent extended-range WebGPU canvas. Values above `1` ask an HDR display for light brighter than ordinary white. The operating system and display decide the physical result.

If that path is unavailable or an image cannot be read safely, the original content stays visible. Text is intended for short, single-line emphasis up to 128 characters.

## Development

```bash
npm test
npm pack --dry-run
```

## Publish the demo

In the GitHub repository, open **Settings → Pages**, choose **Deploy from a
branch**, then select **main** and **/(root)**. The checked-in `index.html`
imports the local `index.js`, so the demo does not depend on npm or a CDN.

Brightpixels is available under the [MIT License](./LICENSE.txt).
