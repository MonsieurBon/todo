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
import { Writes } from '../core/writes';

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
  private readonly writes = inject(Writes);

  protected readonly lists = this.board.lists;
  protected readonly online = this.board.online;
  protected readonly newName = signal('');
  protected readonly sharingWith = signal<number | null>(null);
  protected readonly shareEmail = signal('');

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

  private async run(
    change: () => Promise<unknown>,
    missing = 'That list is no longer there.',
  ): Promise<boolean> {
    if ((await this.writes.attempt(change, missing)) !== 'done') {
      return false;
    }
    await this.board.refresh();
    return true;
  }
}
