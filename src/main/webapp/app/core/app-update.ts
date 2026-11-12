import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter, fromEvent, merge, pairwise } from 'rxjs';
import { Connectivity } from './connectivity';

export const RELOAD = new InjectionToken<() => void>('reload', {
  factory: () => () => location.reload(),
});

/** `broken`: the running version can no longer load its own files, so screens may fail to open. */
export type UpdateOffer = 'ready' | 'broken';

/**
 * A page keeps the code it was opened with until it is reloaded, and an installed app is resumed
 * far more often than it is opened, so it would talk to a changed server for days unless told. A
 * reload is offered rather than done, even for a broken version: only the user knows what it would
 * interrupt.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdate {
  private readonly sw = inject(SwUpdate);
  private readonly reload = inject(RELOAD);

  private readonly offered = signal<UpdateOffer | null>(null);

  readonly offer = this.offered.asReadonly();

  constructor() {
    if (!this.sw.isEnabled) {
      return;
    }
    this.sw.versionUpdates
      .pipe(
        filter((event) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.ready());
    this.sw.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => this.offered.set('broken'));
    // The worker checks only when it starts or a page is loaded, not when the server is back.
    merge(
      toObservable(inject(Connectivity).online).pipe(
        pairwise(),
        filter(([was, is]) => !was && is),
      ),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
      ),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.check());
  }

  apply(): void {
    this.reload();
  }

  private ready(): void {
    this.offered.update((offer) => offer ?? 'ready');
  }

  private async check(): Promise<void> {
    try {
      if (await this.sw.checkForUpdate()) {
        this.ready();
      }
    } catch {
      // A check the worker could not finish is no news; the next return asks again.
    }
  }
}
