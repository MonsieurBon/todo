import { describe, expect, it } from 'vitest';
import contract from '../../api/openapi.json';
import {
  MAX_LABEL_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  cutTo,
  openingLine,
  parseLabels,
  tooLongLabel,
} from './model';

/**
 * The limits start as constants on the Java entity, reach `openapi.json` through
 * `OpenApiContractIT`, and are copied by hand into `model.ts` — a form cannot import a number out
 * of a type. This is what makes that last hop fail loudly instead of drifting: change the entity,
 * commit the regenerated contract, and this test names the constant that was left behind.
 */
describe('the limits the form enforces', () => {
  const schemas = (
    contract as unknown as {
      components: {
        schemas: Record<
          string,
          { properties: Record<string, { maxLength?: number; items?: { maxLength?: number } }> }
        >;
      };
    }
  ).components.schemas;

  it.each(['CaptureTask', 'CreateTask'])('match what %s publishes', (name) => {
    const properties = schemas[name].properties;
    expect(properties['title'].maxLength).toBe(MAX_TITLE_LENGTH);
    expect(properties['notes'].maxLength).toBe(MAX_NOTES_LENGTH);
    expect(properties['labels'].items?.maxLength).toBe(MAX_LABEL_LENGTH);
  });
});

describe('parsing the comma-separated topics field', () => {
  it('trims and drops the empties a trailing comma leaves', () => {
    expect(parseLabels(' house , project-a ,, ')).toEqual(['house', 'project-a']);
  });

  it('finds nothing wrong with labels that fit', () => {
    expect(tooLongLabel('house, project-a')).toBeNull();
  });

  it('names the label that is too long, so the message can quote it', () => {
    const long = 'l'.repeat(MAX_LABEL_LENGTH + 1);
    expect(tooLongLabel(`house, ${long}`)).toBe(long);
  });

  it('accepts one exactly at the limit', () => {
    expect(tooLongLabel('l'.repeat(MAX_LABEL_LENGTH))).toBeNull();
  });
});

describe('making a title out of a shared body', () => {
  it('takes the first line when there is one', () => {
    expect(openingLine('Ring the plumber\nabout the upstairs leak')).toBe('Ring the plumber');
  });

  it('cuts a long first line at a space, so it ends in whole words', () => {
    const title = openingLine('word '.repeat(MAX_TITLE_LENGTH));
    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(title.endsWith('word')).toBe(true);
  });

  it('falls back to a hard cut when the first line has no spaces at all', () => {
    expect(openingLine('x'.repeat(MAX_TITLE_LENGTH + 50))).toHaveLength(MAX_TITLE_LENGTH);
  });

  // The hard cut is where a character can be split: an odd limit lands between the two halves of
  // an emoji, and a lone high surrogate reaches the column as '?'.
  it('never cuts a character in half', () => {
    const title = openingLine('\uD83E\uDDF9'.repeat(200));

    expect(title.length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    expect(title).toBe('\uD83E\uDDF9'.repeat(Math.floor(MAX_TITLE_LENGTH / 2)));
    expect(/[\uD800-\uDBFF]$/.test(title)).toBe(false);
  });

  it('measures in code units, because that is what @Size counts', () => {
    const body = '\uD83E\uDDF9'.repeat(MAX_TITLE_LENGTH);
    expect(openingLine(body).length).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
  });
});

describe('cutting to fit', () => {
  it('leaves a value that already fits alone', () => {
    expect(cutTo(10, 'short')).toBe('short');
  });

  it('drops a split character rather than leaving half of one', () => {
    expect(cutTo(3, '\uD83E\uDDF9\uD83E\uDDF9')).toBe('\uD83E\uDDF9');
  });

  it('keeps a character that ends exactly on the limit', () => {
    expect(cutTo(2, '\uD83E\uDDF9\uD83E\uDDF9')).toBe('\uD83E\uDDF9');
  });
});
