import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  MAX_LABEL_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  ZONE_MEANINGS,
  ZONE_NAMES,
  ZONES,
  Zone,
  cutTo,
  openingLine,
  parseLabels,
  tooLongLabel,
} from '../api/model';
import { BoardStore } from '../board/board-store';

/**
 * Capture, and the Web Share Target. Android hands a share over as `?title=&text=&url=` (see
 * manifest.webmanifest); the URL goes to the notes, because a task called "https://…" tells you
 * nothing three days later.
 */
@Component({
  selector: 'app-capture-page',
  imports: [
    FormsModule,
    MatButton,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatLabel,
    MatOption,
    MatSelect,
  ],
  templateUrl: './capture-page.html',
  styleUrl: './capture-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapturePage {
  private readonly board = inject(BoardStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly zones = ZONES;
  protected readonly zoneName = (zone: Zone) => ZONE_NAMES[zone];
  protected readonly zoneMeaning = (zone: Zone) => ZONE_MEANINGS[zone];
  protected readonly lists = this.board.lists;
  protected readonly online = this.board.online;

  protected readonly title = signal('');
  protected readonly notes = signal('');
  protected readonly labels = signal('');
  protected readonly zone = signal<Zone>('OPPORTUNITY_NOW');

  /**
   * A sentinel rather than null, because a select shows nothing at all for null. Null is still
   * what goes over the wire — offline the inbox's id may not be known yet, and the server knows it.
   */
  protected readonly INBOX = -1;
  protected readonly listId = signal<number>(this.INBOX);

  /** The inbox is already offered as the sentinel above, so it must not appear twice. */
  protected readonly otherLists = computed(() => this.lists().filter((list) => !list.inbox));

  protected readonly inboxName = computed(
    () => this.lists().find((list) => list.inbox)?.name ?? 'Inbox',
  );
  protected readonly saved = signal(false);

  protected readonly maxTitleLength = MAX_TITLE_LENGTH;
  protected readonly maxNotesLength = MAX_NOTES_LENGTH;
  protected readonly maxLabelLength = MAX_LABEL_LENGTH;

  /** The cap is per topic but the input holds several, so it cannot sit on the field itself. */
  protected readonly labelTooLong = computed(() => tooLongLabel(this.labels()));

  /**
   * Told, not enforced: no `maxlength`, because a paste it silently cuts is the same silent loss
   * this exists to prevent. Counted in UTF-16 code units, like the `@Size` that decides the 400.
   */
  protected readonly titleTooLong = computed(() => this.title().trim().length > MAX_TITLE_LENGTH);
  protected readonly notesTooLong = computed(() => this.notes().trim().length > MAX_NOTES_LENGTH);

  protected readonly canSave = computed(
    () =>
      !!this.title().trim() && !this.titleTooLong() && !this.notesTooLong() && !this.labelTooLong(),
  );

  private readonly titleField = viewChild<ElementRef<HTMLInputElement>>('titleField');

  protected readonly loadOf = computed(() => {
    const section = this.board.zones().find((s) => s.zone === this.zone());
    return section && section.softCap !== null ? section : null;
  });

  constructor() {
    const shared = this.route.snapshot.queryParamMap;
    // `||` rather than `??`: a parameter sent but left blank comes back as '' or '   ', not null.
    const sharedText = shared.get('text')?.trim() || '';
    const sharedTitle = shared.get('title')?.trim() || sharedText;
    const sharedUrl = shared.get('url')?.trim() || '';

    // A share sometimes arrives with the link in `text` and nothing in `url`.
    const looksLikeUrl = /^https?:\/\/\S+$/.test(sharedTitle.trim());
    // A body too long or spanning lines goes to the notes instead. Newlines matter because an
    // <input> strips them from what it displays but not from what it saves.
    const bodyIsNotATitle =
      !looksLikeUrl && (sharedTitle.length > MAX_TITLE_LENGTH || sharedTitle.includes('\n'));

    this.title.set(looksLikeUrl ? '' : bodyIsNotATitle ? openingLine(sharedTitle) : sharedTitle);
    this.notes.set(
      cutTo(
        MAX_NOTES_LENGTH,
        // Sliced rather than refused: a share is handed to this screen, so nobody is here to
        // shorten it.
        [
          looksLikeUrl || bodyIsNotATitle ? sharedTitle : '',
          sharedText === sharedTitle ? '' : sharedText,
          sharedUrl,
        ]
          .filter(Boolean)
          .filter((part, at, all) => all.indexOf(part) === at)
          .join('\n'),
      ),
    );

    // Keyboard up on arrival — except when a share filled the title in, where the notes matter.
    afterNextRender(() => {
      if (!this.title().trim()) {
        this.titleField()?.nativeElement.focus();
      }
    });
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    const title = this.title().trim();
    await this.board.capture({
      title,
      notes: this.notes().trim(),
      zone: this.zone(),
      labels: parseLabels(this.labels()),
      listId: this.listId() === this.INBOX ? null : this.listId(),
    });
    this.saved.set(true);
    await this.router.navigateByUrl('/');
  }
}
