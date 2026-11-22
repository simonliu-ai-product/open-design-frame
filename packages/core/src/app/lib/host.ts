/**
 * The open-x host protocol, v1: what a host app embedding the viewer offers it
 * through `window.openxHost`. Every member is optional, and with no host the
 * viewer behaves exactly as in a browser. The viewer looks only at
 * capabilities, never at which host it is.
 *
 * `agent` means the host brings its own agent, so the viewer's agent panel and
 * its toggle stay out of the way: two agents in one window would edit the same
 * files without knowing about each other.
 */
export type HostCapability =
  | 'theme'
  | 'openItem'
  | 'openHome'
  | 'guardUnsaved'
  | 'printToPdf'
  | 'translucent'
  | 'agent';

export interface HostTheme {
  mode: 'light' | 'dark';
  accent: string | null;
}

export type UnsavedStatus = { drafts: boolean; pending: boolean };
export type UnsavedAction = 'save' | 'discard' | 'abandon';
export type UnsavedOutcome = { ok: true } | { ok: false; error: string };

export interface UnsavedGuard {
  status(): UnsavedStatus;
  settle(action: UnsavedAction): Promise<UnsavedOutcome>;
}

export interface OpenxHost {
  protocol: 1;
  name: string;
  capabilities: HostCapability[];
  theme?: {
    current(): HostTheme;
    onChange(listener: (theme: HostTheme) => void): () => void;
  };
  openItem?(item: { path: string; title?: string }): boolean;
  openHome?(path?: string): boolean;
  guardUnsaved?(guard: UnsavedGuard): () => void;
  printToPdf?(filename: string): Promise<boolean>;
  translucent?: boolean;
}

declare global {
  interface Window {
    openxHost?: OpenxHost;
  }
}

export function getHost(): OpenxHost | undefined {
  const host = typeof window === 'undefined' ? undefined : window.openxHost;
  return host?.protocol === 1 ? host : undefined;
}

export function hostCan(capability: HostCapability, host = getHost()): boolean {
  return Boolean(host?.capabilities?.includes(capability));
}
