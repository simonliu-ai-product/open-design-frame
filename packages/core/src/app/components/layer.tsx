import type { CSSProperties, ReactNode } from 'react';
import { LOC_ATTR } from '../../editing/loc.ts';
import {
  LAYER_ATTR,
  LAYER_ID_ATTR,
  LAYER_KIND_ATTR,
  LAYER_TO_ATTR,
  type LayerKind,
} from '../lib/layers.ts';

export type LayerProps = {
  /** Stamped by the dev server so the inspector can find this in the source. */
  'data-odf-loc'?: string;
  name: string;
  kind?: LayerKind;
  /** Stable across renders, so selection survives an edit. Defaults to the name. */
  id?: string;
  /** The frame a press on this goes to when played, by frame name. */
  to?: string;
  as?: 'div' | 'section' | 'header' | 'nav' | 'aside' | 'footer' | 'span';
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
};

/**
 * Names a piece of the frame so it can be pointed at.
 *
 * Nothing here changes what is drawn — a Layer is a `div` with attributes. It
 * exists because a design tool's left rail lists things a person named, and
 * `div > div > div` is not that list. Wrapping is opt-in: an unwrapped frame
 * still renders, it just has nothing to select.
 */
export function Layer({
  name,
  kind = 'group',
  id,
  to,
  as: Tag = 'div',
  style,
  className,
  children,
  ...rest
}: LayerProps) {
  const attrs = {
    [LAYER_ATTR]: name,
    [LAYER_KIND_ATTR]: kind,
    [LAYER_ID_ATTR]: id ?? name,
    [LAYER_TO_ATTR]: to,
    // Forwarded, not consumed: the inspector reads it off this element to know
    // which line of the frame to edit.
    [LOC_ATTR]: rest[LOC_ATTR],
  };
  return (
    <Tag {...attrs} style={style} className={className}>
      {children}
    </Tag>
  );
}
