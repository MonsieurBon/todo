import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

/** Whether the date is past is the server's to judge, by the app's day, not the device's. */
@Component({
  selector: 'app-defer-dialog',
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
  template: `
    <h2 mat-dialog-title>Defer until</h2>
    <form (ngSubmit)="defer()">
      <mat-dialog-content>
        <mat-form-field>
          <mat-label>Date</mat-label>
          <input
            matInput
            type="date"
            name="until"
            [ngModel]="until()"
            (ngModelChange)="until.set($event)"
          />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Cancel</button>
        <button matButton="filled" type="submit" [disabled]="!until()">Defer</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      padding-top: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeferDialog {
  static pick(dialog: MatDialog, current?: string): Promise<string | undefined> {
    return firstValueFrom(dialog.open(DeferDialog, { data: current }).afterClosed());
  }

  private readonly dialog = inject<MatDialogRef<DeferDialog, string>>(MatDialogRef);

  protected readonly until = signal(inject<string | undefined>(MAT_DIALOG_DATA) ?? '');

  protected defer(): void {
    if (this.until()) {
      this.dialog.close(this.until());
    }
  }
}
