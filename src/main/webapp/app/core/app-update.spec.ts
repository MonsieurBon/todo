import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUpdate, RELOAD } from './app-update';
import { Connectivity } from './connectivity';

describe('a new version of the app', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<unknown>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let visibility: DocumentVisibilityState;
  let online: ReturnType<typeof signal<boolean>>;

  const configure = (isEnabled = true) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: { isEnabled, versionUpdates, unrecoverable, checkForUpdate },
        },
        { provide: RELOAD, useValue: reload },
        { provide: Connectivity, useValue: { online } },
      ],
    });
    return TestBed.inject(AppUpdate);
  };

  const settle = () => new Promise((resolve) => setTimeout(resolve));

  const comeBack = async () => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
  };

  beforeEach(() => {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    checkForUpdate = vi.fn(async () => false);
    reload = vi.fn();
    visibility = 'hidden';
    online = signal(false);
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });

  afterEach(() => vi.restoreAllMocks());

  it('is offered once it is ready', () => {
    const update = configure();
    expect(update.offer()).toBeNull();

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(update.offer()).toBe('ready');
  });

  /** Resuming an app need not restart its worker, so the worker may never ask by itself. */
  it('is asked for when the app comes back to the foreground', async () => {
    const update = configure();
    checkForUpdate.mockResolvedValue(true);

    await comeBack();

    expect(update.offer()).toBe('ready');
  });

  /** A deploy takes the server away and brings it back while the device stays online. */
  it('is asked for when the server can be reached again', async () => {
    const update = configure();
    TestBed.tick();
    checkForUpdate.mockResolvedValue(true);

    online.set(true);
    TestBed.tick();
    await settle();

    expect(update.offer()).toBe('ready');
  });

  it('is not asked for when the connection is lost', async () => {
    online.set(true);
    configure();
    TestBed.tick();

    online.set(false);
    TestBed.tick();
    await settle();

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  /** Found but not yet downloaded, a reload would only bring back the version already running. */
  it('is not offered before it has downloaded', () => {
    const update = configure();

    versionUpdates.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'old' } });
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });

    expect(update.offer()).toBeNull();
  });

  it('is not asked for when the app goes to the background', async () => {
    configure();

    document.dispatchEvent(new Event('visibilitychange'));
    await settle();

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('is not offered when there is none', async () => {
    const update = configure();

    await comeBack();

    expect(update.offer()).toBeNull();
  });

  /** A check the worker could not finish is no news, not something to report. */
  it('takes a failed check for no news', async () => {
    const update = configure();
    checkForUpdate.mockRejectedValue(new Error('offline'));

    await comeBack();

    expect(update.offer()).toBeNull();
  });

  /** Only the user knows whether now is a good moment. */
  it('never takes over by itself', async () => {
    configure();
    checkForUpdate.mockResolvedValue(true);

    await comeBack();
    await comeBack();

    expect(reload).not.toHaveBeenCalled();
  });

  it('takes over when the user asks', () => {
    const update = configure();

    update.apply();

    expect(reload).toHaveBeenCalled();
  });

  /** It can no longer load its own files, but only the user knows what a reload would cut off. */
  it('says when the running version is broken, and leaves the reload to the user', () => {
    const update = configure();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'gone' });

    expect(update.offer()).toBe('broken');
    expect(reload).not.toHaveBeenCalled();
  });

  it('keeps saying the running version is broken when a new one is ready', () => {
    const update = configure();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'gone' });

    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(update.offer()).toBe('broken');
  });

  /** A deploy readies the new version first; the old one breaks only at its next missing part. */
  it('says the running version is broken when a new one was already ready', () => {
    const update = configure();
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'gone' });

    expect(update.offer()).toBe('broken');
  });

  it('is not looked for without a service worker', async () => {
    const update = configure(false);

    await comeBack();

    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(update.offer()).toBeNull();
  });
});
