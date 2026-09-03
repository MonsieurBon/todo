import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { ZONE_NAMES, Zone, zoneAfter } from '../api/model';
import { BoardStore, BoardTask } from './board-store';
import { TaskEdit, TaskEditor } from './task-editor';

const DAY = 24 * 60 * 60 * 1000;

const isoDate = (inDays: number) => new Date(Date.now() + inDays * DAY).toISOString().slice(0, 10);

@Component({
  selector: 'app-task-row',
  imports: [MatIcon, MatIconButton, MatMenu, MatMenuItem, MatMenuTrigger],
  templateUrl: './task-row.html',
  styleUrl: './task-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskRow {
  private readonly board = inject(BoardStore);
  private readonly dialog = inject(MatDialog);

  readonly task = input.required<BoardTask>();

  protected readonly online = this.board.online;

  /** Only worth saying which list a task is on when there is more than one to be on. */
  protected readonly showList = computed(() => this.board.lists().length > 1);

  /** A queued capture has no server id, so everything but completing it is out of reach. */
  protected readonly pending = computed(() => this.task().pendingId !== null);

  protected readonly promoteTo = computed(() => zoneAfter(this.task().zone, -1));
  protected readonly demoteTo = computed(() => zoneAfter(this.task().zone, 1));
  protected readonly zoneName = (zone: Zone) => ZONE_NAMES[zone];

  protected complete(): void {
    void this.board.complete(this.task());
  }

  protected move(zone: Zone | null): void {
    if (zone) {
      void this.board.moveZone(this.task(), zone);
    }
  }

  protected deferBy(days: number): void {
    void this.board.defer(this.task(), isoDate(days));
  }

  protected remove(): void {
    void this.board.remove(this.task());
  }

  protected async edit(): Promise<void> {
    const task = this.task();
    const change = await new Promise<TaskEdit | undefined>((resolve) =>
      this.dialog
        .open(TaskEditor, { data: task })
        .afterClosed()
        .subscribe((result) => resolve(result as TaskEdit | undefined)),
    );
    if (!change) {
      return;
    }
    await this.board.edit(task, {
      title: change.title,
      notes: change.notes,
      ...(change.dueDate ? { dueDate: change.dueDate } : {}),
    });
    await this.board.setLabels(task, change.labels);
  }
}
