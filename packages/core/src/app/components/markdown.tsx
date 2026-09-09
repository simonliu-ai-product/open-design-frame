import { marked } from 'marked';
import { useMemo } from 'react';

export type MarkdownProps = { text: string };

/**
 * A design document, rendered.
 *
 * The Markdown comes from a file in the author's own workspace — the same place
 * the frames it describes come from, and those are executed. Rendering their
 * prose is not a new trust boundary, so there is nothing here to sanitise
 * against; a document fetched from elsewhere would be a different question.
 */
export function Markdown({ text }: MarkdownProps) {
  const html = useMemo(() => marked.parse(text, { async: false }) as string, [text]);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: the source is the workspace's own file
  return <div className="odf-md" dangerouslySetInnerHTML={{ __html: html }} />;
}
