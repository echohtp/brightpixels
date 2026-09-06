# AFTERHOURS — Brightpixels cyberpunk theme

Open `cyberpunk.html` through a local web server:

```sh
python3 -m http.server 8080
```

Visit http://localhost:8080/cyberpunk.html.

## Reuse the theme

Load `assets/cyberpunk.css` and add `data-cyberpunk` to the HTML root. Set
`data-cp-theme` to `cyan`, `pink`, or `acid`. The `--cp-*` variables control colors,
spacing details and component styling. Reuse `cp-button`, `cp-chip`, `cp-input`,
`cp-badge`, `cp-console-panel` and the layout classes from the example.

The CSS theme has no JavaScript or framework dependency. The example JavaScript
uses the included Brightpixels runtime for HDR text, shapes and press feedback.
The runtime includes repository features newer than the tagged 1.0.0 package.
Runtime license: LICENSE.txt.

Controls are local demos: callsigns are not saved or sent, transfers are simulated,
and palette/favorite settings reset on reload. The Anton display font is bundled locally under the SIL Open Font License
(assets/fonts/Anton-OFL.txt); no fonts or scripts are fetched from third parties at runtime. HDR depends on browser, display and OS configuration; ordinary CSS
colors and original component content remain available as fallbacks.
