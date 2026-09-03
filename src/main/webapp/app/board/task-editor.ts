import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { BoardTask } from './board-store';

export interface TaskEdit {
  title: string;
  notes: string;
  dueDate: string;
  labels: string[];
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
    MatInput,
    MatLabel,
  ],
  templateUrl: './task-editor.html',
  styles: `
    .editor {
      display: flex;
      flex-direction: column;
      min-width: min(90vw, 26rem);
      padding-top: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskEditor {
  private readonly dialog = inject<MatDialogRef<TaskEditor, TaskEdit>>(MatDialogRef);
  private readonly task = inject<BoardTask>(MAT_DIALOG_DATA);

  protected readonly title = signal(this.task.title);
  protected readonly notes = signal(this.task.notes ?? '');
  protected readonly dueDate = signal(this.task.dueDate ?? '');
  protected readonly labels = signal((this.task.labels ?? []).join(', '));

  protected save(): void {
    const title = this.title().trim();
    if (!title) {
      return;
    }
    this.dialog.close({
      title,
      notes: this.notes().trim(),
      dueDate: this.dueDate(),
      labels: this.labels()
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean),
    });
  }
}
