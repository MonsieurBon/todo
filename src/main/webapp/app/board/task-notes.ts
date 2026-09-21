import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { renderNotes } from '../core/markdown';

/**
 * The notes of a task, rendered as markdown. The review card and the detail dialog both show them,
 * so how they read is decided once, here.
 */
@Component({
  selector: 'app-task-notes',
  templateUrl: './task-notes.html',
  styleUrl: './task-notes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskNotes {
  readonly notes = input.required<string>();

  /** A string rather than SafeHtml: bound that way, Angular sanitizes what the renderer produced. */
  protected readonly html = computed(() => renderNotes(this.notes()));
}
