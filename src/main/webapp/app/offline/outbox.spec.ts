// jsdom has no IndexedDB, and the outbox's whole point is that it survives a reload.
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { openDB } from 'idb';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoApi } from '../api/todo-api';
import { Outbox } from './outbox';

/**
 * The distinction that decides whether a captured task survives: an undelivered request stays
 * queued, a rejected one must not — otherwise it is retried until the end of time.
 */
describe('the outbox', () => {
  let api: { capture: ReturnType<typeof vi.fn>; complete: ReturnType<typeof vi.fn> };
  let outbox: Outbox;

  beforeEach(async () => {
    api = { capture: vi.fn(() => of({})), complete: vi.fn(() => of({})) };
    TestBed.configureTestingModule({ providers: [{ provide: TodoApi, useValue: api }] });
    outbox = TestBed.inject(Outbox);
    // The store outlives the Outbox that wrote it, and flush() reads the store — so empty it,
    // rather than relying on a fresh instance's empty signal. Deleting the whole database would
    // block on the previous test's open connection.
    await outbox.clear();
  });

  const fails = (status: number) => vi.fn(() => throwError(() => ({ status })));

  /** Written straight to the store, to control the keys the way a real run cannot. */
  const stored = (id: string, createdAt: number, title: string) => ({
    id,
    createdAt,
    title,
    kind: 'capture',
    notes: '',
    zone: 'CRITICAL_NOW',
    labels: [],
    listId: null,
  });

  it('sends a queued capture and forgets it', async () => {
    await outbox.enqueue({
      kind: 'capture',
      title: 'Fix the tile',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });

    expect(api.capture).toHaveBeenCalledTimes(1);
    expect(outbox.pending()).toHaveLength(0);
  });

  it('sends the capture under the reference the server deduplicates on', async () => {
    await outbox.enqueue({
      kind: 'capture',
      title: 'Fix the tile',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });

    const sent = api.capture.mock.calls[0][0] as { clientRef: string };
    expect(sent.clientRef).toBeTruthy();
  });

  it('keeps a write that could not be delivered', async () => {
    // Status 0 is what a fetch with no connection reports.
    api.capture = fails(0);
    await outbox.enqueue({
      kind: 'capture',
      title: 'Underground',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });

    expect(outbox.pending()).toHaveLength(1);
  });

  it('keeps a write the server could not answer', async () => {
    api.capture = fails(503);
    await outbox.enqueue({
      kind: 'capture',
      title: 'Server down',
      notes: '',
      zone: 'OPPORTUNITY_NOW',
      labels: [],
      listId: null,
    });

    expect(outbox.pending()).toHaveLength(1);
  });

  it('keeps a write the token was not allowed to make', async () => {
    // 403 is a token that does not open this surface, which signing in again resolves. Ownership
    // answers 404 and validation 400, so nothing else reaches here to be retried forever.
    api.capture = fails(403);
    await outbox.enqueue({
      kind: 'capture',
      title: 'Filed mid-migration',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });

    expect(outbox.pending()).toHaveLength(1);
  });

  it('drops a completion for a task that is no longer there', async () => {
    // Deleted while this device was offline: retrying never succeeds, and the intent is met.
    api.complete = fails(404);
    await outbox.enqueue({ kind: 'complete', taskId: 42 });

    expect(outbox.pending()).toHaveLength(0);
  });

  it('sends a capture before the completion of the same task', async () => {
    const order: string[] = [];
    api.capture = vi.fn(() => {
      order.push('capture');
      return of({});
    });
    api.complete = vi.fn(() => {
      order.push('complete');
      return of({});
    });
    // Nothing is sent while unreachable, so both accumulate first.
    const unreachable = { status: 0 };
    api.capture.mockImplementationOnce(() => throwError(() => unreachable));
    api.complete.mockImplementationOnce(() => throwError(() => unreachable));

    await outbox.enqueue({
      kind: 'capture',
      title: 'Both in one stretch',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });
    await outbox.enqueue({ kind: 'complete', taskId: 7 });
    await outbox.flush();

    // Out of order, the completion would name a task the server has never heard of.
    expect(order.indexOf('capture')).toBeLessThan(order.indexOf('complete'));
  });

  /** The board renders the queue in signal order, and a reload fills it straight from the store. */
  it('comes back from a reload in the order the entries were made', async () => {
    const db = await openDB('todo-outbox', 1);
    // Keys deliberately disagree with the order they were made in; getAll returns them by key.
    await db.put('entries', stored('zzz', 1, 'Call the plumber'));
    await db.put('entries', stored('aaa', 2, 'Buy milk'));

    await outbox.load();

    expect(outbox.pendingCaptures().map((e) => e.title)).toEqual(['Call the plumber', 'Buy milk']);
  });

  /** The counter starts at zero on every instance, so a reload has to recover where it was. */
  it('does not undercut what is already queued when the clock steps back', async () => {
    const ahead = Date.now() + 60_000;
    const db = await openDB('todo-outbox', 1);
    await db.put('entries', { id: 'queued-before', kind: 'complete', createdAt: ahead, taskId: 3 });
    await outbox.load();

    api.capture = fails(0);
    api.complete = fails(0);
    await outbox.enqueue({
      kind: 'capture',
      title: 'After the correction',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });

    const added = outbox.pending().find((entry) => entry.kind === 'capture');
    expect(added?.createdAt).toBeGreaterThan(ahead);
  });

  /**
   * Each tab holds its own copy of the queue, and only the tab that signs in hears that the store
   * was emptied. Trusting that copy sends the previous user's writes under the new one's token.
   */
  it('sends nothing that another tab has already cleared', async () => {
    api.capture = fails(0);
    await outbox.enqueue({
      kind: 'capture',
      title: 'Queued before the handover',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });
    api.capture = vi.fn(() => of({}));

    // The other tab's clear(), which this one's signal knows nothing about.
    await (await openDB('todo-outbox', 1)).clear('entries');
    await outbox.flush();

    expect(api.capture).not.toHaveBeenCalled();
    expect(outbox.pending()).toHaveLength(0);
  });

  /**
   * Emptying the signal alone would pass every caller in sight and still leave the entries in the
   * store, where the next load brings them back — under whoever is signed in by then.
   */
  it('clears the store, not just what is in memory', async () => {
    api.capture = fails(0);
    await outbox.enqueue({
      kind: 'capture',
      title: 'Queued on a train',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });
    await outbox.enqueue({ kind: 'complete', taskId: 12 });
    expect(outbox.pending()).toHaveLength(2);

    await outbox.clear();

    expect(outbox.pending()).toHaveLength(0);
    await outbox.load();
    expect(outbox.pending()).toHaveLength(0);
  });
});
