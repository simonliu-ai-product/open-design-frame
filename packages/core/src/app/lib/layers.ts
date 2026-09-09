export type LayerKind = 'group' | 'text' | 'shape' | 'image' | 'line';

export type LayerNode = {
  id: string;
  name: string;
  kind: LayerKind;
  element: HTMLElement;
  children: LayerNode[];
};

export const LAYER_ATTR = 'data-ofr-layer';
export const LAYER_KIND_ATTR = 'data-ofr-kind';
export const LAYER_ID_ATTR = 'data-ofr-id';
/**
 * Where a click on this layer goes when the frame is played.
 *
 * A prototype is only a prototype if something happens when you press it, and
 * what happens has to be written down in the frame — a player that invented its
 * own links would be showing a flow nobody designed.
 */
export const LAYER_TO_ATTR = 'data-ofr-to';

const KINDS = new Set<LayerKind>(['group', 'text', 'shape', 'image', 'line']);

function kindOf(el: HTMLElement): LayerKind {
  const raw = el.getAttribute(LAYER_KIND_ATTR) ?? '';
  return KINDS.has(raw as LayerKind) ? (raw as LayerKind) : 'group';
}

/**
 * The layer tree is read from what was rendered, not from the source.
 *
 * A frame is ordinary JSX — helpers, `map`, conditionals — so the component
 * tree and the picture disagree the moment anything is generated. The DOM is
 * what the designer is pointing at, and nesting there is the nesting they see.
 */
export function collectLayers(root: HTMLElement): LayerNode[] {
  const marked = [...root.querySelectorAll<HTMLElement>(`[${LAYER_ATTR}]`)];
  const nodes = new Map<HTMLElement, LayerNode>();
  for (const [index, el] of marked.entries()) {
    nodes.set(el, {
      id: el.getAttribute(LAYER_ID_ATTR) ?? `l${index}`,
      name: el.getAttribute(LAYER_ATTR) || 'Layer',
      kind: kindOf(el),
      element: el,
      children: [],
    });
  }

  const top: LayerNode[] = [];
  for (const [el, node] of nodes) {
    let parent = el.parentElement;
    while (parent && parent !== root && !nodes.has(parent)) parent = parent.parentElement;
    const owner = parent && nodes.get(parent);
    if (owner) owner.children.push(node);
    else top.push(node);
  }
  return top;
}

/** Where a layer sits inside the frame, in frame coordinates rather than screen ones. */
export function boxOf(element: HTMLElement, frame: HTMLElement, scale: number) {
  const a = element.getBoundingClientRect();
  const b = frame.getBoundingClientRect();
  return {
    left: (a.left - b.left) / scale,
    top: (a.top - b.top) / scale,
    width: a.width / scale,
    height: a.height / scale,
  };
}
