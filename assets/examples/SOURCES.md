# Example image sources

These generated SDR source images demonstrate the image wrapper. Each file is a 1536 × 1024 PNG. The demo uses identical files for the original and Brightpixels views; HDR rendering happens at runtime.

| File | Subject | Demo intensity |
| --- | --- | --- |
| `ocean.png` | Sunlight on dark blue water | `6` |
| `chrome.png` | Polished chrome torus | `8` |
| `night.png` | Streetlights on wet pavement | `12` |

The images are repository demo assets and are excluded from the npm runtime package.

## Generation

### Wide-gamut comparison

`wide-gamut-comparison.png` is a deterministic 1500 × 700, 16-bit BT.2020/PQ PNG.
Regenerate with `node assets/examples/color-comparison.mjs`. The first two swatches
use RGB coordinates (1, 0.35, 0) in sRGB and Display P3 respectively, converted to
linear BT.2020 at 203-nit reference white. The third multiplies the P3 linear
signal by four before PQ encoding. PNG cICP signals BT.2020, PQ, RGB, full range.
It is displayed directly, without the Brightpixels image wrapper, to preserve
the encoded color and avoid applying the highlight boost twice.

### Generated photographs

Created with OpenAI image generation in generation mode, one image per prompt. No post-processing was applied.

### ocean.png

```text
Use case: photorealistic-natural
Asset type: SDR source photograph for a JavaScript image-highlights demo
Primary request: a close view of deep blue ocean water in direct sunlight, with many crisp isolated near-white sun glints.
Scene/backdrop: ocean surface fills the frame, no visible sky or horizon.
Style/medium: natural photorealistic photography with true water texture and believable sunlight.
Composition/framing: horizontal 3:2 composition, 1536 x 1024 pixels; close view of small overlapping waves and ripples.
Lighting/mood: bright sun glints scattered over dark blue water, balanced exposure that preserves the water's blue midtones and shadows; highlights are small and crisp.
Color palette: deep navy and clear blue water with near-white specular highlights.
Constraints: no text, logos, borders, UI, people, boats, or synthetic bloom overlays; avoid a large blown-out white region; this is a standard SDR image, not an HDR file.
```

### chrome.png

```text
Use case: product-mockup
Asset type: SDR source product photograph for a JavaScript image-highlights demo
Primary request: one polished chrome torus on a dark graphite studio surface, with bright narrow near-white reflections and readable metallic midtones.
Scene/backdrop: minimal dark graphite studio surface and backdrop.
Subject: a single smooth substantial polished chrome ring resting on the surface, clearly showing its circular central opening.
Style/medium: refined photorealistic studio product photography.
Composition/framing: horizontal 3:2 composition, 1536 x 1024 pixels; close view with the torus fully in frame and subtle surrounding negative space.
Lighting/mood: controlled narrow white studio lights make distinct crisp highlights on the chrome; enough soft fill to retain metallic midtones and dark reflected surfaces.
Color palette: chrome silver, neutral gray and graphite black.
Constraints: no typography, logos, text, borders, UI or extra products; no synthetic bloom overlays; avoid entirely white or black metal surfaces; this is a standard SDR image, not an HDR file.
```

### night.png

```text
Use case: photorealistic-natural
Asset type: SDR source photograph for a JavaScript image-highlights demo
Primary request: an urban night scene after rain, with white streetlights and their reflections on dark wet pavement.
Scene/backdrop: a quiet city street at night after rain, architectural facades receding into the distance, wet dark road and sidewalk.
Style/medium: natural photorealistic night photography with believable wet pavement texture.
Composition/framing: horizontal 3:2 composition, 1536 x 1024 pixels; street-level view with dark wet pavement in the foreground and white streetlights receding through the scene.
Lighting/mood: controlled exposure, crisp near-white lamp highlights and broken reflections; preserve dark building detail and pavement texture.
Color palette: dark neutral urban tones, white light, restrained warm accents in a few distant windows.
Constraints: no people, readable signs, logos, typography, text, borders, UI or synthetic bloom overlays; no oversized glowing haze; this is a standard SDR image, not an HDR file.
```
