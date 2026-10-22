import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardFilter, TodoApi } from '../api/todo-api';
import { BoardView, Recurrence, Task, TaskList, UpdateTask, ZONES, Zone } from '../api/model';
import { Connectivity } from '../core/connectivity';
import { WriteResult, Writes } from '../core/writes';
import { Outbox } from '../offline/outbox';

/** A capture that has not synced has no `id` yet; `pendingId` identifies it in the outbox. */
export interface BoardTask {
  id: number | null;
  pendingId: string | null;
  title: string;
  zone: Zone;
  labels: string[];
  listId: number | null;
  listName: string | null;
  notes?: string;
  dueDate?: string;
  deferUntil?: string;
  lastReviewedAt?: string;
  recurrence?: Recurrence;
  /** Completed while the board was open: kept in sight so an accidental complete can be undone. */
  done?: true;
}

export interface ZoneSection {
  zone: Zone;
  tasks: BoardTask[];
  open: number;
  softCap: number | null;
  overSoftCap: boolean;
}

/** Where it stood among its zone's rows, so it stays put when the server no longer sends it. */
interface Completed {
  task: BoardTask;
  at: number;
}

const RECOVERY_CHECK_MS = 20_000;

export const GONE = 'That task was completed or deleted elsewhere.';

/** The server sends a deferral only while it still hides the task. */
export const isDeferred = (task: BoardTask): boolean => !!task.deferUntil;

const keyOf = (task: BoardTask): number | string => task.id ?? task.pendingId!;

export const asBoardTask = (task: Task): BoardTask => ({
  id: task.id,
  pendingId: null,
  title: task.title,
  zone: task.zone,
  labels: task.labels ?? [],
  listId: task.listId ?? null,
  listName: task.listName ?? null,
  notes: task.notes,
  dueDate: task.dueDate,
  deferUntil: task.deferUntil,
  lastReviewedAt: task.lastReviewedAt,
  recurrence: task.recurrence,
});

@Injectable({ providedIn: 'root' })
export class BoardStore {
  private readonly api = inject(TodoApi);
  private readonly outbox = inject(Outbox);
  private readonly connectivity = inject(Connectivity);
  private readonly writes = inject(Writes);

  private readonly served = signal<BoardView | null>(null);
  private readonly busy = signal(false);
  private readonly completed = signal<Completed[]>([]);

  readonly filter = signal<BoardFilter>({});
  readonly lists = signal<TaskList[]>([]);
  readonly labels = signal<string[]>([]);
  readonly loading = this.busy.asReadonly();
  readonly online = this.connectivity.online;

  readonly showingCached = computed(() => !this.online() && this.served() !== null);

  readonly pendingCount = computed(() => this.outbox.pending().length);

  /** An acknowledged capture lingers in the outbox; clientRef is how the two copies are one task. */
  private readonly queuedCaptures = computed(() => {
    const acknowledged = new Set(
      this.served()
        ?.tasks.map((t) => t.clientRef)
        .filter(Boolean),
    );
    return this.outbox.pendingCaptures().filter((entry) => !acknowledged.has(entry.id));
  });

  /**
   * The board's tasks with the outbox folded in, marked, so nothing pretends to be saved that is
   * not.
   */
  readonly tasks = computed<BoardTask[]>(() => {
    const completing = this.outbox.completingIds();
    const fromServer = (this.served()?.tasks ?? []).filter((t) => !completing.has(t.id));
    const queued = this.queuedCaptures()
      .filter((entry) => this.matchesFilter(entry.listId, entry.labels, entry.zone))
      .map<BoardTask>((entry) => ({
        id: null,
        pendingId: entry.id,
        title: entry.title,
        notes: entry.notes,
        zone: entry.zone,
        labels: entry.labels,
        listId: entry.listId,
        listName: this.lists().find((l) => l.id === entry.listId)?.name ?? null,
        recurrence: entry.recurrence ?? undefined,
      }));
    const kept = new Set(this.completed().map(({ task }) => keyOf(task)));
    const rows = [...fromServer.map(asBoardTask), ...queued].filter((t) => !kept.has(keyOf(t)));
    // In the order they stood, so each one's place counts the ones before it that are also done.
    const completed = this.completed()
      .filter(({ task }) => this.matchesFilter(task.listId, task.labels, task.zone))
      .sort((a, b) => a.at - b.at);
    for (const { task, at } of completed) {
      const next = rows.filter((row) => row.zone === task.zone)[at];
      rows.splice(next ? rows.indexOf(next) : rows.length, 0, task);
    }
    return rows;
  });

