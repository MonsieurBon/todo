import { Injectable, computed, inject, signal } from '@angular/core';
import { IDBPDatabase, openDB } from 'idb';
import { firstValueFrom } from 'rxjs';
import { TodoApi } from '../api/todo-api';
import { Recurrence, Zone } from '../api/model';

export interface CaptureEntry {
  id: string;
  kind: 'capture';
  createdAt: number;
  listId: number | null;
  title: string;
  notes: string;
  zone: Zone;
  labels: string[];
  /** Missing from entries queued before tasks could repeat. */
  recurrence?: Recurrence | null;
}

/**
 * Two kinds by design, not an unfinished list: creating is append-only and completing idempotent,
 * so both replay blind. Moving, deferring and editing would be silent overwrites.
 *
 * Nothing but sending one takes an entry out again: a click that withdrew one could not tell
 * whether it was already on its way.
 */
export type OutboxEntry =
  | CaptureEntry
  | { id: string; kind: 'complete'; createdAt: number; taskId: number }
  /** A task with no id yet, named by the capture the server resolves to it. */
  | { id: string; kind: 'complete'; createdAt: number; capture: Omit<CaptureEntry, 'createdAt'> };

/** Distributes over the union, so each kind keeps its own fields. */
export type OutboxDraft = OutboxEntry extends infer E
  ? E extends OutboxEntry
    ? Omit<E, 'id' | 'createdAt'>
    : never
  : never;

const DB_NAME = 'todo-outbox';
const STORE = 'entries';

/**
 * Every capture goes through here, online or not, so the case that loses a task — request left,
 * response never came back — is exercised constantly rather than only in a tunnel.
 */
@Injectable({ providedIn: 'root' })
export class Outbox {
  private readonly api = inject(TodoApi);
  private readonly entries = signal<OutboxEntry[]>([]);
  private db: Promise<IDBPDatabase> | null = null;
  private flushing = false;
  private lastAt = 0;

  private readonly sent = signal<ReadonlyMap<string, number>>(new Map());

  readonly pending = this.entries.asReadonly();
  readonly pendingCaptures = computed(() =>
    this.entries().filter((e): e is CaptureEntry => e.kind === 'capture'),
  );
  readonly completingIds = computed(
    () => new Set(this.entries().flatMap((e) => ('taskId' in e ? [e.taskId] : []))),
  );
  /** By the capture's id, which is also the clientRef the server holds the task under. */
  readonly completingCaptures = computed(
    () => new Set(this.entries().flatMap((e) => ('capture' in e ? [e.capture.id] : []))),
  );
  /** The server's id for each capture whose completion this tab sent. */
  readonly delivered = this.sent.asReadonly();

  async load(): Promise<void> {
    this.entries.set(await this.readAll());
  }

  async enqueue(entry: OutboxDraft): Promise<string> {
    // Strictly increasing: order is recovered from the store, whose keys are random, so two
    // entries in the same millisecond would otherwise sort either way round.
    this.lastAt = Math.max(Date.now(), this.lastAt + 1);
    const stored = {
      ...entry,
      // Doubles as the clientRef the server deduplicates on, so a retry resolves to the same task.
      id: crypto.randomUUID(),
      createdAt: this.lastAt,
    } as OutboxEntry;
    await (await this.open()).put(STORE, stored);
    this.entries.update((current) => [...current, stored]);
    await this.flush();
    return stored.id;
  }

  /** Everything queued goes unsent — for when the device may have changed hands. */
  async clear(): Promise<void> {
    await (await this.open()).clear(STORE);
    this.entries.set([]);
  }

  /**
   * Strictly in order: a task captured and completed in the same offline stretch would otherwise
   * have its completion refer to a task the server has not heard of.
   */
  async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      // Until the store is empty: what is queued while one pass is sending is not in that pass,
      // and nothing else would send it before the next capture or reconnect.
      for (;;) {
        // From the store, not the signal: another tab may have emptied it, and each tab holds its
        // own copy that nothing tells.
        const queued = await this.readAll();
        this.entries.set(queued);
        if (!queued.length) {
          return;
        }
        for (const entry of queued) {
          const outcome = await this.send(entry);
          if (outcome === 'unreachable') {
            return;
          }
          await this.discard(entry.id);
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private async discard(id: string): Promise<void> {
    await (await this.open()).delete(STORE, id);
    this.entries.update((current) => current.filter((entry) => entry.id !== id));
  }

  private async send(entry: OutboxEntry): Promise<'done' | 'unreachable'> {
    try {
      if (entry.kind === 'capture') {
        await this.capture(entry);
      } else if ('capture' in entry) {
        const id = await this.capture(entry.capture);
        await firstValueFrom(this.api.complete(id));
        this.sent.update((sent) => new Map(sent).set(entry.capture.id, id));
      } else {
        await firstValueFrom(this.api.complete(entry.taskId));
      }
      return 'done';
    } catch (error) {
      const status = (error as { status?: number }).status ?? 0;
      // 0 is no network; 401 and 403 are a token that could not be renewed or does not open this
      // surface, both of which look the same offline. Anything else is settled and repeating will
      // not change it — the 404 of a task deleted meanwhile is exactly what this drops on purpose.
      return status === 0 || status === 401 || status === 403 || status === 408 || status >= 500
        ? 'unreachable'
        : 'done';
    }
  }

  private async capture(entry: Omit<CaptureEntry, 'createdAt'>): Promise<number> {
    const body = {
      title: entry.title,
      notes: entry.notes,
      zone: entry.zone,
      labels: entry.labels,
      recurrence: entry.recurrence ?? undefined,
      clientRef: entry.id,
    };
    const task = await firstValueFrom(
      entry.listId == null ? this.api.capture(body) : this.api.addToList(entry.listId, body),
    );
    return task.id;
  }

  /** The one place the order is established, so `load` and `flush` cannot disagree about it. */
  private async readAll(): Promise<OutboxEntry[]> {
    const entries = ((await (await this.open()).getAll(STORE)) as OutboxEntry[]).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
    // Seeded from what is already queued: a clock that steps back must not undercut it.
    this.lastAt = Math.max(this.lastAt, entries.at(-1)?.createdAt ?? 0);
    return entries;
  }

  private open(): Promise<IDBPDatabase> {
    this.db ??= openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      },
    });
    return this.db;
  }
}
