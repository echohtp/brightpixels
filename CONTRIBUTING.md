# Contributing

Brightpixels is an ES module with browser custom elements and TypeScript declarations. The runtime has no build step or production dependencies.

## Development

```bash
npm test
npm run test:types
npm pack --dry-run
```

Serve the repository over localhost to use the demo:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`. Validate the original-image fallback as well as HDR output on a compatible browser and display. Standard screenshots cannot establish physical HDR brightness.

## Automated browser checks

Development tools are dev dependencies only; the installed runtime remains
dependency-free. Install browser test engines once, then run:

```bash
npx playwright install --with-deps chromium webkit
npm run test:browser
```

The test server listens only on localhost port 4173. Chromium exercises the real
WebGPU renderer using a software GPU in CI, including texture reuse and global
disable/re-enable. Chromium and WebKit both exercise forced fallback, loading,
reduced motion, progress updates, and cleanup. GPU coverage is intentionally
Chromium-only; WebKit's GPU test is skipped, not counted as a GPU pass. These
checks verify browser behavior, not physical HDR brightness or a guaranteed FPS.
Software GPU flags are for this isolated test runner, not ordinary browsing.

The Verify workflow runs on pushes and pull requests and uploads failure traces.
Keep the React/TypeScript usage fixture and public declarations aligned with API
changes. Run the complete workflow before tagging a release.

Keep `index.d.ts` and `react.d.ts` aligned with the JavaScript API. Importing either package entry without a DOM must remain safe.

## Hardware observations

Open `/hardware.html` on the actual display being tested. Compare reference white
with HDR white, sRGB with Display P3, and original images with HDR highlights.
Use the HDR toggle and intensity slider, then exercise progress, loading, and pulse.
Record the display model, system settings, power source, and what you observe.
Copy or download the JSON report; nothing is sent automatically. Resetting test
controls preserves your observations.

Repeat for each browser/display combination and after moving between monitors.
The report separates browser capabilities from manual observations. An initialized
HDR renderer, software GPU test, or screenshot does not establish physical HDR
brightness. Keep untested observations marked as such.

## Demo publishing

GitHub Pages serves the repository root. In **Settings → Pages**, select **Deploy from a branch**, **main**, and **/(root)**. Changes pushed to that branch update the demo.

`index.html` imports the local `index.js`. Example images live in `assets/examples/`; keep their paths, HTML examples, and README previews synchronized. Demo assets are excluded by the package's `files` whitelist.

## Package releases

Keep the version in `package.json`, the exported version, and declarations synchronized. Review `npm pack --dry-run` before publishing. With an authenticated npm maintainer account, run:

```bash
npm publish --access public
```

The `prepublishOnly` script runs the package tests. Do not commit registry tokens or other credentials.
