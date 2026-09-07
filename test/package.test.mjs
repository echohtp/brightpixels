import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  brighten,
  brightenImages,
  defineBrightpixels,
  version,
} from "../index.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const demo = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const reactTypes = readFileSync(new URL("../react.d.ts", import.meta.url), "utf8");

test("exports the minimal API", () => {
  assert.equal(version, "1.3.2");
  assert.equal(typeof defineBrightpixels, "function");
  assert.equal(typeof brighten, "function");
  assert.equal(typeof brightenImages, "function");
});

test("keeps package metadata and documented tags in sync", () => {
  assert.equal(packageJson.name, "brightpixels");
  assert.equal(packageJson.version, version);
  assert.match(readme, /<bright-text intensity=/);
  assert.match(readme, /<bright-image intensity=/);
  assert.match(readme, /brightenImages\(/);
  assert.match(readme, /brightpixels\/react/);
  assert.match(reactTypes, /"bright-text": BrightTextProps/);
  assert.match(reactTypes, /"bright-image": BrightImageProps/);
});

test("ships a GitHub Pages demo that runs from local source", () => {
  assert.match(demo, /src="\.\/index\.js"/);
  assert.match(demo, /<bright-text intensity="16">/);
  assert.match(demo, /<bright-image intensity="8">/);
  assert.doesNotMatch(demo, /cdn\.jsdelivr\.net/);
});

test("React entry loads without a React runtime dependency", async () => {
  const reactEntry = await import("../react.js");
  assert.equal(reactEntry.version, version);
  assert.equal(typeof reactEntry.brightenImages, "function");
});

test("is safe to import without a browser DOM", () => {
  assert.equal(defineBrightpixels(), null);
  assert.deepEqual(brighten(".headline", { intensity: 12 }), []);
  assert.deepEqual(brightenImages(".photo", { intensity: 8 }), []);
});

test("registers the text and image custom elements in a browser", async () => {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    customElements: globalThis.customElements,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
  };
  const registry = new Map();
  const matches = new Map();

  class FakeElement {
    constructor(localName = "div") {
      this.localName = localName;
      this.parentElement = null;
      this.childNodes = [];
      this.attributes = new Map();
    }

    get children() {
      return this.childNodes.filter((node) => node instanceof FakeElement);
    }

    get firstChild() {
      return this.childNodes[0] || null;
    }

    append(node) {
      if (node.parentElement) {
        const oldIndex = node.parentElement.childNodes.indexOf(node);
        if (oldIndex >= 0) node.parentElement.childNodes.splice(oldIndex, 1);
      }
      node.parentElement = this;
      this.childNodes.push(node);
    }

    before(node) {
      const index = this.parentElement?.childNodes.indexOf(this) ?? -1;
      if (index < 0) return;
      node.parentElement = this.parentElement;
      this.parentElement.childNodes.splice(index, 0, node);
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }

    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) { this.attributes.delete(name); }

    hasAttribute(name) {
      return this.attributes.has(name);
    }
  }

  globalThis.window = {};
  globalThis.document = {
    createElement: (name) => name === "template"
      ? { innerHTML: "", content: {} }
      : new FakeElement(name),
    querySelectorAll: (selector) => matches.get(selector) || [],
  };
  globalThis.customElements = {
    get: (name) => registry.get(name),
    define: (name, constructor) => registry.set(name, constructor),
  };
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;

  try {
    const browserModule = await import(`../index.js?browser-test=${Date.now()}`);
    assert.equal(typeof registry.get("bright-text"), "function");
    assert.equal(typeof registry.get("bright-image"), "function");
    assert.equal(typeof registry.get("bright-shape"), "function");

    const shapeState = Object.create(registry.get("bright-shape").prototype);
    shapeState.attributes = new Map();
    assert.equal(shapeState.shape, "ring");
    assert.equal(shapeState.value, 100);
    shapeState.value = 0;
    assert.doesNotMatch(shapeState._svg(100, 100, "red"), /<circle/);
    shapeState.value = 150;
    assert.equal(shapeState.value, 100);
    shapeState.value = -10;
    assert.equal(shapeState.value, 0);
    shapeState.value = "invalid";
    assert.equal(shapeState.value, 100);
    shapeState.shape = "bar";
    shapeState.value = 25;
    assert.match(shapeState._svg(200, 20, "red"), /<rect width="50" height="20"/);
    shapeState.shape = "outline";
    shapeState.thickness = 1000;
    assert.match(shapeState._svg(100, 20, "red"), /stroke-width="10"/);
    assert.doesNotMatch(shapeState._svg(100, 20, '\"><script>bad</script>'), /<script>/);
    shapeState.shape = "dot";
    assert.match(shapeState._svg(40, 20, "red"), /<ellipse cx="20" cy="10" rx="20" ry="10"/);
    shapeState.shape = "line";
    shapeState.thickness = 4;
    assert.match(shapeState._svg(100, 20, "red"), /points="2,10 98,10"/);
    shapeState.points = "0,100 50,50 100,0";
    assert.match(shapeState._svg(100, 20, "red"), /points="2,18 50,10 98,2"/);
    shapeState.points = "-50,200 200,-50";
    assert.match(shapeState._svg(100, 20, "red"), /points="2,18 98,2"/);
    for (const invalid of ["0,0", "0,0 100,", "0,0 NaN,5", "0,0 Infinity,5", '0,0 \"><script>,5']) {
      shapeState.points = invalid;
      assert.match(shapeState._svg(100, 20, "red"), /points="2,10 98,10"/);
    }
    shapeState.points = "";
    shapeState.thickness = 1000;
    assert.match(shapeState._svg(100, 4, "red"), /points="2,2 98,2".*stroke-width="4"/);

    shapeState.thickness = 4;
    shapeState.value = 100;
    shapeState.shape = "arc";
    shapeState.sweep = 360;
    const fullArc = shapeState._svg(100, 100, "red");
    assert.equal((fullArc.match(/ A48,48/g) || []).length, 2);
    shapeState.value = 0;
    assert.match(shapeState._svg(100, 100, "red"), /<path d=""/);
    shapeState.value = 100;
    shapeState.sweep = 999;
    assert.equal(shapeState.sweep, 360);
    shapeState.shape = "pill";
    assert.match(shapeState._svg(200, 30, "red"), /rx="15"/);
    shapeState.shape = "diamond";
    assert.match(shapeState._svg(100, 100, "red"), /points="50,0 100,50 50,100 0,50"/);
    shapeState.shape = "polygon";
    shapeState.points = "0,0 100,0 50,100";
    assert.match(shapeState._svg(100, 50, "red"), /points="0,0 100,0 50,50"/);
    shapeState.points = "0,0 invalid";
    assert.match(shapeState._svg(100, 50, "red"), /points=""/);
    shapeState.shape = "path";
    shapeState.d = 'M0 0"><script>alert(1)</script>';
    assert.doesNotMatch(shapeState._svg(100, 50, "red"), /<script>/);
    shapeState.filled = true;
    assert.equal(shapeState.filled, true);
    shapeState.filled = false;
    assert.equal(shapeState.filled, false);
    shapeState.shape = "line";
    shapeState.points = "";
    shapeState.dash = "6, 8";
    assert.match(shapeState._svg(100, 20, "red", "blue"), /gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="100" y2="10"/);
    assert.match(shapeState._svg(100, 20, "red"), /stroke-dasharray="6 8"/);
    shapeState.dash = '6"><script>';
    assert.doesNotMatch(shapeState._svg(100, 20, "red"), /stroke-dasharray|<script>/);

    assert.equal(shapeState.track, "");
    shapeState.setAttribute("track", "");
    assert.equal(shapeState.track, "#25252b");
    shapeState.track = "#333";
    assert.equal(shapeState.track, "#333");
    shapeState.track = "";
    assert.equal(shapeState.hasAttribute("track"), false);
    shapeState.shape = "bar";
    shapeState.value = 0;
    assert.match(shapeState._svg(200, 20, "red"), /<rect width="0"/);
    assert.match(shapeState._svg(200, 20, "#333", "", 100, true), /<rect width="200"/);
    shapeState.shape = "arc";
    shapeState.sweep = 270;
    shapeState.dash = "6 8";
    assert.match(shapeState._svg(100, 100, "red"), /<path d=""/);
    assert.match(shapeState._svg(100, 100, "#333", "", 100, true), /<path d="M/);
    assert.doesNotMatch(shapeState._svg(100, 100, "#333", "", 100, true), /stroke-dasharray/);

    const requestRender = shapeState._requestRender;
    shapeState._requestRender = () => {};
    shapeState.isConnected = true;
    shapeState.duration = 1000;
    shapeState._displayValue = 0;
    shapeState.value = 100;
    shapeState._transitionToValue();
    shapeState._advanceValue(0);
    shapeState._advanceValue(500);
    assert.equal(shapeState._displayValue, 50);
    assert.equal(shapeState.value, 100);
    shapeState.value = 20;
    shapeState._transitionToValue();
    assert.equal(shapeState._transition.from, 50);
    shapeState._advanceValue(600);
    shapeState._advanceValue(1100);
    assert.equal(shapeState._displayValue, 35);
    shapeState._advanceValue(1600);
    assert.equal(shapeState._displayValue, 20);
    assert.equal(shapeState._transition, null);
    shapeState.duration = 0;
    shapeState.value = 80;
    shapeState._transitionToValue();
    assert.equal(shapeState._displayValue, 80);
    assert.equal(shapeState._transition, null);
    shapeState.duration = 99999;
    assert.equal(shapeState.duration, 5000);
    shapeState.duration = -1;
    assert.equal(shapeState.duration, 0);
    shapeState.duration = 1000;
    window.matchMedia = () => ({ matches: true });
    shapeState.value = 10;
    shapeState._transitionToValue();
    assert.equal(shapeState._displayValue, 10);
    assert.equal(shapeState._transition, null);
    delete window.matchMedia;
    shapeState.value = 90;
    shapeState._transitionToValue();
    document.hidden = true;
    shapeState._advanceValue(0);
    assert.equal(shapeState._displayValue, 90);
    assert.equal(shapeState._transition, null);
    delete document.hidden;
    shapeState.value = 30;
    shapeState._transitionToValue();
    shapeState.isConnected = false;
    shapeState._advanceValue(0);
    assert.equal(shapeState._displayValue, 30);
    assert.equal(shapeState._transition, null);
    shapeState._requestRender = requestRender;

    const oldRAF = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
    const frames = new Map();
    let nextFrame = 0;
    globalThis.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
    globalThis.cancelAnimationFrame = (id) => frames.delete(id);
    const runFrame = (now) => { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(now); };
    shapeState.isConnected = true;
    shapeState._bright = {};
    shapeState.intensity = 2;
    try {
      shapeState.pulse({ intensity: 8, duration: 1000 });
      runFrame(0);
      assert.equal(shapeState._bright.intensity, 2);
      runFrame(500);
      assert.equal(shapeState._bright.intensity, 8);
      runFrame(1000);
      assert.equal(shapeState._bright.intensity, 2);
      assert.equal(frames.size, 0);
      shapeState.pulse();
      shapeState.pulse();
      assert.equal(frames.size, 1);
      shapeState.stopPulse();
      assert.equal(frames.size, 0);
      window.matchMedia = () => ({ matches: true });
      shapeState.pulse();
      assert.equal(frames.size, 0);
      delete window.matchMedia;
      document.hidden = true;
      shapeState.pulse();
      assert.equal(frames.size, 0);
      delete document.hidden;
      shapeState.pulse();
      shapeState.isConnected = false;
      runFrame(0);
      assert.equal(frames.size, 0);
      assert.equal(shapeState._bright.intensity, 2);
    } finally {
      if (oldRAF === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = oldRAF;
      if (oldCancel === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = oldCancel;
      delete window.matchMedia;
      delete document.hidden;
    }

    const heading = new FakeElement("h1");
    heading.append(new FakeElement("span"));
    matches.set(".headline", [heading]);
    const [textWrapper] = browserModule.brighten(".headline", { intensity: 12 });
    assert.equal(textWrapper.localName, "bright-text");
    assert.equal(textWrapper.intensity, 12);
    assert.equal(heading.firstChild, textWrapper);

    const figure = new FakeElement("figure");
    const image = new FakeElement("img");
    figure.append(image);
    matches.set(".photo", [image]);
    const [imageWrapper] = browserModule.brightenImages(".photo", { intensity: 8 });
    assert.equal(imageWrapper.localName, "bright-image");
    assert.equal(imageWrapper.intensity, 8);
    assert.equal(imageWrapper.firstChild, image);
    assert.equal(figure.firstChild, imageWrapper);

    const [colored] = browserModule.brighten(heading, { color: "#ff5900", intensity: 4 });
    assert.equal(colored, textWrapper);
    assert.equal(colored.color, "#ff5900");
    const [boosted] = browserModule.brightenImages(image, { boost: "all", intensity: 4 });
    assert.equal(boosted, imageWrapper);
    assert.equal(boosted.boost, "all");

    const imagePrototype = registry.get("bright-image").prototype;
    const imageState = Object.create(imagePrototype);
    imageState.attributes = new Map();
    assert.equal(imageState.boost, "highlights");
    imageState.boost = "all";
    assert.equal(imageState.boost, "all");
    imageState.boost = "invalid";
    assert.equal(imageState.boost, "highlights");

    const textState = Object.create(registry.get("bright-text").prototype);
    textState.attributes = new Map();
    assert.equal(textState.color, "white");
    textState.intensity = 4;
    textState._colorSpace = "display-p3";
    textState._glyphs = {};
    textState._colorContext = {
      clearRect() {}, fillRect() {},
      getImageData: () => ({ data: new Uint8ClampedArray([255, 128, 0, 128]) }),
    };
    const oldComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({ color: "color(display-p3 1 0.5 0 / 0.5)" });
    try {
      const rgba = textState._textColor();
      assert.ok(Math.abs(rgba[0] - 4 * 128 / 255) < 0.00001);
      assert.ok(Math.abs(rgba[1] - 0.2158605 * 4 * 128 / 255) < 0.00001);
      assert.equal(rgba[2], 0);
      assert.ok(Math.abs(rgba[3] - 128 / 255) < 0.00001);
    } finally {
      if (oldComputedStyle === undefined) delete globalThis.getComputedStyle;
      else globalThis.getComputedStyle = oldComputedStyle;
    }
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
