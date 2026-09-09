import { useLayoutEffect, useState } from 'react';
import { boxOf } from '../lib/layers.ts';

export type SelectionProps = {
  element: HTMLElement;
  host: HTMLElement | null;
  variant?: 'selected' | 'hover';
};

/**
 * The outline over the selected layer.
 *
 * Drawn inside the frame in frame coordinates, so the zoom that scales the
 * frame scales the outline with it — measuring in screen pixels would leave a
 * 2px border reading as 4px at 200% and as a hairline at 25%.
 */
export function Selection({ element, host, variant = 'selected' }: SelectionProps) {
  const [box, setBox] = useState<ReturnType<typeof boxOf> | null>(null);

  useLayoutEffect(() => {
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      const scale = rect.width === 0 ? 1 : rect.width / host.offsetWidth;
      setBox(boxOf(element, host, scale));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    // The element too: an edit that makes the text wrap changes the box being
    // outlined without changing the frame around it, and the outline would
    // otherwise stay where the element used to be.
    ro.observe(element);
    return () => ro.disconnect();
  }, [element, host]);

  if (!box) return null;
  return (
    <div
      className={variant === 'hover' ? 'of-selection of-selection-hover' : 'of-selection'}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  );
}
