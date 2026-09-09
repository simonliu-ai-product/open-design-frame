declare module 'virtual:open-frame/frames' {
  export const frameIds: string[];
  export function loadFrame(id: string): Promise<unknown>;
}

declare module 'virtual:open-frame/config' {
  const config: import('../config.ts').OpenFrameConfig;
  export default config;
}

declare module 'virtual:open-frame/folders' {
  const manifest: import('../editing/folders.ts').FoldersManifest;
  export default manifest;
}

declare module 'virtual:open-frame/themes' {
  export const themeIds: string[];
  export function loadTheme(id: string): Promise<unknown>;
}

declare module 'virtual:open-frame/theme-docs' {
  /** Theme id → the text of its DESIGN.md, for the themes it has one. */
  const docs: Record<string, string>;
  export default docs;
}
