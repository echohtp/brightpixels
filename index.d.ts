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

export interface BrightShapeElement extends HTMLElement {
  shape: "ring" | "outline" | "bar" | "dot" | "line";
  color: string;
  intensity: number;
  /** Percent filled, 0–100; defaults to 100. Applies to rings and bars. */
  value: number;
  /** Ring/outline/line stroke width in CSS pixels; defaults to 4. */
  thickness: number;
  /** Outline/bar corner radius in CSS pixels; defaults to 12. */
  radius: number;
  /** Line points as space-separated x,y pairs in 0–100 coordinates. Empty means a horizontal line. */
  points: string;
  readonly mode: "hdr" | "fallback" | null;
}

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
    "bright-shape": BrightShapeElement;
  }
}
