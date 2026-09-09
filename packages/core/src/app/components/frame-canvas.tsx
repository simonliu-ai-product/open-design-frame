import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { type DesignSystem, designToCssVars } from '../lib/design.ts';
import type { FrameSize } from '../lib/sdk.ts';

export type FrameCanvasProps = {
  children: ReactNode;
  size: FrameSize;
  design?: DesignSystem;
  /** Explicit zoom. Left out, the frame is fitted to whatever room it has. */
  scale?: number;
  flat?: boolean;
  innerRef?: RefObject<HTMLDivElement>;
  onScale?: (scale: number) => void;
  className?: string;
};

/**
 * One artboard, drawn at its declared size and scaled as a whole.
 *
 * Scaling the container rather than the contents is what keeps a frame honest:
 * every length inside is the length that will be exported, so 16px type is 16px
 * whatever the zoom says. A frame that re-laid-out per zoom would be showing a
 * different design from the one it ships.
 */
export function FrameCanvas(props: FrameCanvasProps) {
  const { children, size, design, scale, flat = false, innerRef, onScale, className } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (scale !== undefined) return;
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setFitted(Math.min(width / size.width, height / size.height));
    };
    // Synchronously, before paint: measured after, the frame flashes at full
    // size for one visible tick.
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale, size.width, size.height]);

  const applied = scale ?? fitted ?? 1;
  useLayoutEffect(() => onScale?.(applied), [applied, onScale]);

  const vars = design ? (designToCssVars(design) as CSSProperties) : undefined;

  return (
    <div ref={boxRef} className={`odf-canvas-box ${className ?? ''}`}>
      <div
        className="odf-canvas-scaler"
        style={{ width: size.width * applied, height: size.height * applied }}
      >
        <div
          ref={innerRef}
          className={flat ? 'odf-frame odf-frame-flat' : 'odf-frame'}
          style={{
            ...vars,
            width: size.width,
            height: size.height,
            transform: `scale(${applied})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
