# NEON DREAMNET

A maximalist old-web / night-drive / dreamcore remix for Brightpixels.

A few satirical AI announcements appear in the subtitle, ticker and sidebar.

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

Move the mouse across a window to steer its neon spotlight. Clicking still
lights the full perimeter. Tracking stops on exit, scrolling or window blur;
touch keeps the existing press glow without a sticky hover effect.

The open page background draws cyan Tron trails behind the mouse: square turns,
a white core and a fading neon tail. Trails stop over cards and controls. The
motion toggle and system reduced-motion preference disable them. No library is
required; assets/tron-trail.js uses a bounded SVG layer with no idle render loop.

GIGA OVERLOAD is on by default: neon window borders, laser grid, broadcast ticker,
orbital hyperspace portal and sticker wall. Toggle it at the top of the page.
IGNITE fires 144 particles and pulses the HDR portal ring. assets/overload.css and
assets/overload.js contain the additional theme layer. Decorative motion respects
both the page motion switch and system preferences.

FIRE CONFETTI launches two neon cannons using the shared HDR particle engine.
assets/confetti-cannon.js exports fireConfetti(buttonElement) for reuse with this
stylesheet. One canvas handles both cannons and the portal. It is pointer-inert,
uses extended-range WebGPU where available, and falls back to ordinary-color
canvas particles. Active capacity is 1024 (256 in fallback). Reduced motion uses
up to 12 stationary sparkles. The containing card retains its HDR press effect.
The included particles.js and particles-shader.js are ready to use; no build is
needed to run the kit.

Included: page, CSS, interaction code, shared container glow, Brightpixels runtime,
and the locally bundled Anton font. Runtime license: LICENSE.txt. Font license:
assets/fonts/Anton-OFL.txt. Nothing is loaded from a third-party server at runtime.

The guestbook and visit counter use this browser's localStorage. Guestbook notes
are local to the browser, not published or sent anywhere. The page includes a
clear-local-notes button. Star adoptions last only for the current page visit.

The included runtime is Brightpixels 1.1.0.
HDR output depends on browser, OS and display support; the CSS theme also has
ordinary-color fallbacks.

When deploying an updated theme, update the asset revision in dreamnet.html
and its local imports in assets/dreamnet.js together. This avoids mixing fresh
markup with older scripts or styles retained in the browser cache.
