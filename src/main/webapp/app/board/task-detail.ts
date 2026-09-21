import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { BoardTask } from './board-store';
import { TaskChips } from './task-chips';
import { TaskNotes } from './task-notes';

/**
 * The whole task, read-only. Everything here is already on the device, so it opens offline and for
 * a capture that has not synced.
 */
@Component({
  selector: 'app-task-detail',
  imports: [
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    TaskChips,
    TaskNotes,
  ],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetail {
  protected readonly task = inject<BoardTask>(MAT_DIALOG_DATA);
}
