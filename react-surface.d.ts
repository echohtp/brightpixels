import type * as React from 'react';
import type { BrightSurfaceController, BrightSurfaceOptions, BrightSurfaceFlash } from './index.js';
export type { BrightSurfaceController, BrightSurfaceOptions, BrightSurfaceFlash } from './index.js';
export interface BrightSurfaceHandle {
  readonly target: HTMLElement | null;
  readonly controller: BrightSurfaceController | null;
  flash(kind?: BrightSurfaceFlash): void;
  ripple(origin?: { x?: number; y?: number }): void;
  setLoading(value?: boolean): void;
  select(value?: boolean): void;
  cancel(): void;
}
export interface BrightSurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside' | 'main' | 'nav' | 'header' | 'footer';
  options?: BrightSurfaceOptions;
}
export declare const BrightSurface: React.ForwardRefExoticComponent<BrightSurfaceProps & React.RefAttributes<BrightSurfaceHandle>>;
export default BrightSurface;
