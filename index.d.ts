export interface BrightpixelsSettings {
  /** HDR signal strength. Clamped to 1–16; defaults to 16. */
  intensity?: number;
}

export interface BrightTextElement extends HTMLElement {
  intensity: number;
  readonly mode: "hdr" | "fallback" | null;
}

export interface BrightImageElement extends HTMLElement {
  intensity: number;
  readonly mode: "hdr" | "fallback" | null;
  readonly image: HTMLImageElement | null;
}

export declare const version: "0.1.0";

export declare function defineBrightpixels(): CustomElementConstructor | null;

export declare function brighten(
  targets: string | Element | Iterable<Element>,
  settings?: BrightpixelsSettings
): BrightTextElement[];

export declare function brightenImages(
  targets: string | Element | Iterable<Element>,
  settings?: BrightpixelsSettings
): BrightImageElement[];

declare global {
  interface HTMLElementTagNameMap {
    "bright-text": BrightTextElement;
    "bright-image": BrightImageElement;
  }
}
