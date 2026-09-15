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
 * Capture, and the Web Share Target.
 *
 * <p>This is the only way a task gets onto the list from a phone, so it has to work with no
 * connection and in as few taps as possible: type a title, press the button. Everything else on
 * this screen has a default that is right most of the time.
 *
 * <p>Android hands a share over as {@code ?title=&text=&url=} (see manifest.webmanifest). The URL
 * goes to the notes rather than the title, because a task called "https://…" tells you nothing
 * three days later.
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
  /** Opportunity Now by default: the method's answer for anything you have not thought about yet. */
  protected readonly zone = signal<Zone>('OPPORTUNITY_NOW');

  /**
   * The list to file into, where {@link INBOX} means "wherever the server keeps my inbox".
   *
   * <p>A sentinel rather than null because a select shows nothing at all for a null value, and a
   * blank "List" field invites the reader to wonder where their task went. Null is still what
   * goes over the wire — offline the inbox's id may not be known yet, and the server knows it.
   */
  protected readonly INBOX = -1;
  protected readonly listId = signal<number>(this.INBOX);

  /**
   * The inbox is offered as the sentinel above, so it must not also appear among the real lists —
   * it is one destination, and listing it twice invites the reader to wonder how the two differ.
   */
  protected readonly otherLists = computed(() => this.lists().filter((list) => !list.inbox));

  /** By its own name, so renaming it to something meaningful actually shows up here. */
  protected readonly inboxName = computed(
    () => this.lists().find((list) => list.inbox)?.name ?? 'Inbox',
  );
  protected readonly saved = signal(false);

  protected readonly maxTitleLength = MAX_TITLE_LENGTH;
  protected readonly maxNotesLength = MAX_NOTES_LENGTH;
  protected readonly maxLabelLength = MAX_LABEL_LENGTH;

  /**
   * The one field a length cap cannot be put on directly, because the cap is per topic and the
   * input holds several. It has to be caught here: a capture is queued and replayed, and the
   * outbox reads the server's 400 as a settled answer and drops the entry — so a label the server
   * refuses is a task reported saved and then silently lost.
   */
  protected readonly labelTooLong = computed(() => tooLongLabel(this.labels()));

  /**
   * Said rather than enforced: there is deliberately no `maxlength` on either field, because a
   * paste it silently cuts to 255 is the same loss this whole change is about — the user does not
   * find out. They are told instead, and {@link canSave} keeps it out of the outbox meanwhile.
   *
   * <p>Measured in UTF-16 code units because that is what the server's `@Size` counts, which is
   * what decides the 400 this exists to avoid. The entity counts characters and is therefore
   * looser; erring on the stricter side is the safe direction.
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
    // Trimmed, and `||` rather than `??`: a parameter that was sent but left blank comes back as
    // '' or '   ' rather than null, and neither is a title. Without both halves it is kept, and
    // the share dead-ends on a field that looks empty and a button that will not go.
    const sharedText = shared.get('text')?.trim() || '';
    const sharedTitle = shared.get('title')?.trim() || sharedText;
    const sharedUrl = shared.get('url')?.trim() || '';

    // A share sometimes arrives with the link in `text` and nothing in `url`.
    const looksLikeUrl = /^https?:\/\/\S+$/.test(sharedTitle.trim());
    // And often with no usable title, so the whole shared body lands there. A body that will not
    // fit, or that runs to more than one line, goes to the notes with its opening line promoted.
    // Length is the obvious half; newlines matter because an <input> strips them from what it
    // displays but not from what gets saved, so the field would show one string and store another.
    const bodyIsNotATitle =
      !looksLikeUrl && (sharedTitle.length > MAX_TITLE_LENGTH || sharedTitle.includes('\n'));

    this.title.set(looksLikeUrl ? '' : bodyIsNotATitle ? openingLine(sharedTitle) : sharedTitle);
    this.notes.set(
      cutTo(
        MAX_NOTES_LENGTH,
        // A selection shared out of a browser arrives as `text` alongside its own `title`, so the
        // passage has to be kept as well as the headline. Sliced rather than refused: a share is
        // handed to this screen rather than typed into it, so there is nobody here to shorten it.
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

    // The whole screen exists to receive one line of text, so the keyboard should already be up —
    // except when a share already filled the title in, where the notes are what needs a look.
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
