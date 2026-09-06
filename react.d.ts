import type * as React from "react";
import type {
  BrightImageElement,
  BrightTextElement,
  BrightShapeElement,
} from "./index.js";

export * from "./index.js";

export interface BrightpixelsReadyDetail {
  kind: "text" | "image" | "shape";
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
> & BrightpixelsProps & { color?: string };

type BrightImageProps = React.DetailedHTMLProps<
  React.HTMLAttributes<BrightImageElement>,
  BrightImageElement
> & BrightpixelsProps & { boost?: "highlights" | "all" };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "bright-text": BrightTextProps;
      "bright-image": BrightImageProps;
      "bright-shape": React.DetailedHTMLProps<React.HTMLAttributes<BrightShapeElement>, BrightShapeElement>
        & BrightpixelsProps & {
          shape?: "ring" | "outline" | "bar" | "dot" | "line" | "arc" | "rect" | "pill" | "triangle" | "diamond" | "star" | "polygon" | "path";
          color?: string;
          value?: number | string;
          thickness?: number | string;
          radius?: number | string;
          points?: string;
          "start-angle"?: number | string;
          sweep?: number | string;
          d?: string;
          filled?: boolean;
          "color-end"?: string;
          angle?: number | string;
          dash?: string;
          linecap?: "butt" | "round" | "square";
        };
    }
  }
}
