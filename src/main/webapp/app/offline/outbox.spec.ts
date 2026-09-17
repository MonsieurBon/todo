// jsdom has no IndexedDB, and the outbox's whole point is that it survives a reload.
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
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

  beforeEach(() => {
    api = { capture: vi.fn(() => of({})), complete: vi.fn(() => of({})) };
    TestBed.configureTestingModule({ providers: [{ provide: TodoApi, useValue: api }] });
    // A fresh Outbox starts empty until load(); deleting the database would block on the previous
    // test's open connection.
    outbox = TestBed.inject(Outbox);
  });

  const fails = (status: number) => vi.fn(() => throwError(() => ({ status })));

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
});
