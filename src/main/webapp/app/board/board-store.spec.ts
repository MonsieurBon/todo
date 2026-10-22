import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { BoardView, Task, Zone } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { Connectivity } from '../core/connectivity';
import { Writes } from '../core/writes';
import { Outbox } from '../offline/outbox';
import { BoardStore } from './board-store';

/** Folding the outbox in: a task going missing, appearing twice, or not counting towards its cap. */
describe('the board', () => {
  /** Counted the way the server counts an unfiltered board, unless a test says otherwise. */
  const board = (tasks: BoardView['tasks'], critical?: number): BoardView => {
    const open = (zone: Zone) =>
      tasks.filter((task) => task.zone === zone && !task.deferUntil).length;
    const criticalNow = critical ?? open('CRITICAL_NOW');
    return {
      zones: [
        { zone: 'CRITICAL_NOW', open: criticalNow, softCap: 5, overSoftCap: criticalNow > 5 },
        {
          zone: 'OPPORTUNITY_NOW',
          open: open('OPPORTUNITY_NOW'),
          softCap: 20,
          overSoftCap: false,
        },
        {
          zone: 'OVER_THE_HORIZON',
          open: open('OVER_THE_HORIZON'),
          softCap: undefined,
          overSoftCap: false,
        },
      ],
      tasks,
    };
  };

  const task = (id: number, over: Partial<BoardView['tasks'][number]> = {}) => ({
    id,
    title: `Task ${id}`,
    zone: 'CRITICAL_NOW' as const,
    state: 'TODO' as const,
    listId: 1,
    listName: 'Inbox',
    labels: [],
    ...over,
  });

  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: BoardStore;
  let writes: Writes;
  const online = signal(true);

  const load = async (tasks: BoardView['tasks']) => {
    api['board'] = vi.fn(() => of(board(tasks)));
    await store.refresh();
  };

  beforeEach(async () => {
    api = {
      board: vi.fn(() => of(board([]))),
      lists: vi.fn(() => of([])),
      labels: vi.fn(() => of([])),
      capture: vi.fn(() => of({})),
      complete: vi.fn(() => of({})),
    };
    online.set(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: TodoApi, useValue: api },
        {
          provide: Connectivity,
          useValue: { online, probe: async () => online(), onReconnect: () => undefined },
        },
      ],
    });
    store = TestBed.inject(BoardStore);
    writes = TestBed.inject(Writes);
    // Shared with the previous test, and flush() reads it rather than this instance's signal.
    await TestBed.inject(Outbox).clear();
  });

  it('counts a queued capture towards its zone, so the cap still means something', async () => {
    await load([task(1), task(2), task(3), task(4), task(5)]);
    expect(store.zones()[0].overSoftCap).toBe(false);

    // Still on this device: the send did not get through.
    api['capture'] = vi.fn(() => {
      throw { status: 0 };
    });
    await store.capture({
      title: 'One more urgent thing',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });

    // Five saved plus one still on its way is six commitments for today either way.
    expect(store.zones()[0].open).toBe(6);
    expect(store.zones()[0].overSoftCap).toBe(true);
  });

  it('counts the whole zone under a filter, so a narrowed view cannot report itself healthy', async () => {
    store.narrowTo({ label: 'house' });
    api['board'] = vi.fn(() => of(board([task(1), task(2), task(3)], 12)));
    await store.refresh();

    expect(store.zones()[0].tasks).toHaveLength(3);
    expect(store.zones()[0].open).toBe(12);
    expect(store.zones()[0].overSoftCap).toBe(true);
  });

  it('counts a queued capture the filter hides, since it is a commitment all the same', async () => {
    store.narrowTo({ label: 'house' });
    await load([task(1)]);
    api['capture'] = vi.fn(() => {
      throw { status: 0 };
    });

    await store.capture({
      title: 'Not about the house',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });

    expect(store.zones()[0].tasks.map((t) => t.id)).toEqual([1]);
    expect(store.zones()[0].open).toBe(2);
  });

  it('shows a deferred task in its zone without counting it, so showing one moves no cap', async () => {
    await load([
      task(1),
      task(2, { deferUntil: '2999-01-01' }),
      // Sent only while it still hides the task, so the server's today decides, not this device's.
      task(3, { deferUntil: '2000-01-01' }),
    ]);

    expect(store.zones()[0].tasks.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(store.zones()[0].open).toBe(1);
  });

  it('shows a capture the server has acknowledged once, not twice', async () => {
    // The request arrived but the response did not, so the entry is still queued while the task
    // itself is already on the server. This is the case the clientRef exists for.
    api['capture'] = vi.fn(() => {
      throw { status: 0 };
    });
    await store.capture({
      title: 'Fix the tile',
      notes: '',
      zone: 'CRITICAL_NOW',
      labels: [],
      listId: null,
    });
    const sentRef = (api['capture'].mock.calls[0][0] as { clientRef: string }).clientRef;
    await load([task(1, { title: 'Fix the tile', clientRef: sentRef })]);

    expect(store.tasks().filter((t) => t.title === 'Fix the tile')).toHaveLength(1);
  });

  it('reloads after a refused write, so a row the server has moved on from corrects itself', async () => {
    await load([task(1), task(2)]);
    // Completed on another device: this board has not heard, and the move is refused.
    api['moveZone'] = vi.fn(() => {
      throw { status: 409, error: { error: 'task_completed' } };
    });
    api['board'] = vi.fn(() => of(board([task(2)])));

    const result = await store.moveZone(store.tasks()[0], 'OPPORTUNITY_NOW');

    expect(result).toBe('settled');
    expect(store.tasks().map((t) => t.id)).toEqual([2]);
  });

  /** The row correcting itself is not an answer: it looks the same as the click doing nothing. */
  it('says so when a write is refused because the task is gone', async () => {
    await load([task(1)]);
    api['moveZone'] = vi.fn(() => {
      throw { status: 404 };
    });

    const result = await store.moveZone(store.tasks()[0], 'OPPORTUNITY_NOW');

    expect(result).toBe('settled');
    expect(writes.problem()).toMatch(/completed or deleted/i);
  });

  it('leaves a write that never reached the server alone, and says that instead', async () => {
    await load([task(1)]);
    api['defer'] = vi.fn(() => {
      throw { status: 0 };
    });

    const result = await store.defer(store.tasks()[0], '2026-10-01');

    expect(result).toBe('refused');
    expect(writes.problem()).toMatch(/connection/i);
    expect(store.tasks().map((t) => t.id)).toEqual([1]);
  });

  it('clears the last complaint when the next write works, so it cannot outlive its cause', async () => {
    await load([task(1)]);
    api['defer'] = vi.fn(() => {
      throw { status: 0 };
    });
    await store.defer(store.tasks()[0], '2026-10-01');

    api['defer'] = vi.fn(() => of({}));
    await store.defer(store.tasks()[0], '2026-10-01');

    expect(writes.problem()).toBeNull();
  });

  /**
   * CLAUDE.md invites the next state refusal to reuse the 409, so the status alone cannot mean
   * "completed or deleted" — saying so would be false, and dropping the review card would lose a
   * decision nobody made.
   */
  it('treats a 409 that is not a completed task as a refusal, not as settled', async () => {
    await load([task(1)]);
    api['moveZone'] = vi.fn(() => {
      throw {
        status: 409,
        error: { error: 'zone_full', message: 'Critical Now is full; finish something first' },
      };
    });

    const result = await store.moveZone(store.tasks()[0], 'OPPORTUNITY_NOW');

    expect(result).toBe('refused');
    expect(writes.problem()).toBe('Critical Now is full; finish something first');
  });

  it('stops counting a task the moment its completion is queued', async () => {
    api['complete'] = vi.fn(() => {
      throw { status: 0 };
    });
    await load([task(1), task(2)]);

    await store.complete(store.tasks()[0]);

    expect(store.zones()[0].open).toBe(1);
  });

  /** An accidental complete is undone from where it happened, so the row has to stay there. */
  describe('a task completed from it', () => {
    const shown = () => store.tasks().map((t) => [t.id, !!t.done]);

    it('stays where it was, done, until the board is opened again', async () => {
      await load([task(1), task(2), task(3)]);

      api['board'] = vi.fn(() => of(board([task(1), task(3)])));
      await store.complete(store.tasks()[1]);

      expect(shown()).toEqual([
        [1, false],
        [2, true],
        [3, false],
      ]);
      expect(store.zones()[0].open).toBe(2);

      store.forgetCompleted();
      expect(shown()).toEqual([
        [1, false],
        [3, false],
      ]);
    });

    it('keeps its place when the one after it is completed too', async () => {
      await load([task(1), task(2), task(3), task(4)]);

      api['board'] = vi.fn(() => of(board([task(1), task(2), task(4)])));
      await store.complete(store.tasks()[2]);
      api['board'] = vi.fn(() => of(board([task(1), task(4)])));
      await store.complete(store.tasks()[1]);

      expect(shown()).toEqual([
        [1, false],
        [2, true],
        [3, true],
        [4, false],
      ]);
    });

    it('is reopened by the server once the completion was sent', async () => {
      await load([task(1)]);
      api['board'] = vi.fn(() => of(board([])));
      await store.complete(store.tasks()[0]);

      api['reopen'] = vi.fn(() => of({}));
      api['board'] = vi.fn(() => of(board([task(1)])));
      const result = await store.reopen(store.tasks()[0]);

      expect(result).toBe('done');
      expect(api['reopen']).toHaveBeenCalledWith(1);
      expect(shown()).toEqual([[1, false]]);
    });

    // Completing hands the repeat on to the next one, and undoing it takes neither back.
    it('stops repeating, and undoing it leaves the next one where it is', async () => {
      const monthly = { every: 1, unit: 'MONTHS' as const };
      await load([task(1, { recurrence: monthly, dueDate: '2026-11-01' })]);

      const next = task(2, { title: 'Task 1', recurrence: monthly, dueDate: '2026-12-01' });
      api['board'] = vi.fn(() => of(board([next])));
      await store.complete(store.tasks()[0]);

      expect(shown()).toEqual([
        [1, true],
        [2, false],
      ]);
      expect(store.tasks()[0].recurrence).toBeUndefined();

      api['reopen'] = vi.fn(() => of({}));
      api['board'] = vi.fn(() => of(board([task(1, { dueDate: '2026-11-01' }), next])));
      await store.reopen(store.tasks()[0]);

      expect(shown()).toEqual([
        [1, false],
        [2, false],
      ]);
      expect(store.tasks().map((t) => t.recurrence)).toEqual([undefined, monthly]);
    });

    it('stays done when the reopen does not get through, so it can be tried again', async () => {
      await load([task(1)]);
      api['board'] = vi.fn(() => of(board([])));
      await store.complete(store.tasks()[0]);

      api['reopen'] = vi.fn(() => {
        throw { status: 0 };
      });
      const result = await store.reopen(store.tasks()[0]);

      expect(result).toBe('refused');
      expect(shown()).toEqual([[1, true]]);
    });

    /** Reopening can then only follow its completion to the server, never race it there. */
    it('waits for its completion to be sent before it can be reopened', async () => {
      api['complete'] = vi.fn(() => {
        throw { status: 0 };
      });
      await load([task(1)]);
      await store.complete(store.tasks()[0]);
      expect(store.reopenable(store.tasks()[0])).toBe(false);

      api['reopen'] = vi.fn(() => of({}));
      expect(await store.reopen(store.tasks()[0])).toBe('refused');

      expect(api['reopen']).not.toHaveBeenCalled();
      expect(TestBed.inject(Outbox).pending()).toHaveLength(1);
      expect(shown()).toEqual([[1, true]]);
    });

    it('needs a connection to be reopened once its completion was sent', async () => {
      await load([task(1)]);
      api['board'] = vi.fn(() => of(board([])));
      await store.complete(store.tasks()[0]);

      expect(store.reopenable(store.tasks()[0])).toBe(true);
      online.set(false);
      expect(store.reopenable(store.tasks()[0])).toBe(false);
    });

    /** Taking it back off the device then would not stop it landing, and the row would be gone. */
    it('cannot be reopened while its completion is being sent', async () => {
      await load([task(1)]);
      const sent = new Subject<Task>();
      api['complete'] = vi.fn(() => sent);
      api['reopen'] = vi.fn(() => of({}));
      api['board'] = vi.fn(() => of(board([])));

      const completing = store.complete(store.tasks()[0]);
      await vi.waitFor(() => expect(api['complete']).toHaveBeenCalled());
      expect(store.reopenable(store.tasks()[0])).toBe(false);
      expect(await store.reopen(store.tasks()[0])).toBe('refused');
      expect(api['reopen']).not.toHaveBeenCalled();
      expect(shown()).toEqual([[1, true]]);

      sent.next(task(1, { state: 'DONE' }));
      sent.complete();
      await completing;
      expect(store.reopenable(store.tasks()[0])).toBe(true);
    });

    /** Completing ended the deferral on the server, so the row must not suggest a reopen keeps it. */
    it('is no longer deferred', async () => {
      await load([task(1, { deferUntil: '2999-01-01' })]);
      api['board'] = vi.fn(() => of(board([])));

      await store.complete(store.tasks()[0]);

      expect(store.tasks()[0].deferUntil).toBeUndefined();
    });

    it('is queued again when it was a capture that had not been sent', async () => {
      api['addToList'] = vi.fn(() => {
        throw { status: 0 };
      });
      await store.capture({
        title: 'Fix the tile',
        notes: 'the loose one',
        zone: 'OPPORTUNITY_NOW',
        labels: ['house'],
        listId: 1,
        recurrence: { every: 1, unit: 'WEEKS' },
      });
      await store.complete(store.tasks()[0]);
      expect(store.tasks().map((t) => [t.title, !!t.done])).toEqual([['Fix the tile', true]]);
      online.set(false);
      expect(store.reopenable(store.tasks()[0])).toBe(true);

      await store.reopen(store.tasks()[0]);

      // The same clientRef, so if the first one reached the server after all, this one is it.
      const [first, again] = api['addToList'].mock.calls.map(([, body]) => body.clientRef);
      expect(again).toBe(first);
      expect(store.tasks()).toEqual([
        expect.objectContaining({
          title: 'Fix the tile',
          notes: 'the loose one',
          zone: 'OPPORTUNITY_NOW',
          labels: ['house'],
          listId: 1,
          recurrence: { every: 1, unit: 'WEEKS' },
        }),
      ]);
      expect(api['addToList'].mock.calls[1][1].recurrence).toEqual({ every: 1, unit: 'WEEKS' });
      expect(store.tasks()[0].done).toBeUndefined();
      expect(store.zones()[1].open).toBe(1);
    });

    it('is not shown under a filter that does not match it', async () => {
      await load([task(1, { labels: ['house'] })]);
      api['board'] = vi.fn(() => of(board([])));
      await store.complete(store.tasks()[0]);

      store.narrowTo({ label: 'garden' });

      expect(store.tasks()).toEqual([]);
    });
  });
});
