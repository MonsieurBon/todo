import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Recurrence } from '../api/model';
import { NOTES_HINT } from '../core/markdown';
import { RepeatField } from '../core/repeat-field';
import { TopicsField } from '../core/topics-field';
import { BoardStore, BoardTask } from './board-store';

export interface TaskEdit {
  title: string;
  notes: string;
  dueDate: string;
  labels: string[];
  recurrence: Recurrence | null;
}

/**
 * Editing a task. Deliberately not available offline: a title rewritten on two devices has no
 * right answer, and unlike a capture there is nothing lost by waiting for a connection.
 */
@Component({
  selector: 'app-task-editor',
  imports: [
    FormsModule,
    MatButton,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    RepeatField,
    TopicsField,
  ],
  templateUrl: './task-editor.html',
  styles: `
    .editor {
      display: flex;
      flex-direction: column;
      min-width: min(90vw, 26rem);
      padding-top: 0.5rem;
    }

    /* The lines a markdown table needs, where task-dialog gives it the width. */
    @media (min-width: 600px) {
      textarea {
        min-height: 40vh;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskEditor {
  static open(dialog: MatDialog, task: BoardTask): MatDialogRef<TaskEditor, TaskEdit> {
    return dialog.open(TaskEditor, { data: task, panelClass: 'task-dialog' });
  }

  private readonly dialog = inject<MatDialogRef<TaskEditor, TaskEdit>>(MatDialogRef);
  private readonly task = inject<BoardTask>(MAT_DIALOG_DATA);

  protected readonly knownTopics = inject(BoardStore).labels;
  private readonly topicsField = viewChild.required(TopicsField);
  private readonly repeatField = viewChild.required(RepeatField);

  protected readonly title = signal(this.task.title);
  protected readonly notes = signal(this.task.notes ?? '');
  protected readonly dueDate = signal(this.task.dueDate ?? '');
  protected readonly labels = signal(this.task.labels ?? []);
  protected readonly recurrence = signal<Recurrence | null>(this.task.recurrence ?? null);
  protected readonly notesHint = NOTES_HINT;

  protected readonly canSave = computed(
    () => !!this.title().trim() && !this.topicsField().invalid() && !this.repeatField().invalid(),
  );

  protected save(): void {
    if (!this.canSave()) {
      return;
    }
    // A topic typed but never confirmed is still a topic the user meant to add.
    this.topicsField().commitPending();
    this.dialog.close({
      title: this.title().trim(),
      notes: this.notes().trim(),
      dueDate: this.dueDate(),
      labels: this.labels(),
      recurrence: this.recurrence(),
    });
  }
}
