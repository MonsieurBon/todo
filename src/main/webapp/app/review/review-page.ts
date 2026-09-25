import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ZONES, ZONE_NAMES, Zone } from '../api/model';
import { ReviewRow } from './review-row';
import { ReviewStore } from './review-store';

/** The review sweep, as a board of what is due. */
@Component({
  selector: 'app-review-page',
  imports: [
    MatButton,
    MatCheckbox,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressBar,
    ReviewRow,
  ],
  providers: [ReviewStore],
  templateUrl: './review-page.html',
  styleUrl: './review-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPage {
  private readonly review = inject(ReviewStore);

  protected readonly zones = this.review.zones;
  protected readonly loading = this.review.loading;
  protected readonly online = this.review.online;
  protected readonly remaining = this.review.remaining;
  protected readonly progress = this.review.progress;
  protected readonly selecting = this.review.selecting;
  protected readonly selectedCount = this.review.selectedCount;

  protected readonly allZones = ZONES;
  protected readonly zoneName = (zone: Zone) => ZONE_NAMES[zone];

  constructor() {
    void this.review.load();
  }

  protected selectionIn(zone: Zone): 'all' | 'some' | 'none' {
    return this.review.selectionIn(zone);
  }

  protected selectZone(zone: Zone, on: boolean): void {
    this.review.selectZone(zone, on);
  }

  protected clearSelection(): void {
    this.review.clearSelection();
  }

  protected reviewedAll(): void {
    void this.review.reviewedAll();
  }

  protected moveAll(zone: Zone): void {
    void this.review.moveAll(zone);
  }

  protected deferAll(days: number): void {
    void this.review.deferAll(days);
  }
}
