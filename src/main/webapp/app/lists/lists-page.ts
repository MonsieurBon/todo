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
    // Cleared only on success: the failure says what to change, and an emptied field takes the
    // advice away.
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
   * A 400's own sentence is shown as it stands: the fallback tells the reader to wait for a
   * connection, which is wrong for every 400 and points away from the one thing that would work.
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
   * A 404 is either no such list or no such account and the status cannot say which, so the caller
   * names what it asked for. A 400 carries two shapes: `invalid_request` is a sentence for a
   * person; `validation_failed` says only "Request body is invalid", so its fields are read out.
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
