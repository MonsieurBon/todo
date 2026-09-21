import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './auth/auth.service';
import { BoardStore } from './board/board-store';
import { Writes } from './core/writes';

/**
 * The one place a failed write is shown. Every screen reports through it, so the board and the
 * lists tests assert the signal and leave the rendering to this one.
 */
describe('the app shell', () => {
  let writes: Writes;

  const render = async (): Promise<ComponentFixture<App>> => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const shown = (fixture: ComponentFixture<App>) => {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.problem')?.textContent?.trim() ?? null;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'lists', children: [] }]),
        {
          provide: AuthService,
          useValue: {
            signedIn: signal(true),
            displayName: signal('Fabian'),
            takeReturnUrl: () => null,
            signOut: vi.fn(),
          },
        },
        {
          provide: BoardStore,
          useValue: {
            online: signal(true),
            pendingCount: signal(0),
            showingCached: signal(false),
            initialise: vi.fn(async () => undefined),
            sync: vi.fn(async () => undefined),
          },
        },
      ],
    });
    writes = TestBed.inject(Writes);
  });

  it('shows what went wrong with the last write', async () => {
    const fixture = await render();
    await writes.attempt(async () => {
      throw { status: 404 };
    }, 'That list is no longer there.');

    expect(shown(fixture)).toContain('That list is no longer there.');
  });

  it('says nothing while nothing has failed', async () => {
    expect(shown(await render())).toBeNull();
  });

  /** It belonged to the screen that caused it, and that screen is gone. */
  it('drops the complaint when the user moves to another screen', async () => {
    const fixture = await render();
    await writes.attempt(async () => {
      throw { status: 404 };
    }, 'That list is no longer there.');
    expect(shown(fixture)).not.toBeNull();

    await TestBed.inject(Router).navigateByUrl('/lists');
    await fixture.whenStable();

    expect(shown(fixture)).toBeNull();
  });

  it('drops the complaint once it is dismissed', async () => {
    const fixture = await render();
    await writes.attempt(async () => {
      throw { status: 0 };
    }, 'gone');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.problem button').click();

    expect(shown(fixture)).toBeNull();
  });
});
