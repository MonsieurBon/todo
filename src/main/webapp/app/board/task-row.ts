import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { ZONE_NAMES, Zone, moveLabel, zoneAfter } from '../api/model';
import { isoDateIn } from '../core/dates';
import { BoardStore, BoardTask } from './board-store';
import { TaskChips } from './task-chips';
import { TaskDetail } from './task-detail';
import { TaskEdit, TaskEditor } from './task-editor';

@Component({
  selector: 'app-task-row',
  imports: [MatIcon, MatIconButton, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip, TaskChips],
  templateUrl: './task-row.html',
  styleUrl: './task-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskRow {
  private readonly board = inject(BoardStore);
  private readonly dialog = inject(MatDialog);

  readonly task = input.required<BoardTask>();

  protected readonly online = this.board.online;

  /** A queued capture has no server id, so everything but completing it is out of reach. */
  protected readonly pending = computed(() => this.task().pendingId !== null);

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
    this.dialog.open(TaskDetail, { data: this.task() });
  }

  protected complete(): void {
    void this.board.complete(this.task());
  }

  protected move(zone: Zone | null): void {
    if (zone) {
      void this.board.moveZone(this.task(), zone);
    }
  }

  protected deferBy(days: number): void {
    void this.board.defer(this.task(), isoDateIn(days));
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
    // Two requests for one edit: labels are a separate endpoint. Sending the second after the
    // first was refused would relabel a task whose edit never landed.
    const edited = await this.board.edit(task, {
      title: change.title,
      notes: change.notes,
      ...(change.dueDate ? { dueDate: change.dueDate } : { clearDueDate: true }),
    });
    if (edited === 'done') {
      await this.board.setLabels(task, change.labels);
    }
  }
}
