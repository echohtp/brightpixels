import type * as React from "react";
import type {
  BrightImageElement,
  BrightTextElement,
} from "./index.js";

export * from "./index.js";

export interface BrightpixelsReadyDetail {
  kind: "text" | "image";
  mode: "hdr" | "fallback";
  version: string;
}

export type BrightpixelsReadyEvent = CustomEvent<BrightpixelsReadyDetail>;

interface BrightpixelsProps {
  intensity?: number | string;
  onbrightpixelsready?: (event: BrightpixelsReadyEvent) => void;
}

type BrightTextProps = React.DetailedHTMLProps<
  React.HTMLAttributes<BrightTextElement>,
  BrightTextElement
> & BrightpixelsProps;

type BrightImageProps = React.DetailedHTMLProps<
  React.HTMLAttributes<BrightImageElement>,
  BrightImageElement
> & BrightpixelsProps;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "bright-text": BrightTextProps;
      "bright-image": BrightImageProps;
    }
  }
}
