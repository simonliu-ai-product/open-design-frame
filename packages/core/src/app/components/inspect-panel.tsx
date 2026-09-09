import { useEffect, useState } from 'react';
import type { DesignSystem } from '../lib/design.ts';
import type { ExportFormat } from '../lib/export.ts';
import type { LayerKind, LayerNode } from '../lib/layers.ts';
import type { FrameSize } from '../lib/sdk.ts';
import type { CommentTarget } from './comment-dock.tsx';
import { CommentForm } from './comment-form.tsx';

const MARK: Record<LayerKind, string> = {
  group: '▦',
  text: 'T',
  shape: '▢',
  image: '▣',
  line: '／',
};

const SCALES = [1, 2, 3];
const FORMATS: ExportFormat[] = ['html', 'png', 'svg'];

const WEIGHTS: [string, string][] = [
  ['100', 'Thin'],
  ['200', 'Extra light'],
  ['300', 'Light'],
  ['400', 'Regular'],
  ['500', 'Medium'],
  ['600', 'Semibold'],
  ['700', 'Bold'],
  ['800', 'Extra bold'],
  ['900', 'Black'],
];

const ALIGNS = ['left', 'center', 'right', 'justify'] as const;
type Align = (typeof ALIGNS)[number];

const ROWS = [
  { key: 'a', width: 1 },
  { key: 'b', width: 0.62 },
  { key: 'c', width: 0.86 },
  { key: 'd', width: 0.5 },
];

