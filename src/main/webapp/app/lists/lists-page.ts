import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { TaskList } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { BoardStore } from '../board/board-store';

/** Only sharing can 404 on a person; every other call on this screen 404s on the list. */
const NO_ACCOUNT =
  'No account with that address yet. They have to sign in once before a list can be shared with them.';

/**
 * Lists, which exist to answer one question: who else can see this.
 *
 * <p>They are deliberately not topics. Topics are labels, because urgency has to be counted across
 * everything at once — a Critical Now cap enforced once per list would permit five urgent tasks per
 * project and call every list healthy. In practice that means very few lists: one private, and one
 * per person you share with.
 */
@Component({
  selector: 'app-lists-page',
  imports: [
    FormsModule,
    MatButton,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
  ],
  templateUrl: './lists-page.html',
  styleUrl: './lists-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListsPage {
  private readonly api = inject(TodoApi);
  private readonly board = inject(BoardStore);

  protected readonly lists = this.board.lists;
  protected readonly online = this.board.online;
  protected readonly newName = signal('');
  protected readonly sharingWith = signal<number | null>(null);
  protected readonly shareEmail = signal('');
  protected readonly problem = signal<string | null>(null);

  protected async create(): Promise<void> {
    const name = this.newName().trim();
    if (!name) {
      return;
    }
    // Cleared only when it worked. The failures now say what to change about the name, and a
    // field emptied under that message is advice the reader cannot take.
    if (await this.run(() => firstValueFrom(this.api.createList(name)))) {
      this.newName.set('');
    }
  }

  protected async rename(list: TaskList): Promise<void> {
    const name = prompt('Rename list', list.name)?.trim();
    if (name && name !== list.name) {
      await this.run(() => firstValueFrom(this.api.renameList(list.id, name)));
    }
  }

  protected async remove(list: TaskList): Promise<void> {
    if (confirm(`Delete "${list.name}" and every task on it?`)) {
      await this.run(() => firstValueFrom(this.api.deleteList(list.id)));
    }
  }

  protected startSharing(list: TaskList): void {
    this.sharingWith.set(list.id);
    this.shareEmail.set('');
  }

  protected async share(list: TaskList): Promise<void> {
    const email = this.shareEmail().trim();
    if (!email) {
      return;
    }
    if (await this.run(() => firstValueFrom(this.api.shareList(list.id, email)), NO_ACCOUNT)) {
      this.sharingWith.set(null);
    }
  }

  protected async unshare(list: TaskList, email: string): Promise<void> {
    await this.run(() => firstValueFrom(this.api.unshareList(list.id, email)), NO_ACCOUNT);
  }

  /**
   * The one place errors surface as words. Sharing fails for a reason worth reading — most often
   * that the person has never signed in, so there is no account to share with yet.
   *
   * <p>A 400 is the server refusing the input rather than failing, and it says why: a name another
   * list already holds, or one longer than the column. That sentence is shown as it stands,
   * because the fallback below tells the reader to wait for a connection — advice that is wrong
   * for every 400, and points away from the one thing that would work.
   */
  private async run(
    change: () => Promise<unknown>,
    missing = 'That list is no longer there.',
  ): Promise<boolean> {
    this.problem.set(null);
    try {
      await change();
      await this.board.refresh();
      return true;
    } catch (error) {
      this.problem.set(this.reasonFor(error, missing));
      return false;
    }
  }

  /**
   * A 404 means different things to different callers — no such list, or no such account — and
   * the server cannot distinguish them by status, so the caller says which it asked for.
   *
   * <p>A 400 is the server refusing the input, and it carries two shapes. `invalid_request` is a
   * sentence written for a person — a name another list holds — and is shown as it stands.
   * `validation_failed` is Bean Validation's own wording, per field, which is terse but true;
   * the top-level message on that one is only "Request body is invalid", so the fields are what
   * gets read out.
   */
  private reasonFor(error: unknown, missing: string): string {
    const failure = error as {
      status?: number;
      error?: { error?: string; message?: string; fields?: Record<string, string> };
    };
    if (failure.status === 404) {
      return missing;
    }
    if (failure.status === 400) {
      const body = failure.error;
      const fields = Object.values(body?.fields ?? {});
      return (
        (body?.error === 'validation_failed' ? fields.join(' ') : body?.message) ||
        fields.join(' ') ||
        body?.message ||
        'The server would not accept that.'
      );
    }
    return 'That did not work. Try again when you have a connection.';
  }
}
