export interface BrightpixelsSettings {
  /** HDR signal strength. Clamped to 1–16; defaults to 16. */
  intensity?: number;
}

export interface BrightTextElement extends HTMLElement {
  intensity: number;
  /** CSS color; defaults to white. Display P3 is supported where available. */
  color: string;
  readonly mode: "hdr" | "fallback" | null;
}

export interface BrightImageElement extends HTMLElement {
  intensity: number;
  boost: "highlights" | "all";
  readonly mode: "hdr" | "fallback" | null;
  readonly image: HTMLImageElement | null;
}

export declare const version: "0.2.0";

export declare function defineBrightpixels(): CustomElementConstructor | null;

export declare function brighten(
  targets: string | Element | Iterable<Element>,
  settings?: BrightpixelsSettings & { color?: string }
): BrightTextElement[];

export declare function brightenImages(
  targets: string | Element | Iterable<Element>,
  settings?: BrightpixelsSettings & { boost?: "highlights" | "all" }
): BrightImageElement[];

declare global {
  interface HTMLElementTagNameMap {
    "bright-text": BrightTextElement;
    "bright-image": BrightImageElement;
  }
}
