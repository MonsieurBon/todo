import { ChangeDetectionStrategy, Component, computed, linkedSignal, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MAX_RECURRENCE_EVERY, Recurrence, RecurrenceUnit, unitName } from '../api/model';

const isValidEvery = (every: number | null): every is number =>
  Number.isInteger(every) && every! >= 1 && every! <= MAX_RECURRENCE_EVERY;

/**
 * How often a task repeats. An interval the server would refuse leaves the last valid value in
 * place rather than clearing it, so the form asks {@link invalid} before it saves.
 */
@Component({
  selector: 'app-repeat-field',
  imports: [FormsModule, MatFormField, MatHint, MatInput, MatLabel, MatOption, MatSelect],
  template: `
    <mat-form-field>
      <mat-label>Repeats</mat-label>
      <mat-select name="repeat" [ngModel]="unit()" (ngModelChange)="setUnit($event)">
        <mat-option [value]="null">Doesn’t repeat</mat-option>
        <mat-option value="DAYS">Daily</mat-option>
        <mat-option value="WEEKS">Weekly</mat-option>
        <mat-option value="MONTHS">Monthly</mat-option>
      </mat-select>
    </mat-form-field>

    @if (unit(); as unit) {
      <mat-form-field>
        <mat-label>Every … {{ unitName(unit, every() ?? 0) }}</mat-label>
        <input
          matInput
          type="number"
          name="every"
          min="1"
          [max]="max"
          [ngModel]="every()"
          (ngModelChange)="setEvery($event)"
        />
        @if (invalid()) {
          <mat-hint class="invalid">A whole number from 1 to {{ max }}.</mat-hint>
        }
      </mat-form-field>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 0.5rem;
    }

    mat-form-field {
      flex: 1;
    }

    // A hint rather than a mat-error, for the reason the topics field gives.
    .invalid {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepeatField {
  readonly recurrence = model<Recurrence | null>(null);

  protected readonly max = MAX_RECURRENCE_EVERY;
  protected readonly unitName = unitName;

  protected readonly unit = linkedSignal<RecurrenceUnit | null>(
    () => this.recurrence()?.unit ?? null,
  );
  protected readonly every = linkedSignal<number | null>(() => this.recurrence()?.every ?? 1);

  readonly invalid = computed(() => this.unit() !== null && !isValidEvery(this.every()));

  protected setUnit(unit: RecurrenceUnit | null): void {
    this.unit.set(unit);
    this.publish();
  }

  protected setEvery(every: number | null): void {
    this.every.set(every);
    this.publish();
  }

  private publish(): void {
    const unit = this.unit();
    const every = this.every();
    if (unit === null) {
      this.recurrence.set(null);
    } else if (isValidEvery(every)) {
      this.recurrence.set({ every, unit });
    }
  }
}
