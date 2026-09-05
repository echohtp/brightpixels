# Contributing

Brightpixels is an ES module with browser custom elements and TypeScript declarations. The runtime has no build step or production dependencies.

## Development

```bash
npm test
npm pack --dry-run
```

Serve the repository over localhost to use the demo:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`. Validate the original-image fallback as well as HDR output on a compatible browser and display. Standard screenshots cannot establish physical HDR brightness.

Keep `index.d.ts` and `react.d.ts` aligned with the JavaScript API. Importing either package entry without a DOM must remain safe.

## Demo publishing

GitHub Pages serves the repository root. In **Settings → Pages**, select **Deploy from a branch**, **main**, and **/(root)**. Changes pushed to that branch update the demo.

`index.html` imports the local `index.js`. Example images live in `assets/examples/`; keep their paths, HTML examples, and README previews synchronized. Demo assets are excluded by the package's `files` whitelist.

## Package releases

Keep the version in `package.json`, the exported version, and declarations synchronized. Review `npm pack --dry-run` before publishing. With an authenticated npm maintainer account, run:

```bash
npm publish --access public
```

The `prepublishOnly` script runs the package tests. Do not commit registry tokens or other credentials.
