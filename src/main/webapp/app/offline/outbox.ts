import { Injectable, computed, inject, signal } from '@angular/core';
import { IDBPDatabase, openDB } from 'idb';
import { firstValueFrom } from 'rxjs';
import { TodoApi } from '../api/todo-api';
import { Zone } from '../api/model';

/**
 * A write made with no connection, waiting to be sent.
 *
 * <p>Only two kinds exist, and that is the design rather than an unfinished list. Creating is
 * append-only and completing is idempotent, so both are safe to replay blind. Moving, deferring and
 * editing are not: replayed against a list someone else has touched they are a silent overwrite,
 * and none of them is urgent enough underground to be worth that.
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
 * The queue of writes this device still owes the server.
 *
 * <p>Every capture goes through here, online or not. One path instead of two means the case that
 * loses a task — the request left, the response never came back — is exercised constantly rather
 * than only on the day the tunnel swallows it.
 */
@Injectable({ providedIn: 'root' })
export class Outbox {
  private readonly api = inject(TodoApi);
  private readonly entries = signal<OutboxEntry[]>([]);
  private db: Promise<IDBPDatabase> | null = null;
  private flushing = false;

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

  /** Queues a write and tries immediately; when there is a connection this is over in a moment. */
  async enqueue(entry: OutboxDraft): Promise<string> {
    const stored = {
      ...entry,
      // The id doubles as the clientRef the server deduplicates on, so a retry after a lost
      // response resolves to the task the first attempt already created.
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    } as OutboxEntry;
    await (await this.open()).put(STORE, stored);
    this.entries.update((current) => [...current, stored]);
    await this.flush();
    return stored.id;
  }

  /** Drops a queued write. Used to take back a capture that never left the device. */
  async discard(id: string): Promise<void> {
    await (await this.open()).delete(STORE, id);
    this.entries.update((current) => current.filter((entry) => entry.id !== id));
  }

  /**
   * Sends what is queued, oldest first and strictly in order.
   *
   * <p>Order matters for one case: a task captured and completed in the same offline stretch. Send
   * them out of order and the completion refers to a task the server has not heard of.
   */
  async flush(): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;
    try {
      for (const entry of [...this.entries()].sort((a, b) => a.createdAt - b.createdAt)) {
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
      // 0 is no network; 401 means the token could not be renewed, which offline looks the same as.
      // Anything else is the server's considered answer, and repeating it will not change it: a
      // completion for a task that was deleted meanwhile is exactly the 404 this drops on purpose.
      return status === 0 || status === 401 || status === 408 || status >= 500
        ? 'unreachable'
        : 'done';
    }
  }

  private async readAll(): Promise<OutboxEntry[]> {
    return (await (await this.open()).getAll(STORE)) as OutboxEntry[];
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