  /**
   * The server's loads, which count everything visible whatever the filter shows, with the outbox
   * folded in: a queued capture counts wherever it is filed, and a queued completion no longer
   * does. Only what is shown can be matched against the outbox, so until it is sent, a completion
   * of a task the filter hides still counts, and a capture the server already holds counts twice.
   */
  readonly zones = computed<ZoneSection[]>(() => {
    const served = this.served();
    const loads = new Map(served?.zones.map((load) => [load.zone, load]));
    const completing = this.outbox.completingIds();
    return ZONES.map((zone) => {
      const load = loads.get(zone);
      const softCap = load?.softCap ?? null;
      const captured = this.queuedCaptures().filter((entry) => entry.zone === zone).length;
      const completed = (served?.tasks ?? []).filter(
        (task) => task.zone === zone && completing.has(task.id) && !task.deferUntil,
      ).length;
      const open = (load?.open ?? 0) + captured - completed;
      const tasks = this.tasks().filter((task) => task.zone === zone);
      return { zone, tasks, open, softCap, overSoftCap: softCap !== null && open > softCap };
    });
  });

  async initialise(): Promise<void> {
    await this.outbox.load();
    this.connectivity.onReconnect(() => void this.sync());
    // The device's online event does not fire when it was the server that was unreachable, or on
    // a captive portal — without this the app says "offline" until someone reloads it.
    setInterval(() => {
      if (!this.online()) {
        void this.sync();
      }
    }, RECOVERY_CHECK_MS);
    await this.sync();
  }

  /** Flush before reload: the other order shows stale rows. */
  async sync(): Promise<void> {
    await this.outbox.flush();
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.busy.set(true);
    // Probed rather than inferred: the service worker returns 200 with no connection at all.
    void this.connectivity.probe();
    try {
      const [board, lists, labels] = await Promise.all([
        firstValueFrom(this.api.board(this.filter())),
        firstValueFrom(this.api.lists()),
        firstValueFrom(this.api.labels()),
      ]);
      this.served.set(board);
      this.lists.set(lists);
      this.labels.set(labels);
    } catch {
      // Only reached when nothing is cached either. Keep what is on screen; the probe says why.
    } finally {
      this.busy.set(false);
    }
  }

  narrowTo(change: Partial<BoardFilter>): void {
    this.filter.update((current) => ({ ...current, ...change }));
    void this.refresh();
  }

  clearFilters(): void {
    this.filter.set({});
    void this.refresh();
  }

  // ----------------------------------------------------------------- writes that work offline

  async capture(draft: {
    title: string;
    notes: string;
    zone: Zone;
    labels: string[];
    listId: number | null;
    recurrence?: Recurrence | null;
  }): Promise<void> {
    await this.outbox.enqueue({ kind: 'capture', ...draft });
    await this.refresh();
  }

