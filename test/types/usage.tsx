import { createRef } from 'react';
import 'brightpixels/react';
import { brighten, brightenImages, configureBrightpixels, getBrightpixelsConfig, getBrightpixelsCapabilities, type BrightShapeElement } from 'brightpixels';
const ref = createRef<BrightShapeElement>();
export const Example = () => <>
  <bright-text color="color(display-p3 1 0.35 0)" intensity={4}>Ready</bright-text>
  <bright-image boost="all" intensity={3}><img src="icon.svg" alt="Icon" /></bright-image>
  <bright-shape ref={ref} status="loading" track="#25252b" duration={400} />
  <bright-shape shape="bar" indeterminate track="" />
</>;
ref.current?.setStatus('success', { pulse: true });
ref.current?.pulse({ duration: 500 });
configureBrightpixels({ enabled: false, brightness: 0.5 });
getBrightpixelsConfig().brightness.toFixed(1);
brighten('.headline', { color: 'red' });
brightenImages('.icon', { boost: 'all' });
// @ts-expect-error Unknown statuses must not be accepted.
ref.current?.setStatus('surprise');
// @ts-expect-error Unknown primitives must not be accepted.
export const Invalid = <bright-shape shape="unknown" />;

configureBrightpixels({ quality: 'low' });
getBrightpixelsCapabilities().hdr.valueOf();
ref.current?.fallbackReason?.toUpperCase();
// @ts-expect-error Unknown quality presets must not be accepted.
configureBrightpixels({ quality: 'ultra' });

import { brightenEdges } from 'brightpixels';
const [edge] = brightenEdges('.card', { trigger: 'hover', thickness: 2 });
edge?.update({ color: 'red', offset: 4 });
edge?.destroy();
// @ts-expect-error Only supported interaction triggers are accepted.
brightenEdges('.card', { trigger: 'click' });

import { brightenFeedback } from 'brightpixels';
const [feedback] = brightenFeedback('.button', { press: true });
feedback?.flash('success').select(true).cancel();
feedback?.destroy();
// @ts-expect-error Unknown feedback signals must not be accepted.
feedback?.flash('alarm');
