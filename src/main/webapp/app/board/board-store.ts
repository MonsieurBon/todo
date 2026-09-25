import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardFilter, TodoApi } from '../api/todo-api';
import { BoardView, Task, TaskList, UpdateTask, ZONES, Zone } from '../api/model';
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
}

export interface ZoneSection {
  zone: Zone;
  tasks: BoardTask[];
  open: number;
  softCap: number | null;
  overSoftCap: boolean;
}

const RECOVERY_CHECK_MS = 20_000;

export const GONE = 'That task was completed or deleted elsewhere.';

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
});

@Injectable({ providedIn: 'root' })
export class BoardStore {
  private readonly api = inject(TodoApi);
  private readonly outbox = inject(Outbox);
  private readonly connectivity = inject(Connectivity);
  private readonly writes = inject(Writes);

  private readonly served = signal<BoardView | null>(null);
  private readonly busy = signal(false);

  readonly filter = signal<BoardFilter>({});
  readonly lists = signal<TaskList[]>([]);
  readonly labels = signal<string[]>([]);
  readonly loading = this.busy.asReadonly();
  readonly online = this.connectivity.online;

  readonly showingCached = computed(() => !this.online() && this.served() !== null);

  readonly pendingCount = computed(() => this.outbox.pending().length);

  /**
   * The board's tasks with the outbox folded in, marked, so nothing pretends to be saved that is
   * not.
   */
  readonly tasks = computed<BoardTask[]>(() => {
    const completing = this.outbox.completingIds();
    const fromServer = (this.served()?.tasks ?? []).filter((t) => !completing.has(t.id));
    // An acknowledged capture lingers in the outbox; clientRef is how the two copies are one task.
    const acknowledged = new Set(fromServer.map((t) => t.clientRef).filter(Boolean));
    const queued = this.outbox
      .pendingCaptures()
      .filter((entry) => !acknowledged.has(entry.id))
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
      }));
    return [...fromServer.map(asBoardTask), ...queued];
  });

  /**
   * Loads counted from what is on screen, so an offline capture counts; the caps themselves stay
   * the server's.
   */
  readonly zones = computed<ZoneSection[]>(() => {
    const caps = new Map(this.served()?.zones.map((load) => [load.zone, load.softCap ?? null]));
    return ZONES.map((zone) => {
      const tasks = this.tasks().filter((task) => task.zone === zone);
      const softCap = caps.get(zone) ?? null;
      return {
        zone,
        tasks,
        open: tasks.length,
        softCap,
        overSoftCap: softCap !== null && tasks.length > softCap,
      };
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
  }): Promise<void> {
    await this.outbox.enqueue({ kind: 'capture', ...draft });
    await this.refresh();
  }

  /**
   * Completing a task that has not synced takes the capture back instead — there is nothing on the
   * server to complete.
   */
  async complete(task: BoardTask): Promise<WriteResult> {
    if (task.pendingId) {
      await this.outbox.discard(task.pendingId);
      return 'done';
    }
    await this.outbox.enqueue({ kind: 'complete', taskId: task.id! });
    await this.refresh();
    return 'done';
  }

  // ------------------------------------------------------------- writes that need a connection

  async moveZone(task: BoardTask, zone: Zone): Promise<WriteResult> {
    return this.online_(() => firstValueFrom(this.api.moveZone(task.id!, zone)));
  }

  async defer(task: BoardTask, until: string): Promise<WriteResult> {
    return this.online_(() => firstValueFrom(this.api.defer(task.id!, until)));
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
