import { frameIds } from 'virtual:open-design-frame/frames';
import { useSearchParams } from 'react-router-dom';
import { AssetBrowser } from '../components/asset-browser.tsx';
import { GLOBAL_SCOPE } from '../lib/assets.ts';
import { useHome } from './home-shell.tsx';

/**
 * Every asset in the project, from the project's own nav.
 *
 * The scope here is a list of all of them, because the question being asked is
 * "where does this file live" rather than "what can this frame see" — the
 * frame's own Assets tab answers that one, with two choices instead of twelve.
 */
export function AssetsPage() {
  const { assets, reloadAssets } = useHome();
  const [params, setParams] = useSearchParams();

  const scope = params.get('scope');
  const setScope = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === '') nextParams.delete('scope');
    else nextParams.set('scope', next);
    setParams(nextParams, { replace: true });
  };

  return (
    <AssetBrowser
      assets={assets}
      reloadAssets={reloadAssets}
      scope={scope}
      scopeControl={
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
      }
    />
  );
}
