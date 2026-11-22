import type { AgentCheckFinding, AgentQuestion, AgentTurnContext } from './types.ts';

// Imported by the viewer too, so nothing here may reach for Node.

export type PromptOptions = {
  /** The workspace's frames folder, `frames` unless the config says otherwise. */
  framesDir: string;
  themesDir?: string;
  assetsDir?: string;
  /** False when the agent's sandbox cannot start a browser, so it cannot draw a frame. */
  canOpenBrowser?: boolean;
};

export function systemPromptAppend(askInstruction: string, opts: PromptOptions): string {
  const themes = opts.themesDir ?? 'themes';
  const assets = opts.assetsDir ?? 'assets';
  return [
    'You are running inside the open-design-frame dev server, driven from its in-app agent panel in the browser rather than a terminal.',
    `The workspace is an open-design-frame project: each design file is ${opts.framesDir}/<id>/index.tsx, which default-exports an array of frames (artboards), each a component carrying its own frameName and size. Themes live in ${themes}/, shared pictures in ${assets}/. The dev server hot-reloads every edit, so the user sees changes on the canvas immediately.`,
    `Edit only files under ${opts.framesDir}/, ${themes}/ and ${assets}/ unless the user asks for something else.`,
    'Use the project skills: frame-authoring as the technical reference before writing a frame, create-frame to draft a new design file, apply-comments to resolve @frame-comment markers left on the canvas, and current-frame when the user points at something without naming it.',
    'Keep the file compiling after every write: a file that does not parse takes every artboard in it off the canvas.',
    opts.canOpenBrowser === false
      ? 'Your sandbox cannot start a browser, so do not run `open-design-frame check --render` or `render`. When your turn ends the dev server checks and draws the frame files you changed and shows the user what it finds.'
      : 'After editing a frame file, run `open-design-frame check <id> --render` and fix what it reports.',
    "Reply in the language of the person's latest message; in Chinese, keep their script and regional wording (Traditional for Traditional, Simplified for Simplified).",
    'Keep replies short and concrete: the panel is narrow. Prefer doing the work over describing it, and finish with a one-line summary of what changed.',
    askInstruction,
  ].join(' ');
}

export function buildTurnPrompt(
  text: string,
  context: AgentTurnContext | undefined,
  framesDir = 'frames',
): string {
  const lines = contextLines(context, framesDir);
  if (lines.length === 0) return text;
  return `${text}\n\n<open-design-frame-context>\n${lines.join('\n')}\n</open-design-frame-context>`;
}

// Titles, names and selected text come from the design's own content, so they
// sit in their own tags with `<` escaped and can't close the context block.
const escapeTag = (s: string) => s.replace(/</g, '&lt;');

function contextLines(context: AgentTurnContext | undefined, framesDir: string): string[] {
  if (!context?.frameId) return [];
  const file = `${framesDir}/${context.frameId}/index.tsx`;
  const lines: string[] = [`The user is viewing the design file "${context.frameId}": ${file}.`];
  if (context.frameTitle) {
    lines.push(`<file-title>${escapeTag(context.frameTitle)}</file-title>`);
  }
  const art = context.artboard;
  if (art) {
    lines.push(
      `They are on artboard ${art.index + 1} of ${art.total} (${art.width}×${art.height}), named in <artboard-name>. "This artboard" or "this screen" refers to it.`,
      `<artboard-name>${escapeTag(art.name)}</artboard-name>`,
    );
  }
  if (context.selection) {
    const { line, column, label, tagName, text } = context.selection;
    lines.push(
      `They have selected a <${escapeTag(tagName)}> element at ${file}:${line}:${column}, shown in the layer list as <selected-layer>.${text ? ' Its text is in <selected-text>.' : ''} "This element" refers to it.`,
      `<selected-layer>${escapeTag(label)}</selected-layer>`,
    );
    if (text) lines.push(`<selected-text>${escapeTag(text)}</selected-text>`);
  }
  if (context.pendingComments) {
    lines.push(
      `There are ${context.pendingComments} pending @frame-comment markers in this file's source.`,
    );
  }
  return lines;
}

