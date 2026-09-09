import docs from 'virtual:open-design-frame/theme-docs';
import { loadTheme, themeIds } from 'virtual:open-design-frame/themes';
import { useEffect, useState } from 'react';
import type { DesignSystem } from './design.ts';
import type { ThemeMeta, ThemeModule } from './sdk.ts';

export type LoadedTheme =
  | { id: string; design: DesignSystem; meta?: ThemeMeta }
  | { id: string; error: string };

export const themeName = (theme: LoadedTheme): string =>
  'error' in theme ? theme.id : (theme.meta?.name ?? theme.id);

/** The import line that puts this theme in a frame. */
export const themeImport = (id: string): string => `import ${id} from '../../themes/${id}';`;

export function useThemes(): { themes: LoadedTheme[]; loading: boolean } {
  const [themes, setThemes] = useState<LoadedTheme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      themeIds.map(async (id): Promise<LoadedTheme> => {
        try {
          const mod = (await loadTheme(id)) as ThemeModule;
          if (!mod.default || typeof mod.default !== 'object') {
            return { id, error: 'default export is not a design system' };
          }
          return { id, design: mod.default, meta: mod.meta };
        } catch (err) {
          return { id, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    ).then((loaded) => {
      if (cancelled) return;
      setThemes(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { themes, loading };
}

/**
 * The theme's DESIGN.md, as written.
 *
 * Bundled with the themes rather than fetched, so the document reads the same
 * in a static build as it does on the dev server — a design system nobody can
 * read once it ships is not one.
 */
export const themeDoc = (id: string): string | null => docs[id] ?? null;

/** Writes a starting document built from the theme's own tokens. Dev only. */
export async function createThemeDoc(
  id: string,
  name: string,
  design: DesignSystem,
): Promise<string | null> {
  const res = await fetch(`/__themes/${encodeURIComponent(id)}/design`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, design }),
  });
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `PUT /__themes/${id}/design → ${res.status}`;
}
