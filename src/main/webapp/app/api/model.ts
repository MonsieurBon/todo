import type { components } from '../../api/schema';

type Schemas = components['schemas'];

/**
 * springdoc marks every field of a Java record optional, since a record component carries no
 * nullability — so the genuinely absent ones are named here and the rest made required. Naming a
 * field that no longer exists is a compile error, which is what catches drift.
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
export type UpdateTask = Schemas['UpdateTask'];

/** Declaration order is urgency order, and every screen relies on it. */
export const ZONES: readonly Zone[] = ['CRITICAL_NOW', 'OPPORTUNITY_NOW', 'OVER_THE_HORIZON'];

export const ZONE_NAMES: Record<Zone, string> = {
  CRITICAL_NOW: 'Critical Now',
  OPPORTUNITY_NOW: 'Opportunity Now',
  OVER_THE_HORIZON: 'Over the Horizon',
};

/** Shown where a zone is empty. */
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
 * Enforced where a value is typed, because the outbox drops a 4xx as settled — so a value the
 * server refuses is a task reported saved and never seen again. Third copy of a number that starts
 * on the Java entity; `model.spec.ts` pins them against the contract.
 */
export const MAX_TITLE_LENGTH = 255;
export const MAX_NOTES_LENGTH = 10_000;
export const MAX_LABEL_LENGTH = 64;

/**
 * The one rewriting a topic gets, matching the entity: a composed and a combining accent are the
 * same text, and would otherwise be two topics that look identical.
 */
export function asTopic(label: string): string {
  return label.normalize('NFC');
}

/**
 * The one place typed text becomes topics, so the one place they are normalised. Before the rule
 * that follows, not after: a combining accent is a mark rather than a letter, so an unnormalised
 * "Cafe\u0301" would be refused for holding something that is not a letter when composing it first
 * makes it one. The entity does the same, in the same order.
 */
export function parseLabels(input: string): string[] {
  return input
    .split(',')
    .map((label) => asTopic(label.trim()))
    .filter(Boolean);
}

/** Cut at the last space that fits, so the result is words rather than a sliced one. */
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
 * Code units, not characters, because the DTO's `@Size` counts them: 255 characters could be 510
 * code units and be refused. A trailing high surrogate can only be an orphan, and left in it
 * reaches the column as `?`.
 */
export function cutTo(max: number, value: string): string {
  return value.length <= max ? value : value.slice(0, max).replace(/[\uD800-\uDBFF]$/, '');
}

export function tooLongLabel(input: string): string | null {
  return parseLabels(input).find((label) => label.length > MAX_LABEL_LENGTH) ?? null;
}

/**
 * What a topic may be spelled with, held here as well as on the entity for the same reason as the
 * lengths: the outbox drops a refusal as settled, so a topic the server would refuse is a task
 * reported saved and never seen again. `model.spec.ts` pins it against the entity's own rule.
 *
 * Letters that stand on their own — a script writing one as a base plus a combining mark is
 * refused, deliberately, and only for a topic. A title and notes take any language.
 */
const ALLOWED_LABEL = /^[\p{L}\p{Nd}-]+$/u;

export function unusableLabel(input: string): string | null {
  return parseLabels(input).find((label) => !ALLOWED_LABEL.test(label)) ?? null;
}
