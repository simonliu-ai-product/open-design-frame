import { frameIds, loadFrame } from 'virtual:open-design-frame/frames';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AssetBrowser } from '../components/asset-browser.tsx';
import { type Asset, fetchAssets, GLOBAL_SCOPE } from '../lib/assets.ts';
import type { FrameModule } from '../lib/sdk.ts';

/**
 * A frame's assets, without leaving the frame.
 *
 * Assets used to be one project-wide page reached from the home nav, with a
 * dropdown of every frame in it — which asks the reader to find the frame they
 * were already standing in. Here the frame is context, not a choice, and the
 * only choice left is the one that matters: beside this frame, or in the
 * folder every frame can see.
 */
export function FrameAssets() {
  const { fileId = '' } = useParams();
  const frameFile = frameIds.includes(fileId) ? fileId : null;
  const [params, setParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [title, setTitle] = useState<string | null>(null);

  const reloadAssets = useCallback(() => {
    void fetchAssets().then(setAssets);
  }, []);
  useEffect(reloadAssets, [reloadAssets]);

  useEffect(() => {
    if (frameFile === null) return;
    let cancelled = false;
    void loadFrame(frameFile)
      .then((loaded) => {
        if (!cancelled) setTitle((loaded as FrameModule).meta?.title ?? null);
      })
      .catch(() => {
        // The title is decoration here; the folder is the page.
      });
    return () => {
      cancelled = true;
    };
  }, [frameFile]);

  if (frameFile === null) {
    return (
      <div className="odf-shell">
        <p className="odf-error">
          No frame called <code>{fileId}</code>.
        </p>
      </div>
    );
  }

  const global = params.get('scope') === GLOBAL_SCOPE;
  const scope = global ? GLOBAL_SCOPE : frameFile;
  const setGlobal = (next: boolean) => {
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('scope', GLOBAL_SCOPE);
    else nextParams.delete('scope');
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="odf-shell">
      <header className="odf-topbar">
        <div className="odf-topbar-left">
          <Link className="odf-back" to="/" aria-label="All frames">
            ‹
          </Link>
          <span className="odf-segment">
            <Link className="odf-seg" to={`/f/${frameFile}`}>
              Frames
            </Link>
            <span className="odf-seg" aria-current="true">
              Assets
            </span>
          </span>
        </div>

        <div className="odf-topbar-center">
          <span className="odf-title">{title ?? frameFile}</span>
        </div>

        <div className="odf-topbar-right" />
      </header>

      <AssetBrowser
        assets={assets}
        reloadAssets={reloadAssets}
        scope={scope}
        scopeControl={
          <span className="odf-segment">
            <button
              type="button"
              className="odf-seg"
              aria-current={!global}
              onClick={() => setGlobal(false)}
            >
              This frame
            </button>
            <button
              type="button"
              className="odf-seg"
              aria-current={global}
              onClick={() => setGlobal(true)}
            >
              Global
            </button>
          </span>
        }
      />
    </div>
  );
}
