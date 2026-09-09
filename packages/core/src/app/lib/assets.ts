export type Asset = {
  name: string;
  scope: string;
  bytes: number;
  type: string;
  updatedAt: string;
  url: string;
  usedBy: string[];
};

export const GLOBAL_SCOPE = '@global';

/** Every asset in the project. Empty in a static build, which has no folder to read. */
export async function fetchAssets(): Promise<Asset[]> {
  if (!import.meta.env.DEV) return [];
  try {
    const res = await fetch('/__assets');
    if (!res.ok) return [];
    const body = (await res.json()) as { assets?: Asset[] };
    return body.assets ?? [];
  } catch {
    return [];
  }
}

export async function uploadAsset(scope: string, file: File): Promise<string | null> {
  const res = await fetch(
    `/__assets/${encodeURIComponent(scope)}/${encodeURIComponent(file.name)}`,
    { method: 'POST', body: file },
  );
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return `${file.name}: ${body.error ?? res.status}`;
}

export async function deleteAsset(asset: Asset): Promise<string | null> {
  const res = await fetch(
    `/__assets/${encodeURIComponent(asset.scope)}/${encodeURIComponent(asset.name)}`,
    { method: 'DELETE' },
  );
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `could not delete ${asset.name}`;
}

/** What to paste into a frame: a relative import the bundler resolves. */
export const referenceFor = (asset: Asset): string =>
  asset.scope === GLOBAL_SCOPE ? `../../assets/${asset.name}` : `./assets/${asset.name}`;

export const sizeLabel = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
