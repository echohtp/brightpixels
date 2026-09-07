export type ParticleShape = 'confetti' | 'spark' | 'dot';
export interface ParticleEngineOptions {
  /** Active particle cap, 1–2048. Fallback rendering is capped at 256. Default 1024. */
  maxParticles?: number;
  /** Default HDR intensity, 1–16. Default 6. */
  intensity?: number;
}
export interface ParticleBurstOptions {
  /** Origin in viewport CSS pixels. Defaults to the lower center of the screen. */
  x?: number;
  y?: number;
  count?: number;
  /** CSS colors, converted to linear sRGB for HDR output. */
  colors?: string[];
  shape?: ParticleShape;
  intensity?: number;
  /** Initial speed in CSS pixels/second. */
  speed?: number;
  /** Optional exact initial velocity in CSS pixels/second, overriding speed/angle. */
  velocityX?: number;
  velocityY?: number;
  /** Horizontal acceleration in CSS pixels/second squared. */
  wind?: number;
  /** Fold rotating particles for a tumbling paper effect. Default false. */
  flutter?: boolean;
  /** Multiplies particle alpha, 0–1. Default 1. */
  opacity?: number;
  /** Direction in degrees; -90 points up. */
  angle?: number;
  spread?: number;
  /** CSS pixels/second squared. Positive falls downward. */
  gravity?: number;
  /** Lifetime in milliseconds, 100–10000. */
  lifetime?: number;
  /** Base size in CSS pixels, 1–24. */
  size?: number;
  /** Request stationary fading particles. System reduced motion always takes priority. */
  reducedMotion?: boolean;
}
export interface ParticleEffects {
  readonly canvas: HTMLCanvasElement | null;
  /** Resolves after the current GPU initialization attempt. Never rejects for unsupported GPU. */
  readonly ready: Promise<'hdr' | 'fallback'>;
  /** Renderer status, not a physical display measurement. */
  readonly mode: 'hdr' | 'fallback';
  readonly fallbackReason: 'disabled' | 'webgpu-unavailable' | 'device-lost' | 'renderer-error' | null;
  readonly activeCount: number;
  readonly running: boolean;
  readonly maxParticles: number;
  readonly intensity: number;
  /** Returns how many particles were emitted. Burst overflow retires the oldest particles. */
  burst(options?: ParticleBurstOptions): number;
  /** Attach a mouse trail and return an idempotent stop function. Default target: window. */
  trail(target?: Window | HTMLElement, options?: ParticleBurstOptions): () => void;
  /** Freeze particles and stop frames. Bursts emit nothing while paused. */
  pause(): void;
  /** Continue paused particles without advancing their age during the pause. */
  resume(): void;
  clear(): void;
  destroy(): void;
}
/** Import is safe on the server; creation requires a browser document. */
export declare function createParticleEffects(options?: ParticleEngineOptions): ParticleEffects;
