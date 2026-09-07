import type { ParticleEffects, ParticleShape } from './particles.js';

export type ConfettiVelocity = number | { min: number; max: number };
export interface ConfettiOptions {
  /** Concurrent target when recycling; total emitted for a one-shot. Default 200, max 2048. */
  numberOfPieces?: number;
  /** Keep replacing expired pieces. Default true. Reduced motion always uses one batch. */
  recycle?: boolean;
  /** Pause emission and freeze existing particles when false. Default true. */
  run?: boolean;
  colors?: string[];
  /** Source rectangle in viewport CSS pixels. Defaults to the full top edge. */
  confettiSource?: { x: number; y: number; w: number; h: number };
  /** Familiar 60 Hz confetti units, converted to time-based acceleration. Default 0.1. */
  gravity?: number;
  /** Horizontal acceleration in the same 60 Hz units. Default 0. */
  wind?: number;
  /** Initial horizontal velocity in pixels per 60 Hz frame. A number means [-n, n]. Default 4. */
  initialVelocityX?: ConfettiVelocity;
  /** Initial vertical velocity in pixels per 60 Hz frame. A number means [-n, 0]. Default 10. */
  initialVelocityY?: ConfettiVelocity;
  opacity?: number;
  /** HDR light intensity, 1–16. Default 8. */
  intensity?: number;
  /** Linear emission ramp in milliseconds; 0 emits immediately. Default 1500. */
  tweenDuration?: number;
  /** Maximum lifetime in milliseconds, 100–10000. Default 5000. */
  lifetime?: number;
  /** Base particle size in CSS pixels, 1–24. Default 5. */
  size?: number;
  shape?: ParticleShape;
  /** Once per naturally completed batch. Clear, unmount and interrupted batches do not call this. */
  onConfettiComplete?: (confetti: ConfettiController) => void;
  /** Once after initial HDR/fallback setup, never after destruction. */
  onReady?: (confetti: ConfettiController) => void;
}
export interface ConfettiController {
  readonly ready: ParticleEffects['ready'];
  readonly canvas: HTMLCanvasElement | null;
  readonly mode: ParticleEffects['mode'];
  readonly fallbackReason: ParticleEffects['fallbackReason'];
  readonly activeCount: number;
  readonly emittedCount: number;
  readonly running: boolean;
  /** Replace the complete options object. Omitted values return to defaults. */
  update(options?: ConfettiOptions): this;
  /** Start a new batch with current options; a paused controller stays paused. */
  restart(): this;
  /** Clear and stop until restart or a larger particle target is requested. */
  clear(): this;
  destroy(): void;
}
/** Browser-only creation; importing this module is safe on the server. */
export declare function createConfetti(options?: ConfettiOptions): ConfettiController;
