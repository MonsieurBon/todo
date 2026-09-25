import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ZONES, Zone, ZoneLoad } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { BoardStore, BoardTask, GONE, ZoneSection, asBoardTask } from '../board/board-store';
import { isoDateIn } from '../core/dates';
import { Writes } from '../core/writes';

const SOME_GONE = 'One of those tasks was completed or deleted elsewhere, so none of them changed.';

/**
 * One sweep's worth of what is due, held here rather than reloaded after each decision: a row has
 * to go the moment its decision lands, or the sweep reads like a click that did nothing. So its
 * writes leave the board alone, which it never shows, and the board catches up when it is opened.
 * Provided by the page, so every visit starts a fresh sweep.
 */
@Injectable()
export class ReviewStore {
  private readonly api = inject(TodoApi);
  private readonly board = inject(BoardStore);
  private readonly writes = inject(Writes);

  private readonly queue = signal<BoardTask[]>([]);
  private readonly loads = signal<ZoneLoad[]>([]);
  private readonly settled = signal(0);
  private readonly working = signal(true);
  private asked = 0;

  readonly selected = signal<ReadonlySet<number>>(new Set());

  readonly loading = this.working.asReadonly();
  readonly online = this.board.online;
  readonly remaining = computed(() => this.queue().length);
  /** Against what has been settled so far, since a task that falls due mid-sweep joins in. */
  readonly progress = computed(() => {
    const total = this.settled() + this.remaining();
    return total === 0 ? 0 : (this.settled() / total) * 100;
  });
  readonly selecting = computed(() => this.selected().size > 0);
  readonly selectedCount = computed(() => this.selected().size);

  /**
   * Only what is due gets a row, but each zone keeps its whole total: whether something belongs in
   * Critical Now depends on everything already there, reviewed or not.
   */
  readonly zones = computed<ZoneSection[]>(() => {
    const loads = new Map(this.loads().map((load) => [load.zone, load]));
    return ZONES.map((zone) => {
      const load = loads.get(zone);
      return {
        zone,
        tasks: this.queue().filter((task) => task.zone === zone),
        open: load?.open ?? 0,
        softCap: load?.softCap ?? null,
        overSoftCap: load?.overSoftCap ?? false,
      };
    });
  });

  async load(): Promise<void> {
    this.working.set(true);
    try {
      await this.refresh();
    } finally {
      this.working.set(false);
    }
  }

  /**
   * The only way the sweep asks the server anything, so there is one rule for when it cannot
   * answer: keep what is on screen, since the decision before this landed and must not read as
   * failed. Only the newest answer is used, so a slow one cannot bring back a row settled since.
   * Never narrowed by the board's filter: tasks are weighed against each other across topics and
   * lists, and a cap counts them all.
   */
  private async refresh(): Promise<void> {
    const asking = ++this.asked;
    try {
      const [due, board] = await Promise.all([
        firstValueFrom(this.api.reviewQueue({})),
        firstValueFrom(this.api.board({})),
      ]);
      if (asking === this.asked) {
        const present = new Set(due.map((task) => task.id));
        this.queue.set(due.map(asBoardTask));
        this.loads.set(board.zones);
        this.selected.update((ids) => new Set([...ids].filter((id) => present.has(id))));
      }
    } catch {
      // What is on screen stays, as above.
    }
  }

  // ------------------------------------------------------------------------------- one task

  reviewed(task: BoardTask): Promise<void> {
    return this.decide(task, () => this.api.markReviewed(task.id!));
  }

  move(task: BoardTask, zone: Zone): Promise<void> {
    return this.decide(task, () => this.api.moveZone(task.id!, zone));
  }

  defer(task: BoardTask, days: number): Promise<void> {
    return this.decide(task, () => this.api.defer(task.id!, isoDateIn(days)));
  }

  remove(task: BoardTask): Promise<void> {
    return this.decide(task, () => this.api.delete(task.id!));
  }

  /**
   * A task settled elsewhere is the row being stale, not the decision failing, so it goes too. A
   * refusal leaves it, because nothing was decided; the banner says why.
   */
  private async decide(task: BoardTask, write: () => Observable<unknown>): Promise<void> {
    if ((await this.writes.attempt(() => firstValueFrom(write()), GONE)) !== 'refused') {
      this.drop([task.id]);
      await this.refresh();
    }
  }

  // ------------------------------------------------------------------------------ a selection

  toggle(task: BoardTask): void {
    this.selected.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(task.id!)) {
        next.add(task.id!);
      }
      return next;
    });
  }

  selectZone(zone: Zone, on: boolean): void {
    const inZone = this.queue()
      .filter((task) => task.zone === zone)
      .map((task) => task.id!);
    this.selected.update((ids) => {
      const next = new Set(ids);
      inZone.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  /** For a zone's own tick box, which stands for everything due in it. */
  selectionIn(zone: Zone): 'all' | 'some' | 'none' {
    const ids = this.selected();
    const inZone = this.queue().filter((task) => task.zone === zone);
    const picked = inZone.filter((task) => ids.has(task.id!)).length;
    return picked === 0 ? 'none' : picked === inZone.length ? 'all' : 'some';
  }

  clearSelection(): void {
    this.selected.set(new Set());
  }

  reviewedAll(): Promise<void> {
    return this.decideAll((ids) => this.api.markAllReviewed(ids));
  }

  moveAll(zone: Zone): Promise<void> {
    return this.decideAll((ids) => this.api.moveAllTo(ids, zone));
  }

  deferAll(days: number): Promise<void> {
    return this.decideAll((ids) => this.api.deferAll(ids, isoDateIn(days)));
  }

  /**
   * The server takes a selection whole or not at all, and a refusal because it has moved past one
   * task does not say which — so the sweep asks again rather than guess.
   */
  private async decideAll(write: (ids: number[]) => Observable<unknown>): Promise<void> {
    const ids = [...this.selected()];
    const result = await this.writes.attempt(() => firstValueFrom(write(ids)), SOME_GONE);
    if (result === 'done') {
      this.drop(ids);
    }
    if (result !== 'refused') {
      await this.refresh();
    }
  }

  private drop(ids: (number | null)[]): void {
    const gone = new Set(ids);
    this.settled.update((count) => count + this.queue().filter((task) => gone.has(task.id)).length);
    this.queue.update((tasks) => tasks.filter((task) => !gone.has(task.id)));
    this.selected.update((selected) => new Set([...selected].filter((id) => !gone.has(id))));
  }
}
