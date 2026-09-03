import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardFilter, TodoApi } from '../api/todo-api';
import { BoardView, Task, TaskList, ZONES, Zone } from '../api/model';
import { Connectivity } from '../core/connectivity';
import { Outbox } from '../offline/outbox';

/**
 * A task as the board draws it, whether or not the server has heard of it yet.
 *
 * <p>A capture made underground has no id until it syncs, so {@code id} is null and {@code
 * pendingId} identifies it in the outbox instead. Everything downstream keys off which of the two
 * is set rather than guessing from a magic id.
 */
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

/**
 * Everything the board shows, and every way to change it.
 *
 * <p>The board is the app: lists and labels are filters on top of one view rather than places to
 * navigate between, because the zone caps are counted across everything visible. A cap counted per
 * list would be enforced once per list, which is the one thing that makes it stop meaning anything.
 */
@Injectable({ providedIn: 'root' })
export class BoardStore {
  private readonly api = inject(TodoApi);
  private readonly outbox = inject(Outbox);
  private readonly connectivity = inject(Connectivity);

  private readonly served = signal<BoardView | null>(null);
  private readonly busy = signal(false);

  readonly filter = signal<BoardFilter>({});
  readonly lists = signal<TaskList[]>([]);
  readonly labels = signal<string[]>([]);
  readonly loading = this.busy.asReadonly();
  readonly online = this.connectivity.online;

  /** True when what is drawn came from the cache rather than from the server just now. */
  readonly showingCached = computed(() => !this.online() && this.served() !== null);

  readonly pendingCount = computed(() => this.outbox.pending().length);

  /**
   * The board's tasks, with the outbox folded in: queued captures appear immediately, and tasks
   * with a queued completion disappear immediately. Both are marked, so nothing pretends to be
   * saved that is not.
   */
  readonly tasks = computed<BoardTask[]>(() => {
    const completing = this.outbox.completingIds();
    const fromServer = (this.served()?.tasks ?? []).filter((t) => !completing.has(t.id));
    // A capture the server has already acknowledged is still in the outbox for a moment; the
    // clientRef it was sent under is how the two copies are recognised as one task.
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
   * The three zones with their loads counted from what is on screen, not from what the server last
   * said — otherwise a task captured offline would sit in Critical Now without counting towards it.
   * The caps themselves stay the server's, so the method's numbers are defined in one place.
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
    // The device's own online event does not fire when it was the server that was unreachable, or
    // behind a captive portal that never let go. Without this the app would sit there saying
    // "offline" until someone reloaded it.
    setInterval(() => {
      if (!this.online()) {
        void this.sync();
      }
    }, RECOVERY_CHECK_MS);
    await this.sync();
  }

  /** Sends anything queued, then reloads. The order matters: reloading first would show stale rows. */
  async sync(): Promise<void> {
    await this.outbox.flush();
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.busy.set(true);
    // Probed alongside the board rather than inferred from it: a service worker serving the last
    // board it saw returns 200 with no connection at all.
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
      // The service worker serves the last board it saw, so this is only reached when there is
      // nothing cached either. Keep whatever is on screen; the probe says why it is not current.
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
   * Completing a task that has not synced yet takes the capture back instead: there is nothing on
   * the server to complete, and sending a create only to complete it is a worse story than never
   * having sent it.
   */
  async complete(task: BoardTask): Promise<void> {
    if (task.pendingId) {
      await this.outbox.discard(task.pendingId);
      return;
    }
    await this.outbox.enqueue({ kind: 'complete', taskId: task.id! });
    await this.refresh();
  }

  // ------------------------------------------------------------- writes that need a connection

  async moveZone(task: BoardTask, zone: Zone): Promise<void> {
    await this.online_(() => firstValueFrom(this.api.moveZone(task.id!, zone)));
  }

  async defer(task: BoardTask, until: string): Promise<void> {
    await this.online_(() => firstValueFrom(this.api.defer(task.id!, until)));
  }

  async edit(
    task: BoardTask,
    patch: { title?: string; notes?: string; dueDate?: string },
  ): Promise<void> {
    await this.online_(() => firstValueFrom(this.api.update(task.id!, patch)));
  }

  async setLabels(task: BoardTask, labels: string[]): Promise<void> {
    await this.online_(() => firstValueFrom(this.api.setLabels(task.id!, labels)));
  }

  async markReviewed(task: BoardTask): Promise<void> {
    await this.online_(() => firstValueFrom(this.api.markReviewed(task.id!)));
  }

  async remove(task: BoardTask): Promise<void> {
    if (task.pendingId) {
      await this.outbox.discard(task.pendingId);
      return;
    }
    await this.online_(() => firstValueFrom(this.api.delete(task.id!)));
  }

  /**
   * Runs a change that has no offline story and reloads afterwards. It throws when there is no
   * connection, and the caller says so — quietly dropping it would be the worst of both worlds.
   */
  private async online_(change: () => Promise<unknown>): Promise<void> {
    await change();
    await this.refresh();
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
