import type * as React from 'react';
import type { ConfettiOptions } from './confetti.js';
export type { ConfettiOptions, ConfettiController, ConfettiVelocity } from './confetti.js';

export interface BrightConfettiHandle {
  restart(): void;
  clear(): void;
  readonly activeCount: number;
  readonly emittedCount: number;
  readonly mode: 'hdr' | 'fallback' | null;
  readonly running: boolean;
}
export type BrightConfettiProps = ConfettiOptions;
export declare const BrightConfetti: React.ForwardRefExoticComponent<BrightConfettiProps & React.RefAttributes<BrightConfettiHandle>>;
export default BrightConfetti;
