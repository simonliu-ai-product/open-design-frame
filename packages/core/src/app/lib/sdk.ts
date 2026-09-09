import type { ComponentType } from 'react';
import type { DesignSystem } from './design.ts';

/**
 * A frame is a fixed-size artboard, not a page.
 *
 * open-doc fixes A4 and open-slide fixes 16:9 because a document is printed and
 * a deck is projected — the medium decides. A design has no such medium: the
 * same screen is drawn at 1440 for desktop and 390 for a phone, and both are the
 * work. So the size travels with the frame rather than with the project.
 */
export type FrameSize = { width: number; height: number };

export type Frame = ComponentType & {
  /** Shown in the layer tree and the exported filename. Defaults to the export name. */
  frameName?: string;
  size?: FrameSize;
  /** What the address bar reads when the frame is played. */
  url?: string;
};

export type FrameMeta = {
  title?: string;
  /** ISO 8601. Set at scaffold time; orders the frame list. */
  createdAt?: string;
};

export type FrameModule = {
  default: Frame[];
  meta?: FrameMeta;
  design?: DesignSystem;
};

export type ThemeMeta = {
  name?: string;
  /** One line on the card: what this theme is for, not what it contains. */
  description?: string;
};

/**
 * A theme is a design system with a name, in a file of its own.
 *
 * A frame can declare its own `design` inline; a theme is the same thing kept
 * where more than one frame can import it. Which frames use it is not recorded
 * anywhere — it is the same object or it is not, and the gallery asks that
 * question of the loaded modules rather than of a list that can go stale.
 */
export type ThemeModule = {
  default: DesignSystem;
  meta?: ThemeMeta;
};

/**
 * The sizes worth naming.
 *
 * A frame may declare any width and height; these exist so the common ones read
 * as intent (`DESKTOP`) rather than as two numbers a reader has to recognise.
 */
export const SIZES = {
  DESKTOP: { width: 1440, height: 1024 },
  LAPTOP: { width: 1280, height: 800 },
  TABLET: { width: 834, height: 1112 },
  PHONE: { width: 390, height: 844 },
  SQUARE: { width: 1080, height: 1080 },
} as const satisfies Record<string, FrameSize>;

export const DEFAULT_SIZE: FrameSize = SIZES.DESKTOP;

export function sizeOf(frame: Frame): FrameSize {
  return frame.size ?? DEFAULT_SIZE;
}

/**
 * What to call a size in the UI.
 *
 * A named preset reads as intent; anything else is reported as its numbers
 * rather than forced into the nearest bucket, because a frame drawn at 1512 is
 * not a Desktop frame and saying so would be a small lie the filter repeats.
 */
export function sizeLabel(size: FrameSize): string {
  for (const [name, preset] of Object.entries(SIZES)) {
    if (preset.width === size.width && preset.height === size.height) {
      return name.charAt(0) + name.slice(1).toLowerCase();
    }
  }
  return `${size.width}×${size.height}`;
}

export function nameOf(frame: Frame, index: number): string {
  return frame.frameName ?? frame.displayName ?? frame.name ?? `Frame ${index + 1}`;
}
