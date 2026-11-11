import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BoardTask, isDeferred } from './board-store';
import { TaskActions } from './task-actions';
import { TaskChips } from './task-chips';
import { TaskDetail } from './task-detail';

@Component({
  selector: 'app-task-row',
  imports: [TaskActions, TaskChips],
  templateUrl: './task-row.html',
  styleUrl: './task-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskRow {
  private readonly dialog = inject(MatDialog);

  readonly task = input.required<BoardTask>();

  protected readonly pending = computed(() => this.task().pendingId !== null);

  protected readonly deferred = computed(() => isDeferred(this.task()));

  protected details(): void {
    TaskDetail.open(this.dialog, this.task());
  }
}
