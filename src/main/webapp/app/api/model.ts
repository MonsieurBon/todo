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
