import { Marked } from 'marked';

function asText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const marked = new Marked({
  gfm: true,
  // Notes predate markdown here, and in plain text a single line break is the whole structure.
  breaks: true,
  renderer: {
    // A note is written by whoever can reach the list — another member of a shared one, or an
    // assistant over MCP. Neither gets to fetch a remote url when the note is opened, nor to
    // choose the markup it renders as. Shown as text rather than discarded: the writer put words
    // there, and a blank tells the reader nothing was.
    image: ({ text, href }) => asText(text || href),
    html: ({ raw }) => asText(raw),
    // Angular's sanitizer allows no form elements, so marked's own checkbox would be stripped on
    // the way out and a ticked step would read exactly like an unticked one.
    checkbox: ({ checked }) => (checked ? '☑ ' : '☐ '),
    // The outline belongs to the page around the note: the review card and the dialog both carry
    // their own heading, and a note is content under it, not a section beside it.
    heading(token) {
      return `<p class="heading">${this.parser.parseInline(token.tokens)}</p>\n`;
    },
    // Installed, the app has no way back: following a link in place leaves the board behind, on a
    // url the reader did not write.
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${asText(token.href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

/** Notes as html, for binding to innerHTML, where Angular sanitizes it a second time. */
export function renderNotes(notes: string): string {
  return marked.parse(notes, { async: false });
}
