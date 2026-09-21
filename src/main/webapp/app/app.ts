import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatToolbar } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { BoardStore } from './board/board-store';
import { Writes } from './core/writes';

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
  private readonly writes = inject(Writes);

  protected readonly signedIn = this.auth.signedIn;
  protected readonly account = this.auth.displayName;
  protected readonly online = this.board.online;
  protected readonly pending = this.board.pendingCount;
  protected readonly showingCached = this.board.showingCached;
  protected readonly problem = this.writes.problem;

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
    // The complaint belongs to the screen that caused it; leaving that screen answers it.
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.writes.dismiss();
      }
    });
    if (this.signedIn()) {
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

  protected dismissProblem(): void {
    this.writes.dismiss();
  }
}
