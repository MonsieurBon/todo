import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { ZONE_NAMES, Zone, zoneAfter } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { BoardStore, BoardTask, asBoardTask } from '../board/board-store';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The review sweep: the part of the method the old app never had.
 *
 * <p>One task at a time, with the decision made explicitly — promote, demote, defer, complete,
 * delete, or leave it where it is. Leaving it is a decision too, which is why it is a button and
 * not simply skipping: it records that the task was looked at, so the sweep can stop offering it.
 *
 * <p>Critical Now is never swept. It is worked continuously, and a zone reviewed daily that is
 * also meant to be emptied daily would just be the same list twice.
 */
@Component({
  selector: 'app-review-page',
  imports: [MatButton, MatIcon, MatProgressBar],
  templateUrl: './review-page.html',
  styleUrl: './review-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPage {
  private readonly api = inject(TodoApi);
  private readonly board = inject(BoardStore);

  private readonly queue = signal<BoardTask[]>([]);
  private readonly index = signal(0);
  private readonly working = signal(true);

  protected readonly loading = this.working.asReadonly();
  protected readonly online = this.board.online;
  protected readonly total = computed(() => this.queue().length);
  protected readonly position = computed(() => Math.min(this.index() + 1, this.total()));
  protected readonly current = computed<BoardTask | null>(() => this.queue()[this.index()] ?? null);
  protected readonly done = computed(() => !this.working() && this.current() === null);
  protected readonly progress = computed(() =>
    this.total() === 0 ? 0 : (this.index() / this.total()) * 100,
  );

  protected readonly zoneName = (zone: Zone) => ZONE_NAMES[zone];
  protected readonly promoteTo = computed(() =>
    this.current() ? zoneAfter(this.current()!.zone, -1) : null,
  );
  protected readonly demoteTo = computed(() =>
    this.current() ? zoneAfter(this.current()!.zone, 1) : null,
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.working.set(true);
    try {
      const due = await firstValueFrom(this.api.reviewQueue(this.board.filter()));
      this.queue.set(due.map(asBoardTask));
      this.index.set(0);
    } finally {
      this.working.set(false);
    }
  }

  protected async keep(): Promise<void> {
    await this.decide((task) => this.board.markReviewed(task));
  }

  protected async move(zone: Zone | null): Promise<void> {
    if (zone) {
      await this.decide(async (task) => {
        await this.board.moveZone(task, zone);
        await this.board.markReviewed(task);
      });
    }
  }

  protected async defer(days: number): Promise<void> {
    const until = new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
    await this.decide(async (task) => {
      await this.board.defer(task, until);
      await this.board.markReviewed(task);
    });
  }

  protected async complete(): Promise<void> {
    await this.decide((task) => this.board.complete(task));
  }

  protected async remove(): Promise<void> {
    await this.decide((task) => this.board.remove(task));
  }

  private async decide(action: (task: BoardTask) => Promise<void>): Promise<void> {
    const task = this.current();
    if (!task) {
      return;
    }
    await action(task);
    this.index.update((at) => at + 1);
  }
}
