import { frameIds } from 'virtual:open-design-frame/frames';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type Asset,
  deleteAsset,
  GLOBAL_SCOPE,
  referenceFor,
  sizeLabel,
  uploadAsset,
} from '../lib/assets.ts';
import { useHome } from './home-shell.tsx';

type SortKey = 'name' | 'bytes' | 'updatedAt';
type Usage = 'all' | 'used' | 'unused';
type TypeKey = 'all' | 'image' | 'font' | 'data';

const TYPE_OF = (asset: Asset): TypeKey =>
  asset.type.startsWith('image/')
    ? 'image'
    : asset.type.startsWith('font/')
      ? 'font'
      : asset.type === 'application/json'
        ? 'data'
        : 'all';

const folderOf = (scope: string): string =>
  scope === GLOBAL_SCOPE ? 'assets/' : `frames/${scope}/assets/`;

export function AssetsPage() {
  const { assets, reloadAssets } = useHome();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [usage, setUsage] = useState<Usage>('all');
  const [type, setType] = useState<TypeKey>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [ascending, setAscending] = useState(true);
  const [columns, setColumns] = useState(4);
  const [list, setList] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const scope = params.get('scope');
  const setScope = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === '') nextParams.delete('scope');
    else nextParams.set('scope', next);
    setParams(nextParams, { replace: true });
  };

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = assets.filter((asset) => {
      if (scope !== null && asset.scope !== scope) return false;
      if (needle !== '' && !asset.name.toLowerCase().includes(needle)) return false;
      if (usage === 'used' && asset.usedBy.length === 0) return false;
      if (usage === 'unused' && asset.usedBy.length > 0) return false;
      if (type !== 'all' && TYPE_OF(asset) !== type) return false;
      return true;
    });
    const direction = ascending ? 1 : -1;
    return [...matched].sort((a, b) => {
      if (sort === 'bytes') return (a.bytes - b.bytes) * direction;
      if (sort === 'updatedAt') return a.updatedAt.localeCompare(b.updatedAt) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [assets, scope, query, usage, type, sort, ascending]);

  // Dropping without a chosen scope has to land somewhere, and the shared
  // folder is the one that is always there.
  const uploadScope = scope ?? GLOBAL_SCOPE;

  const upload = async (files: FileList | File[]) => {
    setStatus(null);
    for (const file of Array.from(files)) {
      const failed = await uploadAsset(uploadScope, file);
      if (failed) {
        setStatus(failed);
        break;
      }
    }
    reloadAssets();
  };

  const remove = async (asset: Asset) => {
    setStatus(await deleteAsset(asset));
    reloadAssets();
  };

  return (
    <main
      className={dragging ? 'odf-home odf-assets-drop' : 'odf-home'}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) void upload(e.dataTransfer.files);
      }}
    >
      <header className="odf-assets-head">
        <code className="odf-assets-path">
          ASSETS {folderOf(uploadScope)} · {String(shown.length).padStart(2, '0')} files
        </code>
        <button
          type="button"
          className="odf-btn odf-btn-primary"
          onClick={() => picker.current?.click()}
        >
          <i aria-hidden="true">↑</i> Upload
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </header>

      <div className="odf-assets-bar">
        <label className="odf-search">
          <span className="odf-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            type="search"
            value={query}
            placeholder="Search assets…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <label className="odf-sort">
          <select value={scope ?? ''} aria-label="Scope" onChange={(e) => setScope(e.target.value)}>
            <option value="">All scopes</option>
            <option value={GLOBAL_SCOPE}>Global</option>
            {frameIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>

        <label className="odf-sort">
          <select
            value={usage}
            aria-label="Usage"
            onChange={(e) => setUsage(e.target.value as Usage)}
          >
            <option value="all">All usage</option>
            <option value="used">Used in a frame</option>
            <option value="unused">Not used</option>
          </select>
        </label>

        <label className="odf-sort">
          <select
            value={type}
            aria-label="Type"
            onChange={(e) => setType(e.target.value as TypeKey)}
          >
            <option value="all">All types</option>
            <option value="image">Images</option>
            <option value="font">Fonts</option>
            <option value="data">Data</option>
          </select>
        </label>

        <label className="odf-sort">
          <select
            value={sort}
            aria-label="Sort by"
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="name">Name</option>
            <option value="bytes">Size</option>
            <option value="updatedAt">Updated</option>
          </select>
        </label>
        <button
          type="button"
          className="odf-chip"
          aria-label={ascending ? 'Sort descending' : 'Sort ascending'}
          onClick={() => setAscending((v) => !v)}
        >
          {ascending ? '↑' : '↓'}
        </button>

        <span className="odf-spacer" />

        {list ? null : (
          <label className="odf-columns">
            <input
              type="range"
              className="odf-slider"
              min={2}
              max={7}
              step={1}
              value={columns}
              aria-label="Columns"
              onChange={(e) => setColumns(Number(e.target.value))}
            />
            <b>{columns}</b>
          </label>
        )}
        <span className="odf-segment">
          <button
            type="button"
            className="odf-seg"
            aria-current={!list}
            onClick={() => setList(false)}
          >
            Grid
          </button>
          <button
            type="button"
            className="odf-seg"
            aria-current={list}
            onClick={() => setList(true)}
          >
            List
          </button>
        </span>
      </div>

      {status ? <p className="odf-error odf-error-inline">{status}</p> : null}

      {shown.length === 0 ? (
        <div className="odf-assets-empty">
          <span className="odf-assets-empty-mark" aria-hidden="true">
            ▤
          </span>
          <p className="odf-assets-empty-title">
            {assets.length === 0 ? 'No assets yet' : 'Nothing matches those filters'}
          </p>
          <p className="odf-note">
            Drop files anywhere here, or use Upload. They are written to{' '}
            <code>{folderOf(uploadScope)}</code>.
          </p>
        </div>
      ) : list ? (
        <div className="odf-asset-rows">
          {shown.map((asset) => (
            <div className="odf-asset-row" key={`${asset.scope}/${asset.name}`}>
              <span className="odf-asset-thumb">
                {asset.type.startsWith('image/') ? (
                  <img src={asset.url} alt="" />
                ) : (
                  <span className="odf-asset-ext">
                    {asset.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                  </span>
                )}
              </span>
              <span className="odf-asset-name">{asset.name}</span>
              <span className="odf-asset-meta">{folderOf(asset.scope)}</span>
              <span className="odf-asset-meta">{sizeLabel(asset.bytes)}</span>
              <span className="odf-asset-meta">
                {asset.usedBy.length === 0 ? 'unused' : `used by ${asset.usedBy.join(', ')}`}
              </span>
              <span className="odf-asset-actions">
                <button
                  type="button"
                  className="odf-chip"
                  onClick={() => {
                    void navigator.clipboard.writeText(referenceFor(asset));
                    setStatus(`Copied ${referenceFor(asset)}`);
                  }}
                >
                  Copy path
                </button>
                <button type="button" className="odf-chip" onClick={() => void remove(asset)}>
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="odf-assets-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {shown.map((asset) => (
            <figure className="odf-asset" key={`${asset.scope}/${asset.name}`}>
              <span className="odf-asset-preview">
                {asset.type.startsWith('image/') ? (
                  <img src={asset.url} alt={asset.name} />
                ) : (
                  <span className="odf-asset-ext">
                    {asset.name.split('.').pop()?.toUpperCase() ?? 'FILE'}
                  </span>
                )}
              </span>
              <figcaption>
                <span className="odf-asset-name">{asset.name}</span>
                <span className="odf-asset-meta">
                  {sizeLabel(asset.bytes)} ·{' '}
                  {asset.usedBy.length === 0 ? 'unused' : `used ×${asset.usedBy.length}`}
                </span>
              </figcaption>
              <span className="odf-asset-actions">
                <button
                  type="button"
                  className="odf-chip"
                  onClick={() => {
                    void navigator.clipboard.writeText(referenceFor(asset));
                    setStatus(`Copied ${referenceFor(asset)}`);
                  }}
                >
                  Copy path
                </button>
                <button type="button" className="odf-chip" onClick={() => void remove(asset)}>
                  Delete
                </button>
              </span>
            </figure>
          ))}
        </div>
      )}
    </main>
  );
}
