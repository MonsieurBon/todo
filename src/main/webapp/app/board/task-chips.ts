import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ZONE_NAMES } from '../api/model';
import { BoardStore, BoardTask } from './board-store';

/**
 * What a task carries besides its title, in one row. The board row, the review card and the
 * detail dialog all show it, so what may be left out is decided once, here.
 */
@Component({
  selector: 'app-task-chips',
  templateUrl: './task-chips.html',
  styleUrl: './task-chips.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskChips {
  private readonly board = inject(BoardStore);

  readonly task = input.required<BoardTask>();

  /** Off by default: the row and the review card give the zone their own place in the layout. */
  readonly showZone = input(false);

  protected readonly zoneName = computed(() => ZONE_NAMES[this.task().zone]);

  /** With one list its name says nothing, wherever the task is shown. */
  protected readonly showList = computed(() => this.board.lists().length > 1);

  protected readonly pending = computed(() => this.task().pendingId !== null);
}
