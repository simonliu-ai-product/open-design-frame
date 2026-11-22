import { Marked } from 'marked';
import { useMemo } from 'react';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A reply is model output, not the workspace's own file: raw HTML in it is
// shown as text, and a link may only lead somewhere ordinary.
const marked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    link({ href, text }) {
      if (!/^(https?:|mailto:)/i.test(href)) return escapeHtml(text);
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(text)}</a>`;
    },
    image({ text }) {
      return escapeHtml(text);
    },
  },
});

export function AgentMarkdown({ text }: { text: string }) {
  const html = useMemo(() => marked.parse(text, { async: false }) as string, [text]);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML in the reply is escaped above
  return <div className="odf-agent-md" dangerouslySetInnerHTML={{ __html: html }} />;
}
