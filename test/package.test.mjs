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
  assert.equal(version, "0.1.0");
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
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
});
