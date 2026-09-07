# NEON DREAMNET

A maximalist old-web / night-drive / dreamcore remix for Brightpixels.

Run `python3 -m http.server 8080` in this folder, then open
http://localhost:8080/dreamnet.html.

The theme is assets/dreamnet.css. Add data-dreamnet to the HTML root and use
assets/dreamnet.js for this page's interactions. Sky variants are midnight,
sunset and void via data-sky. data-still disables decorative movement; system
reduced-motion preferences are also respected.

Links and button labels glow on hover, keyboard focus and press. Add
class="dn-text-glow" to other text to opt in. The halo follows the text color;
override --dn-text-glow-color to tint its outer glow. This is a CSS text-shadow
effect and works without HDR. Keyboard focus outlines remain visible.

Included: page, CSS, interaction code, shared container glow, Brightpixels runtime,
and the locally bundled Anton font. Runtime license: LICENSE.txt. Font license:
assets/fonts/Anton-OFL.txt. Nothing is loaded from a third-party server at runtime.

The guestbook and visit counter use this browser's localStorage. Guestbook notes
are local to the browser, not published or sent anywhere. The page includes a
clear-local-notes button. Star adoptions last only for the current page visit.

The included runtime has repository features newer than the tagged 1.0.0 package.
HDR output depends on browser, OS and display support; the CSS theme also has
ordinary-color fallbacks.
