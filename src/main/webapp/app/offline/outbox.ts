import { Injectable, computed, inject, signal } from '@angular/core';
import { IDBPDatabase, openDB } from 'idb';
import { firstValueFrom } from 'rxjs';
import { TodoApi } from '../api/todo-api';
import { Zone } from '../api/model';

/**
 * Two kinds by design, not an unfinished list: creating is append-only and completing idempotent,
 * so both replay blind. Moving, deferring and editing would be silent overwrites.
 */
export type OutboxEntry =
  | {
      id: string;
      kind: 'capture';
      createdAt: number;
      listId: number | null;
      title: string;
      notes: string;
      zone: Zone;
      labels: string[];
    }
  | { id: string; kind: 'complete'; createdAt: number; taskId: number };

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

  readonly pending = this.entries.asReadonly();
  readonly pendingCaptures = computed(
    () =>
      this.entries().filter((e) => e.kind === 'capture') as Extract<
        OutboxEntry,
        { kind: 'capture' }
      >[],
  );
  readonly completingIds = computed(
    () =>
      new Set(
        this.entries()
          .filter((e) => e.kind === 'complete')
          .map((e) => (e as Extract<OutboxEntry, { kind: 'complete' }>).taskId),
      ),
  );

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

  async discard(id: string): Promise<void> {
    await (await this.open()).delete(STORE, id);
    this.entries.update((current) => current.filter((entry) => entry.id !== id));
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
      // From the store, not the signal: another tab may have emptied it, and each tab holds its
      // own copy that nothing tells.
      const queued = await this.readAll();
      this.entries.set(queued);
      for (const entry of queued) {
        const outcome = await this.send(entry);
        if (outcome === 'unreachable') {
          return;
        }
        await this.discard(entry.id);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async send(entry: OutboxEntry): Promise<'done' | 'unreachable'> {
    try {
      if (entry.kind === 'capture') {
        const body = {
          title: entry.title,
          notes: entry.notes,
          zone: entry.zone,
          labels: entry.labels,
          clientRef: entry.id,
        };
        await firstValueFrom(
          entry.listId == null ? this.api.capture(body) : this.api.addToList(entry.listId, body),
        );
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
