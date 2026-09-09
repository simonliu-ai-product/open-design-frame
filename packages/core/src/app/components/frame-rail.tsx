import type { DesignSystem } from '../lib/design.ts';
import { type Frame, nameOf, sizeOf } from '../lib/sdk.ts';
import { FrameCanvas } from './frame-canvas.tsx';

export type FrameRailProps = {
  frames: Frame[];
  design: DesignSystem;
  current: number;
  onSelect: (index: number) => void;
};

/**
 * Every frame in the file, small.
 *
 * A thumbnail is the frame itself at a smaller scale rather than a picture of
 * it — one renderer, so a rail that disagrees with the canvas is not a state
 * this can reach.
 */
export function FrameRail({ frames, design, current, onSelect }: FrameRailProps) {
  return (
    <div className="of-rail">
      <div className="of-rail-head">
        <span>Frames</span>
        <b>{String(frames.length).padStart(2, '0')}</b>
      </div>
      <div className="of-rail-list">
        {frames.map((frame, index) => {
          const size = sizeOf(frame);
          const name = nameOf(frame, index);
          const Component = frame;
          return (
            <button
              key={name}
              type="button"
              className="of-rail-item"
              aria-current={index === current}
              onClick={() => onSelect(index)}
            >
              <span className="of-rail-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="of-rail-body">
                <span
                  className="of-rail-thumb"
                  style={{ aspectRatio: `${size.width} / ${size.height}` }}
                >
                  {/* No scale: the box knows how wide the rail is, a constant does not. */}
                  <FrameCanvas size={size} design={design} flat>
                    <Component />
                  </FrameCanvas>
                </span>
                <span className="of-rail-name">{name}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