function AlignIcon({ align }: { align: Align }) {
  return (
    <svg viewBox="0 0 16 13" width="16" height="13" aria-hidden="true" focusable="false">
      <title>{align}</title>
      {ROWS.map((row, i) => {
        const w = align === 'justify' ? 14 : 14 * row.width;
        const x = align === 'right' ? 15 - w : align === 'center' ? 8 - w / 2 : 1;
        return (
          <rect
            key={row.key}
            x={x}
            y={1 + i * 3.2}
            width={w}
            height={1.6}
            rx={0.8}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

type Measured = {
  tag: string;
  fontSize: number;
  weight: string;
  italic: boolean;
  lineHeight: number;
  tracking: number;
  align: string;
  color: string;
  background: string;
  width: number;
  height: number;
  textish: boolean;
};

const hex = (value: string): string => {
  const m = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!m) return value;
  const parts = (m[1] ?? '').split(/[,/]/).map((n) => Number.parseFloat(n));
  const [r, g, b, a] = parts;
  if (r === undefined || g === undefined || b === undefined) return value;
  if (a === 0) return 'transparent';
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${to(r)}${to(g)}${to(b)}`;
};

/** An element whose whole content is one run of text is the only one text can be edited on. */
function isTextish(el: HTMLElement): boolean {
  if (el.textContent?.trim() === '') return false;
  return [...el.childNodes].every((child) => child.nodeType === Node.TEXT_NODE);
}

/** What the browser actually resolved, so the panel cannot disagree with the pixels. */
function measure(el: HTMLElement): Measured {
  const s = getComputedStyle(el);
  const fontSize = Number.parseFloat(s.fontSize) || 16;
  return {
    tag: el.tagName.toLowerCase(),
    fontSize: Math.round(fontSize * 10) / 10,
    weight: s.fontWeight,
    italic: s.fontStyle === 'italic',
    lineHeight:
      s.lineHeight === 'normal'
        ? Math.round((1.2 + Number.EPSILON) * 100) / 100
        : Math.round((Number.parseFloat(s.lineHeight) / fontSize) * 100) / 100,
    tracking:
      s.letterSpacing === 'normal' ? 0 : Math.round(Number.parseFloat(s.letterSpacing) * 100) / 100,
    align: s.textAlign,
    color: hex(s.color),
    background: hex(s.backgroundColor),
    width: Math.round(el.offsetWidth),
    height: Math.round(el.offsetHeight),
    textish: isTextish(el),
  };
}

function LayerRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: LayerNode;
  depth: number;
  selected: HTMLElement | null;
  onSelect: (el: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return (
    <>
      <div
        className="odf-layer"
        aria-current={node.element === selected}
        style={{ paddingLeft: 12 + depth * 13 }}
        onPointerDown={() => onSelect(node.element)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="odf-twisty"
            aria-expanded={open}
            aria-label={open ? 'Collapse' : 'Expand'}
            onPointerDown={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? '⌄' : '›'}
          </button>
        ) : (
          <span className="odf-twisty odf-twisty-blank" />
        )}
        <span className="odf-layer-mark">{MARK[node.kind]}</span>
        <span className="odf-layer-name">{node.name}</span>
      </div>
      {open
        ? node.children.map((child) => (
            <LayerRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  );
}

function Field({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="odf-field">
      <span className="odf-field-label">{label}</span>
      <span className="odf-field-value">
        {value}
        {unit ? <i>{unit}</i> : null}
      </span>
    </div>
  );
}

/**
 * A slider and a number that are the same value.
 *
 * The slider is for finding it and the box is for saying it; both write on
 * every change, because the canvas shows the result immediately and a preview
 * that lags behind the handle is worse than no slider.
 */
function Range({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // The element changed under the panel: show what it says now, not the last
  // thing typed into a field that belonged to something else.
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (raw: string) => {
    const next = Number.parseFloat(raw);
    if (Number.isFinite(next)) onChange(next);
    else setDraft(String(value));
  };

  return (
    <div className="odf-field">
      <span className="odf-field-label">{label}</span>
      <input
        className="odf-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        aria-label={label}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
      <span className="odf-field-value odf-field-edit">
        <input
          className="odf-input odf-input-num"
          value={draft}
          inputMode="decimal"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setDraft(String(value));
          }}
        />
        {unit ? <i>{unit}</i> : null}
      </span>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const swatch = /^#[0-9a-f]{6}$/i.test(draft) ? draft : '#000000';
  return (
    <div className="odf-field">
      <span className="odf-field-label">{label}</span>
      <span className="odf-field-value odf-field-edit odf-color-field">
        <input
          type="color"
          className="odf-color"
          value={swatch}
          aria-label={`${label} colour`}
          onChange={(e) => {
            setDraft(e.target.value.toUpperCase());
            onChange(e.target.value.toUpperCase());
          }}
        />
        <input
          className="odf-input odf-input-hex"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => /^#[0-9a-f]{6}$/i.test(draft) && onChange(draft.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setDraft(value);
          }}
        />
      </span>
    </div>
  );
}

export type InspectPanelProps = {
  mode: 'inspect' | 'export';
  design: DesignSystem;
  size: FrameSize;
  layers: LayerNode[];
  selected: HTMLElement | null;
  /** Bumped by every staged edit, so the readouts follow the preview. */
  revision: number;
  /** Where a note would go. Absent in a static build, which has nowhere to write it. */
  commentTarget: CommentTarget | null;
  onComment: ((line: number, column: number, note: string) => Promise<boolean>) | null;
  busy: boolean;
  status: string | null;
  onSelect: (el: HTMLElement) => void;
  /** Frame count in this file, for the export summary. */
  frameCount: number;
  /** Edits staged but not written: an export shows the file, not the preview. */
  unsaved: number;
  onExport: (scope: 'frame' | 'file', scale: number, formats: ExportFormat[]) => void;
  onClose: () => void;
  /** Applies the change to the canvas and stages it. Nothing is written until saved. */
  onStyle: (key: string, value: string) => void;
  onText: (value: string) => void;
};

export function InspectPanel(props: InspectPanelProps) {
  const { mode, design, size, layers, selected, revision, onSelect } = props;
  const { busy, status, onExport, onClose, onStyle, onText } = props;
  const { frameCount, unsaved } = props;
  const { commentTarget, onComment } = props;
  const [scale, setScale] = useState(2);
  const [scope, setScope] = useState<'frame' | 'file'>('file');
  const [formats, setFormats] = useState<ExportFormat[]>(['html', 'png']);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [text, setText] = useState('');
  /*
   * Two things share this panel: what the selected element is, and what there is
   * to select. Stacked they made one column nobody could reach the bottom of;
   * as tabs each is a page.
   */
  const [tab, setTab] = useState<'typography' | 'layers'>('typography');

  // biome-ignore lint/correctness/useExhaustiveDependencies: a preview mutates the element in place, so the revision is the signal
  useEffect(() => {
    setMeasured(selected ? measure(selected) : null);
    setText(selected?.textContent ?? '');
  }, [selected, revision]);

  return (
    <div className="odf-panel">
      <header className="odf-panel-head">
        <span className="odf-panel-title">
          {mode === 'inspect' ? 'Inspect' : 'Export'}
          {mode === 'inspect' && measured ? <code>&lt;{measured.tag}&gt;</code> : null}
        </span>
        <button type="button" className="odf-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>

      {mode === 'inspect' ? (
        <div className="odf-panel-body">
          <div className="odf-panel-tabs">
            <span className="odf-segment">
              <button
                type="button"
                className="odf-seg"
                aria-current={tab === 'typography'}
                onClick={() => setTab('typography')}
              >
                Typography
              </button>
              <button
                type="button"
                className="odf-seg"
                aria-current={tab === 'layers'}
                onClick={() => setTab('layers')}
              >
                Layers
              </button>
            </span>
          </div>

          {tab === 'typography' ? (
            measured && selected ? (
              <>
                {measured.textish ? (
                  <>
                    <div className="odf-section-label">Content</div>
                    <textarea
                      className="odf-textarea"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onBlur={() => text !== (selected.textContent ?? '') && onText(text)}
                    />
                  </>
                ) : null}

                <Range
                  label="Size"
                  value={measured.fontSize}
                  min={8}
                  max={200}
                  step={1}
                  unit="PX"
                  onChange={(v) => onStyle('fontSize', `${v}px`)}
                />
                <div className="odf-field">
                  <span className="odf-field-label">Weight</span>
                  <span className="odf-field-value odf-field-edit">
                    <select
                      className="odf-select"
                      aria-label="Weight"
                      value={WEIGHTS.some(([w]) => w === measured.weight) ? measured.weight : '400'}
                      onChange={(e) => onStyle('fontWeight', e.target.value)}
                    >
                      {WEIGHTS.map(([weight, name]) => (
                        <option key={weight} value={weight}>
                          {name} · {weight}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <div className="odf-field">
                  <span className="odf-field-label">Style</span>
                  <span className="odf-toggles">
                    <button
                      type="button"
                      className="odf-toggle odf-toggle-bold"
                      aria-pressed={Number(measured.weight) >= 600}
                      aria-label="Bold"
                      onClick={() =>
                        onStyle('fontWeight', Number(measured.weight) >= 600 ? '400' : '700')
                      }
                    >
                      B
                    </button>
                    <button
                      type="button"
                      className="odf-toggle odf-toggle-italic"
                      aria-pressed={measured.italic}
                      aria-label="Italic"
                      onClick={() => onStyle('fontStyle', measured.italic ? 'normal' : 'italic')}
                    >
                      I
                    </button>
                  </span>
                </div>
                <Range
                  label="Line height"
                  value={measured.lineHeight}
                  min={0.8}
                  max={3}
                  step={0.05}
                  onChange={(v) => onStyle('lineHeight', String(v))}
                />
                <Range
                  label="Tracking"
                  value={measured.tracking}
                  min={-10}
                  max={20}
                  step={0.01}
                  unit="PX"
                  onChange={(v) => onStyle('letterSpacing', `${v}px`)}
                />
                <div className="odf-field">
                  <span className="odf-field-label">Align</span>
                  <span className="odf-toggles">
                    {ALIGNS.map((align) => (
                      <button
                        key={align}
                        type="button"
                        className="odf-toggle"
                        aria-pressed={measured.align === align}
                        aria-label={`Align ${align}`}
                        onClick={() => onStyle('textAlign', align)}
                      >
                        <AlignIcon align={align} />
                      </button>
                    ))}
                  </span>
                </div>

                <div className="odf-section-label">Color</div>
                <ColorField
                  label="Text"
                  value={measured.color}
                  onChange={(v) => onStyle('color', v)}
                />
                <ColorField
                  label="Background"
                  value={measured.background === 'transparent' ? '#FFFFFF' : measured.background}
                  onChange={(v) => onStyle('backgroundColor', v)}
                />

                <div className="odf-section-label">Box</div>
                <Field label="Size" value={`${measured.width} × ${measured.height}`} />

                {commentTarget && onComment ? (
                  <CommentForm target={commentTarget} onAdd={onComment} />
                ) : null}
              </>
            ) : (
              <p className="odf-note odf-note-pad">Click something on the canvas to inspect it.</p>
            )
          ) : layers.length === 0 ? (
            <p className="odf-note odf-note-pad">
              Nothing named yet. Wrap a part of the frame in <code>&lt;Layer name="…"&gt;</code> to
              list it here.
            </p>
          ) : (
            <div className="odf-layer-list">
              {layers.map((node) => (
                <LayerRow
                  key={node.id}
                  node={node}
                  depth={0}
                  selected={selected}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="odf-panel-body odf-panel-pad">
          <div className="odf-section-label">Pages</div>
          <div className="odf-chips">
            <button
              type="button"
              className="odf-chip"
              aria-current={scope === 'frame'}
              onClick={() => setScope('frame')}
            >
              This frame
            </button>
            <button
              type="button"
              className="odf-chip"
              aria-current={scope === 'file'}
              onClick={() => setScope('file')}
            >
              All {frameCount}
            </button>
          </div>

          <div className="odf-section-label">Include</div>
          <div className="odf-chips">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                className="odf-chip"
                aria-current={formats.includes(f)}
                onClick={() =>
                  setFormats((prev) =>
                    prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
                  )
                }
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="odf-section-label">Scale</div>
          <div className="odf-chips">
            {SCALES.map((s) => (
              <button
                key={s}
                type="button"
                className="odf-chip"
                aria-current={scale === s}
                disabled={!formats.includes('png')}
                onClick={() => setScale(s)}
              >
                {s}×
              </button>
            ))}
          </div>

          <Field label="Frame" value={`${size.width} × ${size.height}`} />
          {formats.includes('png') ? (
            <Field label="PNG" value={`${size.width * scale} × ${size.height * scale}`} />
          ) : null}

          <button
            type="button"
            className="odf-primary"
            disabled={busy || formats.length === 0}
            onClick={() => onExport(scope, scale, formats)}
          >
            {busy ? 'Exporting…' : 'Export zip'}
          </button>
          {status ? <p className="odf-note">{status}</p> : null}

          {/* What lands on disk, said before it does. */}
          <p className="odf-export-summary">
            {formats.length === 0 ? (
              'Choose at least one format.'
            ) : (
              <>
                {scope === 'file' ? frameCount : 1}{' '}
                {(scope === 'file' ? frameCount : 1) === 1 ? 'page' : 'pages'} × {formats.length}{' '}
                {formats.length === 1 ? 'format' : 'formats'}, one folder each:{' '}
                {formats.map((f) => (
                  <code key={f}>{f}/ </code>
                ))}
              </>
            )}
          </p>
          {unsaved > 0 ? (
            <p className="odf-export-summary">
              {unsaved} {unsaved === 1 ? 'layer is' : 'layers are'} edited but not saved — the
              export shows what the file says.
            </p>
          ) : null}

          <div className="odf-section-label">Palette</div>
          <div className="odf-swatches">
            {Object.entries(design.palette).map(([name, value]) =>
              value === undefined ? null : (
                <span key={name} className="odf-swatch" title={`${name} · ${value}`}>
                  <i style={{ background: value }} />
                  {name}
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
