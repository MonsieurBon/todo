import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardView } from '../api/model';
import { TodoApi } from '../api/todo-api';
import { BoardStore } from './board-store';

/**
 * Folding the outbox into the board is where a captured task can go missing, appear twice, or
 * quietly not count towards the cap it belongs to. These are the three ways that goes wrong.
 */
describe('the board', () => {
  const board = (tasks: BoardView['tasks']): BoardView => ({
    zones: [
      { zone: 'CRITICAL_NOW', open: 0, softCap: 5, overSoftCap: false },
      { zone: 'OPPORTUNITY_NOW', open: 0, softCap: 20, overSoftCap: false },
      { zone: 'OVER_THE_HORIZON', open: 0, softCap: undefined, overSoftCap: false },
    ],
    tasks,
  });

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

  const load = async (tasks: BoardView['tasks']) => {
    api['board'] = vi.fn(() => of(board(tasks)));
    await store.refresh();
  };

  beforeEach(() => {
    api = {
      board: vi.fn(() => of(board([]))),
      lists: vi.fn(() => of([])),
      labels: vi.fn(() => of([])),
      capture: vi.fn(() => of({})),
      complete: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({ providers: [{ provide: TodoApi, useValue: api }] });
    store = TestBed.inject(BoardStore);
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

  it('takes a task off the board the moment its completion is queued', async () => {
    api['complete'] = vi.fn(() => {
      throw { status: 0 };
    });
    await load([task(1), task(2)]);

    await store.complete(store.tasks()[0]);

    expect(store.tasks().map((t) => t.id)).toEqual([2]);
    expect(store.zones()[0].open).toBe(1);
  });
});
