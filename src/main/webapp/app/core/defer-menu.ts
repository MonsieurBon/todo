import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenu, MatMenuItem } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { Deferral } from '../api/model';
import { DeferDialog } from './defer-dialog';

const CHOICES = [
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
  { label: 'In a month', days: 30 },
];

@Component({
  selector: 'app-defer-menu',
  imports: [MatMenu, MatMenuItem],
  template: `
    <mat-menu>
      @if (offerNow()) {
        <button mat-menu-item type="button" (click)="now.emit()">Now</button>
      }
      @for (choice of choices; track choice.days) {
        <button mat-menu-item type="button" (click)="defer()({ days: choice.days })">
          {{ choice.label }}
        </button>
      }
      <button mat-menu-item type="button" aria-haspopup="dialog" (click)="pick()">
        Pick a date…
      </button>
    </mat-menu>
  `,
  styles: `
    :host {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeferMenu {
  private readonly dialog = inject(MatDialog);

  readonly menu = viewChild.required(MatMenu);

  readonly deferredUntil = input<string>();
  readonly offerNow = input(false);
  /** Not an output: one emitted once the dialog closes is lost if the host is gone by then. */
  readonly defer = input.required<(deferral: Deferral) => unknown>();

  readonly now = output();

  protected readonly choices = CHOICES;

  protected async pick(): Promise<void> {
    // The dialog gives focus back to whatever held it on opening, so not to this item.
    await firstValueFrom(this.menu().closed);
    const until = await DeferDialog.pick(this.dialog, this.deferredUntil());
    if (until) {
      this.defer()({ until });
    }
  }
}
