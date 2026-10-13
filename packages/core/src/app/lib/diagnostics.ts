import { LOC_ATTR } from '../../editing/loc.ts';
import type { FrameSize } from './sdk.ts';

export type DomDiagnostic = {
  rule: 'frame-overflow' | 'broken-image' | 'tiny-text' | 'blank-frame';
  severity: 'error' | 'warn';
  message: string;
  element?: string;
  loc?: string;
};

const MEDIA_TAGS = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE']);

function hasOwnText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '') return true;
  }
  return false;
}

function isPainted(el: Element, rect: DOMRect): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
}

function leafmost(elements: Element[]): Element[] {
  return elements.filter((el) => !elements.some((other) => other !== el && el.contains(other)));
}

function snippet(el: Element): string {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const tag = el.tagName.toLowerCase();
  if (!text) return tag;
  return `${tag}: ${text.length > 48 ? `${text.slice(0, 48)}…` : text}`;
}

/**
 * Inspects a rendered frame container for visual layout mistakes:
 * clipped overflow past the artboard edge, broken images, or unreadable tiny type.
 */
export function diagnoseFrameDom(host: HTMLElement, _size: FrameSize): DomDiagnostic[] {
  const findings: DomDiagnostic[] = [];
  const hostRect = host.getBoundingClientRect();
  if (hostRect.width <= 0 || hostRect.height <= 0) return findings;

  const descendants = Array.from(host.querySelectorAll<HTMLElement>('*')).filter(
    (el) => !el.classList.contains('odf-sel') && !el.closest('[data-odf-overlay]'),
  );

  const overflowed: Element[] = [];
  const tiny: Element[] = [];
  const broken: Element[] = [];
  let hasMedia = false;

  for (const el of descendants) {
    const rect = el.getBoundingClientRect();
    if (!isPainted(el, rect)) continue;
    if (MEDIA_TAGS.has(el.tagName)) hasMedia = true;

    if (
      rect.right > hostRect.right + 2 ||
      rect.left < hostRect.left - 2 ||
      rect.bottom > hostRect.bottom + 2
    ) {
      overflowed.push(el);
    }
    if (hasOwnText(el) && Number.parseFloat(getComputedStyle(el).fontSize) < 9) {
      tiny.push(el);
    }
    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth === 0) {
      broken.push(el);
    }
  }

  if ((host.textContent ?? '').trim() === '' && !hasMedia) {
    findings.push({
      rule: 'blank-frame',
      severity: 'warn',
      message: 'This frame renders no visible text or media.',
    });
  }

  for (const el of leafmost(overflowed).slice(0, 4)) {
    const loc = el.closest(`[${LOC_ATTR}]`)?.getAttribute(LOC_ATTR) ?? undefined;
    findings.push({
      rule: 'frame-overflow',
      severity: 'warn',
      message: 'Element extends past the artboard bounds and may be clipped.',
      element: snippet(el),
      ...(loc ? { loc } : {}),
    });
  }

  for (const el of broken.slice(0, 4)) {
    const loc = el.closest(`[${LOC_ATTR}]`)?.getAttribute(LOC_ATTR) ?? undefined;
    findings.push({
      rule: 'broken-image',
      severity: 'error',
      message: `Image failed to load: ${(el as HTMLImageElement).getAttribute('src') ?? 'no src'}`,
      element: snippet(el),
      ...(loc ? { loc } : {}),
    });
  }

  for (const el of leafmost(tiny).slice(0, 3)) {
    const loc = el.closest(`[${LOC_ATTR}]`)?.getAttribute(LOC_ATTR) ?? undefined;
    const px = Math.round(Number.parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
    findings.push({
      rule: 'tiny-text',
      severity: 'warn',
      message: `Type is ${px}px (under 9px).`,
      element: snippet(el),
      ...(loc ? { loc } : {}),
    });
  }

  return findings;
}
