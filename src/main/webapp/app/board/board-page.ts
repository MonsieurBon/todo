import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatFabButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { ZONE_MEANINGS, ZONE_NAMES, Zone } from '../api/model';
import { BoardStore, ZoneSection } from './board-store';
import { TaskRow } from './task-row';

@Component({
  selector: 'app-board-page',
  imports: [
    MatButton,
    MatFabButton,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressBar,
    RouterLink,
    TaskRow,
  ],
  templateUrl: './board-page.html',
  styleUrl: './board-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPage {
  private readonly board = inject(BoardStore);

  protected readonly zones = this.board.zones;
  protected readonly lists = this.board.lists;
  protected readonly labels = this.board.labels;
  protected readonly filter = this.board.filter;
  protected readonly loading = this.board.loading;

  protected readonly zoneName = (zone: Zone) => ZONE_NAMES[zone];
  protected readonly zoneMeaning = (zone: Zone) => ZONE_MEANINGS[zone];

  /**
   * Over the Horizon is unbounded by design, so left open it buries the two zones that are
   * supposed to be looked at. It opens on demand, and whenever it is the thing being filtered for.
   */
  private readonly horizonOpened = signal(false);
  protected readonly horizonOpen = computed(
    () => this.horizonOpened() || this.filter().zone === 'OVER_THE_HORIZON',
  );

  protected readonly filteredList = computed(() =>
    this.lists().find((list) => list.id === this.filter().list),
  );

  protected readonly empty = computed(() => this.zones().every((zone) => zone.tasks.length === 0));

  protected collapsed(section: ZoneSection): boolean {
    return section.zone === 'OVER_THE_HORIZON' && !this.horizonOpen();
  }

  protected toggleHorizon(): void {
    this.horizonOpened.update((open) => !open);
  }

  protected byList(list: number | null): void {
    this.board.narrowTo({ list });
  }

  protected byLabel(label: string | null): void {
    this.board.narrowTo({ label });
  }

  protected clear(): void {
    this.board.clearFilters();
  }
}
