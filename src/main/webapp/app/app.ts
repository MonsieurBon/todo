import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatToolbar } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { BoardStore } from './board/board-store';

@Component({
  selector: 'app-root',
  imports: [
    MatButton,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatToolbar,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly board = inject(BoardStore);
  private readonly router = inject(Router);

  protected readonly signedIn = this.auth.signedIn;
  protected readonly account = this.auth.displayName;
  protected readonly online = this.board.online;
  protected readonly pending = this.board.pendingCount;
  protected readonly showingCached = this.board.showingCached;

  /** One line of truth about the connection, or nothing at all when everything is normal. */
  protected readonly connectionNote = computed(() => {
    const queued = this.pending();
    const changes = `${queued} ${queued === 1 ? 'change' : 'changes'}`;
    if (!this.online()) {
      return queued
        ? `Offline — ${changes} will sync`
        : 'Offline — showing the last board this device saw';
    }
    return queued ? `Syncing ${changes}` : null;
  });

  constructor() {
    if (this.signedIn()) {
      // Loads the outbox, sends anything queued, then fetches the board.
      void this.board.initialise();
      const returnUrl = this.auth.takeReturnUrl();
      if (returnUrl) {
        void this.router.navigateByUrl(returnUrl);
      }
    }
  }

  protected signIn(): void {
    this.auth.signIn('/');
  }

  protected signOut(): void {
    void this.auth.signOut();
  }

  protected sync(): void {
    void this.board.sync();
  }
}
