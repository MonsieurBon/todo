import type { components } from '../../api/schema';

type Schemas = components['schemas'];

/**
 * Narrows a generated response type to what the server actually promises.
 *
 * <p>springdoc marks every field of a Java record optional, because a record component carries no
 * nullability. Rather than annotate each one, the fields that really can be absent are named here
 * and the rest are required. This still catches drift: naming a field that no longer exists is a
 * compile error, so a rename on the server breaks the build here rather than at runtime.
 */
type Sent<T, Absent extends keyof T> = Required<Omit<T, Absent>> & Partial<Pick<T, Absent>>;

/**
 * Replaces one property with a narrower type. {@code K extends keyof T} is the point: if the
 * server drops the property, naming it here stops compiling rather than quietly doing nothing.
 */
type Narrow<T, K extends keyof T, V> = Omit<T, K> & Record<K, V>;

export type Zone = NonNullable<Schemas['TaskView']['zone']>;
export type TaskState = NonNullable<Schemas['TaskView']['state']>;

export type Task = Sent<
  Schemas['TaskView'],
  'notes' | 'dueDate' | 'deferUntil' | 'lastReviewedAt' | 'clientRef'
>;
export type ZoneLoad = Sent<Schemas['ZoneLoad'], 'softCap'>;
// The generated element types are optional all the way down, so the collections are narrowed to
// the same types every screen already uses.
export type BoardView = Narrow<
  Narrow<Sent<Schemas['BoardView'], never>, 'tasks', Task[]>,
  'zones',
  ZoneLoad[]
>;
export type TaskList = Sent<Schemas['TaskListSummary'], never>;

export type CaptureTask = Schemas['CaptureTask'];
export type CreateTask = Schemas['CreateTask'];

/** Declaration order is urgency order, and every screen relies on it. */
export const ZONES: readonly Zone[] = ['CRITICAL_NOW', 'OPPORTUNITY_NOW', 'OVER_THE_HORIZON'];

export const ZONE_NAMES: Record<Zone, string> = {
  CRITICAL_NOW: 'Critical Now',
  OPPORTUNITY_NOW: 'Opportunity Now',
  OVER_THE_HORIZON: 'Over the Horizon',
};

/** What each zone is for, in the method's own terms. Shown where the zone is empty. */
export const ZONE_MEANINGS: Record<Zone, string> = {
  CRITICAL_NOW: 'Must be done today.',
  OPPORTUNITY_NOW: 'Do soon, when the chance arises.',
  OVER_THE_HORIZON: 'Not now.',
};

export function zoneAfter(zone: Zone, steps: number): Zone | null {
  const next = ZONES.indexOf(zone) + steps;
  return next >= 0 && next < ZONES.length ? ZONES[next] : null;
}

/**
 * What the server will accept, so the form can refuse it before it is queued rather than after.
 *
 * <p>These matter more than a tidy form: a capture made offline is replayed from the outbox, and
 * the outbox reads a 4xx as the server's settled answer and drops the entry. A value the server
 * refuses is therefore a task the user is told was saved and never sees again — so the limit has
 * to be enforced where it is typed.
 *
 * <p>Third copy of a number that starts on the Java entity, so `model.spec.ts` checks them against
 * the contract rather than trusting this comment.
 */
export const MAX_TITLE_LENGTH = 255;
export const MAX_NOTES_LENGTH = 10_000;
export const MAX_LABEL_LENGTH = 64;

/** The labels a comma-separated field is asking for, which is what the server will be sent. */
export function parseLabels(input: string): string[] {
  return input
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
}

/**
 * A title for a body of text that is too long to be one: its first line, cut at the last space
 * that fits so the result is words rather than a word sliced in half.
 */
export function openingLine(body: string): string {
  const line = body.split('\n', 1)[0].trim();
  if (line.length <= MAX_TITLE_LENGTH) {
    return line;
  }
  const cut = cutTo(MAX_TITLE_LENGTH, line);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Shortens to `max` **code units**, without splitting a character in half.
 *
 * <p>Code units rather than characters on purpose, unlike the entity: what decides whether this is
 * accepted is the DTO's `@Size`, which counts code units, and a 400 on the capture path is
 * discarded by the outbox rather than shown to anyone. Cutting to 255 characters could be 510 code
 * units and would be refused.
 *
 * <p>A trailing high surrogate can only be an orphan — a whole character ends in a low one — so
 * dropping one is exactly the broken case and nothing else. Left in, it survives `JSON.stringify`
 * as an escape, comes back as a `char` with no UTF-8 encoding, and reaches the column as `?`.
 */
export function cutTo(max: number, value: string): string {
  return value.length <= max ? value : value.slice(0, max).replace(/[\uD800-\uDBFF]$/, '');
}

/** The first label too long to store, or null. Named so the form can say which one. */
export function tooLongLabel(input: string): string | null {
  return parseLabels(input).find((label) => label.length > MAX_LABEL_LENGTH) ?? null;
}
