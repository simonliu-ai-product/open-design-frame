import type { MutableRefObject } from 'react';
import { type DesignSystem, designToCssVars } from '../lib/design.ts';
import { type Frame, nameOf, sizeOf } from '../lib/sdk.ts';

export type ExportStageProps = {
  frames: Frame[];
  design: DesignSystem;
  hostsRef: MutableRefObject<(HTMLDivElement | null)[]>;
};

/**
 * Every frame at its own size, off the side of the screen.
 *
 * An export of the whole file needs every frame laid out, and only one is on
 * the canvas. Off-screen rather than hidden: `display: none` has no layout, and
 * an element with no layout photographs as nothing.
 */
export function ExportStage({ frames, design, hostsRef }: ExportStageProps) {
  const vars = designToCssVars(design) as React.CSSProperties;
  return (
    <div className="odf-export-stage" aria-hidden="true">
      {frames.map((frame, index) => {
        const size = sizeOf(frame);
        const Component = frame;
        return (
          <div
            key={nameOf(frame, index)}
            ref={(el) => {
              hostsRef.current[index] = el;
            }}
            className="odf-frame odf-frame-flat"
            style={{ ...vars, position: 'relative', width: size.width, height: size.height }}
          >
            <Component />
          </div>
        );
      })}
    </div>
  );
}
