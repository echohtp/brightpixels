import type { BrightSurfaceController, BrightSurfaceFlash, BrightSurfaceGroup } from './index.js';
import type { ParticleEffects, ElementBurstOptions } from './particles.js';

export interface ActionOptions {
  /** Cancels feedback only. Your app owns aborting its request. */
  signal?: AbortSignal;
  success?: BrightSurfaceFlash | false;
  error?: BrightSurfaceFlash | false;
}
/** Latest tracked promise owns loading/outcome light. Value and rejection are preserved.
 * Scroll, resize, blur, hidden/detached targets and abort stop feedback, not application work. */
export declare function trackAction<T>(surface: BrightSurfaceController, promise: PromiseLike<T>, options?: ActionOptions): Promise<T>;
export interface GestureOptions {
  /** Optional existing surface whose charge follows gesture progress. */
  surface?: BrightSurfaceController;
  signal?: AbortSignal;
  /** 0–1 while active; 0 on release/cancel. Update your own labels/ARIA here. */
  onProgress?: (progress: number) => void;
  /** Called once for a completed gesture, after charge resets. Your app owns the action. */
  onComplete?: (progress: number) => void;
  onCancel?: () => void;
}
export interface GestureBinding {
  readonly active: boolean;
  readonly progress: number;
  cancel(): this;
  destroy(): void;
}
export interface HoldOptions extends GestureOptions {
  /** Hold duration in ms, 150–5000. Default 700. Completion is on release. */
  duration?: number;
  /** Pointer movement tolerance in CSS pixels, 4–100. Default 18. */
  tolerance?: number;
}
/** Native button only. Hold Space/Enter or pointer, release fully charged. Assistive click activates directly. */
export declare function bindHold(target: HTMLButtonElement, options?: HoldOptions): GestureBinding;
/** Native range only. Reach max and release; keyboard arrows/End then Enter. Partial gestures reset to min. */
export declare function bindSwipe(target: HTMLInputElement, options?: GestureOptions): GestureBinding;
/** Existing region, app-owned focus/ARIA. Arrow keys adjust; Enter commits; Escape cancels.
 * Sets touch-action to preserve perpendicular scrolling; restores it on destroy. */
export declare function bindDrag(target: HTMLElement, options?: GestureOptions & { axis?: 'x' | 'y' }): GestureBinding;

export type EffectStep =
  | { effect: 'wait'; duration: number }
  | { effect: 'charge'; surface: BrightSurfaceController; value: number; duration?: number }
  | { effect: 'sweep'; surface: BrightSurfaceController; options?: { angle?: number }; duration?: number }
  | { effect: 'flash'; surface: BrightSurfaceController; kind?: BrightSurfaceFlash; duration?: number }
  | { effect: 'ripple'; surface: BrightSurfaceController; options?: { x?: number; y?: number }; duration?: number }
  | { effect: 'group'; group: BrightSurfaceGroup; options?: { kind?: BrightSurfaceFlash; stagger?: number; from?: 'start' | 'center' | 'end' }; duration?: number }
  | { effect: 'particles'; engine: ParticleEffects; target: Element; options?: ElementBurstOptions; duration?: number };
export interface EffectSequence {
  readonly running: boolean;
  /** Replay cancels the previous run. Resolves when all steps/delays dispatch; particles finish naturally. */
  play(options?: { signal?: AbortSignal }): Promise<'completed' | 'cancelled'>;
  /** Cancels queued steps and touched surfaces' transient effects; restores pre-run charge. */
  cancel(): this;
  destroy(): void;
}
/** 1–64 steps, max 5s per step / 30s total. Borrowed resources are never destroyed.
 * Owns transient effects on supplied surfaces while playing; do not share those with concurrent actions.
 * Reduced motion skips animated delays, preserving explicit waits and static feedback.
 * Scroll/resize/blur/hidden/detach/abort cancels a run; reduced-motion changes cancel too. */
export declare function createEffectSequence(steps: readonly EffectStep[]): EffectSequence;
