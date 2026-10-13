import { useLayoutEffect, useState } from 'react';
import { LOC_ATTR } from '../../editing/loc.ts';
import type { ChangeHunk } from '../lib/changes.ts';
import type { FrameComment } from '../lib/comments.ts';
import { boxOf } from '../lib/layers.ts';

type PinPosition = {
  id: string;
  label: string;
  note: string;
  left: number;
  top: number;
  width: number;
  height: number;
  element: HTMLElement;
};

export type CanvasPinsProps = {
  host: HTMLElement | null;
  comments: FrameComment[];
  hunks: ChangeHunk[];
  showHunks: boolean;
  activeHunkId: string | null;
  onSelectElement: (el: HTMLElement) => void;
  onSelectHunk?: (hunkId: string, el: HTMLElement) => void;
};

export function CanvasPins({
  host,
  comments,
  hunks,
  showHunks,
  activeHunkId,
  onSelectElement,
  onSelectHunk,
}: CanvasPinsProps) {
  const [commentPins, setCommentPins] = useState<PinPosition[]>([]);
  const [hunkBoxes, setHunkBoxes] = useState<PinPosition[]>([]);

  useLayoutEffect(() => {
    if (!host) {
      setCommentPins([]);
      setHunkBoxes([]);
      return;
    }

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const scale = rect.width === 0 ? 1 : rect.width / host.offsetWidth;

      const nextComments: PinPosition[] = [];
      comments.forEach((c, idx) => {
        if (!c.loc) return;
        const el = host.querySelector<HTMLElement>(`[${LOC_ATTR}="${c.loc}"]`);
        if (!el) return;
        const box = boxOf(el, host, scale);
        nextComments.push({
          id: c.id,
          label: String(idx + 1),
          note: c.note,
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          element: el,
        });
      });
      setCommentPins(nextComments);

      if (!showHunks) {
        setHunkBoxes([]);
        return;
      }
      const nextHunks: PinPosition[] = [];
      for (const h of hunks) {
        if (!h.loc) continue;
        const el = host.querySelector<HTMLElement>(`[${LOC_ATTR}="${h.loc}"]`);
        if (!el) continue;
        const box = boxOf(el, host, scale);
        nextHunks.push({
          id: h.id,
          label: h.summary,
          note: h.summary,
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          element: el,
        });
      }
      setHunkBoxes(nextHunks);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host, comments, hunks, showHunks]);

  return (
    <div data-odf-overlay="true">
      {showHunks
        ? hunkBoxes.map((h) => (
            <button
              key={h.id}
              type="button"
              className={
                h.id === activeHunkId ? 'odf-diff-box odf-diff-box-active' : 'odf-diff-box'
              }
              style={{
                left: h.left,
                top: h.top,
                width: h.width,
                height: h.height,
              }}
              title={h.note}
              onClick={(e) => {
                e.stopPropagation();
                onSelectHunk?.(h.id, h.element);
              }}
            >
              <span className="odf-diff-badge">Δ {h.label}</span>
            </button>
          ))
        : null}

      {commentPins.map((pin) => (
        <button
          key={pin.id}
          type="button"
          className="odf-canvas-pin"
          style={{
            left: pin.left + pin.width - 10,
            top: Math.max(4, pin.top - 10),
          }}
          title={pin.note}
          aria-label={`Comment ${pin.label}: ${pin.note}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectElement(pin.element);
          }}
        >
          {pin.label}
        </button>
      ))}
    </div>
  );
}
