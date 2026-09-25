import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { ZONE_NAMES, Zone, moveLabel, zoneAfter } from '../api/model';
import { BoardTask } from '../board/board-store';
import { TaskChips } from '../board/task-chips';
import { TaskDetail } from '../board/task-detail';
import { ReviewStore } from './review-store';

/** A task that is due, which can be placed or passed but not edited or completed. */
@Component({
  selector: 'app-review-row',
  imports: [
    MatCheckbox,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
    TaskChips,
  ],
  templateUrl: './review-row.html',
  styleUrl: './review-row.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewRow {
  private readonly review = inject(ReviewStore);
  private readonly dialog = inject(MatDialog);

  readonly task = input.required<BoardTask>();

  protected readonly online = this.review.online;
  protected readonly selecting = this.review.selecting;
  protected readonly selected = computed(() => this.review.selected().has(this.task().id!));

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

  protected toggle(): void {
    this.review.toggle(this.task());
  }

  protected reviewed(): void {
    void this.review.reviewed(this.task());
  }

  protected move(zone: Zone | null): void {
    if (zone) {
      void this.review.move(this.task(), zone);
    }
  }

  protected defer(days: number): void {
    void this.review.defer(this.task(), days);
  }

  protected remove(): void {
    void this.review.remove(this.task());
  }
}
