import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { BoardStore, BoardTask } from './board-store';
import { TaskActions } from './task-actions';
import { TaskChips } from './task-chips';
import { TaskNotes } from './task-notes';

export interface TaskDetailData {
  task: BoardTask;
  /** The board's own task, which it follows and can act on; otherwise a copy, only to be read. */
  fromBoard: boolean;
}

/**
 * The whole task. Everything here is already on the device, so it opens offline and for a capture
 * that has not synced.
 */
@Component({
  selector: 'app-task-detail',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    TaskActions,
    TaskChips,
    TaskNotes,
  ],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetail {
  static open(dialog: MatDialog, data: TaskDetailData): void {
    // Not on the first button, which completes the task: opened with Enter, a second one would.
    dialog.open(TaskDetail, { data, panelClass: 'task-dialog', autoFocus: 'first-heading' });
  }

  private readonly board = inject(BoardStore);
  private readonly data = inject<TaskDetailData>(MAT_DIALOG_DATA);

  protected readonly fromBoard = this.data.fromBoard;

  private readonly latest = computed(() =>
    this.fromBoard ? this.board.latest(this.data.task) : this.data.task,
  );

  /** As last seen while the board is without it — until the next read, or while it closes. */
  protected readonly task = linkedSignal<BoardTask | undefined, BoardTask>({
    source: this.latest,
    computation: (now, previous) => now ?? previous?.value ?? this.data.task,
  });

  constructor() {
    const ref = inject(MatDialogRef);
    effect(() => {
      this.board.read();
      if (!untracked(this.latest)) {
        ref.close();
      }
    });
  }
}
