import { describe, expect, it } from 'vitest';
import { renderNotes } from './markdown';

describe('rendering notes as markdown', () => {
  it('renders the marks people actually type', () => {
    expect(renderNotes('**bold** and *italic* and `code`')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>\n',
    );
  });

  it('renders lists, headings and quotes', () => {
    const html = renderNotes('## Shopping\n\n- tiles\n- grout\n\n> ask first');

    expect(html).toContain('<p class="heading">Shopping</p>');
    expect(html).toContain('<li>tiles</li>');
    expect(html).toContain('<blockquote>');
  });

  // The page around the note owns the outline; a note may not add sections to it.
  it('leaves the heading levels to the page', () => {
    expect(renderNotes('# Shopping')).not.toMatch(/<h[1-6]/);
  });

  it('says whether a step is ticked, which is the whole point of writing one', () => {
    const html = renderNotes('- [x] tiles\n- [ ] grout');

    expect(html).toContain('☑ tiles');
    expect(html).toContain('☐ grout');
  });

  // Every note written before this existed is plain text whose line breaks carry the meaning.
  it('keeps a single line break, so notes written as plain text still read the same', () => {
    expect(renderNotes('Behind the bath.\nMeasure first.')).toBe(
      '<p>Behind the bath.<br>Measure first.</p>\n',
    );
  });

  // Following a link in place would leave the installed app with no way back to the board.
  it('opens a link beside the app rather than in place of it', () => {
    expect(renderNotes('[tiles](https://example.com/tiles)')).toContain(
      '<a href="https://example.com/tiles" target="_blank" rel="noopener noreferrer">tiles</a>',
    );
  });

  // Notes arrive from a shared list and from an assistant over MCP, not only from the person
  // reading them.
  it('names an image rather than fetching a remote url when the note is opened', () => {
    const html = renderNotes('![kitchen plan](https://tracker.example.com/pixel.png)');

    expect(html).not.toContain('<img');
    expect(html).toContain('kitchen plan');
  });

  it('shows html as the text it was typed as, rather than rendering or swallowing it', () => {
    expect(renderNotes('<script>alert(1)</script>')).toContain('&lt;script&gt;alert(1)');
    expect(renderNotes('a <b>bold</b> claim')).toContain('a &lt;b&gt;bold&lt;/b&gt; claim');
    expect(renderNotes('<img src="x" onerror="alert(1)">')).not.toContain('<img');
  });

  it('escapes text that looks like markup', () => {
    expect(renderNotes('2 < 3 & 4 > 1')).toContain('2 &lt; 3 &amp; 4 &gt; 1');
  });
});
