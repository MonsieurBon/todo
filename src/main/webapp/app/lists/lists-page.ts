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
    await this.run(() => firstValueFrom(this.api.createList(name)));
    this.newName.set('');
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
    await this.run(() => firstValueFrom(this.api.shareList(list.id, email)));
    this.sharingWith.set(null);
  }

  protected async unshare(list: TaskList, email: string): Promise<void> {
    await this.run(() => firstValueFrom(this.api.unshareList(list.id, email)));
  }

  /**
   * The one place errors surface as words. Sharing fails for a reason worth reading — most often
   * that the person has never signed in, so there is no account to share with yet.
   */
  private async run(change: () => Promise<unknown>): Promise<void> {
    this.problem.set(null);
    try {
      await change();
      await this.board.refresh();
    } catch (error) {
      const status = (error as { status?: number }).status;
      this.problem.set(
        status === 404
          ? 'No account with that address yet. They have to sign in once before a list can be shared with them.'
          : 'That did not work. Try again when you have a connection.',
      );
    }
  }
}
