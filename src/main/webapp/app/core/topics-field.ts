import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatChipGrid, MatChipInput, MatChipRemove, MatChipRow } from '@angular/material/chips';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MAX_LABEL_LENGTH, asTopic, parseLabels, tooLongLabel, unusableLabel } from '../api/model';

/**
 * For searching the offers, and nothing else. Being generous is the whole point here - it is how
 * typing `cafe` finds `Café` - and it costs at most an extra row in a list, where being too narrow
 * would hide a topic that exists. It says nothing about whether two topics are the same one; the
 * spelling decides that, here as in the column.
 *
 * <p>Hand-rolled because `Intl.Collator` folds more (ß against ss, ﬁ against fi) but only compares
 * whole strings, and this is a substring match - there is no accent-insensitive `includes`.
 */
const fold = (topic: string): string => topic.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Picking topics. The dropdown is an offer rather than the set of allowed values — topics are
 * invented as they are needed, and a board that only ever reuses its existing ones would be a
 * different thing.
 *
 * <p>The panel opens upwards on purpose: left to choose, it covers whatever sits below the field,
 * and in both forms using this that is the button which saves. A tap meant for the button lands on
 * an option instead.
 *
 * <p>Nothing is committed on blur, deliberately. Material's chip input emits its token on blur
 * without knowing the panel is open, so clicking an offer committed the half-typed text as well as
 * the offer - two chips from one tap, and the half-typed one reaching the server. The form asks for
 * {@link commitPending} before it reads the value, which covers what blur was there for.
 */
@Component({
  selector: 'app-topics-field',
  imports: [
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatChipGrid,
    MatChipInput,
    MatChipRemove,
    MatChipRow,
    MatFormField,
    MatHint,
    MatIcon,
    MatLabel,
    MatOption,
  ],
  templateUrl: './topics-field.html',
  styles: `
    :host {
      display: block;
    }

    mat-form-field {
      width: 100%;
    }

    // A hint rather than a mat-error: mat-error renders only when the control's own errorState is
    // true, which needs a validator and a touched field. What a topic is too long for is a rule
    // only this component knows, so an error there would never be shown.
    .too-long {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopicsField {
  readonly topics = model<string[]>([]);
  readonly known = input<string[]>([]);

  protected readonly separators = [COMMA, ENTER];
  protected readonly maxLabelLength = MAX_LABEL_LENGTH;

  /** Typed but not yet a chip. Held here too, because the panel filters on it. */
  private readonly pending = signal('');
  private readonly pendingInput = viewChild<ElementRef<HTMLInputElement>>('pendingInput');

  /**
   * Told, not enforced: no `maxlength`, because a paste it silently cuts is the same silent loss
   * the limit exists to prevent. Counted in UTF-16 code units, like the `@Size` that decides the
   * 400.
   */
  protected readonly tooLong = computed(() => tooLongLabel(this.pending()));
  protected readonly unusable = computed(() => unusableLabel(this.pending()));

  /** For the form: text that cannot become a chip must not be left behind by a save. */
  readonly invalid = computed(() => this.tooLong() !== null || this.unusable() !== null);

  protected readonly suggestions = computed(() => {
    // Held exactly, searched loosely: a topic already picked is not worth offering again, but a
    // different spelling of it is a different topic and still worth reusing.
    const chosen = new Set(this.topics().map(asTopic));
    const typed = fold(this.pending().trim());
    return this.known().filter(
      (topic) => !chosen.has(asTopic(topic)) && fold(topic).includes(typed),
    );
  });

  /** Called by the form before it reads the value, so unconfirmed text is not dropped in silence. */
  commitPending(): void {
    this.commit(this.pending());
  }

  /**
   * Split as it arrives rather than when it is confirmed, so a pasted list is chips straight away.
   * Everything before the last comma is finished; what follows it is still being typed, and stays
   * in the input where it can be edited.
   */
  protected typed(value: string): void {
    const lastSeparator = value.lastIndexOf(',');
    if (lastSeparator < 0) {
      this.pending.set(value);
      return;
    }
    if (!this.commit(value.slice(0, lastSeparator))) {
      // Refused, so the text stays put: the hint names the offender and `invalid` keeps the form
      // shut. Overwriting it with the tail would throw away the part that was fine as well.
      this.pending.set(value);
      return;
    }
    // trimStart only, and only here: mid-word a space is being typed on purpose, but the one
    // after a separator is just how a list is written.
    this.keepTyping(value.slice(lastSeparator + 1).trimStart());
  }

  /** False when it refused the text, which is then left where it is rather than lost. */
  protected commit(raw: string): boolean {
    const parsed = parseLabels(raw);
    if (tooLongLabel(raw) !== null || unusableLabel(raw) !== null) {
      return false;
    }
    if (parsed.length) {
      this.topics.update((current) => {
        const held = new Set(current.map(asTopic));
        const kept = [...current];
        for (const topic of parsed.map(asTopic)) {
          if (!held.has(topic)) {
            held.add(topic);
            kept.push(topic);
          }
        }
        return kept;
      });
    }
    this.clearPending();
    return true;
  }

  /**
   * Safe to clear what is being typed, because there is nothing there worth keeping: a refused
   * paste sits in `pending` commas and all, and no known topic contains that string, so the panel
   * has no options and this cannot be reached. A `suggestions` that matched more loosely would
   * break that and wipe the text the hint is asking the user to fix.
   */
  protected pick(topic: string): void {
    this.commit(topic);
  }

  protected remove(topic: string): void {
    this.topics.update((current) => current.filter((held) => held !== topic));
  }

  private clearPending(): void {
    this.keepTyping('');
  }

  /** The input is not bound to the signal, so both copies have to be set. */
  private keepTyping(rest: string): void {
    this.pending.set(rest);
    const field = this.pendingInput()?.nativeElement;
    if (field) {
      field.value = rest;
    }
  }
}
