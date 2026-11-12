import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AppUpdate, UpdateOffer } from './core/app-update';
import { AuthService } from './auth/auth.service';
import { BoardStore } from './board/board-store';
import { Writes } from './core/writes';

describe('the app shell', () => {
  let writes: Writes;
  let update: {
    offer: ReturnType<typeof signal<UpdateOffer | null>>;
    apply: ReturnType<typeof vi.fn>;
  };

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
    update = { offer: signal<UpdateOffer | null>(null), apply: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AppUpdate, useValue: update },
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

  it('calls the app Todo', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.querySelector('mat-toolbar').textContent.trim()).toBe('Todo');
  });

  it('offers the sections as Board, Review, Capture, Lists', async () => {
    const fixture = await render();
    const tabs = [...fixture.nativeElement.querySelectorAll('nav.tabs a')].map((tab: Element) =>
      tab.textContent?.trim(),
    );

    expect(tabs).toEqual(['Board', 'Review', 'Capture', 'Lists']);
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

  it('offers a new version once it is ready, and reloads when asked', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('.update')).toBeNull();

    update.offer.set('ready');
    fixture.detectChanges();
    const note: HTMLElement = fixture.nativeElement.querySelector('.update');
    expect(note.textContent).toContain('A new version is ready');
    note.querySelector('button')!.click();

    expect(update.apply).toHaveBeenCalled();
  });

  it('says so when the running version is broken', async () => {
    const fixture = await render();

    update.offer.set('broken');
    fixture.detectChanges();

    const note: HTMLElement = fixture.nativeElement.querySelector('.update');
    expect(note.textContent).toContain('This version of the app can’t load all its parts.');
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.classList).toContain('broken');
  });

  /** Unlike a broken version, a new one can wait for whenever the user likes. */
  it('mentions a new version without raising an alarm', async () => {
    const fixture = await render();

    update.offer.set('ready');
    fixture.detectChanges();

    const note: HTMLElement = fixture.nativeElement.querySelector('.update');
    expect(note.getAttribute('role')).toBe('status');
    expect(note.classList).not.toContain('broken');
  });

  /** A screen reader announces an alert that appears, not a status that turns into one. */
  it('raises a new alert when a version that was ready turns out broken', async () => {
    const fixture = await render();
    update.offer.set('ready');
    fixture.detectChanges();
    const ready: HTMLElement = fixture.nativeElement.querySelector('.update');

    update.offer.set('broken');
    fixture.detectChanges();

    expect(ready.isConnected).toBe(false);
    expect(fixture.nativeElement.querySelector('.update').getAttribute('role')).toBe('alert');
  });
});
