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
import { ZONE_MEANINGS, ZONE_NAMES, ZONES, Zone } from '../api/model';
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

  private readonly titleField = viewChild<ElementRef<HTMLInputElement>>('titleField');

  protected readonly loadOf = computed(() => {
    const section = this.board.zones().find((s) => s.zone === this.zone());
    return section && section.softCap !== null ? section : null;
  });

  constructor() {
    const shared = this.route.snapshot.queryParamMap;
    const sharedTitle = shared.get('title') ?? shared.get('text') ?? '';
    const sharedUrl = shared.get('url') ?? '';
    // A share sometimes arrives with the link in `text` and nothing in `url`.
    const looksLikeUrl = /^https?:\/\/\S+$/.test(sharedTitle.trim());
    this.title.set(looksLikeUrl ? '' : sharedTitle);
    this.notes.set([looksLikeUrl ? sharedTitle : '', sharedUrl].filter(Boolean).join('\n'));

    // The whole screen exists to receive one line of text, so the keyboard should already be up —
    // except when a share already filled the title in, where the notes are what needs a look.
    afterNextRender(() => {
      if (!this.title()) {
        this.titleField()?.nativeElement.focus();
      }
    });
  }

  protected async save(): Promise<void> {
    const title = this.title().trim();
    if (!title) {
      return;
    }
    await this.board.capture({
      title,
      notes: this.notes().trim(),
      zone: this.zone(),
      labels: this.labels()
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean),
      listId: this.listId() === this.INBOX ? null : this.listId(),
    });
    this.saved.set(true);
    await this.router.navigateByUrl('/');
  }
}