/** What the panel's "fix" button sends after a check the dev server ran. */
export function checkFixPrompt(findings: AgentCheckFinding[], total: number): string {
  const lines = findings.map((f) => {
    const where = [`frames/${f.frameId}`, f.frame ? `artboard "${f.frame}"` : null]
      .filter(Boolean)
      .join(', ');
    return `- ${where} [${f.severity}] ${f.message}${f.loc ? ` (at ${f.loc})` : ''}`;
  });
  const more =
    total > findings.length ? `\n- …and ${total - findings.length} more of the same kind` : '';
  return `\`open-design-frame check\` found these problems in the files you changed. Fix them, keeping the design otherwise as it is:\n${lines.join('\n')}${more}`;
}

export function applyCommentsPrompt(frameId: string): string {
  return `Use the apply-comments skill to apply every pending @frame-comment marker in the design file "${frameId}", then remove the markers.`;
}

export const CREATE_FRAME_PROMPT =
  'Use the create-frame skill to draft a new design file. Ask me what it should be first.';

const QUESTIONS_RE = /<open-design-frame-questions>([\s\S]*?)<\/open-design-frame-questions>/i;

export const TEXT_QUESTIONS_INSTRUCTION =
  'You cannot ask the user anything interactively here, and nothing you print in the middle of a turn can be answered. When you need answers before continuing, stop working and end your turn with a final message holding only an <open-design-frame-questions> block: a JSON array of at most 4 questions shaped like [{"header":"Surface","question":"Which screens should it cover?","multiSelect":true,"options":[{"label":"Desktop (Recommended)","description":"1440×1024"}]}], each with 2 to 4 options, written in the user\'s language. The panel shows them as a form and sends the answers back as your next message. Write nothing after the block and do not continue the task in the same turn.';

export function parseQuestions(input: Record<string, unknown>): AgentQuestion[] {
  const raw = Array.isArray(input.questions) ? input.questions : [];
  const questions: AgentQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') continue;
    const r = q as Record<string, unknown>;
    if (typeof r.question !== 'string') continue;
    const options = Array.isArray(r.options)
      ? r.options.flatMap((o) => {
          if (!o || typeof o !== 'object') return [];
          const opt = o as Record<string, unknown>;
          if (typeof opt.label !== 'string') return [];
          return [
            {
              label: opt.label,
              description: typeof opt.description === 'string' ? opt.description : undefined,
            },
          ];
        })
      : [];
    questions.push({
      header: typeof r.header === 'string' ? r.header : '',
      question: r.question,
      options,
      multiSelect: r.multiSelect === true,
    });
  }
  return questions;
}

// Splits a reply written under TEXT_QUESTIONS_INSTRUCTION into its prose and
// questions. Returns null when the reply holds no usable block.
export function extractQuestionBlock(
  text: string,
): { text: string; questions: AgentQuestion[] } | null {
  const match = QUESTIONS_RE.exec(text);
  if (!match) return null;
  const body = (match[1] ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  const questions = parseQuestions({
    questions: Array.isArray(raw) ? raw : (raw as { questions?: unknown } | null)?.questions,
  });
  if (questions.length === 0) return null;
  return { text: text.replace(QUESTIONS_RE, '').trim(), questions };
}

export function answersPrompt(
  questions: AgentQuestion[],
  answers: Record<string, string> | null,
): string {
  if (!answers) {
    return 'I skipped your questions. Continue the task with your best judgement and sensible defaults.';
  }
  const lines = questions.map((q) => `- ${q.question} ${answers[q.question] || '(no answer)'}`);
  return `My answers:\n${lines.join('\n')}\n\nContinue the task with these answers.`;
}

// For agents whose history can't be rewound: the edited message goes on top
// of the old conversation, so the agent is told to set that part aside.
export function editedPrompt(original: string, text: string): string {
  return `I went back and edited an earlier message of mine. Treat everything after it in this conversation, including your replies, as discarded, and respond to the edited version instead. Files keep whatever changes were already made.\n\n<original-message>\n${escapeTag(original)}\n</original-message>\n\n${text}`;
}

// For agents rewound to before the edited message: their history forgets the
// later turns, but the files on disk still hold what those turns wrote.
export function rewoundPrompt(text: string): string {
  return `${text}\n\n<open-design-frame-note>I went back and edited this message. Files keep the changes made after it in the discarded part of this conversation, so read the current files before editing them.</open-design-frame-note>`;
}
