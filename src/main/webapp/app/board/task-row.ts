import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { Deferral, ZONE_NAMES, Zone, moveLabel, zoneAfter } from '../api/model';
import { DeferMenu } from '../core/defer-menu';
import { BoardStore, BoardTask, isDeferred } from './board-store';
import { TaskChips } from './task-chips';
import { TaskDetail } from './task-detail';
import { TaskEdit, TaskEditor } from './task-editor';

@Component({
  selector: 'app-task-row',
  imports: [
    DeferMenu,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
    TaskChips,
  ],
  templateUrl: './task-row.html',
  styleUrl: './task-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskRow {
  private readonly board = inject(BoardStore);
  private readonly dialog = inject(MatDialog);

  readonly task = input.required<BoardTask>();

  private readonly menu = viewChild.required<MatMenu>('menu');

  protected readonly online = this.board.online;

  /** A queued capture has no server id, so everything but completing it is out of reach. */
  protected readonly pending = computed(() => this.task().pendingId !== null);

  protected readonly deferred = computed(() => isDeferred(this.task()));

  protected readonly reopenable = computed(() => this.board.reopenable(this.task()));

  protected readonly promoteTo = computed(() => zoneAfter(this.task().zone, -1));
  protected readonly demoteTo = computed(() => zoneAfter(this.task().zone, 1));
  protected readonly zoneName = (zone: Zone) => ZONE_NAMES[zone];

  protected readonly promoteLabel = computed(() =>
    moveLabel(this.task().title, this.promoteTo(), 'up'),
  );
  protected readonly demoteLabel = computed(() =>
    moveLabel(this.task().title, this.demoteTo(), 'down'),
  );

  protected details(): void {
    TaskDetail.open(this.dialog, this.task());
  }

  protected complete(): void {
    void this.board.complete(this.task());
  }

  protected reopen(): void {
    void this.board.reopen(this.task());
  }

  protected move(zone: Zone | null): void {
    if (zone) {
      void this.board.moveZone(this.task(), zone);
    }
  }

  protected readonly defer = (deferral: Deferral) => this.board.defer(this.task(), deferral);

  protected undefer(): void {
    void this.board.undefer(this.task());
  }

  protected remove(): void {
    void this.board.remove(this.task());
  }

  /** The editor gives focus back to whatever had it on opening, so not to the menu's item. */
  protected async editFromMenu(): Promise<void> {
    const task = this.task();
    await firstValueFrom(this.menu().closed);
    await this.edit(task);
  }

  protected async edit(task = this.task()): Promise<void> {
    const change = await new Promise<TaskEdit | undefined>((resolve) =>
      TaskEditor.open(this.dialog, task).afterClosed().subscribe(resolve),
    );
    if (!change) {
      return;
    }
    await this.board.edit(task, {
      title: change.title,
      notes: change.notes,
      labels: change.labels,
      ...(change.dueDate ? { dueDate: change.dueDate } : { clearDueDate: true }),
      ...(change.recurrence ? { recurrence: change.recurrence } : { clearRecurrence: true }),
    });
  }
}
