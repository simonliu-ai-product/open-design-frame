import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type DesignSystem, designToCssVars } from '../lib/design.ts';
import { LAYER_TO_ATTR } from '../lib/layers.ts';
import { type Frame, nameOf, sizeOf } from '../lib/sdk.ts';

export type PlayerProps = {
  frames: Frame[];
  design: DesignSystem;
  index: number;
  title: string;
  onIndex: (index: number) => void;
  onClose: () => void;
};

/** A desktop frame is played in a browser; a narrow one is played in a hand. */
const isHandheld = (width: number): boolean => width < 700;

const CHROME_HEIGHT = 84;
const PHONE_BEZEL = 14;

/** `Transactions · Desktop` → the frame with that name, or its url, or its number. */
function targetOf(frames: Frame[], to: string): number {
  const wanted = to.trim().toLowerCase();
  const byName = frames.findIndex((frame, i) => nameOf(frame, i).toLowerCase() === wanted);
  if (byName !== -1) return byName;
  const byUrl = frames.findIndex((frame) => frame.url?.toLowerCase() === wanted);
  if (byUrl !== -1) return byUrl;
  const asNumber = Number.parseInt(wanted, 10);
  return Number.isFinite(asNumber) && asNumber >= 1 && asNumber <= frames.length
    ? asNumber - 1
    : -1;
}

/**
 * The frame, at size, in the thing it will be seen in.
 *
 * Not a second renderer: the frame is the same component the canvas draws, so a
 * prototype cannot drift from the design. What the player adds is the shell
 * around it and the links inside it — pressing something goes where the frame
 * says it goes, and pressing something else says so rather than pretending.
 */
export function Player({ frames, design, index, title, onIndex, onClose }: PlayerProps) {
  const frame = frames[index];
  const size = frame ? sizeOf(frame) : { width: 0, height: 0 };
  const handheld = isHandheld(size.width);
  const deviceWidth = handheld ? size.width + PHONE_BEZEL * 2 : size.width;
  const deviceHeight = handheld ? size.height + PHONE_BEZEL * 2 : size.height + CHROME_HEIGHT;

  const [scale, setScale] = useState(1);
  const [hinting, setHinting] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [full, setFull] = useState(false);
  const [fullError, setFullError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const Current = frame;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      // Never past 1: a 1440 frame blown up on a 4K display is not what ships.
      setScale(Math.min(1, width / deviceWidth, height / deviceHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // A resize observer is delivered with the frame, and a tab that is not
    // painting does not have frames. The window event arrives either way.
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [deviceWidth, deviceHeight]);

  /*
   * Fullscreen is the point of playing: the frame is drawn at the size it was
   * designed at, and the editor's chrome is what was making that impossible.
   */
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    setFullError(null);
    // A refusal is worth saying: some contexts (an embedded or automated tab)
    // will not grant fullscreen, and a button that does nothing reads as broken.
    rootRef.current?.requestFullscreen().catch((err: unknown) => {
      setFull(false);
      setFullError(err instanceof Error ? err.message : 'fullscreen was refused');
    });
  }, []);

  useEffect(() => {
    const sync = () => setFull(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const hint = useCallback(() => {
    setHinting(true);
    window.setTimeout(() => setHinting(false), 700);
  }, []);

  const onClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(`[${LAYER_TO_ATTR}]`);
    const to = target?.getAttribute(LAYER_TO_ATTR);
    if (!to) {
      // Pressing something that goes nowhere shows what does go somewhere.
      hint();
      return;
    }
    const next = targetOf(frames, to);
    if (next === -1) {
      hint();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onIndex(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // In fullscreen the browser takes Escape to leave it; closing the player
      // as well would throw away two things for one press.
      if (e.key === 'Escape' && document.fullscreenElement === null) onClose();
      if (e.key.toLowerCase() === 'f') toggleFull();
      if (e.key === 'ArrowRight') onIndex(Math.min(frames.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
      if (e.key.toLowerCase() === 'h') setPinned((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frames.length, index, onIndex, onClose, toggleFull]);

  if (!frame || !Current) return null;
  const address = frame.url ?? nameOf(frame, index);

  return (
    <div className="of-player" ref={rootRef}>
      <div className="of-player-stage">
        {/*
         * The fit is measured on a box with no padding of its own. Measuring the
         * padded stage and placing inside its content box is a lie of up to the
         * padding on each side, and the device lands under the toolbar.
         */}
        <div className="of-player-fit" ref={stageRef}>
          {/* The box holds the scaled size; scaling alone would leave the layout
            at full size and the device pinned to a corner of it. */}
          <div
            className="of-device-box"
            style={{ width: deviceWidth * scale, height: deviceHeight * scale }}
          >
            <div
              className={hinting || pinned ? 'of-device of-device-hinting' : 'of-device'}
              style={{ width: deviceWidth, height: deviceHeight, transform: `scale(${scale})` }}
              onClickCapture={onClick}
            >
              {handheld ? (
                <div className="of-phone">
                  <span className="of-phone-notch" />
                  <div
                    className="of-phone-screen"
                    style={{ width: size.width, height: size.height }}
                  >
                    <FramePlate design={design} size={size} Current={Current} />
                  </div>
                  <span className="of-phone-home" />
                </div>
              ) : (
                <div className="of-browser">
                  <div className="of-browser-chrome" style={{ height: CHROME_HEIGHT }}>
                    <div className="of-browser-row">
                      <span className="of-lights">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="of-browser-tab">
                        <i />
                        {title}
                      </span>
                    </div>
                    <div className="of-browser-row">
                      <span className="of-browser-nav">
                        <i>‹</i>
                        <i>›</i>
                        <i>⟳</i>
                      </span>
                      <span className="of-browser-address">
                        <i aria-hidden="true">🔒</i>
                        {address}
                      </span>
                    </div>
                  </div>
                  <div
                    className="of-browser-page"
                    style={{ width: size.width, height: size.height }}
                  >
                    <FramePlate design={design} size={size} Current={Current} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="of-player-bar">
        <button
          type="button"
          className="of-chip"
          aria-label="Previous frame"
          onClick={() => onIndex(Math.max(0, index - 1))}
        >
          ‹
        </button>
        <span className="of-player-count">
          {index + 1} / {frames.length} · {nameOf(frame, index)}
        </span>
        <button
          type="button"
          className="of-chip"
          aria-label="Next frame"
          onClick={() => onIndex(Math.min(frames.length - 1, index + 1))}
        >
          ›
        </button>
        <span className="of-player-sep" />
        <button
          type="button"
          className="of-chip"
          aria-pressed={pinned}
          onClick={() => setPinned((v) => !v)}
        >
          Hotspots <kbd>H</kbd>
        </button>
        <button type="button" className="of-chip" aria-pressed={full} onClick={toggleFull}>
          {full ? 'Windowed' : 'Fullscreen'} <kbd>F</kbd>
        </button>
        <button type="button" className="of-chip" onClick={onClose}>
          Exit <kbd>Esc</kbd>
        </button>
        {fullError ? <span className="of-player-error">{fullError}</span> : null}
      </div>
    </div>
  );
}

/* The frame at its own size; the device around it is what gets scaled. */
function FramePlate({
  design,
  size,
  Current,
}: {
  design: DesignSystem;
  size: { width: number; height: number };
  Current: Frame;
}) {
  return (
    <div
      className="of-frame of-frame-flat"
      style={{
        ...(designToCssVars(design) as React.CSSProperties),
        position: 'relative',
        width: size.width,
        height: size.height,
      }}
    >
      <Current />
    </div>
  );
}