  /**
   * Completing a task that has not synced takes the capture back instead — there is nothing on the
   * server to complete.
   */
  async complete(task: BoardTask): Promise<WriteResult> {
    const at = this.tasks()
      .filter((row) => row.zone === task.zone)
      .findIndex((row) => keyOf(row) === keyOf(task));
    // Completing ends a deferral, and the server hands a repeat on to the next one; reopening
    // brings back neither. A capture taken back keeps its repeat for when it is queued again.
    const done: BoardTask = {
      ...task,
      deferUntil: undefined,
      recurrence: task.pendingId ? task.recurrence : undefined,
      done: true,
    };
    this.completed.update((current) => [...current, { task: done, at }]);
    if (task.pendingId) {
      await this.outbox.discard(task.pendingId);
      return 'done';
    }
    await this.outbox.enqueue({ kind: 'complete', taskId: task.id! });
    await this.refresh();
    return 'done';
  }

  /**
   * Reopening is a change to a task like moving it, so it needs a connection, and it is not offered
   * until the completion has been sent, so that it can only follow it to the server, never overtake
   * it. A capture that was never sent is only captured again, which works offline.
   */
  reopenable(task: BoardTask): boolean {
    return !!task.pendingId || (this.online() && !this.completionQueued(task));
  }

  async reopen(task: BoardTask): Promise<WriteResult> {
    if (task.pendingId) {
      this.forget(task);
      const draft = {
        kind: 'capture' as const,
        title: task.title,
        notes: task.notes ?? '',
        zone: task.zone,
        labels: task.labels,
        listId: task.listId,
        recurrence: task.recurrence ?? null,
      };
      await this.outbox.enqueue(draft, task.pendingId);
      await this.refresh();
      return 'done';
    }
    if (this.completionQueued(task)) {
      return 'refused';
    }
    const result = await this.online_(() => firstValueFrom(this.api.reopen(task.id!)));
    // Settled means it was deleted elsewhere, so there is nothing left to reopen.
    if (result !== 'refused') {
      this.forget(task);
    }
    return result;
  }

  /** Opening the board again is what lets go of the tasks completed on it. */
  forgetCompleted(): void {
    this.completed.set([]);
  }

  private forget(task: BoardTask): void {
    this.completed.update((current) => current.filter((c) => keyOf(c.task) !== keyOf(task)));
  }

  private completionQueued(task: BoardTask): boolean {
    return this.outbox.completingIds().has(task.id!);
  }

  // ------------------------------------------------------------- writes that need a connection

  async moveZone(task: BoardTask, zone: Zone): Promise<WriteResult> {
    return this.online_(() => firstValueFrom(this.api.moveZone(task.id!, zone)));
  }

  async defer(task: BoardTask, until: string): Promise<WriteResult> {
    return this.online_(() => firstValueFrom(this.api.defer(task.id!, until)));
  }

  async undefer(task: BoardTask): Promise<WriteResult> {
    return this.online_(() => firstValueFrom(this.api.undefer(task.id!)));
  }

  async edit(task: BoardTask, patch: UpdateTask): Promise<WriteResult> {
    return this.online_(() => firstValueFrom(this.api.update(task.id!, patch)));
  }

  async setLabels(task: BoardTask, labels: string[]): Promise<WriteResult> {
    return this.online_(() => firstValueFrom(this.api.setLabels(task.id!, labels)));
  }

  async remove(task: BoardTask): Promise<WriteResult> {
    if (task.pendingId) {
      await this.outbox.discard(task.pendingId);
      return 'done';
    }
    return this.online_(() => firstValueFrom(this.api.delete(task.id!)));
  }

  /**
   * Runs a change that has no offline story and reloads afterwards. The reload happens even when
   * the change was refused, because a refusal usually means this board is stale — the task was
   * completed or deleted on another device.
   */
  private async online_(change: () => Promise<unknown>): Promise<WriteResult> {
    try {
      return await this.writes.attempt(change, GONE);
    } finally {
      await this.refresh();
    }
  }

  private matchesFilter(listId: number | null, labels: string[], zone: Zone): boolean {
    const filter = this.filter();
    if (filter.list != null && filter.list !== listId) {
      return false;
    }
    if (filter.label && !labels.includes(filter.label)) {
      return false;
    }
    return !filter.zone || filter.zone === zone;
  }
}
