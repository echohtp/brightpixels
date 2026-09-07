export interface BrightpixelsSettings {
  /** HDR signal strength. Clamped to 1–16; defaults to 16. */
  intensity?: number;
}

export interface BrightpixelsConfig {
  /** Disable HDR and release renderer resources; fallback content remains visible. */
  enabled: boolean;
  /** Scale extra HDR light, 0–1. Zero means reference white, not black. */
  brightness: number;
  /** Auto caps large canvases near 1MP (minimum 1x); high uses up to 2x DPR; low uses up to 1x. */
  quality: "auto" | "high" | "low";
}
export declare function configureBrightpixels(options?: Partial<BrightpixelsConfig>): BrightpixelsConfig;
export declare function getBrightpixelsConfig(): BrightpixelsConfig;

export type BrightpixelsFallbackReason = "disabled" | "offscreen" | "webgpu-unavailable" | "device-lost" | "missing-image" | "renderer-error";
export interface BrightpixelsCapabilities {
  webgpu: boolean;
  hdr: boolean;
  p3: boolean;
  reducedMotion: boolean;
  intersectionObserver: boolean;
}
/** A fresh snapshot of browser signals; does not measure display luminance or request a GPU. */
export declare function getBrightpixelsCapabilities(): BrightpixelsCapabilities;

export interface BrightTextElement extends HTMLElement {
  intensity: number;
  /** CSS color; defaults to white. Display P3 is supported where available. */
  color: string;
  readonly fallbackReason: BrightpixelsFallbackReason | null;
  readonly mode: "hdr" | "fallback" | null;
}

export interface BrightImageElement extends HTMLElement {
  intensity: number;
  boost: "highlights" | "all";
  readonly fallbackReason: BrightpixelsFallbackReason | null;
  readonly mode: "hdr" | "fallback" | null;
  readonly image: HTMLImageElement | null;
}

export declare const version: "1.2.0";

export interface BrightShapeElement extends HTMLElement {
  shape: "ring" | "outline" | "bar" | "dot" | "line" | "arc" | "rect" | "pill" | "triangle" | "diamond" | "star" | "polygon" | "path";
  color: string;
  intensity: number;
  /** Percent filled, 0–100; defaults to 100. Applies to rings, arcs, and bars. */
  value: number;
  /** Ring/outline/line stroke width in CSS pixels; defaults to 4. */
  thickness: number;
  /** Outline/bar corner radius in CSS pixels; defaults to 12. */
  radius: number;
  /** Line points as space-separated x,y pairs in 0–100 coordinates. Empty means a horizontal line. */
  points: string;
  /** Arc start in degrees, clockwise from the right; defaults to -90 (top). */
  startAngle: number;
  /** Arc extent, 0–360 degrees; defaults to 270. */
  sweep: number;
  /** Custom SVG path data in a 0–100 coordinate system. */
  d: string;
  /** Fill a custom path in addition to its stroke. */
  filled: boolean;
  /** Optional second CSS color for a linear gradient. */
  colorEnd: string;
  /** Gradient direction: 0 goes left to right; 90 goes top to bottom. */
  angle: number;
  /** SVG dash lengths in CSS pixels, separated by spaces or commas. */
  dash: string;
  linecap: "butt" | "round" | "square";
  /** Background rail CSS color for rings/arcs/bars. Empty disables it. */
  track: string;
  /** Progress transition duration in milliseconds, 0–5000; default 0 (instant). */
  duration: number;
  status: "" | "loading" | "success" | "warning" | "error";
  /** Cached native loading animation for rings, arcs, and bars. */
  indeterminate: boolean;
  setStatus(status: "" | "loading" | "success" | "warning" | "error", options?: { pulse?: boolean }): void;
  /** One brightness swell, returning to the base intensity; respects reduced motion. */
  pulse(options?: { intensity?: number; duration?: number }): void;
  stopPulse(): void;
  readonly fallbackReason: BrightpixelsFallbackReason | null;
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

export interface BrightEdgeOptions {
  /** Defaults to the target's computed top-border color. */
  color?: string | null;
  /** Defaults to 4; clamped to 1–16. */
  intensity?: number | null;
  /** Stroke width in CSS pixels, 0.5–32. Defaults to the top-border width, minimum 1. */
  thickness?: number | null;
  /** Distance outside the border box, 0–32 CSS pixels. Overflow rules still apply. */
  offset?: number | null;
  /** Uniform corner radius in CSS pixels. Defaults to the target's top-left pixel radius plus offset. */
  radius?: number | null;
  trigger?: 'always' | 'hover' | 'focus' | null;
}
export interface BrightEdgeElement extends HTMLElement {
  readonly target: HTMLElement | null;
  readonly mode: 'hdr' | 'fallback' | null;
  readonly fallbackReason: BrightpixelsFallbackReason | null;
  update(options?: BrightEdgeOptions): this;
  /** Re-read target styles after stylesheet or theme changes. */
  refresh(): void;
  /** Remove the edge and restore positioning when still owned by the enhancement. */
  destroy(): void;
}
/** Enhance existing HTML containers. Unsupported replaced/form elements are skipped. */
export declare function brightenEdges(targets: string | Element | Iterable<Element>, options?: BrightEdgeOptions): BrightEdgeElement[];
declare global {
  interface HTMLElementTagNameMap { 'bright-edge': BrightEdgeElement; }
}

export interface BrightFeedbackController {
  readonly target: HTMLElement;
  readonly edge: BrightEdgeElement;
  flash(kind?: 'press' | 'success' | 'error' | 'warning' | 'complete' | 'notify'): this;
  /** Visual selection only: the caller owns aria-pressed/checked and application state. */
  select(value?: boolean): this;
  cancel(): this;
  destroy(): void;
}
/** Press/release illumination plus explicit outcome pulses; never invokes application actions. */
export declare function brightenFeedback(targets: string | Element | Iterable<Element>, options?: {
  color?: string;
  thickness?: number;
  press?: boolean;
}): BrightFeedbackController[];
