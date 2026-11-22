import { createContext, type ReactNode, useContext, useState } from 'react';
import { JA } from './i18n-ja.ts';
import { KO } from './i18n-ko.ts';
import { ZH_CN } from './i18n-zh-cn.ts';
import { ZH_TW } from './i18n-zh-tw.ts';

export type Locale = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko';

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'zh-TW', label: '繁體中文', short: '繁' },
  { code: 'zh-CN', label: '简体中文', short: '简' },
  { code: 'ja', label: '日本語', short: '日' },
  { code: 'ko', label: '한국어', short: '한' },
];

const STORAGE_KEY = 'open-design-frame.locale';

export const EN = {
  // Navigation & HomeShell
  'nav.allFrames': 'All frames',
  'nav.themes': 'Themes',
  'nav.assets': 'Assets',
  'nav.folders': 'Folders',
  'nav.unfiled': 'Unfiled',
  'nav.newFolder': 'New folder',
  'nav.folderName': 'Folder name',
  'nav.search': 'Search',
  'nav.searchShortcut': 'Search (⌘K)',
  'nav.lightChrome': 'Light chrome',
  'nav.darkChrome': 'Dark chrome',
  'nav.language': 'Language',

  // Home page
  'home.frames': 'Frames',
  'home.newest': 'Newest',
  'home.name': 'Name',
  'home.searchFrames': 'Search frames',
  'home.rename': 'Rename',
  'home.duplicate': 'Duplicate',
  'home.moveToFolder': 'Move to folder…',
  'home.delete': 'Delete',
  'home.deleteFolderConfirm': 'Delete folder?',
  'home.emptyNoFrames':
    'No frames yet. Create frames/<id>/index.tsx and export an array of frames.',
  'home.emptyFolder': 'Nothing in {name}. Move a frame here from the ⋯ menu on its card.',
  'home.frameSingular': 'frame',
  'home.framePlural': 'frames',

  // FrameView Topbar & Modes
  'view.frames': 'Frames',
  'view.assets': 'Assets',
  'view.single': 'Single',
  'view.split': 'Split',
  'view.grid': 'Grid',
  'view.zoomOut': 'Zoom out',
  'view.zoomIn': 'Zoom in',
  'view.play': 'Play',
  'view.inspect': 'Inspect',
  'view.changes': 'Changes',
  'view.export': 'Export',
  'view.saveToSource': 'Save to source',
  'view.saving': 'Saving…',
  'view.discard': 'Discard',
  'view.layersEdited': '{n} {unit} edited',
  'view.layerSingular': 'layer',
  'view.layerPlural': 'layers',
  'view.savedToSource': 'Saved to source',

  // Inspect Panel
  'inspect.title': 'Inspect',
  'inspect.export': 'Export',
  'inspect.typography': 'Typography',
  'inspect.layers': 'Layers',
  'frame.renderError': 'This frame could not be drawn',
  'frame.renderErrorHint': 'Fix the error in its source; the rest of the file still works.',
  'inspect.diagnostics': 'Checks',
  'inspect.content': 'Content',
  'inspect.size': 'Size',
  'inspect.weight': 'Weight',
  'inspect.style': 'Style',
  'inspect.lineHeight': 'Line height',
  'inspect.tracking': 'Tracking',
  'inspect.align': 'Align',
  'inspect.color': 'Color',
  'inspect.text': 'Text',
  'inspect.background': 'Background',
  'inspect.box': 'Box',
  'inspect.tokens': 'Design tokens',
  'inspect.fromConst': 'from {name}',
  'inspect.emptyClick': 'Click something on the canvas to inspect it.',
  'inspect.emptyLayers':
    'Nothing named yet. Wrap a part of the frame in <Layer name="…"> to list it here.',
  'inspect.noIssues': 'No layout or contrast issues detected on this artboard.',

  // Export Panel
  'export.pages': 'Pages',
  'export.thisFrame': 'This frame',
  'export.allFrames': 'All {n}',
  'export.include': 'Include',
  'export.scale': 'Scale',
  'export.frame': 'Frame',
  'export.exportZip': 'Export zip',
  'export.exporting': 'Exporting…',
  'export.chooseFormat': 'Choose at least one format.',
  'export.palette': 'Palette',

  // Comments & Pins
  'comments.count': '{n} {unit}',
  'comments.singular': 'comment',
  'comments.plural': 'comments',
  'comments.newComment': 'New comment',
  'comments.pickingHint': 'Click an element on the canvas to attach a comment (Esc to cancel)',
  'comments.empty':
    'No notes on this frame yet. Select something or click + to pin one on the canvas.',
  'comments.add': 'Add comment',
  'comments.placeholder': 'Leave a note for your teammate or coding agent…',

  // Changes (Git diff)
  'changes.title': 'Changes',
  'changes.against': 'Against',
  'changes.workingTree': 'Working tree (HEAD)',
  'changes.clean': 'No uncommitted or revision changes in this frame.',
  'changes.unplaced': 'Other file changes',
  'changes.revert': 'Revert',
  'changes.reverting': 'Reverting…',
  'changes.hunks': '{n} {unit}',
  'changes.hunkSingular': 'change',
  'changes.hunkPlural': 'changes',

  // Finder (Command Palette)
  'finder.placeholder': 'Go to a frame, artboard, theme, or run a command…',
  'finder.empty': 'Nothing by that name.',
  'finder.kindFrame': 'Frame',
  'finder.kindArtboard': 'Artboard',
  'finder.kindTheme': 'Theme',
  'finder.kindFolder': 'Folder',
  'finder.kindPage': 'Page',
  'finder.kindAction': 'Action',
  'finder.switchViewSingle': 'View: Single artboard',
  'finder.switchViewSplit': 'View: Split side-by-side',
  'finder.switchViewGrid': 'View: Storyboard grid',
  'finder.toggleInspect': 'Toggle Inspect panel',
  'finder.toggleChanges': 'Toggle Changes (git diff)',
  'finder.toggleExport': 'Toggle Export panel',
  'finder.toggleChromeTheme': 'Toggle Light / Dark chrome',
  'finder.toggleAgent': 'Toggle Agent panel',

  // Agent panel
  'agent.title': 'Agent',
  'agent.open': 'Agent',
  'agent.close': 'Close agent panel',
  'agent.beta': 'Beta',
  'agent.betaHint':
    'The agent writes straight into your files. Look over Changes (D) before you commit.',
  'agent.statusLoading': 'Looking for agents…',
  'agent.disabled': 'The agent panel only answers on the machine running the dev server.',
  'agent.connectTitle': 'Connect an agent',
  'agent.connectDescription':
    'The panel drives a coding agent signed in on this machine. It works in this workspace and edits the frame files you see here.',
  'agent.needCliTitle': 'Install {name} first',
  'agent.needCliDescription':
    'The panel uses the {name} CLI signed in on this machine. Install it, sign in, then check again.',
  'agent.cliFound': 'CLI {version}',
  'agent.cliFoundNoVersion': 'CLI found',
  'agent.cliMissing': 'CLI not found',
  'agent.cliHint': 'Install the {name} CLI, then sign in with it:',
  'agent.connectInstallHint': 'Connecting adds {pkg} to this workspace with {pm}.',
  'agent.connect': 'Connect',
  'agent.connecting': 'Connecting…',
  'agent.connected': 'Connected',
  'agent.retry': 'Try again',
  'agent.checkAgain': 'Check again',
  'agent.backToChat': 'Back to chat',
  'agent.manage': 'Manage connection',
  'agent.modelDefault': 'Default model',
  'agent.reasoning': 'Reasoning',
  'agent.effortAuto': 'Auto',
  'agent.effort.minimal': 'Minimal',
  'agent.effort.low': 'Low',
  'agent.effort.medium': 'Medium',
  'agent.effort.high': 'High',
  'agent.effort.xhigh': 'Extra high',
  'agent.effort.max': 'Max',
  'agent.history': 'History',
  'agent.newSession': 'New chat',
  'agent.emptyTitle': 'What should change?',
  'agent.emptyHint':
    'Ask for a change to this file. The agent sees the artboard you are on and the element you selected.',
  'agent.quickEdit': 'Change this artboard',
  'agent.quickEditHint': 'Describe the change. Select an element first to point at it.',
  'agent.quickApply': 'Apply comments',
  'agent.quickApplyHint':
    'Make the changes the notes on the canvas ask for, then remove the notes.',
  'agent.quickCreate': 'Draft a new file',
  'agent.quickCreateHint': 'Start a new design file with the create-frame skill.',
  'agent.composerPlaceholder': 'Ask {provider} to change this design…',
  'agent.send': 'Send',
  'agent.stop': 'Stop',
  'agent.contextArtboard': 'Artboard {n}',
  'agent.sendFailed': 'Could not send: {error}',
  'agent.working': 'Working…',
  'agent.copy': 'Copy',
  'agent.copied': 'Copied',
  'agent.edit': 'Edit',
  'agent.editHint':
    'Sending runs the conversation again from here. Changes already made to files stay.',
  'agent.cancel': 'Cancel',
  'agent.steps': '{n} {unit}',
  'agent.stepSingular': 'step',
  'agent.stepPlural': 'steps',
  'agent.error': 'Error',
  'agent.checkRunning': 'Checking the files this turn changed…',
  'agent.checkFailed': 'The check could not run.',
  'agent.checkClean': 'Checked {files}: no problems found.',
  'agent.checkFound': 'The check found {n} {unit} in {files}',
  'agent.problemSingular': 'problem',
  'agent.problemPlural': 'problems',
  'agent.checkMore': '+{n} more',
  'agent.checkNotDrawn':
    'Read from source only. Add Playwright to this workspace to draw the frames too.',
  'agent.checkFix': 'Ask the agent to fix',
  'agent.resultDone': 'Done',
  'agent.resultStopped': 'Stopped',
  'agent.resultSeconds': '{n}s',
  'agent.questionOther': 'Something else…',
  'agent.questionSkip': 'Skip',
  'agent.questionSubmit': 'Answer',
  'agent.questionSkipped': 'skipped',
  'agent.historyThisFile': 'This file',
  'agent.historyOtherFiles': 'Other files',
  'agent.noSessions': 'No conversations yet',
  'agent.historyEmptyHint': 'Conversations are kept for this workspace until you delete them.',
  'agent.deleteSession': 'Delete conversation',
  'agent.sessionRunning': 'Working…',
  'agent.presenceEditing': '{provider} is editing',
  'agent.presenceThinking': 'Thinking',
} as const;

export type MessageKey = keyof typeof EN;
export type Messages = Record<MessageKey, string>;

export const DICTIONARIES: Record<Locale, Messages> = {
  en: EN,
  'zh-TW': ZH_TW,
  'zh-CN': ZH_CN,
  ja: JA,
  ko: KO,
};

function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && saved in DICTIONARIES) return saved;
  } catch {
    // ignore storage errors
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language;
    if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK') || lang.startsWith('zh-Hant')) {
      return 'zh-TW';
    }
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('ko')) return 'ko';
  }
  return 'en';
}

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TFunction;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTIONARIES[locale] ?? EN;
  const raw = dict[key] ?? EN[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const t: TFunction = (key, vars) => translate(locale, key, vars);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
  );
}

const fallbackT: TFunction = (key, vars) => translate('en', key, vars);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return { locale: 'en', setLocale: () => {}, t: fallbackT };
  }
  return ctx;
}

export function useT(): TFunction {
  return useLocale().t;
}
